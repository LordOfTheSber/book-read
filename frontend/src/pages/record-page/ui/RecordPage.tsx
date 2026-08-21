import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Breadcrumb, Button, Form, Grid, Result, Skeleton, Space, Tabs, Typography, theme } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { LibraryItem, MediaKind, ProgressUnit } from '@/shared/types/library';
import { fetchBook, loadBooks, updateBookThunk } from '@/entities/book';
import { loadAuthors } from '@/entities/author';
import { loadSeries } from '@/entities/series';
import { loadTags } from '@/entities/tag';
import { loadShelves } from '@/entities/shelf';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { useRequestError } from '@/shared/lib/errors';
import { LoansTab, ProgressTab, QuotesTab, RatingTab } from '@/widgets/book-form';
import { BookFormValues, BookRequest, bookRequestFields } from '@/widgets/book-form/model/requestFields';
import { RecordState } from '@/widgets/record-state';
import { MOBILE_TAB_BAR_HEIGHT } from '@/widgets/mobile-nav';
import { formatDateTime } from '@/shared/lib/date';
import { RecordCardTab } from './RecordCardTab';

/** Ширина колонки состояния из макета: обложка, статус и прогресс встают в неё без переносов. */
const STATE_WIDTH = 292;

/** Даты в форме — объекты dayjs, а на сервер уходят строками. */
const toDate = (value?: string) => (value ? dayjs(value) : undefined);
const fromDate = (value?: dayjs.Dayjs | null) => (value ? value.format('YYYY-MM-DD') : undefined);

/**
 * Запись — своя страница с адресом, а не выдвижная панель.
 *
 * У панели адреса не было: на запись нельзя было дать ссылку, открыть её в новой вкладке или
 * вернуться к ней после перезагрузки. Слева стоит состояние записи, справа — поля во вкладках:
 * «где я в этой книге» и «что про неё записано» — разные вопросы, и делить одну колонку им незачем.
 */
export const RecordPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [form] = Form.useForm<BookFormValues>();

  const listed = useAppSelector((state) => state.books.items.find((book) => book.id === id));
  const filters = useAppSelector((state) => state.bookFilters);
  const [fetched, setFetched] = useState<LibraryItem>();
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string>();
  const [tab, setTab] = useState('card');

  /*
   * Запись из списка главнее дозагруженной: заход на вкладке «Прогресс» перечитывает список, и
   * страница должна показывать позицию после захода, а не ту, что приехала при открытии.
   */
  const item = listed ?? fetched;

  useEffect(() => {
    dispatch(loadAuthors());
    dispatch(loadSeries());
    dispatch(loadTags());
    dispatch(loadShelves());
  }, [dispatch]);

  useEffect(() => {
    if (!id || listed) return;
    let cancelled = false;
    setLoading(true);
    setMissing(false);
    fetchBook(id)
      .then((loaded) => {
        if (!cancelled) setFetched(loaded);
      })
      .catch(() => {
        // Прямая ссылка на удалённую или чужую запись — это «не найдено», а не сбой страницы.
        if (!cancelled) setMissing(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, listed]);

  /** Разложить сохранённую запись по полям формы: и при открытии, и по кнопке «Отменить». */
  const fillForm = useCallback(
    (source: LibraryItem) => {
      form.setFieldsValue({
        ...source,
        // Авторы и серия ездят именами: сервер сам находит существующих и заводит новых.
        authorNames: (source.authors ?? []).map((author) => author.name),
        tagNames: (source.tags ?? []).map((tag) => tag.name),
        shelfIds: (source.shelves ?? []).map((shelf) => shelf.id),
        startedAt: toDate(source.startedAt),
        finishedAt: toDate(source.finishedAt),
        deadline: toDate(source.deadline),
        // Текущей позиции в полях нет: её ведут заходы и смена статуса.
        progressTotal: source.progress?.total,
        progressUnit: source.progress?.unit
      } as BookFormValues);
    },
    [form]
  );

  const openedId = item?.id;
  useEffect(() => {
    if (item) fillForm(item);
    // Перезаполняем только при смене записи: правку в полях перечитанный список затирать не должен.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedId, fillForm]);

  const watchedTitle = Form.useWatch<string>('title', form);
  const watchedKind = Form.useWatch<MediaKind>('kind', form);
  const watchedFormat = Form.useWatch<LibraryItem['format']>('format', form);
  const watchedUnit = Form.useWatch<ProgressUnit>('progressUnit', form);

  const subtitle = useMemo(() => {
    if (!item) return '';
    const authors = (item.authors ?? []).map((author) => author.name).join(', ');
    const series = item.seriesName
      ? `${item.seriesName}${item.orderInSeries ? `, №${item.orderInSeries}` : ''}`
      : undefined;
    return [authors, series].filter(Boolean).join(' · ');
  }, [item]);

  const reloadRecord = useCallback(() => {
    dispatch(loadBooks(filters));
    fetchBook(id)
      .then(setFetched)
      // Перечитывание после захода — не то, из-за чего стоит показывать ошибку поверх страницы.
      .catch(() => undefined);
  }, [dispatch, filters, id]);

  const handleSave = async () => {
    if (!item) return;
    // Провал проверки — отказ промиса: без перехвата он всплывает как unhandled rejection.
    const valid = await form
      .validateFields()
      .then(() => true)
      .catch(() => false);
    if (!valid) {
      // Обязательное поле — название, а оно на вкладке «Карточка»: без перехода ошибку не видно.
      setTab('card');
      return;
    }
    /*
     * Значения берутся из хранилища формы по именам, а не из результата проверки: та возвращает
     * только смонтированные поля, и всё, что лежит в свёрнутом блоке «Издание» или на неоткрытой
     * вкладке «Оценка и отзыв», молча оставалось бы дома. Сервер принимает карточку целиком и
     * недосланное обнуляет — то есть потеря была бы не в интерфейсе, а в базе.
     */
    const values: BookFormValues = form.getFieldsValue([...bookRequestFields]);
    const payload: BookRequest = {
      ...values,
      startedAt: fromDate(values.startedAt),
      finishedAt: fromDate(values.finishedAt),
      deadline: fromDate(values.deadline)
    };
    setSaving(true);
    try {
      const updated = await dispatch(updateBookThunk({ id: item.id, payload })).unwrap();
      setFetched(updated);
      setSavedAt(new Date().toISOString());
      message.success('Данные обновлены');
      // Списки могли пополниться новыми авторами, сериями и тегами, а состав полок — измениться.
      dispatch(loadAuthors({ force: true }));
      dispatch(loadSeries({ force: true }));
      dispatch(loadTags({ force: true }));
      dispatch(loadShelves({ force: true }));
    } catch (error) {
      showRequestError(error, 'Не удалось сохранить запись');
    } finally {
      setSaving(false);
    }
  };

  if (missing) {
    return (
      <Result
        status="404"
        title="Запись не найдена"
        subTitle="Возможно, её удалили или ссылка ведёт на чужую библиотеку."
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            В библиотеку
          </Button>
        }
      />
    );
  }

  if (!item) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  /** Шапка записи: на телефоне она стоит над блоком состояния — по названию узнают, что открыто. */
  const heading = (
    <div style={{ minWidth: 0 }}>
      <Typography.Title level={1} style={{ fontSize: isMobile ? 24 : 30, margin: 0, lineHeight: 1.2 }}>
        {item.title}
      </Typography.Title>
      {subtitle && (
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 6 }}>
          {subtitle}
        </Typography.Text>
      )}
    </div>
  );

  const actions = (
    <Space size={10} wrap>
      {savedAt && (
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {`Сохранено ${formatDateTime(savedAt)}`}
        </Typography.Text>
      )}
      <Button onClick={() => fillForm(item)} disabled={saving}>
        Отменить
      </Button>
      <Button type="primary" loading={saving} onClick={handleSave}>
        Сохранить
      </Button>
    </Space>
  );

  return (
    <>
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[{ title: <Link to="/">Библиотека</Link> }, { title: item.title }]}
      />

      {isMobile && <div style={{ marginBottom: 12 }}>{heading}</div>}

      {/* component={false} — форма не рисует свой <form>, иначе формы заходов и выписок,
          живущие на соседних вкладках, оказались бы вложенными в неё. */}
      <Form form={form} component={false} layout="vertical">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexDirection: isMobile ? 'column' : 'row' }}>
          <div style={{ width: isMobile ? '100%' : STATE_WIDTH, flexShrink: 0 }}>
            <RecordState
              item={item}
              title={watchedTitle ?? item.title}
              kind={watchedKind ?? item.kind}
              onProgressChanged={reloadRecord}
              onOpenSessions={() => setTab('progress')}
              isMobile={isMobile}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            {!isMobile && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                  marginBottom: 16,
                  flexWrap: 'wrap'
                }}
              >
                {heading}
                {actions}
              </div>
            )}

            <Tabs
              activeKey={tab}
              onChange={setTab}
              items={[
                {
                  key: 'card',
                  label: 'Карточка',
                  children: <RecordCardTab item={item} kind={watchedKind} format={watchedFormat} unit={watchedUnit} />
                },
                {
                  key: 'progress',
                  label: 'Прогресс',
                  children: <ProgressTab item={item} onProgressChanged={reloadRecord} />
                },
                { key: 'review', label: 'Оценка и отзыв', children: <RatingTab item={item} form={form} /> },
                { key: 'quotes', label: 'Выписки', children: <QuotesTab item={item} /> },
                { key: 'loans', label: 'Выдачи', children: <LoansTab item={item} /> }
              ]}
            />
          </div>
        </div>
      </Form>

      {/* На телефоне кнопки прилипают к низу над нижней панелью: иначе до них надо прокручивать
          всю карточку, а сохранять хочется с любого места. */}
      {isMobile && (
        <div
          style={{
            position: 'sticky',
            bottom: `calc(${MOBILE_TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom))`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '10px 0',
            background: token.colorBgLayout
          }}
        >
          {actions}
        </div>
      )}

      {loading && <Skeleton active paragraph={{ rows: 1 }} style={{ marginTop: 12 }} />}
    </>
  );
};

import React, { useEffect, useMemo } from 'react';
import {
  App,
  AutoComplete,
  Button,
  Col,
  Collapse,
  DatePicker,
  Drawer,
  Form,
  Grid,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tabs,
  Tooltip,
  Typography,
  theme
} from 'antd';
import { InfoCircleOutlined, SearchOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ExternalBook, LibraryItem, MediaKind, ProgressUnit } from '@/shared/types/library';
import { statusOptions } from '@/shared/constants/status';
import {
  formatOptions,
  progressQuickSteps,
  progressUnitGenitive,
  progressUnitLabel,
  progressUnitName,
  progressUnitOptions,
  resolveProgressUnit
} from '@/shared/constants/format';
import { mediaKindOptionsWithIcon } from '@/shared/constants/mediaKind';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { updateBookThunk, uploadCoverFromUrl } from '@/entities/book';
import { loadAuthors } from '@/entities/author';
import { loadSeries } from '@/entities/series';
import { loadTags } from '@/entities/tag';
import { loadShelves } from '@/entities/shelf';
import { useRequestError } from '@/shared/lib/errors';
import { MetadataSearchModal } from '@/features/book/search-metadata';
import { BookFormValues, BookRequest, bookRequestFields } from '../model/requestFields';
import { CoverField } from './CoverField';
import { DuplicateHint } from './DuplicateHint';
import { ProgressTab } from './ProgressTab';
import { QuotesTab } from './QuotesTab';
import { LoansTab } from './LoansTab';
import { RatingTab } from './RatingTab';
import { loadBooks } from '@/entities/book';

interface Props {
  open: boolean;
  /** Панель правит уже существующую запись: новая заводится окном добавления. */
  editing: LibraryItem;
  onClose: () => void;
}

/** Ant Design по умолчанию рисует в пикере ISO-дату; остальной интерфейс — русский формат. */
const DATE_FORMAT = 'DD.MM.YYYY';

/** Даты в форме — объекты dayjs, а на сервер уходят строками. */
const toDate = (value?: string) => (value ? dayjs(value) : undefined);
const fromDate = (value?: dayjs.Dayjs | null) => (value ? value.format('YYYY-MM-DD') : undefined);

/** Подпись группы полей: она делит длинную форму на читаемые куски. */
const SectionLabel: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <Space size={6} align="center" style={{ marginBottom: 12 }}>
    <Typography.Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
      {children}
    </Typography.Text>
    {hint && (
      <Tooltip title={hint}>
        <InfoCircleOutlined style={{ fontSize: 12, opacity: 0.6 }} />
      </Tooltip>
    )}
  </Space>
);

export const BookFormDrawer: React.FC<Props> = ({ open, editing, onClose }) => {
  const dispatch = useAppDispatch();
  const types = useAppSelector((state) => state.bookTypes.list);
  const sources = useAppSelector((state) => state.sources.list);
  const authors = useAppSelector((state) => state.authors.list);
  const series = useAppSelector((state) => state.series.list);
  const tags = useAppSelector((state) => state.tags.list);
  const shelves = useAppSelector((state) => state.shelves.list);
  const filters = useAppSelector((state) => state.bookFilters);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message, modal } = App.useApp();
  const showRequestError = useRequestError();
  const [form] = Form.useForm();
  const [saving, setSaving] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  /**
   * Обложка из каталога у новой записи ждёт сохранения: адреса, по которому её положить,
   * до появления идентификатора попросту нет.
   */
  const [pendingCoverUrl, setPendingCoverUrl] = React.useState<string>();
  /**
   * Введено ли что-то с прошлого открытия. Панель закрывается по Esc и клику мимо неё, а карточка
   * длинная: промах мышью терял и название, и авторов, и отзыв — молча и без возможности вернуть.
   */
  const [dirty, setDirty] = React.useState(false);

  useEffect(() => {
    if (!open) return;
    dispatch(loadAuthors());
    dispatch(loadSeries());
    dispatch(loadTags());
    dispatch(loadShelves());
  }, [open, dispatch]);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      ...editing,
      typeId: editing.typeId,
      sourceId: editing.sourceId,
      // Авторы и серия ездят именами: сервер сам находит существующих и заводит новых.
      authorNames: (editing.authors ?? []).map((author) => author.name),
      tagNames: (editing.tags ?? []).map((tag) => tag.name),
      shelfIds: (editing.shelves ?? []).map((shelf) => shelf.id),
      seriesName: editing.seriesName,
      startedAt: toDate(editing.startedAt),
      finishedAt: toDate(editing.finishedAt),
      deadline: toDate(editing.deadline),
      // Текущей позиции в карточке нет: её ведут заходы и смена статуса на вкладке «Прогресс».
      progressTotal: editing.progress?.total,
      progressUnit: editing.progress?.unit
    });
    setPendingCoverUrl(undefined);
    // Подстановка значений — не правка пользователя: заполненная карточка редактирования
    // не должна на входе считаться изменённой.
    setDirty(false);
  }, [open, editing, form]);

  const authorOptions = useMemo(
    () => authors.map((author) => ({ label: author.name, value: author.name })),
    [authors]
  );
  const seriesOptions = useMemo(() => series.map((item) => ({ label: item.name, value: item.name })), [series]);
  const tagOptions = useMemo(() => tags.map((tag) => ({ label: tag.name, value: tag.name })), [tags]);
  // Полка, куда позвали читателем, в список не попадает: положить на неё запись всё равно
  // не дадут, а выбор, кончающийся отказом сервера, — худший вид подсказки.
  const shelfOptions = useMemo(
    () =>
      shelves
        .filter((shelf) => shelf.canContribute)
        .map((shelf) => ({ label: shelf.owned ? shelf.name : `${shelf.name} · @${shelf.ownerUsername}`, value: shelf.id })),
    [shelves]
  );

  // Заглушка обложки и подписи шкалы должны меняться вместе с вводом, а не после сохранения.
  const watchedTitle = Form.useWatch<string>('title', form);
  const watchedKind = Form.useWatch<MediaKind>('kind', form);
  const watchedFormat = Form.useWatch<LibraryItem['format']>('format', form);
  const watchedUnit = Form.useWatch<ProgressUnit>('progressUnit', form);
  // Подсказка о дублях следит за вводом: сообщать о них после сохранения уже поздно.
  const watchedIsbn = Form.useWatch<string>('isbn', form);

  /**
   * Находка каталога ложится в форму, а не сохраняется сама: год и число страниц у изданий
   * расходятся, и последнее слово всё равно за пользователем.
   */
  const applyExternal = (book: ExternalBook) => {
    // Целиком, а не только видимое: ISBN и год лежат в свёрнутом блоке, и «уже введённое»
    // из него иначе выглядело бы пустым — находка каталога затирала бы правку руками.
    const current = form.getFieldsValue(true);
    form.setFieldsValue({
      title: book.title,
      altTitle: book.altTitle ?? current.altTitle,
      authorNames: book.authorNames?.length ? book.authorNames : current.authorNames,
      isbn: book.isbn ?? current.isbn,
      publishedYear: book.publishedYear ?? current.publishedYear,
      language: book.language ?? current.language,
      pageCount: book.pageCount ?? current.pageCount,
      // Объём — это шкала прогресса: у книги из каталога другого источника для неё нет.
      progressTotal: current.progressTotal ?? book.pageCount
    });
    setPendingCoverUrl(book.coverUrl);
    // setFieldsValue не считается правкой формы, но терять заполненное из каталога так же обидно.
    setDirty(true);
    setSearchOpen(false);
    message.success(book.coverUrl ? 'Карточка заполнена, обложка подтянется при сохранении' : 'Карточка заполнена');
  };

  /** Обложку из каталога забирает сервер: у каталогов нет CORS, из браузера её не скачать. */
  const attachCoverFromCatalog = async (itemId: string) => {
    if (!pendingCoverUrl) return;
    try {
      await uploadCoverFromUrl(itemId, pendingCoverUrl);
    } catch {
      // Запись уже сохранена — терять её из-за недоехавшей картинки нельзя.
      message.warning('Запись сохранена, но обложку из каталога забрать не удалось');
    }
  };

  const effectiveUnit = resolveProgressUnit({
    kind: watchedKind ?? editing.kind,
    format: watchedFormat ?? editing.format,
    progressUnit: watchedUnit
  });
  const unitShort = progressUnitLabel[effectiveUnit];

  /** Закрытие с несохранённой правкой спрашивает подтверждение; чистую форму закрываем молча. */
  const requestClose = () => {
    if (!dirty) {
      onClose();
      return;
    }
    modal.confirm({
      title: 'Закрыть без сохранения?',
      content: 'Введённое в карточке будет потеряно.',
      okText: 'Закрыть',
      okButtonProps: { danger: true },
      cancelText: 'Вернуться к правке',
      onOk: onClose
    });
  };

  const handleSubmit = async () => {
    // Провал валидации — это отказ промиса: без перехвата он всплывает как unhandled rejection.
    const valid = await form
      .validateFields()
      .then(() => true)
      .catch(() => false);
    if (!valid) {
      return;
    }
    /*
     * Значения берутся из хранилища формы по именам, а не из результата проверки: та возвращает
     * только смонтированные поля, и всё, что лежит в свёрнутом блоке «Издание» или на неоткрытой
     * вкладке «Оценка и отзыв», молча оставалось бы дома. Сервер принимает карточку целиком и
     * недосланное обнуляет — то есть потеря была не в интерфейсе, а в базе.
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
      await dispatch(updateBookThunk({ id: editing.id, payload })).unwrap();
      await attachCoverFromCatalog(editing.id);
      message.success('Данные обновлены');
      // Списки могли пополниться новыми авторами, сериями и тегами, заведёнными по ходу сохранения.
      dispatch(loadAuthors({ force: true }));
      dispatch(loadSeries({ force: true }));
      dispatch(loadTags({ force: true }));
      // Счётчики на полках изменились вместе с составом.
      dispatch(loadShelves({ force: true }));
      onClose();
    } catch (error) {
      showRequestError(error, 'Не удалось сохранить запись');
    } finally {
      setSaving(false);
    }
  };

  /** Название, авторы и обложка — шапка карточки: с них запись и узнаётся. */
  const identityBlock = (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>
      {/* Обложка стоит первой, а не в конце формы: в списке запись узнают именно по ней. */}
      <CoverField item={editing} title={watchedTitle ?? editing.title} kind={watchedKind ?? editing.kind} />

      <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <Form.Item
            name="title"
            label="Название"
            rules={[{ required: true, message: 'Название обязательно' }]}
            style={{ flex: 1, minWidth: 0 }}
          >
            <Input placeholder="Например, «Задача трёх тел»" size="large" />
          </Form.Item>
          {/* Избранное — звездой рядом с названием: Switch посреди формы читался как ещё одно поле. */}
          <Form.Item name="favorite" valuePropName="checked">
            <FavoriteToggle />
          </Form.Item>
        </div>
        <Form.Item name="altTitle" label="Альтернативное название">
          <Input placeholder="Оригинальное название или перевод" />
        </Form.Item>
        {/* Автора можно ввести с клавиатуры: незнакомое имя заведётся на сервере само. */}
        <Form.Item name="authorNames" label="Авторы" tooltip="Новое имя можно ввести прямо здесь">
          <Select
            mode="tags"
            allowClear
            placeholder="Начните вводить имя"
            options={authorOptions}
            tokenSeparators={[',']}
          />
        </Form.Item>
        {/* Теги — контекст, а не жанр: жанр задаётся полем «Тип» из общего справочника. */}
        <Form.Item name="tagNames" label="Теги" tooltip="Свободные пометки: «на лето», «перечитать»">
          <Select
            mode="tags"
            allowClear
            placeholder="Начните вводить пометку"
            options={tagOptions}
            tokenSeparators={[',']}
          />
        </Form.Item>
      </div>
    </div>
  );

  /** Список желаемого отдельно от статуса «в планах»: «прочитать» и «купить» — разные вопросы. */
  const wishlistBlock = (
    <>
      <SectionLabel hint="Отдельно от статуса «в планах»: это не «собираюсь прочитать», а «надо купить»">
        Список желаемого
      </SectionLabel>
      <Row gutter={16}>
        <Col xs={24} sm={6}>
          <Form.Item name="wishlist" label="В желаемом" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} sm={6}>
          <Form.Item name="price" label="Цена">
            <InputNumber min={0} step={10} style={{ width: '100%' }} placeholder="899" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={4}>
          <Form.Item name="currency" label="Валюта">
            <Input placeholder="RUB" maxLength={8} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item name="purchaseUrl" label="Ссылка на покупку">
            <Input placeholder="https://…" maxLength={2048} />
          </Form.Item>
        </Col>
      </Row>
    </>
  );

  const cardTab = (
    <Space direction="vertical" size={0} style={{ display: 'flex' }}>
      {/* Дубли показываются до сохранения: сообщать о них после — уже поздно. */}
      <DuplicateHint title={watchedTitle} isbn={watchedIsbn} excludeId={editing.id} />
      {identityBlock}

      {/* Серия и полки — связи, а не издательские подробности: раньше серия лежала в свёрнутом
          блоке «Издание», и понять, как эта связь вообще заводится, было неоткуда. */}
      <SectionLabel hint="Серия заводится по названию сама; полка выбирается из уже созданных">
        Серия и полки
      </SectionLabel>
      <Row gutter={16}>
        <Col xs={24} sm={10}>
          {/* AutoComplete, а не Select: серия одна, и её название можно ввести руками. */}
          <Form.Item name="seriesName" label="Серия" tooltip="Новое название заведёт серию на сервере">
            <AutoComplete
              allowClear
              placeholder="Например, «Воспоминания о прошлом Земли»"
              options={seriesOptions}
              filterOption={(input, option) =>
                String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={5}>
          <Form.Item name="orderInSeries" label="Номер в серии" tooltip="Дробный номер для побочных повестей">
            <InputNumber min={0} step={0.5} style={{ width: '100%' }} placeholder="1" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={9}>
          {/* Полки — идентификаторами, а не именами: полка заводится осознанно, с описанием
              и признаком публичности, и плодить её опечаткой в карточке нельзя. */}
          <Form.Item
            name="shelfIds"
            label="Полки"
            tooltip="Наборы, собранные вручную. Новую полку заводят на странице «Полки и теги»"
          >
            <Select
              mode="multiple"
              allowClear
              placeholder={shelfOptions.length ? 'Не на полках' : 'Полок пока нет'}
              options={shelfOptions}
              optionFilterProp="label"
              notFoundContent="Полки создаются на странице «Полки и теги»"
            />
          </Form.Item>
        </Col>
      </Row>

      <SectionLabel hint="Вид задаёт единицу прогресса: у манги тома, у сериала эпизоды, у подкаста минуты">
        Что это и где взято
      </SectionLabel>
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item name="kind" label="Вид">
            <Select options={mediaKindOptionsWithIcon} optionFilterProp="title" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item name="typeId" label="Тип" tooltip="Жанр из справочника типов">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Не указан"
              options={types.map((t) => ({ label: t.name, value: t.id }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item name="sourceId" label="Источник">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Не указан"
              options={sources.map((s) => ({ label: s.name, value: s.id }))}
            />
          </Form.Item>
        </Col>
      </Row>

      <SectionLabel>Статус и шкала</SectionLabel>
      <Row gutter={16}>
        <Col xs={24} sm={10}>
          <Form.Item name="status" label="Статус" rules={[{ required: true }]}>
            <Select options={statusOptions.map((s) => ({ label: s.label, value: s.value }))} />
          </Form.Item>
        </Col>
        {/* Объём и единица переехали сюда из свёрнутого блока: без них не работают ни полоса
            прогресса, ни норма в день, ни быстрые «+N». */}
        <Col xs={12} sm={7}>
          <Form.Item
            name="progressTotal"
            label="Объём"
            tooltip={`Шкала прогресса целиком: ${progressUnitGenitive[effectiveUnit]}`}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="400" suffix={unitShort} />
          </Form.Item>
        </Col>
        <Col xs={12} sm={7}>
          <Form.Item
            name="progressUnit"
            label="Единица"
            tooltip="Своя единица главнее вида: аудиокнигу в томах никто не считает"
          >
            <Select allowClear placeholder={progressUnitName[effectiveUnit]} options={progressUnitOptions} />
          </Form.Item>
        </Col>
      </Row>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: -8 }}>
        {`Прогресс считается в единицах «${unitShort}»`}
        {watchedUnit ? '' : ' — по виду произведения'}
        {`; быстрые шаги на вкладке «Прогресс» — +${progressQuickSteps[effectiveUnit].join(', +')}.`}
      </Typography.Paragraph>

      <SectionLabel hint="Обычно даты проставляет сама смена статуса — здесь их можно поправить">
        Даты и срок
      </SectionLabel>
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item name="startedAt" label="Начато">
            <DatePicker style={{ width: '100%' }} format={DATE_FORMAT} placeholder="по статусу" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item name="finishedAt" label="Завершено">
            <DatePicker style={{ width: '100%' }} format={DATE_FORMAT} placeholder="по статусу" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item name="deadline" label="Дочитать к" tooltip="По сроку считается норма в день">
            <DatePicker style={{ width: '100%' }} format={DATE_FORMAT} placeholder="не задан" />
          </Form.Item>
        </Col>
      </Row>

      {wishlistBlock}

      {/* Издательские поля нужны не всегда, поэтому лежат свёрнутыми и не мешают быстрому вводу. */}
      <Collapse
        ghost
        items={[
          {
            key: 'edition',
            label: 'Издание и расположение',
            children: (
              <>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item name="isbn" label="ISBN">
                      <Input placeholder="9785171049676" maxLength={20} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="publishedYear" label="Год издания">
                      <InputNumber min={1} max={2999} style={{ width: '100%' }} placeholder="2006" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Form.Item name="language" label="Язык">
                      <Input placeholder="ru" maxLength={32} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      name="pageCount"
                      label="Страниц в издании"
                      tooltip="Справочное число страниц: шкалу прогресса задаёт поле «Объём»"
                    >
                      <InputNumber min={1} style={{ width: '100%' }} placeholder="400" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item name="format" label="Формат">
                      <Select allowClear placeholder="Не указан" options={formatOptions} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="translator" label="Переводчик">
                  <Input placeholder="Ольга Глушкова" maxLength={255} />
                </Form.Item>

                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item name="bookcase" label="Шкаф">
                      <Input placeholder="Гостиная" maxLength={255} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="shelf" label="Полка">
                      <Input placeholder="Вторая сверху" maxLength={255} />
                    </Form.Item>
                  </Col>
                </Row>
              </>
            )
          }
        ]}
      />
    </Space>
  );

  return (
    <Drawer
      title="Редактирование записи"
      open={open}
      onClose={requestClose}
      destroyOnHidden
      width={isMobile ? '100%' : 760}
      styles={{ body: { paddingTop: 12 } }}
      // Поиск по каталогам стоит в шапке: с него начинается ввод, а не заканчивается.
      extra={
        <Button icon={<SearchOutlined />} onClick={() => setSearchOpen(true)}>
          Найти в каталогах
        </Button>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '12px 24px' }}>
          <Button onClick={requestClose}>Отмена</Button>
          <Button type="primary" loading={saving} onClick={handleSubmit}>
            Сохранить
          </Button>
        </div>
      }
    >
      {/* component={false} — форма не рисует свой <form>, иначе формы заходов и выписок,
          живущие на соседних вкладках, оказались бы вложенными в неё. */}
      <Form
        component={false}
        layout="vertical"
        form={form}
        // onValuesChange срабатывает только на правку человеком: подстановка через
        // setFieldsValue его не вызывает, поэтому открытие карточки не считается изменением.
        onValuesChange={() => setDirty(true)}
      >
        <Tabs
          items={[
            { key: 'card', label: 'Карточка', children: cardTab },
            {
              key: 'progress',
              label: 'Прогресс',
              children: <ProgressTab item={editing} onProgressChanged={() => dispatch(loadBooks(filters))} />
            },
            { key: 'review', label: 'Оценка и отзыв', children: <RatingTab item={editing} form={form} /> },
            { key: 'quotes', label: 'Выписки', children: <QuotesTab item={editing} /> },
            { key: 'loans', label: 'Выдачи', children: <LoansTab item={editing} /> }
          ]}
        />
      </Form>

      <MetadataSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onPick={applyExternal} />
    </Drawer>
  );
};

interface FavoriteToggleProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

/** Звезда-переключатель: у избранного есть общепринятый знак, и Switch им не является. */
const FavoriteToggle: React.FC<FavoriteToggleProps> = ({ checked, onChange }) => {
  const { token } = theme.useToken();
  return (
    <Tooltip title={checked ? 'Убрать из избранного' : 'В избранное'}>
      <Button
        type="text"
        shape="circle"
        aria-label="Избранное"
        aria-pressed={Boolean(checked)}
        onClick={() => onChange?.(!checked)}
        icon={
          checked ? (
            <StarFilled style={{ color: token.colorWarning }} />
          ) : (
            <StarOutlined style={{ color: token.colorTextTertiary }} />
          )
        }
      />
    </Tooltip>
  );
};

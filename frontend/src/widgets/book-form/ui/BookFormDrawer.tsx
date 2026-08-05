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
  Tabs,
  Tooltip,
  Typography,
  theme
} from 'antd';
import { InfoCircleOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { LibraryItem, MediaKind, ProgressUnit } from '@/shared/types/library';
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
import { createBookThunk, updateBookThunk } from '@/entities/book';
import { loadAuthors } from '@/entities/author';
import { loadSeries } from '@/entities/series';
import { useRequestError } from '@/shared/lib/errors';
import { CoverField } from './CoverField';
import { ProgressTab } from './ProgressTab';
import { QuotesTab } from './QuotesTab';
import { RatingTab } from './RatingTab';
import { loadBooks } from '@/entities/book';

interface Props {
  open: boolean;
  /** null — создание новой книги. */
  editing: LibraryItem | null;
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
  const filters = useAppSelector((state) => state.bookFilters);
  const screens = Grid.useBreakpoint();
  const { token } = theme.useToken();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const [form] = Form.useForm();
  const [saving, setSaving] = React.useState(false);

  useEffect(() => {
    if (!open) return;
    dispatch(loadAuthors());
    dispatch(loadSeries());
  }, [open, dispatch]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        ...editing,
        typeId: editing.typeId,
        sourceId: editing.sourceId,
        // Авторы и серия ездят именами: сервер сам находит существующих и заводит новых.
        authorNames: (editing.authors ?? []).map((author) => author.name),
        seriesName: editing.seriesName,
        startedAt: toDate(editing.startedAt),
        finishedAt: toDate(editing.finishedAt),
        deadline: toDate(editing.deadline),
        progressCurrent: editing.progress?.current,
        progressTotal: editing.progress?.total,
        progressUnit: editing.progress?.unit
      });
    } else {
      form.resetFields();
    }
  }, [open, editing, form]);

  const authorOptions = useMemo(
    () => authors.map((author) => ({ label: author.name, value: author.name })),
    [authors]
  );
  const seriesOptions = useMemo(() => series.map((item) => ({ label: item.name, value: item.name })), [series]);

  // Заглушка обложки и подписи шкалы должны меняться вместе с вводом, а не после сохранения.
  const watchedTitle = Form.useWatch<string>('title', form);
  const watchedKind = Form.useWatch<MediaKind>('kind', form);
  const watchedFormat = Form.useWatch<LibraryItem['format']>('format', form);
  const watchedUnit = Form.useWatch<ProgressUnit>('progressUnit', form);

  const effectiveUnit = resolveProgressUnit({
    kind: watchedKind ?? editing?.kind,
    format: watchedFormat ?? editing?.format,
    progressUnit: watchedUnit
  });
  const unitShort = progressUnitLabel[effectiveUnit];

  const handleSubmit = async () => {
    // Провал валидации — это отказ промиса: без перехвата он всплывает как unhandled rejection.
    const values = await form.validateFields().catch(() => undefined);
    if (!values) {
      return;
    }
    const payload = {
      ...values,
      startedAt: fromDate(values.startedAt),
      finishedAt: fromDate(values.finishedAt),
      deadline: fromDate(values.deadline)
    };
    setSaving(true);
    try {
      if (editing) {
        await dispatch(updateBookThunk({ id: editing.id, payload })).unwrap();
        message.success('Данные обновлены');
      } else {
        await dispatch(createBookThunk(payload)).unwrap();
        message.success('Запись добавлена');
      }
      // Списки могли пополниться новыми авторами и сериями, заведёнными по ходу сохранения.
      dispatch(loadAuthors({ force: true }));
      dispatch(loadSeries({ force: true }));
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
      <CoverField item={editing} title={watchedTitle ?? editing?.title ?? ''} kind={watchedKind ?? editing?.kind} />

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
      </div>
    </div>
  );

  const cardTab = (
    <Space direction="vertical" size={0} style={{ display: 'flex' }}>
      {identityBlock}

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

      {/* Издательские поля нужны не всегда, поэтому лежат свёрнутыми и не мешают быстрому вводу. */}
      <Collapse
        ghost
        items={[
          {
            key: 'edition',
            label: 'Издание, серия и расположение',
            children: (
              <>
                <Row gutter={16}>
                  <Col xs={24} sm={16}>
                    {/* AutoComplete, а не Select: серия одна, и её название можно ввести руками. */}
                    <Form.Item name="seriesName" label="Серия">
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
                  <Col xs={24} sm={8}>
                    <Form.Item name="orderInSeries" label="Номер" tooltip="Дробный номер для побочных повестей">
                      <InputNumber min={0} step={0.5} style={{ width: '100%' }} placeholder="1" />
                    </Form.Item>
                  </Col>
                </Row>

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
      title={editing ? 'Редактирование записи' : 'Новая запись'}
      open={open}
      onClose={onClose}
      destroyOnHidden
      width={isMobile ? '100%' : 760}
      styles={{ body: { paddingTop: 12 } }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '12px 24px' }}>
          <Button onClick={onClose}>Отмена</Button>
          <Button type="primary" loading={saving} onClick={handleSubmit}>
            {editing ? 'Сохранить' : 'Добавить'}
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
        initialValues={{ status: 'PLANNED', favorite: false, kind: 'BOOK' }}
      >
        {/* Прогресс и выписки живут своими запросами, поэтому доступны только у сохранённой книги. */}
        {editing ? (
          <Tabs
            items={[
              { key: 'card', label: 'Карточка', children: cardTab },
              {
                key: 'progress',
                label: 'Прогресс',
                children: <ProgressTab item={editing} onProgressChanged={() => dispatch(loadBooks(filters))} />
              },
              { key: 'review', label: 'Оценка и отзыв', children: <RatingTab item={editing} form={form} /> },
              { key: 'quotes', label: 'Выписки', children: <QuotesTab item={editing} /> }
            ]}
          />
        ) : (
          <Space direction="vertical" size={0} style={{ display: 'flex' }}>
            {cardTab}
            <div
              style={{
                marginTop: 8,
                paddingTop: 16,
                borderTop: `1px solid ${token.colorBorderSecondary}`
              }}
            >
              <RatingTab item={null} form={form} />
            </div>
          </Space>
        )}
      </Form>
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

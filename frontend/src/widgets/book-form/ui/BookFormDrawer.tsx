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
  Rate,
  Row,
  Select,
  Switch,
  Tabs
} from 'antd';
import dayjs from 'dayjs';
import { LibraryItem } from '@/shared/types/library';
import { statusOptions } from '@/shared/constants/status';
import { formatOptions } from '@/shared/constants/format';
import { mediaKindOptions } from '@/shared/constants/mediaKind';
import { ratingCriteria } from '@/shared/constants/ratingCriteria';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { createBookThunk, updateBookThunk } from '@/entities/book';
import { loadAuthors } from '@/entities/author';
import { loadSeries } from '@/entities/series';
import { useRequestError } from '@/shared/lib/errors';
import { CoverField } from './CoverField';
import { ProgressTab } from './ProgressTab';
import { QuotesTab } from './QuotesTab';
import { ReviewBlock } from './ReviewBlock';
import { progressUnitOptions } from '@/shared/constants/format';
import { loadBooks } from '@/entities/book';

interface Props {
  open: boolean;
  /** null — создание новой книги. */
  editing: LibraryItem | null;
  onClose: () => void;
}

/** Даты в форме — объекты dayjs, а на сервер уходят строками. */
const toDate = (value?: string) => (value ? dayjs(value) : undefined);
const fromDate = (value?: dayjs.Dayjs | null) => (value ? value.format('YYYY-MM-DD') : undefined);

export const BookFormDrawer: React.FC<Props> = ({ open, editing, onClose }) => {
  const dispatch = useAppDispatch();
  const types = useAppSelector((state) => state.bookTypes.list);
  const sources = useAppSelector((state) => state.sources.list);
  const authors = useAppSelector((state) => state.authors.list);
  const series = useAppSelector((state) => state.series.list);
  const filters = useAppSelector((state) => state.bookFilters);
  const screens = Grid.useBreakpoint();
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
        message.success('Книга добавлена');
      }
      // Списки могли пополниться новыми авторами и сериями, заведёнными по ходу сохранения.
      dispatch(loadAuthors({ force: true }));
      dispatch(loadSeries({ force: true }));
      onClose();
    } catch (error) {
      showRequestError(error, 'Не удалось сохранить книгу');
    } finally {
      setSaving(false);
    }
  };

  const cardTab = (
    <>
      <Form layout="vertical" form={form} initialValues={{ status: 'PLANNED', favorite: false, kind: 'BOOK' }}>
        <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Название обязательно' }]}>
          <Input placeholder="Например, «Задача трёх тел»" size="large" />
        </Form.Item>
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

        <Row gutter={16}>
          <Col xs={24} sm={8}>
            {/* Вид задаёт единицу прогресса: у сериала эпизоды, у манги тома. */}
            <Form.Item name="kind" label="Вид">
              <Select options={mediaKindOptions} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="typeId" label="Тип">
              <Select allowClear placeholder="Не указан" options={types.map((t) => ({ label: t.name, value: t.id }))} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="sourceId" label="Источник">
              <Select allowClear placeholder="Не указан" options={sources.map((s) => ({ label: s.name, value: s.id }))} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="status" label="Статус" rules={[{ required: true }]}>
              <Select options={statusOptions.map((s) => ({ label: s.label, value: s.value }))} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="favorite" label="Избранное" valuePropName="checked">
              <Switch checkedChildren="Да" unCheckedChildren="Нет" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="rating" label="Оценка" tooltip="Полшага доступны — 7.5 тоже валидная оценка">
          <Rate allowClear allowHalf count={10} style={{ fontSize: 20 }} />
        </Form.Item>

        {/* Критерии по желанию: общая оценка от них не считается, вес у каждого свой. */}
        <Collapse
          ghost
          items={[
            {
              key: 'criteria',
              label: 'Оценка по критериям',
              children: (
                <Row gutter={16}>
                  {ratingCriteria.map((criterion) => (
                    <Col xs={24} sm={12} key={criterion.key}>
                      <Form.Item name={criterion.key} label={criterion.label}>
                        <Rate allowClear allowHalf count={10} style={{ fontSize: 16 }} />
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
              )
            }
          ]}
        />
        {/* Даты обычно проставляет сама смена статуса; здесь их можно поправить или задать срок. */}
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item name="startedAt" label="Начато">
              <DatePicker style={{ width: '100%' }} placeholder="по статусу" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="finishedAt" label="Завершено">
              <DatePicker style={{ width: '100%' }} placeholder="по статусу" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="deadline" label="Дочитать к" tooltip="По сроку считается норма в день">
              <DatePicker style={{ width: '100%' }} placeholder="не задан" />
            </Form.Item>
          </Col>
        </Row>

        {/* Заметка и отзыв разделены: первая для себя, второй — то, что не стыдно показать. */}
        <Form.Item name="note" label="Заметка" tooltip="Видна только вам">
          <Input.TextArea rows={3} placeholder="На чём остановились, что купить, о чём не забыть" />
        </Form.Item>

        <Form.Item name="review" label="Отзыв" tooltip="Публичная часть — без спойлеров">
          <Input.TextArea rows={4} placeholder="Впечатление, которое можно показать другим" />
        </Form.Item>

        <Form.Item
          name="reviewSpoiler"
          label="Отзыв: под спойлер-катом"
          tooltip="Эта часть в интерфейсе скрыта, пока её не раскроют"
        >
          <Input.TextArea rows={3} placeholder="Развязка, повороты, финал" />
        </Form.Item>

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
                      <Form.Item name="pageCount" label="Страниц">
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
                      <Form.Item name="progressTotal" label="Объём" tooltip="Шкала прогресса: страницы, минуты, эпизоды">
                        <InputNumber min={1} style={{ width: '100%' }} placeholder="400" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item name="progressUnit" label="Единица прогресса">
                        <Select allowClear placeholder="По формату" options={progressUnitOptions} />
                      </Form.Item>
                    </Col>
                  </Row>

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
      </Form>

      {/* Обложка загружается отдельным запросом и только у сохранённой книги: до этого нет и адреса. */}
      {editing && <CoverField item={editing} />}
    </>
  );

  return (
    <Drawer
      title={editing ? 'Редактирование книги' : 'Новая книга'}
      open={open}
      onClose={onClose}
      destroyOnHidden
      width={isMobile ? '100%' : 720}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '12px 24px' }}>
          <Button onClick={onClose}>Отмена</Button>
          <Button type="primary" loading={saving} onClick={handleSubmit}>
            {editing ? 'Сохранить' : 'Добавить'}
          </Button>
        </div>
      }
    >
      {/* Прогресс и выписки живут своими запросами, поэтому доступны только у сохранённой книги. */}
      {editing ? (
        <Tabs
          items={[
            { key: 'card', label: 'Карточка', children: cardTab },
            {
              key: 'progress',
              label: 'Прогресс',
              children: (
                <ProgressTab item={editing} onProgressChanged={() => dispatch(loadBooks(filters))} />
              )
            },
            { key: 'review', label: 'Отзыв', children: <ReviewBlock item={editing} /> },
            { key: 'quotes', label: 'Выписки', children: <QuotesTab item={editing} /> }
          ]}
        />
      ) : (
        cardTab
      )}
    </Drawer>
  );
};

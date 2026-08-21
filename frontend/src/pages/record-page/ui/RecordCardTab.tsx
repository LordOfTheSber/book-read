import React from 'react';
import {
  AutoComplete,
  Card,
  Col,
  Collapse,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Tag,
  Typography
} from 'antd';
import { LibraryItem, MediaKind, ProgressUnit } from '@/shared/types/library';
import { useAppSelector } from '@/shared/lib/hooks';
import { mediaKindOptionsWithIcon } from '@/shared/constants/mediaKind';
import {
  formatOptions,
  progressUnitGenitive,
  progressUnitLabel,
  progressUnitName,
  progressUnitOptions,
  resolveProgressUnit
} from '@/shared/constants/format';

interface Props {
  item: LibraryItem;
  kind?: MediaKind;
  format?: LibraryItem['format'];
  unit?: ProgressUnit;
}

/** Ant Design по умолчанию рисует в пикере ISO-дату; остальной интерфейс — русский формат. */
export const DATE_FORMAT = 'DD.MM.YYYY';

const GroupTitle: React.FC<React.PropsWithChildren> = ({ children }) => (
  <Typography.Text
    type="secondary"
    style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}
  >
    {children}
  </Typography.Text>
);

/**
 * Вкладка «Карточка»: поля записи, разложенные по карточкам вместо одного свитка.
 *
 * Редкие блоки — издание и покупка — свёрнуты в строки с кратким содержимым: их открывают
 * единицы записей, а место в общем потоке они занимали всегда.
 */
export const RecordCardTab: React.FC<Props> = ({ item, kind, format, unit }) => {
  const types = useAppSelector((state) => state.bookTypes.list);
  const sources = useAppSelector((state) => state.sources.list);
  const authors = useAppSelector((state) => state.authors.list);
  const series = useAppSelector((state) => state.series.list);
  const tags = useAppSelector((state) => state.tags.list);
  const shelves = useAppSelector((state) => state.shelves.list);

  const authorOptions = React.useMemo(
    () => authors.map((author) => ({ label: author.name, value: author.name })),
    [authors]
  );
  const seriesOptions = React.useMemo(() => series.map((s) => ({ label: s.name, value: s.name })), [series]);
  const tagOptions = React.useMemo(() => tags.map((tag) => ({ label: tag.name, value: tag.name })), [tags]);
  // Полка, куда позвали читателем, в список не попадает: положить на неё запись всё равно не дадут.
  const shelfOptions = React.useMemo(
    () =>
      shelves
        .filter((shelf) => shelf.canContribute)
        .map((shelf) => ({ label: shelf.owned ? shelf.name : `${shelf.name} · @${shelf.ownerUsername}`, value: shelf.id })),
    [shelves]
  );

  const effectiveUnit = resolveProgressUnit({ kind: kind ?? item.kind, format: format ?? item.format, progressUnit: unit });
  const unitShort = progressUnitLabel[effectiveUnit];

  /** Краткое содержимое свёрнутой строки: по нему видно, надо ли её вообще открывать. */
  const editionSummary = [
    item.isbn && `ISBN ${item.isbn}`,
    item.publishedYear,
    item.language,
    item.translator && `пер. ${item.translator}`,
    [item.bookcase, item.shelf].filter(Boolean).join(', ') || undefined
  ]
    .filter(Boolean)
    .join(' · ');

  const editionFilled = Boolean(editionSummary);
  const wishlistSummary = item.wishlist
    ? [item.price && `${item.price} ${item.currency ?? ''}`.trim(), item.purchaseUrl].filter(Boolean).join(' · ') ||
      'В списке желаемого'
    : 'Цена, валюта и ссылка на магазин — для того, что ещё не куплено';

  return (
    <Space direction="vertical" size={12} style={{ display: 'flex' }}>
      <Card size="small" styles={{ body: { padding: '18px 20px' } }}>
        <GroupTitle>Основное</GroupTitle>
        <Row gutter={16} style={{ marginTop: 14 }}>
          <Col xs={24} md={12}>
            <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Название обязательно' }]}>
              <Input placeholder="Например, «Задача трёх тел»" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="altTitle" label="Альтернативное название">
              <Input placeholder="Оригинальное название или перевод" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            {/* Автора можно ввести с клавиатуры: незнакомое имя заведётся на сервере само. */}
            <Form.Item name="authorNames" label="Авторы" tooltip="Новое имя можно ввести прямо здесь">
              <Select mode="tags" allowClear placeholder="Начните вводить имя" options={authorOptions} tokenSeparators={[',']} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            {/* Теги — контекст, а не жанр: жанр задаётся полем «Тип» из общего справочника. */}
            <Form.Item name="tagNames" label="Теги" tooltip="Свободные пометки: «на лето», «перечитать»">
              <Select mode="tags" allowClear placeholder="Начните вводить пометку" options={tagOptions} tokenSeparators={[',']} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            {/* AutoComplete, а не Select: серия одна, и её название можно ввести руками. */}
            <Form.Item name="seriesName" label="Серия" tooltip="Новое название заведёт серию на сервере">
              <AutoComplete
                allowClear
                placeholder="Например, «Воспоминания о прошлом Земли»"
                options={seriesOptions}
                filterOption={(input, option) => String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item name="orderInSeries" label="№ в серии" tooltip="Дробный номер для побочных повестей">
              <InputNumber min={0} step={0.5} style={{ width: '100%' }} placeholder="1" />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            {/* Полки — идентификаторами: полка заводится осознанно, плодить её опечаткой нельзя. */}
            <Form.Item name="shelfIds" label="Полки" tooltip="Новую полку заводят на странице «Полки и теги»">
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
      </Card>

      <Card size="small" styles={{ body: { padding: '18px 20px' } }}>
        <GroupTitle>Что это и где взято</GroupTitle>
        <Row gutter={16} style={{ marginTop: 14 }}>
          <Col xs={24} md={6}>
            <Form.Item name="kind" label="Вид" tooltip="Вид задаёт единицу прогресса: у манги тома, у подкаста минуты">
              <Select options={mediaKindOptionsWithIcon} optionFilterProp="title" />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
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
          <Col xs={24} md={6}>
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
          <Col xs={12} md={3}>
            <Form.Item
              name="progressTotal"
              label="Объём"
              tooltip={`Шкала прогресса целиком: ${progressUnitGenitive[effectiveUnit]}`}
            >
              <InputNumber min={1} style={{ width: '100%' }} placeholder="400" suffix={unitShort} />
            </Form.Item>
          </Col>
          <Col xs={12} md={3}>
            <Form.Item name="progressUnit" label="Единица" tooltip="Своя единица главнее вида">
              <Select allowClear placeholder={progressUnitName[effectiveUnit]} options={progressUnitOptions} />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Card size="small" styles={{ body: { padding: '18px 20px' } }}>
        <GroupTitle>Даты и срок</GroupTitle>
        <Row gutter={16} style={{ marginTop: 14 }}>
          <Col xs={24} md={8}>
            <Form.Item name="startedAt" label="Начато" tooltip="Обычно даты проставляет сама смена статуса">
              <DatePicker style={{ width: '100%' }} format={DATE_FORMAT} placeholder="по статусу" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="finishedAt" label="Завершено">
              <DatePicker style={{ width: '100%' }} format={DATE_FORMAT} placeholder="по статусу" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="deadline" label="Дочитать к" tooltip="По сроку считается норма в день">
              <DatePicker style={{ width: '100%' }} format={DATE_FORMAT} placeholder="не задан" />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Card size="small" styles={{ body: { padding: '4px 8px' } }}>
        <Collapse
          ghost
          items={[
            {
              key: 'edition',
              label: (
                <CollapsedLabel
                  title="Издание и расположение"
                  summary={editionSummary || 'ISBN, год, язык, формат, переводчик, шкаф и полка'}
                  badge={editionFilled ? 'заполнено' : 'пусто'}
                  filled={editionFilled}
                />
              ),
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
            },
            {
              key: 'wishlist',
              label: (
                <CollapsedLabel
                  title="Покупка и желаемое"
                  summary={wishlistSummary}
                  badge={item.wishlist ? 'включено' : 'выключено'}
                  filled={item.wishlist}
                />
              ),
              children: (
                <Row gutter={16}>
                  <Col xs={12} sm={8}>
                    <Form.Item name="price" label="Цена">
                      <InputNumber min={0} step={10} style={{ width: '100%' }} placeholder="899" />
                    </Form.Item>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Form.Item name="currency" label="Валюта">
                      <Input placeholder="RUB" maxLength={8} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={10}>
                    <Form.Item name="purchaseUrl" label="Ссылка на покупку">
                      <Input placeholder="https://…" maxLength={2048} />
                    </Form.Item>
                  </Col>
                </Row>
              )
            }
          ]}
        />
      </Card>
    </Space>
  );
};

interface CollapsedLabelProps {
  title: string;
  summary: string;
  badge: string;
  filled: boolean;
}

const CollapsedLabel: React.FC<CollapsedLabelProps> = ({ title, summary, badge, filled }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
    <div style={{ minWidth: 0, flex: 1 }}>
      <Typography.Text strong style={{ display: 'block' }}>
        {title}
      </Typography.Text>
      <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 12 }}>
        {summary}
      </Typography.Text>
    </div>
    <Tag bordered={false} color={filled ? 'blue' : undefined} style={{ flexShrink: 0, marginInlineEnd: 0 }}>
      {badge}
    </Tag>
  </div>
);

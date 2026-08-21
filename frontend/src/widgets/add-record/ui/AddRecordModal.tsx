import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Drawer, Form, Grid, Modal } from 'antd';
import { ExternalBook, LibraryItem, MediaKind, ProgressUnit, ReadingStatus } from '@/shared/types/library';
import { searchMetadata } from '@/entities/metadata';
import { createBookThunk, uploadCoverFromUrl } from '@/entities/book';
import { loadAuthors } from '@/entities/author';
import { loadSeries } from '@/entities/series';
import { loadTags } from '@/entities/tag';
import { loadShelves } from '@/entities/shelf';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { useRequestError } from '@/shared/lib/errors';
import { IsbnScannerModal, isBarcodeScanningSupported } from '@/features/book/scan-isbn';
import { DuplicateHint } from '@/widgets/book-form';
import { BookRequest } from '@/widgets/book-form/model/requestFields';
import { metadataQuery } from '../model/externalBook';
import { SearchStep } from './SearchStep';
import { ConfirmStep } from './ConfirmStep';
import { ManualStep } from './ManualStep';

interface Props {
  open: boolean;
  onClose: () => void;
  /** «Открыть полную карточку»: созданная запись сразу уходит в панель правки. */
  onOpenRecord: (item: LibraryItem) => void;
}

interface AddFormValues {
  title?: string;
  authorNames?: string[];
  kind?: MediaKind;
  status?: ReadingStatus;
  progressTotal?: number;
  progressUnit?: ProgressUnit;
  shelfIds?: string[];
}

type Step = 'search' | 'confirm' | 'manual';

const INITIAL_VALUES: AddFormValues = { status: 'PLANNED', kind: 'BOOK' };

/**
 * Добавление записи: сначала найти, потом подтвердить.
 *
 * Кнопка «Добавить запись» открывает поиск по каталогам, а не форму на 31 поле. Каталог отдаёт
 * название, автора, ISBN, год, язык, объём и обложку — ровно то, что раньше набирали руками;
 * подтвердить остаётся статус, вид, объём и полку. Кому каталог не помог — «Завести вручную»
 * с шестью полями, из которых обязательно одно.
 */
export const AddRecordModal: React.FC<Props> = ({ open, onClose, onOpenRecord }) => {
  const dispatch = useAppDispatch();
  const authors = useAppSelector((state) => state.authors.list);
  const shelves = useAppSelector((state) => state.shelves.list);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const [form] = Form.useForm<AddFormValues>();

  const [step, setStep] = useState<Step>('search');
  const [query, setQuery] = useState('');
  /** Запрос, по которому получены находки: по нему Enter отличает «искать» от «выбрать первое». */
  const [searchedQuery, setSearchedQuery] = useState('');
  const [results, setResults] = useState<ExternalBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [picked, setPicked] = useState<ExternalBook>();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep('search');
    setQuery('');
    setSearchedQuery('');
    setResults([]);
    setSearched(false);
    setPicked(undefined);
    /*
     * Именно resetFields, а не подстановка значений по умолчанию: форма живёт в этом окне и
     * переживает его закрытие. После добавления книги из каталога в ней оставались название и
     * авторы прошлой находки, и следующее «Добавить запись» → «Завести вручную» молча заводило
     * второй экземпляр той же записи — форма считалась заполненной.
     */
    form.resetFields();
    dispatch(loadAuthors());
    dispatch(loadShelves());
  }, [open, dispatch, form]);

  const watchedKind = Form.useWatch<MediaKind>('kind', form);
  const watchedUnit = Form.useWatch<ProgressUnit>('progressUnit', form);
  const watchedTitle = Form.useWatch<string>('title', form);

  const authorOptions = useMemo(
    () => authors.map((author) => ({ label: author.name, value: author.name })),
    [authors]
  );
  // Полка, куда позвали читателем, в список не попадает: положить на неё запись всё равно не дадут.
  const shelfOptions = useMemo(
    () =>
      shelves
        .filter((shelf) => shelf.canContribute)
        .map((shelf) => ({ label: shelf.owned ? shelf.name : `${shelf.name} · @${shelf.ownerUsername}`, value: shelf.id })),
    [shelves]
  );

  const runSearch = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setLoading(true);
    setSearched(true);
    try {
      const found = await searchMetadata(metadataQuery(trimmed));
      setResults(found);
      setSearchedQuery(trimmed);
    } catch (error) {
      showRequestError(error, 'Не удалось поискать в каталогах');
    } finally {
      setLoading(false);
    }
  };

  /** Находка кладётся в форму: год и объём у изданий расходятся, последнее слово за человеком. */
  const pick = (book: ExternalBook) => {
    setPicked(book);
    form.setFieldsValue({
      title: book.title,
      authorNames: book.authorNames?.length ? book.authorNames : undefined,
      // Объём — это шкала прогресса: у книги из каталога другого источника для неё нет.
      progressTotal: book.pageCount
    });
    setStep('confirm');
  };

  /** Enter в поле ищет, а когда находки уже на экране и запрос не менялся — выбирает первую. */
  const handleEnter = (value: string) => {
    if (results.length > 0 && value.trim() === searchedQuery) {
      pick(results[0]);
      return;
    }
    void runSearch(value);
  };

  const handleScanned = (isbn: string) => {
    setScannerOpen(false);
    setQuery(isbn);
    void runSearch(isbn);
  };

  const submit = async (openCard: boolean) => {
    const valid = await form
      .validateFields()
      .then(() => true)
      .catch(() => false);
    if (!valid) return;

    const values = form.getFieldsValue(true) as AddFormValues;
    const payload: BookRequest = {
      title: values.title,
      authorNames: values.authorNames,
      kind: values.kind,
      status: values.status,
      progressTotal: values.progressTotal,
      progressUnit: values.progressUnit,
      shelfIds: values.shelfIds,
      // Издательские поля из каталога: их не спрашивали, но и терять незачем.
      altTitle: picked?.altTitle,
      isbn: picked?.isbn,
      publishedYear: picked?.publishedYear,
      language: picked?.language,
      pageCount: picked?.pageCount
    };

    setSaving(true);
    try {
      const created = await dispatch(createBookThunk(payload)).unwrap();
      // Обложку из каталога забирает сервер: у каталогов нет CORS, из браузера её не скачать.
      if (picked?.coverUrl) {
        try {
          await uploadCoverFromUrl(created.id, picked.coverUrl);
        } catch {
          // Запись уже сохранена — терять её из-за недоехавшей картинки нельзя.
          message.warning('Запись сохранена, но обложку из каталога забрать не удалось');
        }
      }
      message.success('Запись добавлена');
      // Списки могли пополниться новыми авторами, сериями и тегами, а счётчики полок — измениться.
      dispatch(loadAuthors({ force: true }));
      dispatch(loadSeries({ force: true }));
      dispatch(loadTags({ force: true }));
      dispatch(loadShelves({ force: true }));
      onClose();
      if (openCard) {
        onOpenRecord(created);
      }
    } catch (error) {
      showRequestError(error, 'Не удалось сохранить запись');
    } finally {
      setSaving(false);
    }
  };

  const title = step === 'search' ? 'Добавить запись' : step === 'confirm' ? 'Добавить запись' : 'Завести вручную';

  const body = (
    <>
      {/* Дубли показываются до сохранения: сообщать о них после — уже поздно. */}
      {step !== 'search' && <DuplicateHint title={watchedTitle} isbn={picked?.isbn} />}
      <Form form={form} component={false} layout="vertical" initialValues={INITIAL_VALUES}>
        {step === 'search' && (
          <SearchStep
            query={query}
            onQueryChange={setQuery}
            onSearch={handleEnter}
            loading={loading}
            searched={searched}
            results={results}
            onPick={pick}
            onManual={() => setStep('manual')}
            onScan={() => setScannerOpen(true)}
            scannerSupported={isBarcodeScanningSupported()}
            isMobile={isMobile}
          />
        )}
        {step === 'confirm' && picked && (
          <ConfirmStep
            book={picked}
            shelfOptions={shelfOptions}
            kind={watchedKind}
            unit={watchedUnit}
            onEditDetails={() => setStep('manual')}
            isMobile={isMobile}
          />
        )}
        {step === 'manual' && (
          <ManualStep authorOptions={authorOptions} kind={watchedKind} unit={watchedUnit} isMobile={isMobile} />
        )}
      </Form>

      <IsbnScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanned} />
    </>
  );

  const addButton = (
    <Button
      type="primary"
      loading={saving}
      onClick={() => submit(false)}
      size={isMobile ? 'large' : 'middle'}
      style={isMobile ? { width: '100%' } : undefined}
    >
      Добавить
    </Button>
  );

  const openCardButton = (
    <Button
      onClick={() => submit(true)}
      disabled={saving}
      size={isMobile ? 'large' : 'middle'}
      style={isMobile ? { width: '100%' } : undefined}
    >
      Добавить и открыть карточку
    </Button>
  );

  /** На шаге поиска решение ещё не принято — подвал там не нужен. */
  const footer =
    step === 'search' ? null : isMobile ? (
      // На телефоне кнопки во всю ширину и главная сверху: до нижней руке тянуться дальше.
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 16px' }}>
        {addButton}
        {openCardButton}
      </div>
    ) : (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        {openCardButton}
        <Button onClick={onClose}>Отмена</Button>
        {addButton}
      </div>
    );

  if (isMobile) {
    return (
      <Drawer
        title={title}
        open={open}
        onClose={onClose}
        destroyOnHidden
        placement="bottom"
        height="100%"
        footer={footer}
        styles={{ body: { paddingTop: 12 } }}
      >
        {body}
      </Drawer>
    );
  }

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      destroyOnHidden
      width={720}
      footer={footer}
    >
      {body}
    </Modal>
  );
};

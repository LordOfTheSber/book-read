import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Select, Slider, Space, Spin, Typography, Grid, message, Drawer } from 'antd';
import { ArrowLeftOutlined, LeftOutlined, RightOutlined, HomeOutlined, SettingOutlined } from '@ant-design/icons';
import { parseNovelChapter } from '@/shared/api/novelReaderApi';
import { httpClient } from '@/shared/api/httpClient';
import { LibraryItem, NovelChapter } from '@/shared/types/library';
import { type ReaderSettings, useReaderPageStyles } from './ReaderPage.styles';

const { Title, Text, Paragraph } = Typography;

export const ReaderPage: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const defaultReaderSettings: ReaderSettings = {
    fontSize: isMobile ? 16 : 18,
    lineHeight: 1.8,
    paragraphSpacing: 16,
    fontFamily: 'serif',
    contentWidth: 900
  };

  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(defaultReaderSettings);
  const styles = useReaderPageStyles(isMobile, readerSettings);

  const [book, setBook] = useState<LibraryItem | null>(null);
  const [chapter, setChapter] = useState<NovelChapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [maxAttempts, setMaxAttempts] = useState(3);

  useEffect(() => {
    const saved = localStorage.getItem('reader-settings-v1');
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Partial<ReaderSettings>;
      setReaderSettings((prev) => ({ ...prev, ...parsed }));
    } catch {
      localStorage.removeItem('reader-settings-v1');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('reader-settings-v1', JSON.stringify(readerSettings));
  }, [readerSettings]);

  useEffect(() => {
    const savedAttempts = localStorage.getItem('reader-max-attempts-v1');
    if (!savedAttempts) return;

    const parsedAttempts = Number(savedAttempts);
    if (!Number.isFinite(parsedAttempts)) return;

    setMaxAttempts(Math.min(10, Math.max(1, Math.round(parsedAttempts))));
  }, []);

  useEffect(() => {
    localStorage.setItem('reader-max-attempts-v1', String(maxAttempts));
  }, [maxAttempts]);

  useEffect(() => {
    if (!bookId) return;
    httpClient.get<LibraryItem>(`/items/${bookId}`).then(({ data }) => {
      setBook(data);
      if (data.readUrl) {
        loadChapter(data.readUrl);
      } else {
        setLoading(false);
        message.error('У книги не указана ссылка для чтения');
      }
    }).catch(() => {
      setLoading(false);
      message.error('Не удалось загрузить данные книги');
    });
  }, [bookId]);

  const loadChapter = useCallback(async (url: string) => {
    setChapterLoading(true);
    try {
      const data = await parseNovelChapter(url, maxAttempts);
      setChapter(data);
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message;
      message.error(serverMsg || `Не удалось загрузить главу за ${maxAttempts} попыток`);
    } finally {
      setLoading(false);
      setChapterLoading(false);
    }
  }, [maxAttempts]);

  const handleChapterChange = (chapterNumber: number) => {
    if (!chapter) return;
    const target = chapter.chapters.find((c) => c.number === chapterNumber);
    if (target) {
      loadChapter(target.url);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (chapter?.prevChapterUrl) {
      loadChapter(chapter.prevChapterUrl);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNext = () => {
    if (chapter?.nextChapterUrl) {
      loadChapter(chapter.nextChapterUrl);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const updateSetting = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    setReaderSettings((prev) => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    setReaderSettings(defaultReaderSettings);
    setMaxAttempts(3);
  };

  if (loading) {
    return (
      <div style={styles.loader}>
        <Spin size="large" />
      </div>
    );
  }

  if (!chapter) {
    return (
      <Card style={styles.pageCard}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          Назад к библиотеке
        </Button>
        <Paragraph style={{ marginTop: 16 }}>
          Не удалось загрузить содержимое. Проверьте ссылку для чтения в настройках книги.
        </Paragraph>
      </Card>
    );
  }

  return (
    <div style={styles.wrapper}>
      <Card style={styles.headerCard} bodyStyle={styles.headerCardBody}>
        <div style={styles.headerTop}>
          <Button
            icon={<HomeOutlined />}
            onClick={() => navigate('/')}
            size={isMobile ? 'small' : 'middle'}
          >
            {!isMobile && 'Библиотека'}
          </Button>
          <div style={styles.titleBlock}>
            <Title level={isMobile ? 5 : 4} style={styles.title}>
              {chapter.title || book?.title}
            </Title>
            {chapter.author && (
              <Text type="secondary">{chapter.author}</Text>
            )}
          </div>
          <Button
            icon={<SettingOutlined />}
            onClick={() => setSettingsVisible(true)}
            size={isMobile ? 'small' : 'middle'}
          >
            {!isMobile && 'Настройки'}
          </Button>
        </div>

        {chapter.description && !isMobile && (
          <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={styles.description}>
            {chapter.description}
          </Paragraph>
        )}

        <div style={styles.navBar}>
          <Button
            icon={<LeftOutlined />}
            disabled={!chapter.prevChapterUrl || chapterLoading}
            onClick={handlePrev}
            size={isMobile ? 'small' : 'middle'}
          >
            {!isMobile && 'Назад'}
          </Button>

          <Select
            value={chapter.currentChapter}
            onChange={handleChapterChange}
            style={styles.chapterSelect}
            size={isMobile ? 'small' : 'middle'}
            disabled={chapterLoading}
            options={chapter.chapters.map((c) => ({
              label: c.title,
              value: c.number
            }))}
          />

          <Text type="secondary" style={styles.chapterCount}>
            {chapter.currentChapter} / {chapter.totalChapters}
          </Text>

          <Button
            icon={<RightOutlined />}
            disabled={!chapter.nextChapterUrl || chapterLoading}
            onClick={handleNext}
            size={isMobile ? 'small' : 'middle'}
          >
            {!isMobile && 'Далее'}
          </Button>
        </div>
      </Card>

      <Drawer
        title="Настройки чтения"
        placement="right"
        width={isMobile ? '100%' : 420}
        onClose={() => setSettingsVisible(false)}
        open={settingsVisible}
      >
        <Space direction="vertical" size="middle" style={styles.settingsDrawerContent}>
          <div>
            <Text>Размер текста: {readerSettings.fontSize}px</Text>
            <Slider
              min={13}
              max={30}
              value={readerSettings.fontSize}
              onChange={(value) => updateSetting('fontSize', value)}
            />
          </div>

          <div>
            <Text>Межстрочный интервал: {readerSettings.lineHeight.toFixed(1)}</Text>
            <Slider
              min={1.2}
              max={2.8}
              step={0.1}
              value={readerSettings.lineHeight}
              onChange={(value) => updateSetting('lineHeight', value)}
            />
          </div>

          <div>
            <Text>Расстояние между абзацами: {readerSettings.paragraphSpacing}px</Text>
            <Slider
              min={0}
              max={40}
              value={readerSettings.paragraphSpacing}
              onChange={(value) => updateSetting('paragraphSpacing', value)}
            />
          </div>

          <div>
            <Text>Максимальная ширина текста: {readerSettings.contentWidth}px</Text>
            <Slider
              min={640}
              max={1200}
              step={20}
              value={readerSettings.contentWidth}
              onChange={(value) => updateSetting('contentWidth', value)}
            />
          </div>


          <div>
            <Text>Попыток загрузки страницы: {maxAttempts}</Text>
            <Slider
              min={1}
              max={10}
              step={1}
              value={maxAttempts}
              onChange={(value) => setMaxAttempts(typeof value === 'number' ? value : value[0])}
            />
          </div>

          <div>
            <Text>Шрифт</Text>
            <Select
              value={readerSettings.fontFamily}
              onChange={(value) => updateSetting('fontFamily', value)}
              style={{ width: '100%', marginTop: 8 }}
              options={[
                { label: 'Serif (книжный)', value: 'serif' },
                { label: 'Sans-serif (современный)', value: 'sans-serif' },
                { label: 'Monospace (моноширинный)', value: 'monospace' }
              ]}
            />
          </div>

          <Button onClick={resetSettings}>Сбросить по умолчанию</Button>
        </Space>
      </Drawer>

      <Card style={styles.contentCard} bodyStyle={styles.contentBody}>
        {chapterLoading ? (
          <div style={styles.loader}>
            <Spin size="large" />
          </div>
        ) : (
          <div
            className="reader-story-text"
            style={styles.storyText}
            dangerouslySetInnerHTML={{ __html: chapter.textHtml }}
          />
        )}
      </Card>

      <Card style={styles.footerCard} bodyStyle={styles.footerBody}>
        <Space size="middle" wrap style={{ justifyContent: 'center', width: '100%', display: 'flex' }}>
          <Button
            icon={<LeftOutlined />}
            disabled={!chapter.prevChapterUrl || chapterLoading}
            onClick={handlePrev}
          >
            Предыдущая глава
          </Button>
          <Button
            icon={<RightOutlined />}
            type="primary"
            disabled={!chapter.nextChapterUrl || chapterLoading}
            onClick={handleNext}
          >
            Следующая глава
          </Button>
        </Space>
      </Card>
    </div>
  );
};

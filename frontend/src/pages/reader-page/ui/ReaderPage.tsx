import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Select, Space, Spin, Typography, Grid, message } from 'antd';
import { ArrowLeftOutlined, LeftOutlined, RightOutlined, HomeOutlined } from '@ant-design/icons';
import { parseNovelChapter } from '@/shared/api/novelReaderApi';
import { httpClient } from '@/shared/api/httpClient';
import { LibraryItem, NovelChapter } from '@/shared/types/library';
import { useReaderPageStyles } from './ReaderPage.styles';

const { Title, Text, Paragraph } = Typography;

export const ReaderPage: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const styles = useReaderPageStyles(isMobile);

  const [book, setBook] = useState<LibraryItem | null>(null);
  const [chapter, setChapter] = useState<NovelChapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [chapterLoading, setChapterLoading] = useState(false);

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
      const data = await parseNovelChapter(url);
      setChapter(data);
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message;
      message.error(serverMsg || 'Не удалось загрузить главу');
    } finally {
      setLoading(false);
      setChapterLoading(false);
    }
  }, []);

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

      <Card style={styles.contentCard} bodyStyle={styles.contentBody}>
        {chapterLoading ? (
          <div style={styles.loader}>
            <Spin size="large" />
          </div>
        ) : (
          <div
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

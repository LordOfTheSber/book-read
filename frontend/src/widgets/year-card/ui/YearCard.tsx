import React, { useCallback, useEffect, useRef } from 'react';
import { App, Button, Card, Space, Typography } from 'antd';
import { CopyOutlined, DownloadOutlined } from '@ant-design/icons';
import { MediaKind, YearInReview } from '@/shared/types/library';
import { brand, displayFont, kindColor, uiFont } from '@/shared/config/brand';
import { formatNumber } from '@/shared/lib/format';
import { plural } from '@/shared/lib/plural';

interface Props {
  review: YearInReview;
  /** Логин для адреса публичной страницы: открытку показывают вместе с ней. */
  username?: string;
}

/** Размер открытки в точках макета; на экране она рисуется вдвое плотнее ради чёткости. */
const WIDTH = 520;
const HEIGHT = 300;
const SCALE = 2;

/** Поля бумажной подложки под корешковой полосой и просвет между корешками. */
const PAD = 4;
const GAP = 3;

const PAPER_DIM = 'rgba(251, 248, 243, 0.5)';
const PAPER_SOFT = 'rgba(251, 248, 243, 0.72)';

/** Три числа года: больше на открытке не читается, меньше — не о чем рассказывать. */
const numbers = (review: YearInReview) => [
  { value: formatNumber(review.finishedCount), label: plural(review.finishedCount, ['книга', 'книги', 'книг']) },
  { value: formatNumber(review.pageCount), label: 'страниц' },
  { value: formatNumber(review.readingDays), label: 'дней с чтением' }
];

/** «Лучшее за год — Disco Elysium и Пикник на обочине. Самая длинная серия — 118 дней подряд.» */
const summaryLine = (review: YearInReview): string => {
  const best = review.topRated.slice(0, 2).map((item) => item.title);
  const parts: string[] = [];
  if (best.length > 0) {
    parts.push(`Лучшее за год — ${best.join(' и ')}.`);
  }
  if (review.longestStreak > 0) {
    parts.push(`Самая длинная серия — ${review.longestStreak} ${plural(review.longestStreak, ['день', 'дня', 'дней'])} подряд.`);
  }
  return parts.join(' ');
};

/** Перенос по словам: у канвы своего переноса нет, а строка с названиями книг длинная. */
const wrap = (context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
};

/**
 * Открытка «Год в обзоре» по макету `BrandMotifs.dc.html`.
 *
 * Единственная страница, которую человек показывает другим по своей воле, — значит, именно она
 * должна выглядеть как бренд: чернильный прямоугольник, знак, три числа, корешковая полоса
 * из того, что читалось, и адрес публичной страницы.
 *
 * Рисуется на канве, а не вёрсткой: показанное и сохранённое обязано совпадать до пикселя,
 * а «сфотографировать» разметку в браузере без сторонней библиотеки нечем. Заодно это снимает
 * вопрос шрифтов — канва берёт те же Literata и Inter, что и остальной интерфейс.
 */
export const YearCard: React.FC<Props> = ({ review, username }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { message } = App.useApp();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    context.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    context.clearRect(0, 0, WIDTH, HEIGHT);

    // Фон и тёплое пятно в углу — те же две формы, что на артборде.
    context.fillStyle = brand.ink;
    context.beginPath();
    context.roundRect(0, 0, WIDTH, HEIGHT, 18);
    context.fill();
    context.save();
    context.clip();
    context.fillStyle = 'rgba(200, 85, 47, 0.14)';
    context.beginPath();
    context.arc(WIDTH - 20, -10, 110, 0, Math.PI * 2);
    context.fill();
    context.restore();

    // Знак: корешок с полной лентой. Вне приложения она всегда полная — иначе знак не узнать.
    context.fillStyle = brand.paper;
    context.beginPath();
    context.roundRect(32, 28, 18, 20, 4);
    context.fill();
    context.fillStyle = brand.bookmark;
    context.beginPath();
    context.moveTo(42, 28);
    context.lineTo(47, 28);
    context.lineTo(47, 45);
    context.lineTo(44.5, 42);
    context.lineTo(42, 45);
    context.closePath();
    context.fill();

    context.fillStyle = brand.paper;
    context.font = `700 14px ${displayFont}`;
    context.textBaseline = 'middle';
    context.fillText('BookRead', 58, 39);

    if (username) {
      context.fillStyle = PAPER_DIM;
      context.font = `12px ${uiFont}`;
      context.textAlign = 'right';
      context.fillText(`${window.location.host}/u/${username}`, WIDTH - 32, 39);
      context.textAlign = 'left';
    }

    context.fillStyle = brand.paper;
    context.font = `700 30px ${displayFont}`;
    context.textBaseline = 'alphabetic';
    context.fillText('Год в обзоре', 32, 100);
    context.fillText(String(review.year), 32, 136);

    let x = 32;
    numbers(review).forEach((number) => {
      context.fillStyle = brand.paper;
      context.font = `700 30px ${displayFont}`;
      context.fillText(number.value, x, 186);
      const width = context.measureText(number.value).width;
      context.fillStyle = PAPER_DIM;
      context.font = `12px ${uiFont}`;
      context.fillText(number.label, x, 204);
      x += Math.max(width, context.measureText(number.label).width) + 30;
    });

    // Корешковая полоса: доли видов за год — тот же приём, что на «Аналитике».
    // Полоса лежит на бумажной подложке, а не прямо на чернилах: цвет книги в бренде и есть
    // чернильный, и на тёмном фоне самая большая доля просто пропадала.
    const shares = Object.entries(review.kindBreakdown ?? {}).filter(([, count]) => (count ?? 0) > 0);
    const total = shares.reduce((sum, [, count]) => sum + (count ?? 0), 0);
    if (total > 0) {
      const trackWidth = WIDTH - 64;
      const innerWidth = trackWidth - PAD * 2;
      context.fillStyle = brand.paper;
      context.beginPath();
      context.roundRect(32, 222, trackWidth, 34, 7);
      context.fill();

      let offset = 32 + PAD;
      shares.forEach(([kind, count], index) => {
        const last = index === shares.length - 1;
        const width = ((count ?? 0) / total) * innerWidth - (last ? 0 : GAP);
        context.fillStyle = kindColor[kind as MediaKind]?.color ?? brand.bookmark;
        context.beginPath();
        context.roundRect(offset, 222 + PAD, Math.max(width, 4), 34 - PAD * 2, 4);
        context.fill();
        offset += width + GAP;
      });
    }

    const line = summaryLine(review);
    if (line) {
      context.fillStyle = PAPER_SOFT;
      context.font = `13px ${uiFont}`;
      wrap(context, line, WIDTH - 64, 2).forEach((text, index) => {
        context.fillText(text, 32, 278 + index * 18);
      });
    }
  }, [review, username]);

  useEffect(() => {
    draw();
    // Первый кадр может уйти до того, как браузер разберёт Literata: с запасным шрифтом
    // открытка выглядит чужой, поэтому после загрузки шрифтов она перерисовывается.
    document.fonts?.ready.then(draw).catch(() => undefined);
  }, [draw]);

  const save = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bookread-${review.year}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const copyLink = async () => {
    if (!username) return;
    const link = `${window.location.origin}/u/${username}`;
    try {
      await navigator.clipboard.writeText(link);
      message.success('Ссылка скопирована');
    } catch {
      // Буфер обмена закрыт в небезопасном контексте и без разрешения — адрес всё равно нужен.
      message.info(link);
    }
  };

  return (
    <Card style={{ marginTop: 16 }}>
      <Space direction="vertical" size={14} style={{ display: 'flex' }}>
        <div>
          <Typography.Title level={3} className="brand-display" style={{ margin: 0, fontSize: 18 }}>
            Открытка «Год в обзоре»
          </Typography.Title>
          <Typography.Text type="secondary">
            Одна картинка, которую можно сохранить и отправить: знак, три числа, полоса из того,
            что читалось, и адрес вашей страницы.
          </Typography.Text>
        </div>

        <canvas
          ref={canvasRef}
          width={WIDTH * SCALE}
          height={HEIGHT * SCALE}
          style={{ width: '100%', maxWidth: WIDTH, height: 'auto', borderRadius: 18 }}
          aria-label={`Открытка «Год в обзоре» за ${review.year} год`}
          role="img"
        />

        <Space size={8} wrap>
          <Button type="primary" icon={<DownloadOutlined />} onClick={save}>
            Сохранить картинкой
          </Button>
          {username && (
            <Button icon={<CopyOutlined />} onClick={copyLink}>
              Скопировать ссылку
            </Button>
          )}
        </Space>
      </Space>
    </Card>
  );
};

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Grid, Input, Modal, Space, Typography, theme } from 'antd';
import { CameraOutlined, StopOutlined } from '@ant-design/icons';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Распознанный штрихкод: для книг это EAN-13, он же ISBN-13. */
  onDetected: (isbn: string) => void;
}

/** Форматы книжного штрихкода. EAN-13 — это и есть ISBN-13, ISBN-10 встречается на старых изданиях. */
const BARCODE_FORMATS = ['ean_13', 'ean_8', 'isbn_13', 'isbn_10'];

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
}

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

/** Доступен не везде: в Firefox и в Safari до 17 конструктора нет вовсе. */
const getBarcodeDetector = (): BarcodeDetectorConstructor | undefined =>
  (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;

export const isBarcodeScanningSupported = () =>
  typeof window !== 'undefined' && Boolean(getBarcodeDetector()) && Boolean(navigator.mediaDevices?.getUserMedia);

interface Refusal {
  title: string;
  text: string;
}

/**
 * Отказы названы по причине, а не одной строкой «нет камеры»: разрешить доступ, сменить браузер
 * и найти другое устройство — три разных действия, и человек должен понимать, какое из них его.
 */
const REFUSALS: Record<'unsupported' | 'denied' | 'missing', Refusal> = {
  unsupported: {
    title: 'Браузер не умеет читать штрихкоды',
    text: 'Chrome и Edge умеют, Firefox и Safari младше 17 — нет. Номер можно ввести руками, это тот же путь.'
  },
  denied: {
    title: 'Доступ к камере не дали',
    text: 'Разрешите камеру в настройках сайта и откройте сканер снова — или введите номер с обложки.'
  },
  missing: {
    title: 'Камеры нет',
    text: 'На этом устройстве камера не найдена. На настольном браузере это обычное дело.'
  }
};

/** Из «978-5-389-07993-2» получается 9785389079932: дефисы человек ставит как хочет. */
const digitsOnly = (value: string) => value.replace(/\D/g, '');

/**
 * Сканер ISBN камерой по макету `ScanIsbn.dc.html`.
 *
 * Вводить тринадцать цифр с обложки руками — ровно тот барьер, из-за которого библиотеку
 * не заполняют; в вебе это закрывается `BarcodeDetector` без единой зависимости. Но чаще всего
 * этот экран показывает не книгу, а отказ: камеры нет, доступ не дали, браузер не умеет. Поэтому
 * ручной ввод здесь не запасной путь, а равноправный — он стоит и рядом с видоискателем, и вместо
 * него, когда камера недоступна.
 */
export const IsbnScannerModal: React.FC<Props> = ({ open, onClose, onDetected }) => {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [refusal, setRefusal] = useState<Refusal>();
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string>();

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }
    setRefusal(undefined);
    setManual('');
    setManualError(undefined);

    const Detector = getBarcodeDetector();
    if (!Detector) {
      setRefusal(REFUSALS.unsupported);
      return;
    }

    let cancelled = false;
    let frame = 0;
    const detector = new Detector({ formats: BARCODE_FORMATS });

    const scan = async () => {
      const video = videoRef.current;
      if (cancelled || !video || video.readyState < 2) {
        frame = requestAnimationFrame(scan);
        return;
      }
      try {
        const codes = await detector.detect(video);
        const value = codes.find((code) => /^\d{10,13}$/.test(code.rawValue))?.rawValue;
        if (value) {
          onDetected(value);
          onClose();
          return;
        }
      } catch {
        // Отдельный неудачный кадр — не повод останавливать сканирование.
      }
      frame = requestAnimationFrame(scan);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
        frame = requestAnimationFrame(scan);
      })
      .catch((error: unknown) => {
        // Отказ пользователя и отсутствие камеры браузер различает именем ошибки.
        const name = error instanceof Error ? error.name : '';
        setRefusal(name === 'NotFoundError' || name === 'OverconstrainedError' ? REFUSALS.missing : REFUSALS.denied);
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stop();
    };
  }, [open, onClose, onDetected, stop]);

  const submitManual = () => {
    const digits = digitsOnly(manual);
    if (digits.length !== 10 && digits.length !== 13) {
      setManualError('ISBN — это десять или тринадцать цифр под штрихкодом');
      return;
    }
    onDetected(digits);
    onClose();
  };

  const manualBlock = (
    <div>
      <Typography.Text style={{ display: 'block', marginBottom: 6 }}>Номер с обложки</Typography.Text>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={manual}
          onChange={(event) => {
            setManual(event.target.value);
            setManualError(undefined);
          }}
          onPressEnter={submitManual}
          placeholder="978-5-389-07993-2"
          inputMode="numeric"
          maxLength={20}
          status={manualError ? 'error' : undefined}
          aria-label="Номер с обложки"
        />
        <Button type="primary" onClick={submitManual}>
          Найти
        </Button>
      </Space.Compact>
      <Typography.Text type={manualError ? 'danger' : 'secondary'} style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
        {manualError ?? 'Дефисы можно не ставить. Тринадцать цифр — под штрихкодом.'}
      </Typography.Text>
    </div>
  );

  return (
    <Modal
      title="Сканировать ISBN"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      /* На телефоне сканер занимает весь экран: видоискатель в окне 420 px бесполезен. */
      width={isMobile ? '100%' : 420}
      style={isMobile ? { top: 0, maxWidth: '100vw', paddingBottom: 0 } : undefined}
    >
      <Space direction="vertical" size={14} style={{ display: 'flex' }}>
        {refusal ? (
          <div
            style={{
              display: 'flex',
              gap: 12,
              padding: '14px 16px',
              borderRadius: token.borderRadiusLG,
              background: token.colorFillQuaternary
            }}
          >
            <span aria-hidden style={{ color: token.colorTextQuaternary, fontSize: 20, lineHeight: 1 }}>
              <StopOutlined />
            </span>
            <span>
              <Typography.Text strong style={{ display: 'block' }}>
                {refusal.title}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 13, lineHeight: 1.55 }}>
                {refusal.text}
              </Typography.Text>
            </span>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <video
              ref={videoRef}
              muted
              playsInline
              style={{
                width: '100%',
                height: isMobile ? '52vh' : 240,
                objectFit: 'cover',
                display: 'block',
                borderRadius: token.borderRadiusLG,
                background: token.colorFillTertiary
              }}
            />
            {/* Рамка видоискателя: без неё непонятно, куда наводить и что происходит. */}
            <span
              aria-hidden
              style={{
                position: 'absolute',
                inset: '18% 12%',
                border: `2px solid ${token.colorPrimary}`,
                borderRadius: token.borderRadius,
                boxShadow: `0 0 0 9999px ${token.colorBgMask}`,
                pointerEvents: 'none'
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 10,
                textAlign: 'center',
                color: token.colorTextLightSolid,
                fontSize: 13
              }}
            >
              <CameraOutlined /> Держите ровно — распознаём сами
            </span>
          </div>
        )}

        {!refusal && (
          <Typography.Text type="secondary">
            Наведите камеру на штрихкод на обороте обложки — он же ISBN-13.
          </Typography.Text>
        )}

        {manualBlock}
      </Space>
    </Modal>
  );
};

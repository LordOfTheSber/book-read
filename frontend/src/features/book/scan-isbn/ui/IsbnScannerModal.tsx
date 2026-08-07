import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Space, Typography, theme } from 'antd';

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

/**
 * Сканер ISBN камерой. Вводить тринадцать цифр с обложки руками — ровно тот барьер, из-за которого
 * библиотеку не заполняют; в вебе это закрывается `BarcodeDetector` без единой зависимости.
 * <p>
 * Там, где его нет, кнопка сканирования не показывается вовсе: см. {@link isBarcodeScanningSupported}.
 */
export const IsbnScannerModal: React.FC<Props> = ({ open, onClose, onDetected }) => {
  const { token } = theme.useToken();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string>();

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }

    const Detector = getBarcodeDetector();
    if (!Detector) {
      setError('Браузер не умеет распознавать штрихкоды — введите ISBN вручную');
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
      .catch(() => setError('Нет доступа к камере — разрешите его в настройках браузера'));

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stop();
    };
  }, [open, onClose, onDetected, stop]);

  return (
    <Modal title="Сканировать ISBN" open={open} onCancel={onClose} footer={null} destroyOnHidden width={420}>
      <Space direction="vertical" size={12} style={{ display: 'flex' }}>
        {error ? (
          <Alert type="warning" message={error} showIcon />
        ) : (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ width: '100%', borderRadius: token.borderRadiusLG, background: token.colorFillTertiary }}
            />
            <Typography.Text type="secondary">
              Наведите камеру на штрихкод на обороте обложки — он же ISBN-13.
            </Typography.Text>
          </>
        )}
      </Space>
    </Modal>
  );
};

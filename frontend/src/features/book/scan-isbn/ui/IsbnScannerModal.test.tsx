import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IsbnScannerModal } from './IsbnScannerModal';
import { renderWithStore } from '@/test/renderWithStore';

const withBarcodeDetector = (value?: unknown) => {
  Object.defineProperty(window, 'BarcodeDetector', { value, configurable: true, writable: true });
};

afterEach(() => {
  withBarcodeDetector(undefined);
});

describe('IsbnScannerModal', () => {
  /**
   * Этот экран чаще показывает не книгу, а отказ, и отказы разные: разрешить доступ, сменить
   * браузер и найти другое устройство — три разных действия.
   */
  it('называет причину, когда браузер не умеет читать штрихкоды', async () => {
    renderWithStore(<IsbnScannerModal open onClose={vi.fn()} onDetected={vi.fn()} />);

    expect(await screen.findByText('Браузер не умеет читать штрихкоды')).toBeInTheDocument();
    // Ручной ввод остаётся на месте: он равноправный путь, а не запасной.
    expect(screen.getByLabelText('Номер с обложки')).toBeInTheDocument();
  });

  it('принимает номер, введённый руками, вместе с дефисами', async () => {
    const onDetected = vi.fn();
    const onClose = vi.fn();
    renderWithStore(<IsbnScannerModal open onClose={onClose} onDetected={onDetected} />);

    await userEvent.type(await screen.findByLabelText('Номер с обложки'), '978-5-389-07993-2');
    await userEvent.click(screen.getByRole('button', { name: 'Найти' }));

    expect(onDetected).toHaveBeenCalledWith('9785389079932');
    expect(onClose).toHaveBeenCalled();
  });

  it('не пропускает номер не той длины', async () => {
    const onDetected = vi.fn();
    renderWithStore(<IsbnScannerModal open onClose={vi.fn()} onDetected={onDetected} />);

    await userEvent.type(await screen.findByLabelText('Номер с обложки'), '978538');
    await userEvent.click(screen.getByRole('button', { name: 'Найти' }));

    expect(screen.getByText(/десять или тринадцать цифр/)).toBeInTheDocument();
    expect(onDetected).not.toHaveBeenCalled();
  });
});

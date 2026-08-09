import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoansTab } from './LoansTab';
import { renderWithStore } from '@/test/renderWithStore';
import { LibraryItem, Loan } from '@/shared/types/library';

const fetchItemLoans = vi.fn();
const createLoan = vi.fn();
const returnLoan = vi.fn();
const deleteLoan = vi.fn();

vi.mock('@/entities/loan', () => ({
  fetchItemLoans: (...args: unknown[]) => fetchItemLoans(...args),
  fetchOpenLoans: vi.fn(),
  createLoan: (...args: unknown[]) => createLoan(...args),
  updateLoan: vi.fn(),
  returnLoan: (...args: unknown[]) => returnLoan(...args),
  deleteLoan: (...args: unknown[]) => deleteLoan(...args)
}));

const item = { id: 'item-1', title: 'Задача трёх тел', kind: 'BOOK', status: 'READING' } as LibraryItem;

const loan = (overrides: Partial<Loan> = {}): Loan => ({
  id: 'loan-1',
  itemId: 'item-1',
  itemTitle: 'Задача трёх тел',
  borrowerName: 'Аня',
  lentOn: '2026-07-01',
  overdue: false,
  daysOut: 37,
  ...overrides
});

describe('LoansTab', () => {
  beforeEach(() => {
    [fetchItemLoans, createLoan, returnLoan, deleteLoan].forEach((mock) => mock.mockReset());
    fetchItemLoans.mockResolvedValue([]);
    createLoan.mockResolvedValue(loan());
    returnLoan.mockResolvedValue(loan({ returnedOn: '2026-08-07' }));
  });

  it('предлагает записать выдачу, пока книга на месте', async () => {
    renderWithStore(<LoansTab item={item} />);

    expect(await screen.findByLabelText('Кому выдана')).toBeInTheDocument();
    expect(screen.getByText('Книгу ещё никому не отдавали')).toBeInTheDocument();
  });

  it('записывает выдачу с именем заёмщика', async () => {
    renderWithStore(<LoansTab item={item} />);

    await userEvent.type(await screen.findByLabelText('Кому выдана'), 'Аня');
    await userEvent.click(screen.getByRole('button', { name: 'Отметить выдачу' }));

    await waitFor(() =>
      expect(createLoan).toHaveBeenCalledWith('item-1', expect.objectContaining({ borrowerName: 'Аня' }))
    );
  });

  /** Пока экземпляр на руках, форму показывать незачем: вторая открытая выдача — это забытая первая. */
  it('прячет форму, пока книга не вернулась', async () => {
    fetchItemLoans.mockResolvedValue([loan()]);
    renderWithStore(<LoansTab item={item} />);

    expect(await screen.findByText(/Экземпляр на руках: Аня/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Кому выдана')).not.toBeInTheDocument();
  });

  it('отмечает возврат одним нажатием', async () => {
    fetchItemLoans.mockResolvedValue([loan()]);
    renderWithStore(<LoansTab item={item} />);

    await userEvent.click(await screen.findByRole('button', { name: /Вернули/ }));

    await waitFor(() => expect(returnLoan).toHaveBeenCalledWith('loan-1'));
  });

  /** Имя заёмщика не склоняется, поэтому оно вынесено из фразы, а нулевой срок — это «сегодня». */
  it('в день выдачи пишет «сегодня», а не «0 дней»', async () => {
    fetchItemLoans.mockResolvedValue([loan({ daysOut: 0 })]);
    renderWithStore(<LoansTab item={item} />);

    expect(await screen.findByText(/выдана сегодня/)).toBeInTheDocument();
  });

  it('помечает просроченную выдачу', async () => {
    fetchItemLoans.mockResolvedValue([loan({ dueOn: '2026-07-15', overdue: true })]);
    renderWithStore(<LoansTab item={item} />);

    expect(await screen.findByText('просрочено')).toBeInTheDocument();
  });
});

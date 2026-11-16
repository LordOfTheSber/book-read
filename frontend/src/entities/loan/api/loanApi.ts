import { httpClient } from '@/shared/api/httpClient';
import { Loan } from '@/shared/types/library';

export interface LoanPayload {
  borrowerName: string;
  borrowerContact?: string;
  lentOn?: string;
  dueOn?: string;
  note?: string;
}

export const fetchItemLoans = async (itemId: string) => {
  const { data } = await httpClient.get<Loan[]>(`/items/${itemId}/loans`);
  return data;
};

/** Что сейчас на руках по всей библиотеке: просроченные первыми. */
export const fetchOpenLoans = async () => {
  const { data } = await httpClient.get<Loan[]>('/loans');
  return data;
};

export const createLoan = async (itemId: string, payload: LoanPayload) => {
  const { data } = await httpClient.post<Loan>(`/items/${itemId}/loans`, payload);
  return data;
};

export const updateLoan = async (loanId: string, payload: LoanPayload) => {
  const { data } = await httpClient.put<Loan>(`/loans/${loanId}`, payload);
  return data;
};

export const returnLoan = async (loanId: string, returnedOn?: string) => {
  const { data } = await httpClient.post<Loan>(`/loans/${loanId}/return`, null, { params: { returnedOn } });
  return data;
};

export const deleteLoan = async (loanId: string) => {
  await httpClient.delete(`/loans/${loanId}`);
};

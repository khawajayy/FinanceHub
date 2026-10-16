import { create } from "zustand";
import type { ExpenseTxn, YearMonth } from "@/engine/expense-engine";
import { currentMonth } from "@/engine/expense-engine";
import type { Asset, Txn } from "@/engine/ledger-engine.js";

/** Cross-page UI state: global modals + the selected expense month. */
export interface InvestPrefill { type: Txn["type"]; asset?: Asset; assetId?: string; qty?: number }

interface ActionsState {
  expenseModal: { open: boolean; editing: ExpenseTxn | null };
  investModal: { open: boolean; txn: Txn | null; prefill: InvestPrefill | null };
  pfOpen: boolean;
  month: YearMonth;
  openExpense: (editing?: ExpenseTxn | null) => void;
  closeExpense: () => void;
  openInvest: (txn?: Txn | null, prefill?: InvestPrefill | null) => void;
  closeInvest: () => void;
  setPf: (open: boolean) => void;
  setMonth: (m: YearMonth) => void;
}

export const useActions = create<ActionsState>((set) => ({
  expenseModal: { open: false, editing: null },
  investModal: { open: false, txn: null, prefill: null },
  pfOpen: false,
  month: currentMonth(),
  openExpense: (editing = null) => set({ expenseModal: { open: true, editing } }),
  closeExpense: () => set((s) => ({ expenseModal: { ...s.expenseModal, open: false } })),
  openInvest: (txn = null, prefill = null) => set({ investModal: { open: true, txn, prefill } }),
  closeInvest: () => set((s) => ({ investModal: { ...s.investModal, open: false } })),
  setPf: (pfOpen) => set({ pfOpen }),
  setMonth: (month) => set({ month }),
}));

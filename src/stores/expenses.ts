import { create } from "zustand";
import { collection, doc, onSnapshot, writeBatch, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEMO, demoExpenses } from "@/lib/demo";
import {
  findDebt, isProvidentFund, parseDebtPayment, parseDebtTitle, todayISO,
  type Account, type AccountKind, type Direction, type ExpenseTxn,
} from "@/engine/expense-engine";
import { toast } from "./ui";

/*
 * Firestore layout (one owner per tree, see firestore.rules):
 *   expenses/{uid}/transactions/{id}  { txn_date, description, amount, category, direction, created_at }
 *   expenses/{uid}/accounts/{id}      { name, kind, balance, sort_order, created_at }
 * Every change is applied to local state first (instant UI), then written as one
 * batch. Firestore's offline cache queues the batch while offline.
 */

export interface TxnInput { txn_date: string; description: string; amount: number; category: string | null; direction: Direction }

type Coll = "transactions" | "accounts";
type Op =
  | { kind: "set"; coll: Coll; id: string; data: Record<string, unknown> }
  | { kind: "update"; coll: Coll; id: string; data: Record<string, unknown> }
  | { kind: "delete"; coll: Coll; id: string };

interface ExpenseState {
  uid: string | null;
  txns: ExpenseTxn[];
  accounts: Account[];
  loaded: boolean;
  error: string | null;
  start: (uid: string) => void;
  stop: () => void;
  addTxn: (t: TxnInput) => Promise<string>;
  updateTxn: (id: string, t: TxnInput) => Promise<void>;
  deleteTxn: (id: string) => Promise<void>;
  addAccount: (kind: AccountKind, name: string, balance: number) => Promise<void>;
  setBalance: (id: string, balance: number) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  adjustDebt: (id: string, mode: "repay" | "borrow", amount: number) => Promise<void>;
  savePF: (balance: number) => Promise<string>;
}

let unsubs: Unsubscribe[] = [];
const round2 = (n: number) => Math.round(n * 100) / 100;
const sortAccounts = (a: Account[]) => [...a].sort((x, y) => x.sort_order - y.sort_order || x.created_at - y.created_at);
/** Client-side Firestore id (works offline). */
const newId = () => doc(collection(db, "_ids")).id;

export const useExpenses = create<ExpenseState>((set, get) => {
  function applyLocal(ops: Op[]) {
    let txns = get().txns, accounts = get().accounts;
    for (const op of ops) {
      const list = (op.coll === "transactions" ? txns : accounts) as { id: string }[];
      let next: { id: string }[];
      if (op.kind === "set") next = [...list.filter((x) => x.id !== op.id), { id: op.id, ...op.data }];
      else if (op.kind === "update") next = list.map((x) => (x.id === op.id ? { ...x, ...op.data } : x));
      else next = list.filter((x) => x.id !== op.id);
      if (op.coll === "transactions") txns = next as ExpenseTxn[]; else accounts = sortAccounts(next as Account[]);
    }
    set({ txns, accounts });
  }

  function commit(ops: Op[]) {
    applyLocal(ops);
    const uid = get().uid;
    if (DEMO || !uid) return;
    const batch = writeBatch(db);
    for (const op of ops) {
      const ref = doc(db, "expenses", uid, op.coll, op.id);
      if (op.kind === "set") batch.set(ref, op.data);
      else if (op.kind === "update") batch.update(ref, op.data as { [k: string]: string | number | null });
      else batch.delete(ref);
    }
    batch.commit().catch((e) => {
      console.error("Expense write failed", e);
      toast(e?.code === "permission-denied" ? "Cloud rejected the change — deploy the latest firestore.rules (see README)" : "Couldn't save to the cloud", true);
    });
  }

  const accountData = (kind: AccountKind, name: string, balance: number) => ({
    name: name.slice(0, 60), kind, balance: round2(balance),
    sort_order: get().accounts.filter((a) => a.kind === kind).length, created_at: Date.now(),
  });

  return {
    uid: null, txns: [], accounts: [], loaded: false, error: null,

    start: (uid) => {
      if (get().uid === uid) return;
      get().stop();
      set({ uid, loaded: false, error: null });
      if (DEMO) { const d = demoExpenses(); set({ txns: d.txns, accounts: sortAccounts(d.accounts), loaded: true }); return; }
      let gotTx = false, gotAc = false;
      const done = () => gotTx && gotAc && set({ loaded: true });
      const onErr = (e: Error) => { console.error(e); set({ error: e.message, loaded: true }); };
      unsubs = [
        onSnapshot(collection(db, "expenses", uid, "transactions"), (snap) => {
          set({ txns: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExpenseTxn, "id">) })) });
          gotTx = true; done();
        }, onErr),
        onSnapshot(collection(db, "expenses", uid, "accounts"), (snap) => {
          set({ accounts: sortAccounts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Account, "id">) }))) });
          gotAc = true; done();
        }, onErr),
      ];
    },

    stop: () => { unsubs.forEach((u) => u()); unsubs = []; set({ uid: null, txns: [], accounts: [], loaded: false }); },

    addTxn: async (t) => {
      const ops: Op[] = [{ kind: "set", coll: "transactions", id: newId(), data: { ...t, amount: round2(t.amount), description: t.description.slice(0, 200), created_at: Date.now() } }];
      // "Debt paid - Name" reduces that debt; "Debt - Name" creates / tops it up.
      let msg = "Transaction added";
      const paid = parseDebtPayment(t.description);
      const added = paid ? null : parseDebtTitle(t.description);
      if (paid) {
        const d = findDebt(get().accounts, paid);
        if (d) { ops.push({ kind: "update", coll: "accounts", id: d.id, data: { balance: round2(Math.max(0, d.balance - t.amount)) } }); msg = `Transaction added · debt "${paid}" reduced`; }
        else msg = `Transaction added · no debt named "${paid}"`;
      } else if (added) {
        const d = findDebt(get().accounts, added);
        ops.push(d ? { kind: "update", coll: "accounts", id: d.id, data: { balance: round2(d.balance + t.amount) } }
          : { kind: "set", coll: "accounts", id: newId(), data: accountData("debt", added, t.amount) });
        msg = `Transaction added · debt "${added}" updated`;
      }
      commit(ops);
      return msg;
    },

    updateTxn: async (id, t) => commit([{ kind: "update", coll: "transactions", id, data: { ...t, amount: round2(t.amount), description: t.description.slice(0, 200) } }]),
    deleteTxn: async (id) => commit([{ kind: "delete", coll: "transactions", id }]),
    addAccount: async (kind, name, balance) => commit([{ kind: "set", coll: "accounts", id: newId(), data: accountData(kind, name, balance) }]),
    setBalance: async (id, balance) => commit([{ kind: "update", coll: "accounts", id, data: { balance: round2(balance) } }]),
    deleteAccount: async (id) => commit([{ kind: "delete", coll: "accounts", id }]),

    // Repay: debt down + OUT expense. Borrow: debt up + IN income.
    adjustDebt: async (id, mode, amount) => {
      const d = get().accounts.find((a) => a.id === id);
      if (!d) return;
      commit([
        { kind: "update", coll: "accounts", id, data: { balance: round2(mode === "repay" ? Math.max(0, d.balance - amount) : d.balance + amount) } },
        { kind: "set", coll: "transactions", id: newId(), data: mode === "repay"
          ? { txn_date: todayISO(), amount: round2(amount), description: `Repaid: ${d.name}`, direction: "OUT", category: "Debt & Loans", created_at: Date.now() }
          : { txn_date: todayISO(), amount: round2(amount), description: `Borrowed: ${d.name}`, direction: "IN", category: null, created_at: Date.now() } },
      ]);
    },

    savePF: async (balance) => {
      const existing = get().accounts.find(isProvidentFund);
      if (existing) { await get().setBalance(existing.id, balance); return existing.name; }
      await get().addAccount("asset", "Provident Fund", balance);
      return "Provident Fund";
    },
  };
});

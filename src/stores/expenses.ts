import { create } from "zustand";
import { collection, doc, onSnapshot, setDoc, writeBatch, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEMO, demoExpenses } from "@/lib/demo";
import {
  CATEGORIES, DEBT_CATEGORY, findDebt, isProvidentFund, parseDebtPayment, parseDebtTitle, todayISO,
  type Account, type AccountKind, type Bucket, type Category, type Direction, type ExpenseTxn,
} from "@/engine/expense-engine";
import { toast } from "./ui";

/*
 * Firestore layout (one owner per tree, see firestore.rules):
 *   expenses/{uid}/transactions/{id}  { txn_date, description, amount, category, direction, created_at, bucket? }
 *   expenses/{uid}/accounts/{id}      { name, kind, balance, sort_order, created_at }
 *   expenses/{uid}/buckets/{id}       { name, emoji, color, budget, status, created_at }
 *   expenses/{uid}/prefs/main         { categories: [{ key, emoji, color }] }  (missing = defaults)
 * Every change is applied to local state first (instant UI), then written as one
 * batch. Firestore's offline cache queues the batch while offline.
 */

export interface TxnInput { txn_date: string; description: string; amount: number; category: string | null; direction: Direction; bucket: string | null }
export interface BucketInput { name: string; emoji: string; color: string; budget: number | null }

type Coll = "transactions" | "accounts" | "buckets";
type Op =
  | { kind: "set"; coll: Coll; id: string; data: Record<string, unknown> }
  | { kind: "update"; coll: Coll; id: string; data: Record<string, unknown> }
  | { kind: "delete"; coll: Coll; id: string };

interface ExpenseState {
  uid: string | null;
  txns: ExpenseTxn[];
  accounts: Account[];
  buckets: Bucket[];
  categories: Category[];
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
  addBucket: (b: BucketInput) => Promise<string>;
  updateBucket: (id: string, patch: Partial<BucketInput> & { status?: Bucket["status"] }) => Promise<void>;
  /** Removes the bucket; its transactions stay, just untagged. Returns how many were untagged. */
  deleteBucket: (id: string) => Promise<number>;
  /** Saves the list; `renames` (old → new) and `removed` (→ uncategorised) are applied to existing transactions. */
  saveCategories: (next: Category[], renames?: Record<string, string>, removed?: string[]) => Promise<void>;
}

let unsubs: Unsubscribe[] = [];
const round2 = (n: number) => Math.round(n * 100) / 100;
const sortAccounts = (a: Account[]) => [...a].sort((x, y) => x.sort_order - y.sort_order || x.created_at - y.created_at);
/** Active first, newest first. */
const sortBuckets = (b: Bucket[]) => [...b].sort((x, y) => (x.status === y.status ? y.created_at - x.created_at : x.status === "active" ? -1 : 1));
const cleanCategories = (raw: unknown): Category[] => {
  const list = Array.isArray(raw) ? raw.filter((c): c is Category => !!c && typeof c.key === "string" && c.key.trim() !== "") : [];
  return list.length ? list.map((c) => ({ key: c.key, emoji: c.emoji || "🏷️", color: c.color || "#94a3b8" })) : [...CATEGORIES];
};
/** Client-side Firestore id (works offline). */
const newId = () => doc(collection(db, "_ids")).id;

function onWriteError(e: { code?: string }) {
  console.error("Expense write failed", e);
  toast(e?.code === "permission-denied" ? "Cloud rejected the change — deploy the latest firestore.rules (see README)" : "Couldn't save to the cloud", true);
}

export const useExpenses = create<ExpenseState>((set, get) => {
  function applyLocal(ops: Op[]) {
    let txns = get().txns, accounts = get().accounts, buckets = get().buckets;
    for (const op of ops) {
      const list = (op.coll === "transactions" ? txns : op.coll === "accounts" ? accounts : buckets) as { id: string }[];
      let next: { id: string }[];
      if (op.kind === "set") next = [...list.filter((x) => x.id !== op.id), { id: op.id, ...op.data }];
      else if (op.kind === "update") next = list.map((x) => (x.id === op.id ? { ...x, ...op.data } : x));
      else next = list.filter((x) => x.id !== op.id);
      if (op.coll === "transactions") txns = next as ExpenseTxn[];
      else if (op.coll === "accounts") accounts = sortAccounts(next as Account[]);
      else buckets = sortBuckets(next as Bucket[]);
    }
    set({ txns, accounts, buckets });
  }

  function commit(ops: Op[]) {
    applyLocal(ops);
    const uid = get().uid;
    if (DEMO || !uid) return;
    // Firestore caps a batch at 500 writes; a category rename can touch more transactions than that.
    for (let i = 0; i < ops.length; i += 450) {
      const batch = writeBatch(db);
      for (const op of ops.slice(i, i + 450)) {
        const ref = doc(db, "expenses", uid, op.coll, op.id);
        if (op.kind === "set") batch.set(ref, op.data);
        else if (op.kind === "update") batch.update(ref, op.data as { [k: string]: string | number | null });
        else batch.delete(ref);
      }
      batch.commit().catch(onWriteError);
    }
  }

  const txnData = (t: TxnInput) => ({ ...t, amount: round2(t.amount), description: t.description.slice(0, 200), bucket: t.bucket || null });

  const bucketData = (b: BucketInput) => ({
    name: b.name.trim().slice(0, 60), emoji: (b.emoji.trim() || "🧺").slice(0, 8), color: b.color,
    budget: b.budget != null && b.budget > 0 ? round2(b.budget) : null,
  });

  const accountData = (kind: AccountKind, name: string, balance: number) => ({
    name: name.slice(0, 60), kind, balance: round2(balance),
    sort_order: get().accounts.filter((a) => a.kind === kind).length, created_at: Date.now(),
  });

  return {
    uid: null, txns: [], accounts: [], buckets: [], categories: [...CATEGORIES], loaded: false, error: null,

    start: (uid) => {
      if (get().uid === uid) return;
      get().stop();
      set({ uid, loaded: false, error: null });
      if (DEMO) { const d = demoExpenses(); set({ txns: d.txns, accounts: sortAccounts(d.accounts), buckets: sortBuckets(d.buckets), loaded: true }); return; }
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
        // Newer paths: if their rules aren't deployed yet, don't block the whole module.
        onSnapshot(collection(db, "expenses", uid, "buckets"), (snap) => {
          set({ buckets: sortBuckets(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Bucket, "id">) }))) });
        }, (e) => console.error(e)),
        onSnapshot(doc(db, "expenses", uid, "prefs", "main"), (snap) => {
          set({ categories: cleanCategories(snap.data()?.categories) });
        }, (e) => console.error(e)),
      ];
    },

    stop: () => { unsubs.forEach((u) => u()); unsubs = []; set({ uid: null, txns: [], accounts: [], buckets: [], categories: [...CATEGORIES], loaded: false }); },

    addTxn: async (t) => {
      const ops: Op[] = [{ kind: "set", coll: "transactions", id: newId(), data: { ...txnData(t), created_at: Date.now() } }];
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

    updateTxn: async (id, t) => commit([{ kind: "update", coll: "transactions", id, data: txnData(t) }]),
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
          ? { txn_date: todayISO(), amount: round2(amount), description: `Repaid: ${d.name}`, direction: "OUT", category: DEBT_CATEGORY, created_at: Date.now() }
          : { txn_date: todayISO(), amount: round2(amount), description: `Borrowed: ${d.name}`, direction: "IN", category: null, created_at: Date.now() } },
      ]);
    },

    savePF: async (balance) => {
      const existing = get().accounts.find(isProvidentFund);
      if (existing) { await get().setBalance(existing.id, balance); return existing.name; }
      await get().addAccount("asset", "Provident Fund", balance);
      return "Provident Fund";
    },

    addBucket: async (b) => {
      const id = newId();
      commit([{ kind: "set", coll: "buckets", id, data: { ...bucketData(b), status: "active", created_at: Date.now() } }]);
      return id;
    },

    updateBucket: async (id, patch) => {
      const cur = get().buckets.find((b) => b.id === id);
      if (!cur) return;
      commit([{ kind: "update", coll: "buckets", id, data: { ...bucketData({ ...cur, ...patch }), status: patch.status || cur.status } }]);
    },

    deleteBucket: async (id) => {
      const tagged = get().txns.filter((t) => t.bucket === id);
      commit([
        ...tagged.map((t): Op => ({ kind: "update", coll: "transactions", id: t.id, data: { bucket: null } })),
        { kind: "delete", coll: "buckets", id },
      ]);
      return tagged.length;
    },

    saveCategories: async (next, renames = {}, removed = []) => {
      const categories = next.map((c) => ({ key: c.key.trim().slice(0, 80), emoji: c.emoji.trim() || "🏷️", color: c.color }));
      set({ categories });
      const ops: Op[] = [];
      for (const t of get().txns) {
        if (!t.category) continue;
        if (renames[t.category]) ops.push({ kind: "update", coll: "transactions", id: t.id, data: { category: renames[t.category] } });
        else if (removed.includes(t.category)) ops.push({ kind: "update", coll: "transactions", id: t.id, data: { category: null } });
      }
      if (ops.length) commit(ops);
      const uid = get().uid;
      if (!DEMO && uid) setDoc(doc(db, "expenses", uid, "prefs", "main"), { categories }).catch(onWriteError);
    },
  };
});

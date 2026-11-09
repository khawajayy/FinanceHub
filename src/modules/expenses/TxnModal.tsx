import { motion } from "framer-motion";
import { ArrowDownCircle, ArrowUpCircle, Building2, ReceiptText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AmountInput, Field, Modal, Segmented } from "@/components/ui";
import {
  AUTO_BANK, NO_BANK, applyMoves, defaultFormDate, orderBanks, parseDebtPayment, parseDebtTitle, planBankMoves, sourceOf, type BankSource, type Direction,
} from "@/engine/expense-engine";
import { cx, fmtAmtStr, fmtRs, stripNum } from "@/lib/format";
import { useActions } from "@/stores/actions";
import { useExpenses } from "@/stores/expenses";
import { toast } from "@/stores/ui";

export function ExpenseTxnModal() {
  const { open, editing, bucket: presetBucket } = useActions((s) => s.expenseModal);
  const close = useActions((s) => s.closeExpense);
  const month = useActions((s) => s.month);
  const setMonth = useActions((s) => s.setMonth);
  const addTxn = useExpenses((s) => s.addTxn);
  const updateTxn = useExpenses((s) => s.updateTxn);
  const categories = useExpenses((s) => s.categories);
  const allBuckets = useExpenses((s) => s.buckets);
  const accounts = useExpenses((s) => s.accounts);
  const bankPriority = useExpenses((s) => s.bankPriority);
  const autoBank = useExpenses((s) => s.autoBank);

  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [dir, setDir] = useState<Direction>("OUT");
  const [cat, setCat] = useState<string>(categories[0].key);
  const [bucket, setBucket] = useState<string | null>(null);
  const [source, setSource] = useState<BankSource>(AUTO_BANK);
  const [initialSource, setInitialSource] = useState<BankSource>(AUTO_BANK);

  useEffect(() => {
    if (!open) return;
    setDate(editing?.txn_date || defaultFormDate(month));
    setAmount(editing ? fmtAmtStr(editing.amount) : "");
    setDesc(editing?.description || "");
    setDir(editing?.direction || "OUT");
    setCat(editing?.category || categories[0].key);
    setBucket(editing ? editing.bucket || null : presetBucket);
    // Editing shows where the money went; transactions from before auto-deduct show "Don't change".
    const src = editing ? sourceOf(editing) : autoBank ? AUTO_BANK : NO_BANK;
    setSource(src); setInitialSource(src);
  }, [open, editing, month, presetBucket]);

  // Banks as they'd be without this transaction, in priority order, for the preview.
  const banks = useMemo(() => orderBanks(applyMoves(accounts, editing?.bank_moves, -1), bankPriority), [accounts, editing, bankPriority]);
  const preview = useMemo(() => {
    const amt = stripNum(amount);
    if (!(amt > 0)) return [];
    return Object.entries(planBankMoves(amt, dir, banks, source)).map(([id, d]) => {
      const b = banks.find((x) => x.id === id)!;
      return { name: b.name, delta: d, after: b.balance + d };
    });
  }, [amount, dir, banks, source]);

  // Closed buckets are hidden from the picker, unless this transaction is already in one.
  const buckets = allBuckets.filter((b) => b.status === "active" || b.id === bucket);

  const save = async () => {
    const amt = stripNum(amount);
    if (!date || !desc.trim() || !(amt >= 0)) { toast("Please fill in date, description and a valid amount.", true); return; }
    // An edit that doesn't change the amount, direction or bank leaves the balances alone.
    const same = editing && source === initialSource && Math.abs(amt - editing.amount) < 0.005 && dir === editing.direction;
    const payload = { txn_date: date, amount: amt, description: desc.trim(), direction: dir, category: dir === "OUT" ? cat : null, bucket, source: same ? undefined : source };
    if (editing) { await updateTxn(editing.id, payload); toast("Transaction updated"); }
    else toast(await addTxn(payload));
    const [y, m] = date.split("-").map(Number);
    setMonth({ year: y, month: m });
    close();
  };

  const debtHint = !editing && (parseDebtPayment(desc) ? `Will reduce the debt "${parseDebtPayment(desc)}"` : parseDebtTitle(desc) ? `Will create / top up the debt "${parseDebtTitle(desc)}"` : null);

  return (
    <Modal open={open} onClose={close} title={editing ? "Edit transaction" : "New transaction"} icon={<ReceiptText size={16} />}
      footer={<><button className="btn btn-ghost" onClick={close}>Cancel</button><button className="btn btn-primary" onClick={save}>{editing ? "Save changes" : "Add transaction"}</button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Segmented id="exp-dir" className="w-full" value={dir} onChange={setDir} options={[
          { value: "OUT", label: <span className="flex items-center justify-center gap-1.5"><ArrowDownCircle size={15} className="text-neg" /> Spent</span> },
          { value: "IN", label: <span className="flex items-center justify-center gap-1.5"><ArrowUpCircle size={15} className="text-pos" /> Received</span> },
        ]} />
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-lg font-semibold text-muted">Rs</span>
          <AmountInput autoFocus value={amount} onChange={setAmount} placeholder="0" className={cx("!py-4 !pl-14 !text-2xl font-semibold", dir === "IN" ? "!text-pos" : "!text-neg")} aria-label="Amount" />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_170px]">
          <Field label="Description" hint={debtHint ? <span className="text-violet">↳ {debtHint}</span> : <>Tip: <b>"Debt - Name"</b> logs a debt, <b>"Debt paid - Name"</b> reduces it.</>}>
            <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Grocery, Salary, Rent" maxLength={200} />
          </Field>
          <Field label="Date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        {dir === "OUT" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
            <span className="field-label">Category</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {categories.map((c) => (
                <button type="button" key={c.key} onClick={() => setCat(c.key)}
                  className={cx("flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium ring-1 transition",
                    cat === c.key ? "bg-line/[.06] text-ink" : "text-muted ring-line/10 hover:text-ink")}
                  style={cat === c.key ? { boxShadow: `0 0 0 1px ${c.color}, 0 0 18px -4px ${c.color}` } : undefined}>
                  <span className="text-base">{c.emoji}</span><span className="line-clamp-2">{c.key}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
        {buckets.length > 0 && (
          <div>
            <span className="field-label">Bucket <span className="font-normal normal-case tracking-normal text-muted">(optional)</span></span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setBucket(null)}
                className={cx("rounded-xl px-3 py-1.5 text-xs font-medium ring-1 transition", !bucket ? "bg-line/[.06] text-ink ring-line/25" : "text-muted ring-line/10 hover:text-ink")}>
                None
              </button>
              {buckets.map((b) => (
                <button type="button" key={b.id} onClick={() => setBucket(b.id)}
                  className={cx("flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium ring-1 transition",
                    bucket === b.id ? "bg-line/[.06] text-ink" : "text-muted ring-line/10 hover:text-ink")}
                  style={bucket === b.id ? { boxShadow: `0 0 0 1px ${b.color}, 0 0 18px -4px ${b.color}` } : undefined}>
                  <span className="text-sm">{b.emoji}</span>{b.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {banks.length > 0 && (
          <div>
            <span className="field-label">{dir === "IN" ? "Received into" : "Paid from"}</span>
            <div className="flex flex-wrap gap-2">
              {[...(autoBank || source === AUTO_BANK ? [{ id: AUTO_BANK, label: "Auto · by priority" }] : []), ...banks.map((b) => ({ id: b.id, label: b.name })), { id: NO_BANK, label: "Don't change balances" }].map((o) => (
                <button type="button" key={o.id} onClick={() => setSource(o.id)}
                  className={cx("flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium ring-1 transition",
                    source === o.id ? "bg-cyan/10 text-ink ring-cyan/40" : "text-muted ring-line/10 hover:text-ink")}>
                  {o.id !== AUTO_BANK && o.id !== NO_BANK && <Building2 size={12} />}{o.label}
                </button>
              ))}
            </div>
            {preview.length > 0 && (
              <div className="mt-2 space-y-0.5 text-xs text-muted">
                {preview.map((p) => (
                  <div key={p.name} className="flex gap-2">
                    <span>{p.name}</span>
                    <span className={cx("num", p.delta < 0 ? "neg" : "pos")}>{p.delta < 0 ? "−" : "+"} {fmtRs(Math.abs(p.delta))}</span>
                    <span className={cx("num ml-auto", p.after < 0 && "neg")}>→ {fmtRs(p.after)}{p.after < 0 && " (overdrawn)"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

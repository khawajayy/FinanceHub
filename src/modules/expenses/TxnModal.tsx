import { motion } from "framer-motion";
import { ArrowDownCircle, ArrowUpCircle, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";
import { AmountInput, Field, Modal, Segmented } from "@/components/ui";
import { CATEGORIES, defaultFormDate, parseDebtPayment, parseDebtTitle, type Direction } from "@/engine/expense-engine";
import { cx, fmtAmtStr, stripNum } from "@/lib/format";
import { useActions } from "@/stores/actions";
import { useExpenses } from "@/stores/expenses";
import { toast } from "@/stores/ui";

export function ExpenseTxnModal() {
  const { open, editing } = useActions((s) => s.expenseModal);
  const close = useActions((s) => s.closeExpense);
  const month = useActions((s) => s.month);
  const setMonth = useActions((s) => s.setMonth);
  const addTxn = useExpenses((s) => s.addTxn);
  const updateTxn = useExpenses((s) => s.updateTxn);

  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [dir, setDir] = useState<Direction>("OUT");
  const [cat, setCat] = useState<string>(CATEGORIES[0].key);

  useEffect(() => {
    if (!open) return;
    setDate(editing?.txn_date || defaultFormDate(month));
    setAmount(editing ? fmtAmtStr(editing.amount) : "");
    setDesc(editing?.description || "");
    setDir(editing?.direction || "OUT");
    setCat(editing?.category || CATEGORIES[0].key);
  }, [open, editing, month]);

  const save = async () => {
    const amt = stripNum(amount);
    if (!date || !desc.trim() || !(amt >= 0)) { toast("Please fill in date, description and a valid amount.", true); return; }
    const payload = { txn_date: date, amount: amt, description: desc.trim(), direction: dir, category: dir === "OUT" ? cat : null };
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
              {CATEGORIES.map((c) => (
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
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

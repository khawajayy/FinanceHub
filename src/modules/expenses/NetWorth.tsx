import { AnimatePresence, motion } from "framer-motion";
import { Building2, Calculator, Gem, HandCoins, Minus, Plus, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { AmountInput, AnimatedNumber, Card, CardHeader } from "@/components/ui";
import { Donut } from "@/components/charts";
import { accountTotals, type Account, type AccountKind } from "@/engine/expense-engine";
import { cx, fmtAmtStr, fmtRs, stripNum } from "@/lib/format";
import { useActions } from "@/stores/actions";
import { useExpenses } from "@/stores/expenses";
import { confirmDialog, promptDialog, toast } from "@/stores/ui";
import { LoadingGrid, PageTitle } from "./common";

function AccountRow({ a }: { a: Account }) {
  const setBalance = useExpenses((s) => s.setBalance);
  const del = useExpenses((s) => s.deleteAccount);
  const adjustDebt = useExpenses((s) => s.adjustDebt);
  const [val, setVal] = useState(fmtAmtStr(a.balance));
  useEffect(() => setVal(fmtAmtStr(a.balance)), [a.balance]);

  const commit = async () => {
    const n = val.trim() === "" ? 0 : stripNum(val);
    if (!Number.isFinite(n)) { setVal(fmtAmtStr(a.balance)); toast("Enter a valid number", true); return; }
    if (Math.abs(n - a.balance) < 0.005) return;
    await setBalance(a.id, n); toast(`${a.name} saved`);
  };
  const debt = async (mode: "repay" | "borrow") => {
    const raw = await promptDialog(mode === "repay" ? "Record repayment" : "Record borrowing", `How much did you ${mode} for "${a.name}"? This also logs a transaction for today.`, { type: "number", placeholder: "Amount in Rs" });
    if (raw === null) return;
    const amt = parseFloat(raw);
    if (!(amt > 0)) { toast("Enter an amount greater than 0.", true); return; }
    await adjustDebt(a.id, mode, amt);
    toast(mode === "repay" ? "Repayment logged" : "Borrowing logged");
  };
  const remove = async () => {
    if (await confirmDialog("Remove account", `Remove "${a.name}"? This cannot be undone.`, { confirmText: "Remove", danger: true })) del(a.id);
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }} className="group flex items-center gap-2 px-5 py-2.5">
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.name}</span>
      {a.kind === "debt" && <>
        <button className="btn btn-sm !text-pos" title="Repay (logs an expense)" onClick={() => debt("repay")}><Minus size={13} />Repay</button>
        <button className="btn btn-sm !text-amber" title="Borrow more (logs income)" onClick={() => debt("borrow")}><Plus size={13} />Borrow</button>
      </>}
      <AmountInput value={val} onChange={setVal} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={cx("!w-36 !py-1.5 text-right", a.kind === "debt" && "!text-neg")} aria-label={`${a.name} balance`} />
      <button className="icon-btn opacity-60 hover:!text-neg group-hover:opacity-100" onClick={remove} title="Remove"><X size={15} /></button>
    </motion.div>
  );
}

function Section({ kind, title, icon, total, hint, placeholder, delay, action, accent }: {
  kind: AccountKind; title: string; icon: ReactNode; total: number; hint?: ReactNode; placeholder: string; delay: number; action?: ReactNode; accent: string;
}) {
  const accounts = useExpenses((s) => s.accounts).filter((a) => a.kind === kind);
  const add = useExpenses((s) => s.addAccount);
  const [name, setName] = useState("");
  const [bal, setBal] = useState("");
  const submit = async () => {
    if (!name.trim()) return;
    await add(kind, name.trim(), stripNum(bal) || 0);
    setName(""); setBal(""); toast("Added");
  };
  return (
    <Card delay={delay}>
      <CardHeader title={title} icon={icon} right={<>{action}<AnimatedNumber value={total} format={fmtRs} className={cx("text-base font-semibold", accent)} /></>} />
      {hint && <p className="border-b hairline px-5 py-3 text-xs leading-relaxed text-muted">{hint}</p>}
      <div className="py-2">
        <AnimatePresence initial={false}>{accounts.map((a) => <AccountRow key={a.id} a={a} />)}</AnimatePresence>
        {!accounts.length && <div className="px-5 py-4 text-sm text-muted">{kind === "debt" ? "No debts recorded — nice." : "Nothing here yet."}</div>}
      </div>
      <form className="flex gap-2 border-t hairline p-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input className="input !py-2" placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <AmountInput className="!w-36 !py-2" placeholder="Balance" value={bal} onChange={setBal} />
        <button className="btn btn-primary !px-3" type="submit" aria-label="Add"><Plus size={16} /></button>
      </form>
    </Card>
  );
}

export default function NetWorth() {
  const loaded = useExpenses((s) => s.loaded);
  const accounts = useExpenses((s) => s.accounts);
  const setPf = useActions((s) => s.setPf);
  const t = accountTotals(accounts);
  return (
    <>
      <PageTitle title="Net Worth" sub="Assets, bank balances and debts — ongoing, not per month" />
      {!loaded ? <LoadingGrid /> : (
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <Section kind="asset" title="Assets / money bound" icon={<Gem size={16} />} total={t.assets} placeholder="New asset (e.g. Provident Fund)" delay={0} accent="text-violet"
              action={<button className="btn btn-sm" onClick={() => setPf(true)}><Calculator size={13} /> PF calculator</button>} />
            <Section kind="bank" title="Bank accounts" icon={<Building2 size={16} />} total={t.banks} placeholder="New account name" delay={0.05} accent="text-cyan" />
            <Section kind="debt" title="Debts / liabilities" icon={<HandCoins size={16} />} total={t.debts} placeholder="New debt (e.g. Car loan)" delay={0.1} accent="neg"
              hint={<>Money you owe — subtracted from net worth. <b>Repay</b> / <b>Borrow</b> also log a transaction. A transaction titled <b>"Debt - Name"</b> creates or tops up a debt; <b>"Debt paid - Name"</b> reduces it.</>} />
          </div>
          <Card className="h-fit p-6 xl:sticky xl:top-4" delay={0.15}>
            <div className="label">Total net worth</div>
            <AnimatedNumber value={t.net} format={fmtRs} className="mt-2 block text-3xl font-semibold gradient-text" />
            <div className="my-6 flex justify-center">
              <Donut size={190} stroke={18} data={[
                { key: "Assets", value: Math.max(0, t.assets), color: "rgb(var(--violet))" },
                { key: "Banks", value: Math.max(0, t.banks), color: "rgb(var(--cyan))" },
                { key: "Debts", value: Math.max(0, t.debts), color: "rgb(var(--neg))" },
              ]} center={<div><div className="label !text-[9.5px]">Debt ratio</div><div className="num mt-1 text-lg font-semibold">{t.assets + t.banks > 0 ? `${((t.debts / (t.assets + t.banks)) * 100).toFixed(1)}%` : "—"}</div></div>} />
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex"><span className="flex items-center gap-2 text-muted"><i className="h-2 w-2 rounded-full bg-violet" />Assets</span><span className="num ml-auto">{fmtRs(t.assets)}</span></div>
              <div className="flex"><span className="flex items-center gap-2 text-muted"><i className="h-2 w-2 rounded-full bg-cyan" />Banks</span><span className="num ml-auto">{fmtRs(t.banks)}</span></div>
              <div className="flex"><span className="flex items-center gap-2 text-muted"><i className="h-2 w-2 rounded-full bg-neg" />Debts</span><span className="num ml-auto neg">− {fmtRs(t.debts)}</span></div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

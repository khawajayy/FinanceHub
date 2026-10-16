import { AnimatePresence, motion } from "framer-motion";
import { Calculator, ChevronDown, Gem } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatedNumber, Field, Modal, Segmented } from "@/components/ui";
import { calculatePF, isProvidentFund } from "@/engine/expense-engine";
import { cx, fmtRs } from "@/lib/format";
import { useActions } from "@/stores/actions";
import { useExpenses } from "@/stores/expenses";
import { confirmDialog, toast } from "@/stores/ui";

function Chips({ values, current, onPick, fmt }: { values: number[]; current: number; onPick: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {values.map((v) => (
        <button key={v} type="button" onClick={() => onPick(v)}
          className={cx("chip !normal-case !tracking-normal !text-[11px] transition", current === v && "!bg-cyan/15 !text-cyan ring-1 ring-cyan/30")}>{fmt(v)}</button>
      ))}
    </div>
  );
}

const num = (v: string) => parseFloat(v) || 0;

export function PFCalculator() {
  const open = useActions((s) => s.pfOpen);
  const setOpen = useActions((s) => s.setPf);
  const accounts = useExpenses((s) => s.accounts);
  const savePF = useExpenses((s) => s.savePF);

  const [initial, setInitial] = useState("0");
  const [emp, setEmp] = useState("25000");
  const [match, setMatch] = useState<"1" | "0.5" | "0" | "custom">("1");
  const [employer, setEmployer] = useState("25000");
  const [years, setYears] = useState(15);
  const [rate, setRate] = useState("12");
  const [inc, setInc] = useState("5");
  const [taxOn, setTaxOn] = useState(true);
  const [taxRate, setTaxRate] = useState("10");
  const [scope, setScope] = useState<"interest" | "total">("interest");
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    if (!open) return;
    const pf = accounts.find(isProvidentFund);
    if (pf && (!num(initial))) setInitial(String(pf.balance));
   
  }, [open]);

  const setEmpAndMatch = (v: string) => { setEmp(v); if (match !== "custom") setEmployer(String(Math.round(num(v) * parseFloat(match)))); };
  const pickMatch = (m: typeof match) => { setMatch(m); if (m !== "custom") setEmployer(String(Math.round(num(emp) * parseFloat(m)))); };

  const r = useMemo(() => calculatePF({
    initialBalance: num(initial), empMonthly: num(emp), employerMonthly: num(employer), years, annualRatePct: num(rate),
    annualIncrementPct: num(inc), taxEnabled: taxOn, taxRatePct: num(taxRate), taxScope: scope,
  }), [initial, emp, employer, years, rate, inc, taxOn, taxRate, scope]);

  const tot = r.totalEmployeeContrib + r.totalEmployerContrib + r.totalInterest || 1;
  const pE = (r.totalEmployeeContrib / tot) * 100, pR = (r.totalEmployerContrib / tot) * 100, pI = Math.max(0, 100 - pE - pR);

  const save = async () => {
    if (!(await confirmDialog("Save to assets", `Save Provident Fund to your assets with the current balance of ${fmtRs(r.initialBalance)}?`, { confirmText: "Save" }))) return;
    const name = await savePF(r.initialBalance);
    toast(`"${name}" set to ${fmtRs(r.initialBalance)}`);
    setOpen(false);
  };
  const fetchAsset = () => {
    const a = accounts.find(isProvidentFund) || accounts.find((x) => x.kind === "asset");
    if (a) { setInitial(String(a.balance)); toast(`Loaded ${fmtRs(a.balance)} from "${a.name}"`); }
    else toast("No asset accounts found to fetch from.", true);
  };

  const StatBox = ({ t, v, s, c }: { t: string; v: number; s: string; c?: string }) => (
    <div className="rounded-2xl bg-line/[.03] p-3.5 ring-1 ring-line/5">
      <div className="text-[11px] text-muted">{t}</div>
      <AnimatedNumber value={v} format={fmtRs} className={cx("mt-1 block text-[15px] font-semibold", c)} />
      <div className="mt-0.5 text-[10.5px] text-muted">{s}</div>
    </div>
  );
  const L = ({ children }: { children: ReactNode }) => <span className="field-label">{children}</span>;

  return (
    <Modal open={open} onClose={() => setOpen(false)} wide title="Provident Fund calculator" icon={<Calculator size={16} />}
      footer={<><button className="btn btn-ghost" onClick={() => setOpen(false)}>Close</button><button className="btn btn-primary" onClick={save}><Gem size={15} /> Save to assets</button></>}>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan/15 via-violet/10 to-pink/10 p-5 ring-1 ring-cyan/20">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label">Projected take-home at maturity</span>
          <span className={cx("chip ml-auto", taxOn && num(taxRate) > 0 ? "!bg-amber/15 !text-amber" : "!bg-pos/15 !text-pos")}>{taxOn && num(taxRate) > 0 ? `${num(taxRate)}% tax applied` : "Tax-exempt"}</span>
        </div>
        <AnimatedNumber value={r.netMaturity} format={fmtRs} className="mt-2 block text-3xl font-semibold sm:text-4xl" />
        <div className="mt-1 text-xs text-muted">Gross <b className="num text-ink">{fmtRs(r.grossMaturity)}</b> · Tax <b className="num neg">− {fmtRs(r.taxDeduction)}</b></div>
        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-line/10">
          <motion.div className="bg-cyan" animate={{ width: `${pE}%` }} />
          <motion.div className="bg-violet" animate={{ width: `${pR}%` }} />
          <motion.div className="bg-pos" animate={{ width: `${pI}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-cyan" />Employee {pE.toFixed(0)}%</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-violet" />Employer {pR.toFixed(0)}%</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-pos" />Interest {pI.toFixed(0)}%</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatBox t="👤 Employee total" v={r.totalEmployeeContrib} s={`${fmtRs(num(emp))} / mo`} />
        <StatBox t="🏢 Employer match" v={r.totalEmployerContrib} s={`${num(emp) > 0 ? ((num(employer) / num(emp)) * 100).toFixed(0) : 0}% match`} />
        <StatBox t="📈 Interest earned" v={r.totalInterest} s={`@ ${num(rate)}% p.a.`} c="pos" />
        <StatBox t="🏛️ Est. tax" v={r.taxDeduction} s={taxOn ? `${num(taxRate)}% rate` : "Disabled"} c="neg" />
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <div className="flex items-center"><L>Current PF balance (Rs)</L><button type="button" className="mb-1.5 ml-auto text-[11px] font-semibold text-cyan" onClick={fetchAsset}>Fetch from assets</button></div>
          <input className="input num" type="number" min={0} step={5000} value={initial} onChange={(e) => setInitial(e.target.value)} inputMode="decimal" />
        </div>
        <Field label="Employee monthly contribution (Rs)">
          <input className="input num" type="number" min={0} step={1000} value={emp} onChange={(e) => setEmpAndMatch(e.target.value)} inputMode="decimal" />
          <Chips values={[10000, 25000, 50000, 100000]} current={num(emp)} onPick={(v) => setEmpAndMatch(String(v))} fmt={(v) => `${v / 1000}k`} />
        </Field>
        <div>
          <L>Employer match ratio</L>
          <Segmented id="pf-match" size="sm" className="w-full" value={match} onChange={pickMatch}
            options={[{ value: "1", label: "100%" }, { value: "0.5", label: "50%" }, { value: "0", label: "0%" }, { value: "custom", label: "Custom" }]} />
        </div>
        <Field label="Employer monthly match (Rs)" hint={<>Total monthly deposit: <b className="num text-ink">{fmtRs(num(emp) + num(employer))}</b></>}>
          <input className="input num" type="number" min={0} step={1000} value={employer} inputMode="decimal"
            onChange={(e) => { setEmployer(e.target.value); const ratio = num(emp) > 0 ? num(e.target.value) / num(emp) : -1; setMatch(ratio === 1 ? "1" : ratio === 0.5 ? "0.5" : ratio === 0 ? "0" : "custom"); }} />
        </Field>
        <div>
          <L>Duration: <b className="text-ink">{years} year{years === 1 ? "" : "s"}</b></L>
          <div className="flex items-center gap-3">
            <input type="range" min={1} max={40} value={years} onChange={(e) => setYears(+e.target.value)} className="flex-1" />
            <input className="input num !w-20 !py-1.5" type="number" min={1} max={40} value={years} onChange={(e) => setYears(Math.max(1, Math.min(40, +e.target.value || 1)))} />
          </div>
          <Chips values={[5, 10, 15, 20, 25, 30]} current={years} onPick={setYears} fmt={(v) => `${v}y`} />
        </div>
        <Field label="Expected annual return (%)">
          <input className="input num" type="number" min={1} max={30} step={0.25} value={rate} onChange={(e) => setRate(e.target.value)} />
          <Chips values={[8, 10, 12, 14, 16]} current={num(rate)} onPick={(v) => setRate(String(v))} fmt={(v) => `${v}%`} />
        </Field>
        <Field label="Annual contribution increment (%)" hint="Simulates yearly raises (0% for flat)">
          <input className="input num" type="number" min={0} max={25} step={1} value={inc} onChange={(e) => setInc(e.target.value)} />
        </Field>
        <div className="rounded-2xl bg-line/[.03] p-4 ring-1 ring-line/5">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
            <button type="button" role="switch" aria-checked={taxOn} onClick={() => setTaxOn(!taxOn)}
              className={cx("relative h-6 w-11 rounded-full transition", taxOn ? "bg-cyan" : "bg-line/20")}>
              <motion.span layout className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" style={{ left: taxOn ? 22 : 2 }} />
            </button>
            Deduct taxes on withdrawal
          </label>
          <AnimatePresence>{taxOn && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input className="input num !py-1.5" type="number" min={0} max={50} step={0.5} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} aria-label="Tax rate" />
                <select className="input !py-1.5" value={scope} onChange={(e) => setScope(e.target.value as "interest" | "total")} aria-label="Tax scope">
                  <option value="interest">On interest only</option><option value="total">On total corpus</option>
                </select>
              </div>
              <Chips values={[0, 5, 10, 15, 20]} current={num(taxRate)} onPick={(v) => setTaxRate(String(v))} fmt={(v) => `${v}%`} />
            </motion.div>
          )}</AnimatePresence>
        </div>
      </div>

      <button type="button" className="btn mt-5 w-full" onClick={() => setShowTable(!showTable)}>
        📅 Year-by-year growth <motion.span animate={{ rotate: showTable ? 180 : 0 }}><ChevronDown size={15} /></motion.span>
      </button>
      <AnimatePresence>{showTable && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
          <div className="mt-3 max-h-80 overflow-auto rounded-2xl ring-1 ring-line/10">
            <table className="tbl num text-xs">
              <thead><tr><th>Year</th><th>Employee</th><th>Employer</th><th>Interest</th><th>Balance</th><th>Net after tax</th></tr></thead>
              <tbody>{r.schedule.map((y) => (
                <tr key={y.year}><td>Y{y.year}</td><td>{fmtRs(y.empContrib)}</td><td>{fmtRs(y.employerContrib)}</td><td className="pos">+{fmtRs(y.interest)}</td><td className="font-semibold">{fmtRs(y.closingBalance)}</td><td>{fmtRs(y.netAfterTax)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </motion.div>
      )}</AnimatePresence>
    </Modal>
  );
}

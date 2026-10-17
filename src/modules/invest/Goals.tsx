import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Pencil, Plus, RotateCcw, Target, Trash2, X, Table2 } from "lucide-react";
import { useEffect, useState } from "react";
import GoalCalc from "@/engine/goal-calc.js";
import LE, { type Goal } from "@/engine/ledger-engine.js";
import { AmountInput, Card, Empty, Field, Ring, Segmented, Tag } from "@/components/ui";
import { cx, fmtAmtStr, fmtUSD, formatDurationDays, stripNum } from "@/lib/format";
import { ledgerTradeDays, useInvest } from "@/stores/invest";
import { confirmDialog, toast } from "@/stores/ui";
import { PageTitle } from "@/modules/expenses/common";
import { usePortfolio, useSecFmt } from "./common";

const EPS = LE.EPS;
const sameDays = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 5e-4);
const fmtDaysInput = (d: number | null | undefined) => (d != null && Number.isFinite(d) && d > 0 ? String(Number(d.toPrecision(4))) : "");

function useLedgerDays() {
  const transactions = useInvest((s) => s.transactions);
  const assets = useInvest((s) => s.assets);
  return ledgerTradeDays({ transactions, assets }).days;
}

/** Inline numeric input that keeps exactly what the user types (so "1." stays "1."). */
function LiveNum({ value, onCommit, className, title }: { value: string; onCommit: (raw: string) => void; className?: string; title?: string }) {
  const [v, setV] = useState(value);
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setV(value); }, [value, focus]);
  return <input type="text" inputMode="decimal" title={title} className={cx("input num !w-20 !px-2 !py-1 text-right !text-xs", className)} value={v}
    onFocus={() => setFocus(true)} onBlur={() => { setFocus(false); if (!(parseFloat(v) > 0)) onCommit(""); }}
    onChange={(e) => { setV(e.target.value); onCommit(e.target.value); }} />;
}

function Row({ k, children, className }: { k: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <div className={cx("flex items-center gap-3 border-b border-line/5 py-2 text-sm last:border-none", className)}><span className="text-muted">{k}</span><span className="num ml-auto text-right font-semibold">{children}</span></div>;
}

function GoalCard({ g, equity, onEdit, i }: { g: Goal; equity: number; onEdit: () => void; i: number }) {
  const mutate = useInvest((s) => s.mutate);
  const sec = useSecFmt();
  const ledgerDays = useLedgerDays();
  const [table, setTable] = useState(false);
  const isStep = g.type === "stepup";
  const steps = g.steps?.length ? g.steps : [{ target: g.target || 15000, profitPct: g.profitPct || 10 }];
  const calc = isStep ? GoalCalc.calculateStepUpGoal({ startAmount: g.startAmount && g.startAmount > 0 ? g.startAmount : equity > 0 ? equity : 10000, steps }) : null;
  const target = isStep ? calc!.goalAmount || g.target : g.target;
  const pct = g.profitPct || 10;
  const remaining = target - equity;
  const progress = Math.max(0, Math.min(100, (equity / target) * 100));
  const reached = equity >= target - EPS;
  const gainNeeded = equity > 0 ? (target / equity - 1) * 100 : null;
  const nTrades = isStep ? calc!.totalTrades : GoalCalc.tradesToGoal(equity, target, pct);
  const endAmount = !isStep && nTrades != null ? equity * Math.pow(1 + pct / 100, nTrades) : null;
  const custom = g.tradeDays != null && g.tradeDays > 0 && !sameDays(g.tradeDays, ledgerDays);
  const tradeDays = custom ? g.tradeDays! : ledgerDays;
  const est = !reached && nTrades && nTrades > 0 ? GoalCalc.estimateTimeToGoal(nTrades, tradeDays) : null;
  const norm = (v: number | null) => (v != null && v > 0 && !sameDays(v, ledgerDays) ? v : null);
  const update = (fn: (x: Goal) => void) => mutate((d) => { const x = d.goals.find((y) => y.id === g.id); if (x) fn(x); });

  const remove = async () => {
    if (await confirmDialog("Delete goal", `Delete goal "${g.name}"?`, { confirmText: "Delete", danger: true })) {
      mutate((d) => { d.goals = d.goals.filter((x) => x.id !== g.id); }); toast("Goal deleted");
    }
  };

  return (
    <Card className="flex flex-col p-5" delay={i * 0.06}>
      <div className="flex items-start gap-2">
        <div>
          <div className="font-display text-lg font-semibold">{g.name}</div>
          <Tag className={isStep ? "!bg-violet/12 !text-violet" : "!bg-cyan/12 !text-cyan"}>{isStep ? `Step-up · ${steps.length} step${steps.length === 1 ? "" : "s"}` : "Fixed profit"}</Tag>
        </div>
        <div className="ml-auto flex"><button className="icon-btn" onClick={onEdit} title="Edit"><Pencil size={15} /></button><button className="icon-btn hover:!text-neg" onClick={remove} title="Delete"><Trash2 size={15} /></button></div>
      </div>
      <div className="my-5 flex justify-center">
        <Ring progress={progress} reached={reached} size={170} stroke={12}>
          <div><div className={cx("num text-3xl font-semibold", reached && "pos")}>{progress.toFixed(0)}%</div><div className="num text-[11px] text-muted">of {fmtUSD(target)}</div></div>
        </Ring>
      </div>
      {reached && <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-3 rounded-xl bg-pos/15 py-2 text-center text-sm font-semibold text-pos">🎉 Reached!</motion.div>}
      <div>
        <Row k="Current equity">{fmtUSD(equity)}</Row>
        <Row k={reached ? "Surplus over goal" : "Remaining"}><span className={cx(reached && "pos")}>{fmtUSD(Math.abs(remaining))}</span>{sec(Math.abs(remaining)) && <div className="text-[11px] font-normal text-muted">{sec(Math.abs(remaining))}</div>}</Row>
        {!reached && gainNeeded != null && <Row k="Gain still needed">{gainNeeded.toFixed(1)}%</Row>}
        {isStep && <Row k="Starting balance">{fmtUSD(calc!.initialStartingBalance)}</Row>}
        {!reached && (isStep ? <Row k="Winning trades required"><span className="gradient-text text-xl">{calc!.totalTrades}</span></Row> : (
          <div className="my-3 rounded-2xl bg-line/[.03] p-3 text-center ring-1 ring-line/5">
            <span className="num gradient-text text-3xl font-semibold">{nTrades != null ? `≈ ${nTrades}` : "—"}</span>
            <span className="text-sm text-muted"> {nTrades === 1 ? "trade" : "trades"} at </span>
            <LiveNum value={String(pct)} onCommit={(raw) => { const v = parseFloat(raw); if (v > 0 && v !== g.profitPct) update((x) => { x.profitPct = v; }); }} className="!inline-block !w-16" />
            <span className="text-sm text-muted"> % each</span>
            <div className="mt-1 text-[11px] text-muted">compounding {pct}% per win, reinvested</div>
          </div>
        ))}
        {!reached && !isStep && <Row k={`You'd end at (after ${nTrades} ${nTrades === 1 ? "trade" : "trades"})`}><span className="pos">{endAmount != null ? fmtUSD(endAmount) : "—"}</span></Row>}
        {!reached && nTrades != null && nTrades > 0 && <>
          <Row k="Avg time / profitable trade">
            <span className="inline-flex items-center gap-1">
              <LiveNum value={fmtDaysInput(tradeDays)} title="Days per profitable trade (defaults to your ledger average)"
                onCommit={(raw) => { const v = parseFloat(raw); update((x) => { x.tradeDays = v > 0 ? norm(v) : null; }); }} />d
              {custom && <button className="icon-btn !h-6 !w-6 text-cyan" title={`Reset to ledger average (${formatDurationDays(ledgerDays)})`} onClick={() => { update((x) => { x.tradeDays = null; }); toast("Reset to ledger default"); }}><RotateCcw size={12} /></button>}
            </span>
          </Row>
          <Row k="Est. time to goal">
            <span className="inline-flex items-center gap-1">
              <LiveNum value={est ? String(est.totalDays) : ""} title="Total days to reach the goal (adjusts days per trade)"
                onCommit={(raw) => { const v = parseFloat(raw); update((x) => { x.tradeDays = v > 0 ? norm(v / nTrades) : null; }); }} />d
            </span>
          </Row>
          <div className="text-right text-[11px] text-muted"><span className="font-semibold text-cyan">{est?.formatted ?? "—"}</span> · {custom ? "✏️ manually adjusted" : `⚡ from ledger (${formatDurationDays(ledgerDays)}/trade)`}</div>
        </>}
        {isStep && <>
          <Row k="Final ending balance"><span className="pos">{fmtUSD(calc!.finalBalance)}</span></Row>
          <Row k="Total expected profit"><span className="pos">+{fmtUSD(calc!.totalProfit)}</span></Row>
          {calc!.overshootAmount > 0 && <Row k="Surplus after final trade"><span className="pos">+{fmtUSD(calc!.overshootAmount)}</span></Row>}
        </>}
      </div>

      {isStep && (
        <div className="mt-4 space-y-1.5">
          <div className="label !text-[10px]">Step roadmap</div>
          {calc!.steps.map((st, idx) => (
            <div key={st.stepNumber}>
              {idx > 0 && <ArrowDown size={13} className="mx-auto my-0.5 text-muted" />}
              <div className="rounded-xl bg-line/[.03] p-3 ring-1 ring-line/5">
                <div className="flex items-center text-sm"><b>Step {st.stepNumber}</b><Tag className="ml-auto">{st.profitPct}% / trade</Tag></div>
                <div className="num mt-1 text-sm">{fmtUSD(st.startingBalance)} → <b>{fmtUSD(st.endingBalance)}</b></div>
                <div className="mt-0.5 text-[11px] text-muted">{st.tradesCount} trade{st.tradesCount === 1 ? "" : "s"} · target {fmtUSD(st.targetAmount)} · +{fmtUSD(st.profitGenerated)}{!reached && st.tradesCount > 0 ? ` · ≈ ${formatDurationDays(st.tradesCount * tradeDays)}` : ""}</div>
              </div>
            </div>
          ))}
          <button className="btn btn-sm mt-2 w-full" onClick={() => setTable(!table)}>{table ? <><X size={13} /> Hide trades</> : <><Table2 size={13} /> Trade-by-trade ({calc!.totalTrades})</>}</button>
          <AnimatePresence>{table && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-2 max-h-80 overflow-auto rounded-xl ring-1 ring-line/10">
                <table className="tbl num text-xs"><thead><tr><th>#</th><th>Step</th><th>%</th><th>Start</th><th>Profit</th><th>End</th></tr></thead>
                  <tbody>{calc!.trades.map((t) => t.trade === 0
                    ? <tr key={0}><td>#0</td><td>—</td><td>—</td><td>—</td><td>—</td><td className="font-semibold">{fmtUSD(t.endingBalance)}</td></tr>
                    : <tr key={t.trade} className={cx(t.isStepStart && "bg-violet/[.06]")}><td>#{t.trade}</td><td>S{t.step}</td><td>{t.profitPct}%</td><td>{fmtUSD(t.startingBalance!)}</td><td className="pos">+{fmtUSD(t.profit!)}</td><td className="font-semibold">{fmtUSD(t.endingBalance)}</td></tr>)}</tbody>
                </table>
              </div>
            </motion.div>
          )}</AnimatePresence>
        </div>
      )}
    </Card>
  );
}

interface EditState { id: string; type: "fixed" | "stepup"; name: string; target: string; profitPct: string; tradeDays: string; startAmount: string; steps: { target: string; profitPct: string }[] }

function GoalForm({ editing, equity, onDone }: { editing: Goal | "new"; equity: number; onDone: () => void }) {
  const mutate = useInvest((s) => s.mutate);
  const ledgerDays = useLedgerDays();
  const defStart = equity > 0 ? equity : 10000;
  const [f, setF] = useState<EditState>(() => {
    if (editing === "new") return { id: "new", type: "fixed", name: "", target: "", profitPct: "10", tradeDays: "", startAmount: fmtAmtStr(+defStart.toFixed(2)),
      steps: [{ target: fmtAmtStr(Math.round(defStart * 1.5)), profitPct: "20" }, { target: fmtAmtStr(Math.round(defStart * 10)), profitPct: "10" }] };
    const g = editing;
    const base = g.target || Math.round(defStart * 1.5);
    return { id: g.id, type: g.type, name: g.name, target: g.target ? fmtAmtStr(g.target) : "", profitPct: String(g.profitPct || 10), tradeDays: fmtDaysInput(g.tradeDays),
      startAmount: fmtAmtStr(g.startAmount && g.startAmount > 0 ? g.startAmount : +defStart.toFixed(2)),
      steps: g.steps?.length ? g.steps.map((s) => ({ target: fmtAmtStr(s.target), profitPct: String(s.profitPct) })) : [{ target: fmtAmtStr(base), profitPct: "20" }, { target: fmtAmtStr(base * 2), profitPct: "10" }] };
  });
  const set = (p: Partial<EditState>) => setF({ ...f, ...p });
  const isStep = f.type === "stepup";

  const save = () => {
    const td = parseFloat(f.tradeDays);
    const tradeDays = td > 0 && !sameDays(td, ledgerDays) ? td : null;
    const name = f.name.trim();
    let goal: Goal;
    if (!isStep) {
      const target = stripNum(f.target), pct = parseFloat(f.profitPct);
      if (!(target > 0)) { toast("Enter a positive target amount", true); return; }
      if (!(pct > 0)) { toast("Enter a positive profit percentage", true); return; }
      goal = { id: f.id, name: name || "Goal", type: "fixed", target, profitPct: pct, tradeDays, startAmount: null, steps: [] };
    } else {
      const startAmount = stripNum(f.startAmount);
      const steps = f.steps.map((s) => ({ target: stripNum(s.target), profitPct: parseFloat(s.profitPct) }));
      const v = GoalCalc.validateStepUpGoal({ startAmount, steps });
      if (!v.valid) { toast(v.error || "Invalid goal", true); return; }
      goal = { id: f.id, name: name || "Step-Up Goal", type: "stepup", startAmount, target: steps[steps.length - 1].target, profitPct: steps[0].profitPct, steps, tradeDays };
    }
    mutate((d) => {
      if (goal.id === "new") d.goals.push({ ...goal, id: LE.makeId() });
      else { const i = d.goals.findIndex((x) => x.id === goal.id); if (i >= 0) d.goals[i] = goal; }
    });
    toast("Goal saved"); onDone();
  };

  return (
    <Card className="mx-auto mb-5 max-w-xl p-6">
      <div className="mb-4 font-display text-lg font-semibold">{editing === "new" ? "New goal" : "Edit goal"}</div>
      <div className="space-y-4">
        <Segmented id="gtype" className="w-full" value={f.type} onChange={(type) => set({ type })} options={[{ value: "fixed", label: "Fixed profit" }, { value: "stepup", label: "Step-up" }]} />
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. First 10k, Car fund" /></Field>
        {!isStep ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target value (USD)"><AmountInput value={f.target} onChange={(target) => set({ target })} placeholder="10,000" /></Field>
            <Field label="Profit per winning trade (%)"><input className="input num" type="number" step="any" min="0.01" value={f.profitPct} onChange={(e) => set({ profitPct: e.target.value })} /></Field>
          </div>
        ) : (
          <>
            <Field label="Starting balance (USD)">
              <div className="flex gap-2"><AmountInput value={f.startAmount} onChange={(startAmount) => set({ startAmount })} placeholder="10,000" />
                <button type="button" className="btn btn-sm shrink-0" onClick={() => set({ startAmount: fmtAmtStr(+defStart.toFixed(2)) })}>Use equity</button></div>
            </Field>
            <p className="rounded-xl bg-violet/10 px-3 py-2.5 text-xs text-muted ring-1 ring-violet/20">💡 Each step starts from the previous step's <i>actual</i> ending balance and compounds its % per trade until its target is reached. Targets must increase.</p>
            <div className="space-y-2">
              {f.steps.map((s, i) => (
                <motion.div key={i} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-line/[.03] p-3 ring-1 ring-line/5">
                  <div className="mb-2 flex items-center text-sm font-semibold">Step {i + 1}{i === f.steps.length - 1 && <Tag className="ml-2">overall goal</Tag>}
                    {f.steps.length > 1 && <button type="button" className="icon-btn ml-auto !h-7 !w-7 hover:!text-neg" onClick={() => set({ steps: f.steps.filter((_, j) => j !== i) })}><X size={14} /></button>}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <AmountInput value={s.target} onChange={(v) => set({ steps: f.steps.map((x, j) => (j === i ? { ...x, target: v } : x)) })} placeholder="Target $" aria-label={`Step ${i + 1} target`} />
                    <input className="input num" type="number" step="any" min="0.01" value={s.profitPct} aria-label={`Step ${i + 1} profit %`}
                      onChange={(e) => set({ steps: f.steps.map((x, j) => (j === i ? { ...x, profitPct: e.target.value } : x)) })} placeholder="% per trade" />
                  </div>
                </motion.div>
              ))}
              <button type="button" className="btn btn-sm" onClick={() => {
                const last = f.steps[f.steps.length - 1]; const lt = stripNum(last?.target) || 10000, lp = parseFloat(last?.profitPct) || 10;
                set({ steps: [...f.steps, { target: fmtAmtStr(Math.round(lt * 1.5)), profitPct: String(lp > 5 ? Math.max(1, lp - 5) : lp) }] });
              }}><Plus size={13} /> Add step</button>
            </div>
          </>
        )}
        <Field label="Avg time per profitable trade (days)" hint={`Leave blank to follow your ledger average (${formatDurationDays(ledgerDays)}).`}>
          <div className="flex gap-2">
            <input className="input num" type="number" step="any" min="0.01" value={f.tradeDays} onChange={(e) => set({ tradeDays: e.target.value })} placeholder={`${fmtDaysInput(ledgerDays)} (ledger)`} />
            <button type="button" className="btn btn-sm shrink-0" onClick={() => set({ tradeDays: fmtDaysInput(ledgerDays) })}>Use ledger avg</button>
          </div>
        </Field>
        <div className="flex gap-2 pt-1"><button className="btn btn-primary" onClick={save}>Save goal</button><button className="btn" onClick={onDone}>Cancel</button></div>
      </div>
    </Card>
  );
}

export default function Goals() {
  const goals = useInvest((s) => s.goals);
  const p = usePortfolio();
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  return (
    <>
      <PageTitle title="Portfolio targets" sub={`Progress toward target portfolio values · equity ${fmtUSD(p.equity)}`}
        right={!editing && <button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={15} /> Add goal</button>} />
      <AnimatePresence>{editing && <GoalForm key={editing === "new" ? "new" : editing.id} editing={editing} equity={p.equity} onDone={() => setEditing(null)} />}</AnimatePresence>
      {!goals.length && !editing ? (
        <Card><Empty icon={<Target />} title="No goals yet" sub={`Add a target portfolio value to track progress toward it. Your current equity is ${fmtUSD(p.equity)}.`}
          action={<button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={15} /> Add goal</button>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {[...goals].sort((a, b) => (a.target || 0) - (b.target || 0)).map((g, i) => <GoalCard key={g.id} g={g} i={i} equity={p.equity} onEdit={() => setEditing(g)} />)}
        </div>
      )}
    </>
  );
}

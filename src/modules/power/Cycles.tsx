import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, CalendarClock, CheckCircle2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, Empty } from "@/components/ui";
import { completedCycles, estimateAccuracy, isoDate, meterAt, type Cycle } from "@/engine/power-engine";
import { cx } from "@/lib/format";
import { usePower } from "@/stores/power";
import { confirmDialog, toast } from "@/stores/ui";
import { LoadingGrid, PageTitle } from "@/modules/expenses/common";
import { fmt2, money, prettyIso, useUnits } from "./common";

const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const plain = (n: number | null | undefined) => (n == null || isNaN(n) ? "" : String(Math.round(n * 100) / 100));

function PendingCycle({ c }: { c: { start: Date; end: Date; units: number } }) {
  const readings = usePower((s) => s.readings);
  const rate = usePower((s) => s.settings.rate);
  const save = usePower((s) => s.saveCycle);
  const { u } = useUnits();
  const est = c.units * rate;
  const [reading, setReading] = useState(plain(meterAt(readings, +c.end)));
  const [units, setUnits] = useState(plain(c.units));
  const [bill, setBill] = useState("");
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="rounded-2xl bg-line/[.03] p-4 ring-1 ring-line/5">
      <div className="flex flex-wrap items-baseline gap-2">
        <b className="font-display">{prettyIso(isoDate(c.start))} → {prettyIso(isoDate(c.end))}</b>
        <span className="text-xs text-muted">estimated <b className="num text-ink">{u(c.units)}</b> · <b className="num text-amber">{money(est)}</b> at Rs {fmt2(rate)}/unit</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <label><span className="field-label">Actual meter reading</span><input className="input num" type="number" step="any" value={reading} onChange={(e) => setReading(e.target.value)} /></label>
        <label><span className="field-label">Actual units</span><input className="input num" type="number" step="any" value={units} onChange={(e) => setUnits(e.target.value)} /></label>
        <label><span className="field-label">Actual bill (Rs)</span><input className="input num" type="number" step="any" value={bill} onChange={(e) => setBill(e.target.value)} placeholder={`est ${Math.round(est)}`} /></label>
        <button className="btn btn-primary self-end" onClick={() => {
          save({ start: isoDate(c.start), end: isoDate(c.end), units: c.units, rate, est, actual: num(bill), actualUnits: num(units), actualReading: num(reading) });
          toast("Cycle saved");
        }}><CheckCircle2 size={15} /> Save cycle</button>
      </div>
    </motion.div>
  );
}

function EditNum({ c, field }: { c: Cycle; field: "actual" | "actualUnits" | "actualReading" }) {
  const update = usePower((s) => s.updateCycle);
  const [v, setV] = useState(plain(c[field]));
  useEffect(() => setV(plain(c[field])), [c, field]);
  return <input className="input num !w-28 !py-1.5 text-right" type="number" step="any" placeholder="—" value={v} onChange={(e) => setV(e.target.value)}
    onBlur={() => { const n = num(v); if (n !== c[field]) update(c.id, { [field]: n }); }} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />;
}

export default function Cycles() {
  const loaded = usePower((s) => s.loaded);
  const readings = usePower((s) => s.readings);
  const cycles = usePower((s) => s.cycles);
  const billDay = usePower((s) => s.settings.billDay);
  const del = usePower((s) => s.deleteCycle);
  const { u } = useUnits();
  const saved = useMemo(() => [...cycles].sort((a, b) => b.start.localeCompare(a.start)), [cycles]);
  const pending = useMemo(() => {
    const keys = new Set(cycles.map((c) => c.start));
    return completedCycles(readings, billDay).filter((c) => !keys.has(isoDate(c.start)) && c.units > 0);
  }, [readings, cycles, billDay]);
  const acc = estimateAccuracy(cycles);

  return (
    <>
      <PageTitle title="Billing cycles" sub="Close each cycle with your real bill to see how good the estimates are" />
      {!loaded ? <LoadingGrid /> : (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Closed cycles to save" icon={<CalendarClock size={16} />} sub="Saved cycles stay put even as the meter keeps going" />
            <div className="space-y-3 p-4">
              <AnimatePresence>{pending.map((c) => <PendingCycle key={+c.start} c={c} />)}</AnimatePresence>
              {!pending.length && <div className="px-1 py-3 text-sm text-muted">No closed cycles waiting. They appear here once a billing period ends.</div>}
            </div>
          </Card>

          {acc && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 sm:grid-cols-3">
              <div className="card p-5"><div className="label">Estimate accuracy</div><div className={cx("num mt-2 text-3xl font-semibold", acc.avgErrPct <= 5 ? "pos" : acc.avgErrPct <= 15 ? "text-amber" : "neg")}>±{fmt2(acc.avgErrPct)}%</div><div className="text-xs text-muted">average error over {acc.count} cycle{acc.count === 1 ? "" : "s"}</div></div>
              <div className="card p-5"><div className="label">Bias</div><div className="num mt-2 text-3xl font-semibold">{money(Math.abs(acc.bias))}</div><div className="text-xs text-muted">{acc.bias >= 0 ? "under" : "over"}-estimated in total</div></div>
              <div className="card p-5"><div className="label">Tip</div><div className="mt-2 text-sm text-muted">{acc.bias > 0 ? "Real bills run higher than units × rate — taxes and fixed charges. Nudge your tariff up to compensate." : "Your tariff is close to or above the real effective rate."}</div></div>
            </motion.div>
          )}

          <Card>
            <CardHeader title="Saved cycles" icon={<CalendarCheck size={16} />} />
            {!saved.length ? <Empty icon="🗓️" title="Nothing saved yet" sub="Close a cycle above once a billing period ends." /> : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Period</th><th className="!text-right">Est units</th><th className="!text-right">Est bill</th><th className="!text-right">Actual reading</th><th className="!text-right">Actual units</th><th className="!text-right">Actual bill</th><th /></tr></thead>
                  <tbody>{saved.map((c) => {
                    const diff = c.actual != null ? c.actual - c.est : null;
                    return (
                      <tr key={c.id}>
                        <td className="text-sm">{prettyIso(c.start)} → {prettyIso(c.end)}</td>
                        <td className="num text-right">{u(c.units)}</td>
                        <td className="num text-right">{money(c.est)}</td>
                        <td className="text-right"><EditNum c={c} field="actualReading" /></td>
                        <td className="text-right"><EditNum c={c} field="actualUnits" /></td>
                        <td className="text-right"><EditNum c={c} field="actual" />{diff != null && <div className={cx("num mt-1 text-[11px]", diff > 0 ? "neg" : "pos")}>{diff >= 0 ? "+" : "−"}{money(Math.abs(diff))} vs est</div>}</td>
                        <td className="w-px"><button className="icon-btn hover:!text-neg" title="Delete" onClick={async () => {
                          if (await confirmDialog("Delete cycle", "Delete this saved cycle?", { confirmText: "Delete", danger: true })) del(c.id);
                        }}><Trash2 size={14} /></button></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

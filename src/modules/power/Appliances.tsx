import { AnimatePresence, motion } from "framer-motion";
import { Plug, Plus, PieChart, Trash2 } from "lucide-react";
import { useState } from "react";
import { Card, CardHeader, Empty, Field } from "@/components/ui";
import { Donut } from "@/components/charts";
import { applianceBreakdown } from "@/engine/power-engine";
import { usePower } from "@/stores/power";
import { toast } from "@/stores/ui";
import { LoadingGrid, PageTitle } from "@/modules/expenses/common";
import { fmt2, money, useUnits } from "./common";

const COLORS = ["#fbbf24", "#22d3ee", "#a78bfa", "#f472b6", "#34d399", "#60a5fa", "#f87171", "#fb923c"];

export default function Appliances() {
  const loaded = usePower((s) => s.loaded);
  const list = usePower((s) => s.appliances);
  const rate = usePower((s) => s.settings.rate);
  const add = usePower((s) => s.addAppliance);
  const del = usePower((s) => s.deleteAppliance);
  const { u, unit } = useUnits();
  const [f, setF] = useState({ name: "", watts: "", qty: "1", hours: "" });
  const { rows, totalPerDay } = applianceBreakdown(list);

  const submit = () => {
    const watts = parseFloat(f.watts), hours = parseFloat(f.hours), qty = parseInt(f.qty, 10) || 1;
    if (!f.name.trim() || !(watts > 0) || !(hours >= 0) || hours > 24) { toast("Enter a name, watts, and hours per day (0–24)", true); return; }
    add({ name: f.name.trim(), watts, qty, hours });
    setF({ name: "", watts: "", qty: "1", hours: "" }); toast("Appliance added");
  };

  return (
    <>
      <PageTitle title="Appliances" sub="Estimate which devices use the most — watts × quantity × hours per day" />
      {!loaded ? <LoadingGrid /> : (
        <div className="space-y-4">
          <Card className="p-5">
            <form className="grid gap-3 sm:grid-cols-[2fr_1fr_90px_1fr_auto]" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Air Conditioner" maxLength={60} /></Field>
              <Field label="Power (watts)"><input className="input num" type="number" step="any" min={0} value={f.watts} onChange={(e) => setF({ ...f, watts: e.target.value })} placeholder="1500" /></Field>
              <Field label="Qty"><input className="input num" type="number" step={1} min={1} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
              <Field label="Hours / day"><input className="input num" type="number" step="any" min={0} max={24} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} placeholder="8" /></Field>
              <button className="btn btn-primary self-end !py-2.5" type="submit"><Plus size={16} /> Add</button>
            </form>
          </Card>

          {!rows.length ? <Card><Empty icon={<Plug />} title="No appliances yet" sub="Add your AC, fridge, fans and pump to see where the units go." /></Card> : (
            <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
              <Card>
                <CardHeader title="Your appliances" icon={<Plug size={16} />} />
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead><tr><th>Appliance</th><th className="!text-right">Watts</th><th className="!text-right">Qty</th><th className="!text-right">h/day</th><th className="!text-right">{unit}/day</th><th>Share</th><th /></tr></thead>
                    <tbody>
                      <AnimatePresence initial={false}>
                        {rows.map((a, i) => (
                          <motion.tr key={a.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <td><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length], boxShadow: `0 0 8px ${COLORS[i % COLORS.length]}` }} />{a.name}</span></td>
                            <td className="num text-right">{fmt2(a.watts)}</td>
                            <td className="num text-right">{a.qty}</td>
                            <td className="num text-right">{fmt2(a.hours)}</td>
                            <td className="num text-right font-semibold">{fmt2(a.kwh)}</td>
                            <td className="w-36">
                              <div className="h-1.5 overflow-hidden rounded-full bg-line/10"><motion.div className="h-full rounded-full" style={{ background: COLORS[i % COLORS.length] }} initial={{ width: 0 }} animate={{ width: `${(a.kwh / rows[0].kwh) * 100}%` }} transition={{ duration: 0.9, delay: i * 0.05 }} /></div>
                              <div className="num mt-1 text-[11px] text-muted">{totalPerDay > 0 ? ((a.kwh / totalPerDay) * 100).toFixed(0) : 0}%</div>
                            </td>
                            <td className="w-px"><button className="icon-btn hover:!text-neg" title="Remove" onClick={() => { del(a.id); toast("Removed"); }}><Trash2 size={14} /></button></td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card className="h-fit p-6">
                <div className="flex items-center gap-2"><PieChart size={15} className="text-muted" /><span className="label">Estimated daily share</span></div>
                <div className="my-5 flex justify-center">
                  <Donut size={200} stroke={20} data={rows.map((a, i) => ({ key: a.id, value: a.kwh, color: COLORS[i % COLORS.length] }))}
                    center={<div><div className="num text-xl font-semibold">{fmt2(totalPerDay)}</div><div className="text-[11px] text-muted">{unit} / day</div></div>} />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex"><span className="text-muted">Per month (30 days)</span><span className="num ml-auto font-semibold">{u(totalPerDay * 30)}</span></div>
                  <div className="flex"><span className="text-muted">Monthly cost at Rs {fmt2(rate)}</span><span className="num ml-auto font-semibold text-amber">{money(totalPerDay * 30 * rate)}</span></div>
                  <div className="flex"><span className="text-muted">Biggest consumer</span><span className="ml-auto font-semibold">{rows[0].name}</span></div>
                </div>
                <p className="mt-4 text-[11.5px] text-muted">Assumes each device runs its hours every day. Compare with your actual daily average on the dashboard.</p>
              </Card>
            </div>
          )}
        </div>
      )}
    </>
  );
}

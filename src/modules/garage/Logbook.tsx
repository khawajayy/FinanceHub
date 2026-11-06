import { Download, Fuel, Gauge as GaugeIcon, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardHeader, Empty, Segmented, Skeleton, Tag } from "@/components/ui";
import { csvCell } from "@/engine/expense-engine";
import { parseFuelCsv, partialEstimates, planFuelImport } from "@/engine/garage-engine";
import { cx, downloadFile, fmtRs } from "@/lib/format";
import { useGarage } from "@/stores/garage";
import { confirmDialog, toast } from "@/stores/ui";
import { PageTitle } from "@/modules/expenses/common";
import { VehicleSwitcher, fmtKm, prettyDay, useVehicleData } from "./common";

export default function Logbook() {
  const loaded = useGarage((s) => s.loaded);
  const { openModal, remove, restore, importFuel, removeFuelMany } = useGarage();
  const { vehicle: v, fuel, odometer, service, stats } = useVehicleData();
  const [tab, setTab] = useState<"fuel" | "mileage">("fuel");

  const rows = useMemo(() => {
    const bySeg = new Map(stats.segments.map((s) => [s.logId, s]));
    const est = partialEstimates(fuel, v?.tankLitres);
    return [...fuel].reverse().map((f, i, arr) => ({ f, seg: bySeg.get(f.id), est: est.get(f.id), km: arr[i + 1] ? f.odo - arr[i + 1].odo : null }));
  }, [fuel, stats, v?.tankLitres]);
  const miles = useMemo(() => [...odometer].sort((a, b) => b.odo - a.odo), [odometer]);

  const exportCsv = () => {
    if (!v || !fuel.length) { toast("No fill-ups to export", true); return; }
    const lines = ["Date,Odometer (km),Litres,Cost (Rs),Rs per litre,Full tank,Tank %,Station"];
    for (const f of fuel) lines.push(`${f.date},${f.odo},${f.litres},${f.cost},${(f.cost / f.litres).toFixed(2)},${f.full ? "yes" : "no"},${f.tankPct ?? ""},${csvCell(f.station)}`);
    downloadFile(`fuel-log-${v.name.replace(/[^\w-]+/g, "_")}.csv`, lines.join("\n"), "text/csv;charset=utf-8;");
    toast("CSV exported");
  };
  const importCsv = () => {
    if (!v) return;
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".csv,text/csv";
    inp.onchange = () => {
      const file = inp.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { toast("Import failed: file is larger than 2 MB", true); return; }
      const rd = new FileReader();
      rd.onerror = () => toast("Couldn't read that file", true);
      rd.onload = async () => {
        const { rows: parsed, errors } = parseFuelCsv(String(rd.result));
        // only real readings count here: the odometer typed when adding the vehicle may be newer than these logs
        const logged = [...fuel, ...odometer, ...service].flatMap((x) => (x.odo == null ? [] : [{ date: x.date, odo: x.odo }]));
        const plan = planFuelImport(parsed, fuel, logged);
        if (!plan.toAdd.length) {
          const why = errors[0] ? `Line ${errors[0].line}: ${errors[0].message}` : plan.duplicates.length ? "Every fill-up in this file is already logged." : plan.conflicts[0] ? plan.conflicts[0].message : "The file has no fill-ups.";
          toast(`Nothing imported. ${why}`, true);
          return;
        }
        const first = plan.toAdd[0].date, last = plan.toAdd[plan.toAdd.length - 1].date;
        const notes = [
          plan.duplicates.length && `${plan.duplicates.length} already logged and skipped`,
          plan.conflicts.length && `${plan.conflicts.length} skipped because the odometer would run backwards (first: ${plan.conflicts[0].row.date}, ${plan.conflicts[0].row.odo.toLocaleString()} km)`,
          errors.length && `${errors.length} invalid line${errors.length === 1 ? "" : "s"} skipped (first: line ${errors[0].line}, ${errors[0].message})`,
        ].filter(Boolean);
        const total = plan.toAdd.reduce((s, r) => s + r.cost, 0);
        const message = `Add ${plan.toAdd.length} fill-up${plan.toAdd.length === 1 ? "" : "s"} to ${v.name}, from ${first} to ${last}, totalling ${fmtRs(total)}? They stay in Garage and aren't added to Expenses.${notes.length ? ` ${notes.join("; ")}.` : ""}`;
        if (!(await confirmDialog("Import fill-ups", message, { confirmText: "Import" }))) return;
        const ids = importFuel(v.id, plan.toAdd);
        toast(`Imported ${ids.length} fill-up${ids.length === 1 ? "" : "s"}`, false, { label: "Undo", onClick: () => removeFuelMany(ids) });
      };
      rd.readAsText(file);
    };
    inp.click();
  };
  const del = (coll: "fuel" | "odometer", id: string, label: string) => {
    const r = remove(coll, id);
    if (r) toast(`Deleted ${label}`, false, { label: "Undo", onClick: () => restore(coll, r) });
  };

  if (!loaded) return <><PageTitle title="Logbook" /><Skeleton className="h-96" /></>;
  if (!v) return <><PageTitle title="Logbook" /><Card><Empty icon="🚗" title="No vehicle yet" sub="Add a vehicle first to start logging." action={<button className="btn btn-primary" onClick={() => openModal({ type: "vehicle" })}><Plus size={15} /> Add vehicle</button>} /></Card></>;

  return (
    <>
      <PageTitle title="Logbook" sub={`${stats.fills} fill-up${stats.fills === 1 ? "" : "s"} · ${stats.totalLitres.toFixed(0)} L · ${fmtRs(stats.totalCost)}`} right={<VehicleSwitcher />} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented id="ltab" value={tab} onChange={setTab} options={[{ value: "fuel", label: "⛽ Fuel" }, { value: "mileage", label: "📍 Mileage" }]} />
        <div className="ml-auto flex gap-2">
          {tab === "fuel" && <>
            <button className="btn" onClick={importCsv} title="Import fill-ups from a CSV in the same format as the export"><Upload size={15} /> Import</button>
            <button className="btn" onClick={exportCsv}><Download size={15} /> Export</button>
          </>}
          <button className="btn btn-primary" onClick={() => openModal({ type: tab === "fuel" ? "fuel" : "odometer" })}><Plus size={15} /> {tab === "fuel" ? "Log fill-up" : "Log mileage"}</button>
        </div>
      </div>

      {tab === "fuel" ? (
        <Card>
          <CardHeader title="Fill-ups" icon={<Fuel size={16} />} sub="km/l is measured between full tanks; ≈ marks an estimate from a partial fill's tank level" />
          {!rows.length ? <Empty icon="⛽" title="No fill-ups yet" sub="Fill to full and log it. Your fuel average starts from the second full tank." /> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Date</th><th className="!text-right">Odometer</th><th className="!text-right">Distance</th><th className="!text-right">Litres</th><th className="!text-right">Rs/L</th><th className="!text-right">Cost</th><th className="!text-right">km/l</th><th>Station</th><th /></tr></thead>
                <tbody>
                  {rows.map(({ f, seg, est, km }) => (
                    <tr key={f.id}>
                      <td className="text-sm">{prettyDay(f.date)}{!f.full && <Tag className="ml-2 !normal-case">partial{f.tankPct != null ? ` · ${f.tankPct}%` : ""}</Tag>}</td>
                      <td className="num text-right">{f.odo.toLocaleString()}</td>
                      <td className="num text-right text-muted">{km != null ? `+${km.toLocaleString()}` : "—"}</td>
                      <td className="num text-right">{f.litres.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="num text-right text-muted">{(f.cost / f.litres).toFixed(1)}</td>
                      <td className="num text-right">{fmtRs(f.cost)}</td>
                      <td className={cx("num text-right font-semibold", seg && stats.avgKmpl != null && (seg.kmpl >= stats.avgKmpl ? "pos" : "text-amber"))}>{seg ? seg.kmpl.toFixed(1) : est ? <span className="font-normal text-muted" title="Estimate from the tank level. Not included in the average.">≈{est.kmpl.toFixed(1)}</span> : <span className="font-normal text-muted">—</span>}</td>
                      <td className="max-w-[120px] truncate text-sm text-muted">{f.station}</td>
                      <td className="w-px text-right"><div className="inline-flex">
                        <button className="icon-btn" aria-label="Edit fill-up" onClick={() => openModal({ type: "fuel", id: f.id })}><Pencil size={14} /></button>
                        <button className="icon-btn hover:!text-neg" aria-label="Delete fill-up" onClick={() => del("fuel", f.id, "fill-up")}><Trash2 size={14} /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <CardHeader title="Mileage" icon={<GaugeIcon size={16} />} sub="Readings between fill-ups keep km-based reminders accurate" />
          {!miles.length ? <Empty icon="📍" title="No mileage logs yet" sub="Fill-ups and services already update the odometer. Add readings here whenever you like." /> : (
            <div className="divide-y divide-line/5">
              {miles.map((o, i) => (
                <div key={o.id} className="group flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="num text-sm font-semibold">{fmtKm(o.odo)}{miles[i + 1] && <span className="ml-2 font-normal text-muted">+{(o.odo - miles[i + 1].odo).toLocaleString()}</span>}</div>
                    <div className="truncate text-xs text-muted">{prettyDay(o.date)}{o.note ? ` · ${o.note}` : ""}</div>
                  </div>
                  <button className="icon-btn" aria-label="Edit mileage" onClick={() => openModal({ type: "odometer", id: o.id })}><Pencil size={14} /></button>
                  <button className="icon-btn hover:!text-neg" aria-label="Delete mileage" onClick={() => del("odometer", o.id, "reading")}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </>
  );
}

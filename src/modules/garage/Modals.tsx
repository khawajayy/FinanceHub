import { CarFront, Fuel, Gauge as GaugeIcon, Trash2, Wrench, BellRing } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { AmountInput, Field, Modal, Segmented, Warn } from "@/components/ui";
import {
  FUEL_TYPES, REMINDER_PRESETS, addMonthsIso, currentOdo, isoDay, odoConflict, odoPoints, sortFuel,
  type FuelType, type Reminder, type Vehicle, type VehicleKind,
} from "@/engine/garage-engine";
import { cx, fmtAmtStr, fmtRs, stripNum } from "@/lib/format";
import { useExpenses } from "@/stores/expenses";
import { useGarage } from "@/stores/garage";
import { confirmDialog, toast } from "@/stores/ui";
import { fmtKm, useVehicleData } from "./common";

const optNum = (s: string) => { const n = stripNum(s); return Number.isFinite(n) ? n : null; };
const numStr = (n: number | null | undefined) => (n == null ? "" : fmtAmtStr(n));

function Foot({ onCancel, onSave, saveLabel, extra }: { onCancel: () => void; onSave: () => void; saveLabel: string; extra?: ReactNode }) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2 border-t hairline pt-4">
      {extra}
      <button type="button" className="btn btn-ghost ml-auto" onClick={onCancel}>Cancel</button>
      <button type="button" className="btn btn-primary" onClick={onSave}>{saveLabel}</button>
    </div>
  );
}

/** Logs the cost in Expenses under Transport (when that category still exists). */
function useLogExpense() {
  const addTxn = useExpenses((s) => s.addTxn);
  const categories = useExpenses((s) => s.categories);
  return (description: string, date: string, amount: number) => {
    if (!(amount > 0)) return;
    const cat = categories.find((c) => c.key === "Transport")?.key ?? null;
    addTxn({ txn_date: date, description, amount, category: cat, direction: "OUT", bucket: null });
  };
}

/**
 * Opt-in per entry: always starts off and isn't remembered, so nothing reaches
 * Expenses unless it's switched on for this entry (e.g. fuel on a company card).
 */
function ExpenseToggle({ on, set, amount }: { on: boolean; set: (v: boolean) => void; amount: number }) {
  return (
    <div className={cx("flex items-center gap-3 rounded-2xl p-3 ring-1 transition-colors", on ? "bg-cyan/10 ring-cyan/30" : "bg-line/[.03] ring-line/5")}>
      <button type="button" role="switch" aria-checked={on} aria-label="Add this cost to my Expenses" onClick={() => set(!on)}
        className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-cyan" : "bg-line/20")}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
      <div className="min-w-0 text-sm">
        <div className="font-semibold">Add to my Expenses</div>
        <div className="text-[11.5px] text-muted">{on ? (amount > 0 ? `${fmtRs(amount)} will be logged under Transport.` : "The cost will be logged under Transport.") : "Off: stays in Garage only, e.g. paid by a company fuel card."}</div>
      </div>
    </div>
  );
}

/* ---------- vehicle ---------- */
function VehicleForm({ v, onClose }: { v?: Vehicle; onClose: () => void }) {
  const { saveVehicle, deleteVehicle, fuel, service, odometer } = useGarage();
  const [f, setF] = useState({
    name: v?.name || "", kind: (v?.kind || "car") as VehicleKind, make: v?.make || "", model: v?.model || "", year: v?.year ? String(v.year) : "",
    plate: v?.plate || "", fuelType: (v?.fuelType || "petrol") as FuelType, tank: numStr(v?.tankLitres), startOdo: numStr(v?.startOdo),
  });
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const save = () => {
    if (!f.name.trim()) { toast("Give the vehicle a name", true); return; }
    const startOdo = stripNum(f.startOdo);
    if (!(startOdo >= 0)) { toast("Enter the current odometer reading", true); return; }
    const year = parseInt(f.year, 10);
    saveVehicle({
      name: f.name.trim().slice(0, 60), kind: f.kind, make: f.make.trim().slice(0, 40), model: f.model.trim().slice(0, 40), year: year > 1900 && year < 2100 ? year : null,
      plate: f.plate.trim().toUpperCase().slice(0, 20), fuelType: f.fuelType, tankLitres: optNum(f.tank), startOdo,
    }, v?.id);
    toast(v ? "Vehicle updated" : `${f.name.trim()} added to your garage`);
    onClose();
  };
  const remove = async () => {
    if (!v) return;
    const n = [...fuel, ...service, ...odometer].filter((x) => x.vehicleId === v.id).length;
    if (!(await confirmDialog("Delete vehicle", `Delete ${v.name} and its ${n} log${n === 1 ? "" : "s"} and reminders? Expenses already logged are kept. This cannot be undone.`, { confirmText: "Delete", danger: true }))) return;
    deleteVehicle(v.id); toast("Vehicle deleted"); onClose();
  };
  return (
    <>
      <div className="space-y-4">
        <Segmented id="vkind" className="w-full" value={f.kind} onChange={(kind) => set({ kind })} options={[{ value: "car", label: "🚗 Car" }, { value: "bike", label: "🏍️ Bike" }, { value: "other", label: "🛻 Other" }]} />
        <Field label="Name"><input autoFocus className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} placeholder="e.g. Toyota Passo" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Make (optional)"><input className="input" value={f.make} onChange={(e) => set({ make: e.target.value })} maxLength={40} placeholder="Toyota" /></Field>
          <Field label="Model (optional)"><input className="input" value={f.model} onChange={(e) => set({ model: e.target.value })} maxLength={40} placeholder="Passo" /></Field>
          <Field label="Year (optional)"><input className="input num" inputMode="numeric" value={f.year} onChange={(e) => set({ year: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="2018" /></Field>
          <Field label="Plate (optional)"><input className="input" value={f.plate} onChange={(e) => set({ plate: e.target.value })} maxLength={20} placeholder="LEB-18-4471" /></Field>
        </div>
        <div><span className="field-label">Fuel</span>
          <Segmented id="vfuel" size="sm" className="w-full" value={f.fuelType} onChange={(fuelType) => set({ fuelType })} options={FUEL_TYPES} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={v ? "Odometer when added (km)" : "Current odometer (km)"}><AmountInput value={f.startOdo} onChange={(startOdo) => set({ startOdo })} placeholder="61,200" /></Field>
          <Field label="Tank size in litres (optional)" hint="Used to estimate range."><AmountInput value={f.tank} onChange={(tank) => set({ tank })} placeholder="40" /></Field>
        </div>
      </div>
      <Foot onCancel={onClose} onSave={save} saveLabel={v ? "Save changes" : "Add vehicle"}
        extra={v && <button type="button" className="btn btn-danger" onClick={remove}><Trash2 size={14} /> Delete</button>} />
    </>
  );
}

/* ---------- refuel ---------- */
function FuelForm({ id, onClose }: { id?: string; onClose: () => void }) {
  const data = useVehicleData();
  const { saveFuel, fuel, odometer, service } = useGarage();
  const logExpense = useLogExpense();
  const editing = id ? fuel.find((x) => x.id === id) : undefined;
  const v = data.vehicle!;
  const [date, setDate] = useState(editing?.date || isoDay(new Date()));
  const [odo, setOdo] = useState(numStr(editing?.odo));
  const [litres, setLitres] = useState(numStr(editing?.litres));
  const [price, setPrice] = useState(editing && editing.litres > 0 ? fmtAmtStr(+(editing.cost / editing.litres).toFixed(2)) : data.stats.lastPrice ? fmtAmtStr(+data.stats.lastPrice.toFixed(2)) : "");
  const [total, setTotal] = useState(numStr(editing?.cost));
  const [full, setFull] = useState(editing?.full ?? true);
  const [station, setStation] = useState(editing?.station || "");
  const [toExp, setToExp] = useState(false);

  // any two of litres / price / total give the third
  const sync = (edited: "litres" | "price" | "total", l0 = litres, p0 = price, t0 = total) => {
    const l = stripNum(l0), p = stripNum(p0), t = stripNum(t0), ok = (x: number) => Number.isFinite(x) && x > 0;
    if (edited === "total") { if (ok(t) && ok(p)) setLitres(fmtAmtStr(+(t / p).toFixed(2))); else if (ok(t) && ok(l)) setPrice(fmtAmtStr(+(t / l).toFixed(2))); }
    else if (ok(l) && ok(p)) setTotal(fmtAmtStr(Math.round(l * p)));
    else if (edited === "litres" && ok(l) && ok(t)) setPrice(fmtAmtStr(+(t / l).toFixed(2)));
    else if (edited === "price" && ok(p) && ok(t)) setLitres(fmtAmtStr(+(t / p).toFixed(2)));
  };

  const pts = useMemo(() => odoPoints(v, fuel.filter((x) => x.vehicleId === v.id && x.id !== id), odometer.filter((x) => x.vehicleId === v.id), service.filter((x) => x.vehicleId === v.id)), [v, fuel, odometer, service, id]);
  const nOdo = stripNum(odo), nLit = stripNum(litres), nTotal = stripNum(total);
  const conflict = Number.isFinite(nOdo) && date ? odoConflict(date, nOdo, pts) : null;

  // live preview of this tank's average
  const preview = useMemo(() => {
    if (!full || !Number.isFinite(nOdo) || !(nLit > 0)) return null;
    const earlier = sortFuel(fuel.filter((x) => x.vehicleId === v.id && x.id !== id && x.odo < nOdo));
    let prevFull = null as (typeof earlier)[number] | null, partial = 0;
    for (let i = earlier.length - 1; i >= 0; i--) { if (earlier[i].full) { prevFull = earlier[i]; break; } partial += earlier[i].litres; }
    if (!prevFull) return null;
    const km = nOdo - prevFull.odo;
    return km > 0 ? { km, kmpl: km / (nLit + partial) } : null;
  }, [fuel, full, nOdo, nLit, v.id, id]);

  const save = () => {
    if (!date) { toast("Pick a date", true); return; }
    if (!(nOdo >= 0)) { toast("Enter the odometer reading", true); return; }
    if (conflict) { toast(`Odometer can't go backwards. ${conflict}`, true); return; }
    if (!(nLit > 0)) { toast("Enter how many litres", true); return; }
    if (!(nTotal >= 0)) { toast("Enter the total cost", true); return; }
    saveFuel({ vehicleId: v.id, date, odo: nOdo, litres: nLit, cost: nTotal, full, station: station.trim().slice(0, 60) }, id);
    if (!editing && toExp) logExpense(`Fuel - ${v.name}`, date, nTotal);
    const addedToExpenses = !editing && toExp && nTotal > 0 ? " · added to Expenses" : "";
    toast(editing ? "Fill-up updated" : (preview ? `Logged · ${preview.kmpl.toFixed(1)} km/l this tank` : "Fill-up logged") + addedToExpenses);
    onClose();
  };

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Odometer (km)"><AmountInput autoFocus value={odo} onChange={setOdo} placeholder={data.odo ? `last ${Math.round(data.odo).toLocaleString()}` : "66,220"} /></Field>
        </div>
        {conflict && <Warn>Odometer can't go backwards. {conflict}</Warn>}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Litres"><AmountInput value={litres} onChange={(x) => { setLitres(x); sync("litres", x); }} placeholder="31" /></Field>
          <Field label="Rs per litre"><AmountInput value={price} onChange={(x) => { setPrice(x); sync("price", litres, x); }} placeholder="270" /></Field>
          <Field label="Total (Rs)"><AmountInput value={total} onChange={(x) => { setTotal(x); sync("total", litres, price, x); }} placeholder="auto" /></Field>
        </div>
        <div>
          <Segmented id="ffull" className="w-full" value={full ? "full" : "partial"} onChange={(x) => setFull(x === "full")} options={[{ value: "full", label: "⛽ Filled to full" }, { value: "partial", label: "Partial fill" }]} />
          <p className="mt-1.5 text-[11.5px] text-muted">Average is measured between full tanks; partial fills roll into the next one.</p>
        </div>
        <Field label="Station (optional)"><input className="input" value={station} onChange={(e) => setStation(e.target.value)} maxLength={60} placeholder="PSO, Shell…" /></Field>
        {!editing && <ExpenseToggle on={toExp} set={setToExp} amount={Number.isFinite(nTotal) ? nTotal : 0} />}
        {preview && (
          <div className="rounded-2xl bg-gradient-to-r from-cyan/10 to-violet/10 px-4 py-3 text-sm ring-1 ring-cyan/15">
            This tank: <b className="num">{preview.kmpl.toFixed(1)} km/l</b> <span className="text-muted">over {fmtKm(preview.km)}</span>
            {data.stats.avgKmpl != null && <span className="text-muted"> · your average {data.stats.avgKmpl.toFixed(1)}</span>}
          </div>
        )}
      </div>
      <Foot onCancel={onClose} onSave={save} saveLabel={editing ? "Save changes" : "Log fill-up"} />
    </>
  );
}

/* ---------- mileage ---------- */
function OdoForm({ id, onClose }: { id?: string; onClose: () => void }) {
  const data = useVehicleData();
  const { saveOdo, fuel, odometer, service } = useGarage();
  const editing = id ? odometer.find((x) => x.id === id) : undefined;
  const v = data.vehicle!;
  const [date, setDate] = useState(editing?.date || isoDay(new Date()));
  const [odo, setOdo] = useState(numStr(editing?.odo));
  const [note, setNote] = useState(editing?.note || "");
  const pts = useMemo(() => odoPoints(v, fuel.filter((x) => x.vehicleId === v.id), odometer.filter((x) => x.vehicleId === v.id && x.id !== id), service.filter((x) => x.vehicleId === v.id)), [v, fuel, odometer, service, id]);
  const n = stripNum(odo);
  const conflict = Number.isFinite(n) && date ? odoConflict(date, n, pts) : null;
  const since = Number.isFinite(n) ? n - currentOdo(pts) : null;
  const save = () => {
    if (!date) { toast("Pick a date", true); return; }
    if (!(n >= 0)) { toast("Enter the odometer reading", true); return; }
    if (conflict) { toast(`Odometer can't go backwards. ${conflict}`, true); return; }
    saveOdo({ vehicleId: v.id, date, odo: n, note: note.trim().slice(0, 200) }, id);
    toast("Mileage logged");
    onClose();
  };
  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Odometer (km)" hint={since != null && since > 0 ? `+${fmtKm(since)} since the last reading` : undefined}><AmountInput autoFocus value={odo} onChange={setOdo} placeholder={data.odo ? `last ${Math.round(data.odo).toLocaleString()}` : ""} /></Field>
        </div>
        {conflict && <Warn>Odometer can't go backwards. {conflict}</Warn>}
        <Field label="Note (optional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Trip to Murree" /></Field>
        <p className="text-[11.5px] text-muted">Fill-ups and services update the odometer too. Log mileage in between so km-based reminders stay accurate.</p>
      </div>
      <Foot onCancel={onClose} onSave={save} saveLabel={editing ? "Save changes" : "Log mileage"} />
    </>
  );
}

/* ---------- service record ---------- */
function ServiceForm({ id, reminderId, onClose }: { id?: string; reminderId?: string; onClose: () => void }) {
  const data = useVehicleData();
  const { saveService, service, reminders, fuel, odometer } = useGarage();
  const logExpense = useLogExpense();
  const editing = id ? service.find((x) => x.id === id) : undefined;
  const v = data.vehicle!;
  const mine = reminders.filter((r) => r.vehicleId === v.id);
  const preset = reminderId ? mine.find((r) => r.id === reminderId) : undefined;
  const [title, setTitle] = useState(editing?.title || preset?.title || "");
  const [link, setLink] = useState(preset?.id || "");
  const [date, setDate] = useState(editing?.date || isoDay(new Date()));
  const [odo, setOdo] = useState(editing ? numStr(editing.odo) : data.odo ? fmtAmtStr(Math.round(data.odo)) : "");
  const [cost, setCost] = useState(numStr(editing?.cost));
  const [workshop, setWorkshop] = useState(editing?.workshop || "");
  const [note, setNote] = useState(editing?.note || "");
  const [toExp, setToExp] = useState(false);
  const pts = useMemo(() => odoPoints(v, fuel.filter((x) => x.vehicleId === v.id), odometer.filter((x) => x.vehicleId === v.id), service.filter((x) => x.vehicleId === v.id && x.id !== id)), [v, fuel, odometer, service, id]);
  const nOdo = odo.trim() ? stripNum(odo) : null;
  const conflict = nOdo != null && Number.isFinite(nOdo) && date ? odoConflict(date, nOdo, pts) : null;
  const linked = mine.find((r) => r.id === link);

  const save = () => {
    if (!title.trim()) { toast("What was done?", true); return; }
    if (!date) { toast("Pick a date", true); return; }
    if (nOdo != null && !(nOdo >= 0)) { toast("Enter a valid odometer reading", true); return; }
    if (conflict) { toast(`Odometer can't go backwards. ${conflict}`, true); return; }
    const c = cost.trim() ? stripNum(cost) : 0;
    if (!(c >= 0)) { toast("Enter a valid cost", true); return; }
    saveService({ vehicleId: v.id, date, odo: nOdo, title: title.trim().slice(0, 80), cost: c, workshop: workshop.trim().slice(0, 60), note: note.trim().slice(0, 500) }, id, link || undefined);
    if (!editing && toExp) logExpense(`${title.trim()} - ${v.name}`, date, c);
    toast(linked ? `Done · ${linked.title} reset` : editing ? "Service updated" : "Service logged");
    onClose();
  };
  return (
    <>
      <div className="space-y-4">
        <Field label="What was done?"><input autoFocus className="input" list="svc-titles" value={title} maxLength={80} placeholder="e.g. Engine oil & filter"
          onChange={(e) => { setTitle(e.target.value); const m = mine.find((r) => r.title.toLowerCase() === e.target.value.trim().toLowerCase()); if (m) setLink(m.id); }} />
          <datalist id="svc-titles">{[...new Set([...mine.map((r) => r.title), ...REMINDER_PRESETS.filter((p) => p.kind === "service").map((p) => p.title)])].map((t) => <option key={t} value={t} />)}</datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Odometer (km)"><AmountInput value={odo} onChange={setOdo} /></Field>
          <Field label="Cost (Rs)"><AmountInput value={cost} onChange={setCost} placeholder="0" /></Field>
          <Field label="Workshop (optional)"><input className="input" value={workshop} onChange={(e) => setWorkshop(e.target.value)} maxLength={60} /></Field>
        </div>
        {conflict && <Warn>Odometer can't go backwards. {conflict}</Warn>}
        {mine.length > 0 && !editing && (
          <Field label="Resets reminder" hint={linked && (linked.intervalKm || linked.intervalMonths) ? "Its next due point moves forward by its repeat interval." : linked ? "It has no repeat interval, so set its next due date afterwards." : undefined}>
            <select className="input" value={link} onChange={(e) => setLink(e.target.value)}>
              <option value="">None</option>
              {mine.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </Field>
        )}
        <Field label="Notes (optional)"><textarea className="input min-h-[60px] resize-y text-[13px]" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Oil grade, parts replaced…" /></Field>
        {!editing && <ExpenseToggle on={toExp} set={setToExp} amount={cost.trim() ? stripNum(cost) || 0 : 0} />}
      </div>
      <Foot onCancel={onClose} onSave={save} saveLabel={editing ? "Save changes" : "Log service"} />
    </>
  );
}

/* ---------- reminder ---------- */
function ReminderForm({ id, onClose }: { id?: string; onClose: () => void }) {
  const data = useVehicleData();
  const { saveReminder, remove, restore, reminders } = useGarage();
  const editing = id ? reminders.find((x) => x.id === id) : undefined;
  const v = data.vehicle!;
  const [f, setF] = useState({
    title: editing?.title || "", kind: (editing?.kind || "service") as Reminder["kind"], lastDate: editing?.lastDate || "", lastOdo: numStr(editing?.lastOdo),
    dueDate: editing?.dueDate || "", dueOdo: numStr(editing?.dueOdo), intervalKm: numStr(editing?.intervalKm), intervalMonths: editing?.intervalMonths ? String(editing.intervalMonths) : "",
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const iKm = optNum(f.intervalKm), iMo = parseInt(f.intervalMonths, 10) > 0 ? parseInt(f.intervalMonths, 10) : null, lastOdo = optNum(f.lastOdo);
  // next due is what you typed, otherwise last done + repeat interval
  const autoOdo = lastOdo != null && iKm ? lastOdo + iKm : null;
  const autoDate = f.lastDate && iMo ? addMonthsIso(f.lastDate, iMo) : null;
  const dueOdo = optNum(f.dueOdo) ?? autoOdo, dueDate = f.dueDate || autoDate;

  const applyPreset = (p: (typeof REMINDER_PRESETS)[number]) => set({ title: p.title, kind: p.kind, intervalKm: numStr(p.intervalKm), intervalMonths: p.intervalMonths ? String(p.intervalMonths) : "" });
  const save = () => {
    if (!f.title.trim()) { toast("Name the reminder", true); return; }
    if (dueOdo == null && !dueDate) { toast("Set when it's next due, or when it was last done plus a repeat interval", true); return; }
    saveReminder({ vehicleId: v.id, title: f.title.trim().slice(0, 80), kind: f.kind, intervalKm: iKm, intervalMonths: iMo, lastDate: f.lastDate || null, lastOdo, dueDate: dueDate || null, dueOdo }, id);
    toast(editing ? "Reminder updated" : "Reminder added");
    onClose();
  };
  return (
    <>
      <div className="space-y-4">
        {!editing && (
          <div>
            <span className="field-label">Quick start</span>
            <div className="flex flex-wrap gap-1.5">
              {REMINDER_PRESETS.map((p) => (
                <button key={p.title} type="button" onClick={() => applyPreset(p)} className={cx("chip !normal-case !tracking-normal !text-[11px] transition", f.title === p.title && "!bg-cyan/15 !text-cyan ring-1 ring-cyan/30")}>{p.emoji} {p.title}</button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted">Intervals are typical values. Your owner's manual has the exact ones for your {v.kind === "bike" ? "bike" : "vehicle"}.</p>
          </div>
        )}
        <Field label="Name"><input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} placeholder="e.g. Engine oil & filter" /></Field>
        <Segmented id="rkind" size="sm" className="w-full" value={f.kind} onChange={(kind) => set({ kind })} options={[{ value: "service", label: "🔧 Maintenance" }, { value: "document", label: "📄 Document / renewal" }]} />
        <div className="rounded-2xl bg-line/[.03] p-3 ring-1 ring-line/5">
          <span className="label !text-[10px]">Last done</span>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Field label="Date"><input className="input" type="date" value={f.lastDate} onChange={(e) => set({ lastDate: e.target.value })} /></Field>
            <Field label="At odometer (km)"><AmountInput value={f.lastOdo} onChange={(lastOdo) => set({ lastOdo })} placeholder={data.odo ? Math.round(data.odo).toLocaleString() : ""} /></Field>
          </div>
        </div>
        <div className="rounded-2xl bg-line/[.03] p-3 ring-1 ring-line/5">
          <span className="label !text-[10px]">Repeat every</span>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Field label="Km"><AmountInput value={f.intervalKm} onChange={(intervalKm) => set({ intervalKm })} placeholder="5,000" /></Field>
            <Field label="Months"><input className="input num" inputMode="numeric" value={f.intervalMonths} onChange={(e) => set({ intervalMonths: e.target.value.replace(/\D/g, "").slice(0, 3) })} placeholder="6" /></Field>
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-r from-cyan/10 to-violet/10 p-3 ring-1 ring-cyan/15">
          <span className="label !text-[10px]">Next due · whichever comes first</span>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Field label="Date" hint={!f.dueDate && autoDate ? `Auto: ${autoDate}` : undefined}><input className="input" type="date" value={f.dueDate} onChange={(e) => set({ dueDate: e.target.value })} /></Field>
            <Field label="At odometer (km)" hint={!f.dueOdo && autoOdo != null ? `Auto: ${autoOdo.toLocaleString()} km` : undefined}><AmountInput value={f.dueOdo} onChange={(x) => set({ dueOdo: x })} /></Field>
          </div>
        </div>
      </div>
      <Foot onCancel={onClose} onSave={save} saveLabel={editing ? "Save changes" : "Add reminder"}
        extra={editing && <button type="button" className="btn btn-danger" onClick={() => { const r = remove("reminders", editing.id); onClose(); if (r) toast(`Deleted "${editing.title}"`, false, { label: "Undo", onClick: () => restore("reminders", r) }); }}><Trash2 size={14} /> Delete</button>} />
    </>
  );
}

const TITLES = {
  vehicle: { add: "Add vehicle", edit: "Edit vehicle", icon: <CarFront size={16} /> },
  fuel: { add: "Log a fill-up", edit: "Edit fill-up", icon: <Fuel size={16} /> },
  odometer: { add: "Log mileage", edit: "Edit mileage", icon: <GaugeIcon size={16} /> },
  service: { add: "Log service", edit: "Edit service", icon: <Wrench size={16} /> },
  reminder: { add: "Add reminder", edit: "Edit reminder", icon: <BellRing size={16} /> },
};

export function GarageModals() {
  const modal = useGarage((s) => s.modal);
  const close = useGarage((s) => s.closeModal);
  const vehicles = useGarage((s) => s.vehicles);
  const { vehicle } = useVehicleData();
  const t = modal ? TITLES[modal.type] : null;
  // remount each form on open so its fields start fresh
  const key = modal ? `${modal.type}-${modal.id || "new"}-${modal.type === "service" ? modal.reminderId || "" : ""}-${vehicle?.id || ""}` : "closed";
  return (
    <Modal open={!!modal} onClose={close} title={t ? (modal?.id ? t.edit : t.add) : ""} icon={t?.icon}>
      {modal?.type === "vehicle" && <VehicleForm key={key} v={vehicles.find((x) => x.id === modal.id)} onClose={close} />}
      {modal?.type === "fuel" && vehicle && <FuelForm key={key} id={modal.id} onClose={close} />}
      {modal?.type === "odometer" && vehicle && <OdoForm key={key} id={modal.id} onClose={close} />}
      {modal?.type === "service" && vehicle && <ServiceForm key={key} id={modal.id} reminderId={modal.reminderId} onClose={close} />}
      {modal?.type === "reminder" && vehicle && <ReminderForm key={key} id={modal.id} onClose={close} />}
    </Modal>
  );
}


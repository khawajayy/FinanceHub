import { motion } from "framer-motion";
import { BellRing, CheckCircle2, FileText, History, ListPlus, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardHeader, Empty, Skeleton } from "@/components/ui";
import { type Reminder } from "@/engine/garage-engine";
import { iso } from "@/engine/task-engine";
import { cx, fmtRs } from "@/lib/format";
import { useGarage } from "@/stores/garage";
import { useTasks } from "@/stores/tasks";
import { toast } from "@/stores/ui";
import { PageTitle } from "@/modules/expenses/common";
import { StatusBadge, VehicleSwitcher, dueSummary, fmtKm, prettyDay, statusBar, useVehicleData } from "./common";

type Row = ReturnType<typeof useVehicleData>["reminders"][number];

function ReminderCard({ row, i, vehicleName }: { row: Row; i: number; vehicleName: string }) {
  const { r, st } = row;
  const openModal = useGarage((s) => s.openModal);
  const addTask = useTasks((s) => s.add);
  const tasks = useTasks((s) => s.tasks);
  const taskTitle = `${r.title} — ${vehicleName}`;
  const hasTask = tasks.some((t) => !t.done && t.title === taskTitle);
  const toTask = () => {
    const today = iso(new Date());
    addTask({ title: taskTitle, due: st.predictedDate && st.predictedDate > today ? st.predictedDate : today, priority: st.status === "overdue" ? "high" : "med", list: "garage" });
    toast("Added to Tasks");
  };
  const lastBits = [r.lastDate && prettyDay(r.lastDate), r.lastOdo != null && fmtKm(r.lastOdo)].filter(Boolean).join(" · ");
  const nextBits = [r.dueDate && prettyDay(r.dueDate), r.dueOdo != null && fmtKm(r.dueOdo)].filter(Boolean).join(" or ");
  const repeat = [r.intervalKm && fmtKm(r.intervalKm), r.intervalMonths && `${r.intervalMonths} mo`].filter(Boolean).join(" / ");
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }} className="card flex flex-col p-5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[15px] font-semibold">{r.title}</div>
          <div className={cx("mt-0.5 text-xs font-medium", st.status === "overdue" ? "neg" : st.status === "soon" ? "text-amber" : "text-muted")}>{dueSummary(st)}</div>
        </div>
        <StatusBadge status={st.status} />
      </div>
      {st.used != null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line/10">
          <motion.div className={cx("h-full rounded-full", statusBar(st.status))} initial={{ width: 0 }} animate={{ width: `${st.used * 100}%` }} transition={{ duration: 1, delay: 0.15 + i * 0.04, ease: [0.22, 1, 0.36, 1] }} />
        </div>
      )}
      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex gap-2"><dt className="w-14 shrink-0 text-muted">Last</dt><dd className="min-w-0 truncate">{lastBits || <span className="text-muted">Not recorded</span>}</dd></div>
        <div className="flex gap-2"><dt className="w-14 shrink-0 text-muted">Next</dt><dd className="min-w-0 truncate font-medium">{nextBits || <span className="text-muted">Not set</span>}</dd></div>
        {repeat && <div className="flex gap-2"><dt className="w-14 shrink-0 text-muted">Repeats</dt><dd>every {repeat}</dd></div>}
      </dl>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
        <button className="btn btn-sm" onClick={() => openModal({ type: "service", reminderId: r.id })}><CheckCircle2 size={13} /> Mark done</button>
        {hasTask ? <span className="chip !normal-case !tracking-normal">In Tasks</span> : <button className="btn btn-sm" onClick={toTask}><ListPlus size={13} /> Task</button>}
        <button className="icon-btn ml-auto !h-7 !w-7" onClick={() => openModal({ type: "reminder", id: r.id })} aria-label={`Edit ${r.title}`}><Pencil size={13} /></button>
      </div>
    </motion.div>
  );
}

function Section({ title, icon, rows, empty, vehicleName }: { title: string; icon: ReactNode; rows: Row[]; empty: string; vehicleName: string }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1"><span className="text-muted">{icon}</span><h2 className="label">{title}</h2></div>
      {rows.length
        ? <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{rows.map((row, i) => <ReminderCard key={row.r.id} row={row} i={i} vehicleName={vehicleName} />)}</div>
        : <div className="rounded-2xl border-2 border-dashed border-line/10 px-4 py-6 text-center text-sm text-muted">{empty}</div>}
    </section>
  );
}

export default function Maintenance() {
  const loaded = useGarage((s) => s.loaded);
  const { openModal, remove, restore } = useGarage();
  const { vehicle: v, reminders, service, costs } = useVehicleData();
  const ofKind = (k: Reminder["kind"]) => reminders.filter((x) => x.r.kind === k);
  const services = ofKind("service"), docs = ofKind("document");

  if (!loaded) return <><PageTitle title="Maintenance" /><div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div></>;
  if (!v) return <><PageTitle title="Maintenance" /><Card><Empty icon="🔧" title="No vehicle yet" sub="Add a vehicle first to set up reminders." action={<button className="btn btn-primary" onClick={() => openModal({ type: "vehicle" })}><Plus size={15} /> Add vehicle</button>} /></Card></>;

  return (
    <>
      <PageTitle title="Maintenance" sub="What was last done, what's next, and renewals coming up" right={<VehicleSwitcher />} />
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <button className="btn" onClick={() => openModal({ type: "service" })}><Wrench size={15} /> Log service</button>
        <button className="btn btn-primary" onClick={() => openModal({ type: "reminder" })}><Plus size={15} /> Add reminder</button>
      </div>
      <div className="space-y-5">
        <Section title="Service reminders" icon={<BellRing size={14} />} rows={services} vehicleName={v.name} empty="No reminders yet. Add engine oil first; the quick-start list has common intervals." />
        <Section title="Documents & renewals" icon={<FileText size={14} />} rows={docs} vehicleName={v.name} empty="Add insurance and token-tax expiry dates so renewals don't catch you out." />
        <Card>
          <CardHeader title="Service history" icon={<History size={16} />} sub={service.length ? `${service.length} record${service.length === 1 ? "" : "s"} · ${fmtRs(costs.serviceCost)} total` : undefined} />
          {!service.length ? <Empty icon="🧾" title="No service records yet" sub="Log work as it's done to build a history. It also helps resale value." /> : (
            <div className="divide-y divide-line/5">
              {service.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet/12 text-violet"><Wrench size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{s.title}</div>
                    <div className="truncate text-xs text-muted">{[prettyDay(s.date), s.odo != null && fmtKm(s.odo), s.workshop, s.note].filter(Boolean).join(" · ")}</div>
                  </div>
                  <span className="num text-sm font-semibold">{fmtRs(s.cost)}</span>
                  <button className="icon-btn" aria-label={`Edit ${s.title}`} onClick={() => openModal({ type: "service", id: s.id })}><Pencil size={14} /></button>
                  <button className="icon-btn hover:!text-neg" aria-label={`Delete ${s.title}`} onClick={() => { const r = remove("service", s.id); if (r) toast(`Deleted "${s.title}"`, false, { label: "Undo", onClick: () => restore("service", r) }); }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

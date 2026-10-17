import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, CheckCircle2, ChevronDown, Flag, Mountain, Pause, Play, Plus, RotateCcw, Trash2, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AmountInput, Field, Modal, Ring, Segmented } from "@/components/ui";
import { LineArea } from "@/components/charts";
import { AREAS, areaInfo, evaluate, isoDay, linkedTasks, type Area, type Goal, type Metric, type Milestone } from "@/engine/goal-engine";
import { cx, fmtAmtStr, stripNum } from "@/lib/format";
import { useActions } from "@/stores/actions";
import { useGoals } from "@/stores/goals";
import { useTasks } from "@/stores/tasks";
import { confirmDialog, toast } from "@/stores/ui";
import { CheckOrb, QuickAdd, TaskRow } from "@/modules/tasks/parts";
import { daysLeftLabel, fmtGoalValue, PaceBadge, useGoalCtx } from "./common";

const rid = () => Math.random().toString(36).slice(2, 10);
const addMonths = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + n); return isoDay(d); };
const HORIZONS: [string, number][] = [["3 mo", 3], ["6 mo", 6], ["1 yr", 12], ["3 yrs", 36], ["5 yrs", 60]];
const METRIC_OPTS: { value: Metric; label: string }[] = [
  { value: "checklist", label: "Milestones" }, { value: "number", label: "Number" }, { value: "networth", label: "Net worth" }, { value: "portfolio", label: "Portfolio" },
];

function AreaPicker({ value, onChange }: { value: Area; onChange: (a: Area) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {AREAS.map((a) => (
        <button key={a.key} type="button" onClick={() => onChange(a.key)}
          className={cx("flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition", value === a.key ? "bg-line/[.06] text-ink" : "text-muted ring-line/10 hover:text-ink")}
          style={value === a.key ? { boxShadow: `0 0 0 1px ${a.color}, 0 0 18px -4px ${a.color}` } : undefined}>
          <span className="text-base">{a.emoji}</span>{a.label}
        </button>
      ))}
    </div>
  );
}

function DateWithHorizons({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <input type="date" className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {HORIZONS.map(([l, m]) => (
          <button key={l} type="button" onClick={() => onChange(addMonths(m))} className={cx("chip !normal-case !tracking-normal transition", value === addMonths(m) && "!bg-cyan/15 !text-cyan ring-1 ring-cyan/30")}>{l}</button>
        ))}
        {value && <button type="button" onClick={() => onChange("")} className="chip !normal-case !tracking-normal"><X size={10} /> no deadline</button>}
      </div>
    </div>
  );
}

/* ---------------- create ---------------- */
function CreateGoal({ onDone }: { onDone: (id: string) => void }) {
  const add = useGoals((s) => s.add);
  const ctx = useGoalCtx();
  const [title, setTitle] = useState("");
  const [area, setArea] = useState<Area>("personal");
  const [why, setWhy] = useState("");
  const [targetDate, setTargetDate] = useState(addMonths(12));
  const [metric, setMetric] = useState<Metric>("checklist");
  const [ms, setMs] = useState("");
  const [start, setStart] = useState("0");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");

  const save = () => {
    if (!title.trim()) { toast("Give the goal a name", true); return; }
    const t = stripNum(target);
    let s = stripNum(start);
    if (metric === "networth") { if (ctx.netWorthPkr == null) { toast("Net worth isn't available yet (waiting for the USD/PKR rate)", true); return; } s = ctx.netWorthPkr; }
    if (metric === "portfolio") s = ctx.equityUsd ?? 0;
    if (metric !== "checklist") {
      if (!Number.isFinite(t)) { toast("Enter a target value", true); return; }
      if (!Number.isFinite(s)) { toast("Enter a starting value", true); return; }
      if (t === s) { toast("Target must differ from the starting value", true); return; }
    }
    const milestones: Milestone[] = metric === "checklist" ? ms.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 100).map((x) => ({ id: rid(), title: x.slice(0, 140), done: false, due: null })) : [];
    const id = add({ title, why, area, targetDate: targetDate || null, metric, unit: metric === "networth" ? "PKR" : metric === "portfolio" ? "USD" : unit.trim(), start: metric === "checklist" ? 0 : s, target: metric === "checklist" ? 0 : t, milestones });
    toast("Goal created — break it down into milestones and tasks");
    onDone(id);
  };

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <input autoFocus className="input !py-3 !text-lg font-semibold" placeholder="What do you want to achieve?" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} aria-label="Goal title" />
      <div><span className="field-label">Life area</span><AreaPicker value={area} onChange={setArea} /></div>
      <Field label="Why does this matter?" hint="Your reason, shown on the goal to keep you motivated.">
        <textarea className="input min-h-[64px] resize-y" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={1000} placeholder="e.g. Freedom to choose my next move" />
      </Field>
      <div><span className="field-label">Target date</span><DateWithHorizons value={targetDate} onChange={setTargetDate} /></div>
      <div>
        <span className="field-label">Measure progress by</span>
        <Segmented id="gmetric" size="sm" className="w-full" value={metric} onChange={setMetric} options={METRIC_OPTS} />
        <div className="mt-3">
          {metric === "checklist" && (
            <Field label="Milestones (one per line, optional)" hint="Progress = milestones + linked tasks completed. You can add more later.">
              <textarea className="input min-h-[90px] resize-y text-[13px]" value={ms} onChange={(e) => setMs(e.target.value)} placeholder={"Finish the course\nBuild a project\nPublish it"} />
            </Field>
          )}
          {metric === "number" && (
            <div className="grid grid-cols-3 gap-2">
              <Field label="Start"><AmountInput value={start} onChange={setStart} /></Field>
              <Field label="Target"><AmountInput value={target} onChange={setTarget} placeholder="500" /></Field>
              <Field label="Unit"><input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={16} placeholder="km, kg, books" /></Field>
            </div>
          )}
          {metric === "networth" && (
            <Field label="Target net worth (Rs)" hint={ctx.netWorthPkr != null ? `Starts from your current total: Rs ${Math.round(ctx.netWorthPkr).toLocaleString()} — tracked live from the Hub.` : "Waiting for the USD/PKR rate to read your current net worth."}>
              <AmountInput value={target} onChange={setTarget} placeholder="10,000,000" />
            </Field>
          )}
          {metric === "portfolio" && (
            <Field label="Target portfolio equity (USD)" hint={`Starts from your current equity: $${(ctx.equityUsd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} — tracked live.`}>
              <AmountInput value={target} onChange={setTarget} placeholder="10,000" />
            </Field>
          )}
        </div>
      </div>
      <button type="submit" className="btn btn-primary w-full !py-3"><Mountain size={16} /> Create goal</button>
    </form>
  );
}

/* ---------------- detail ---------------- */
function GoalDetail({ g, onClose }: { g: Goal; onClose: () => void }) {
  const ctx = useGoalCtx();
  const { update, setStatus, logValue, remove, restore } = useGoals();
  const tasks = useTasks((s) => s.tasks);
  const e = evaluate(g, ctx);
  const a = areaInfo(g.area);
  const lt = useMemo(() => linkedTasks(g, tasks).sort((x, y) => Number(x.done) - Number(y.done)), [g, tasks]);
  const [newMs, setNewMs] = useState("");
  const [val, setVal] = useState("");
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ title: g.title, why: g.why, area: g.area, targetDate: g.targetDate || "", target: fmtAmtStr(g.target), start: fmtAmtStr(g.start), unit: g.unit });
  useEffect(() => setF({ title: g.title, why: g.why, area: g.area, targetDate: g.targetDate || "", target: fmtAmtStr(g.target), start: fmtAmtStr(g.start), unit: g.unit }), [g]);

  const saveEdit = () => {
    if (!f.title.trim()) { toast("Title can't be empty", true); return; }
    const patch: Partial<Goal> = { title: f.title.trim(), why: f.why, area: f.area, targetDate: f.targetDate || null };
    if (g.metric !== "checklist") {
      const t = stripNum(f.target), s = stripNum(f.start);
      if (!Number.isFinite(t) || !Number.isFinite(s) || t === s) { toast("Start and target must be different numbers", true); return; }
      patch.target = t; patch.start = s;
      if (g.metric === "number") patch.unit = f.unit.trim().slice(0, 16);
    }
    update(g.id, patch); setEditing(false); toast("Goal updated");
  };
  const addMs = () => {
    if (!newMs.trim()) return;
    update(g.id, { milestones: [...g.milestones, { id: rid(), title: newMs.trim().slice(0, 140), done: false, due: null }] });
    setNewMs("");
  };
  const log = () => {
    const v = stripNum(val);
    if (!Number.isFinite(v)) { toast("Enter a number", true); return; }
    logValue(g.id, v); setVal(""); toast(`Logged ${fmtGoalValue(g, v)}`);
  };

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl p-5 ring-1" style={{ background: `linear-gradient(135deg, ${a.color}22, transparent 60%)`, boxShadow: `inset 0 0 0 1px ${a.color}33` }}>
        <div className="flex flex-wrap items-center gap-5">
          <Ring progress={e.pct * 100} reached={g.status === "done"} size={130} stroke={11}>
            <div><div className="num text-2xl font-semibold">{Math.round(e.pct * 100)}%</div><div className="text-[10px] text-muted">{g.metric === "checklist" ? `${e.done}/${e.total} done` : "progress"}</div></div>
          </Ring>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><span className="chip !normal-case" style={{ color: a.color, background: `${a.color}1f` }}>{a.emoji} {a.label}</span><PaceBadge pace={e.pace} /></div>
            <h2 className="mt-2 font-display text-xl font-semibold leading-tight">{g.title}</h2>
            <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{g.targetDate ? new Date(g.targetDate + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "No deadline"} · {daysLeftLabel(e.daysLeft)}</span>
              {g.targetDate && g.status === "active" && <span>expected by now: {Math.round(e.expected * 100)}%</span>}
            </div>
          </div>
        </div>
        {g.why && <p className="mt-4 border-l-2 pl-3 text-sm italic text-muted" style={{ borderColor: a.color }}>“{g.why}”</p>}
      </div>

      {g.metric === "checklist" ? (
        <div className="space-y-4">
          <div>
            <div className="label mb-2 flex items-center gap-1.5"><Flag size={12} /> Milestones</div>
            <div className="space-y-1.5">
              {g.milestones.map((m) => (
                <div key={m.id} className="group flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-line/[.03]">
                  <CheckOrb size={19} done={m.done} label={`Milestone ${m.title}`} onToggle={() => update(g.id, { milestones: g.milestones.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)) })} />
                  <span className={cx("flex-1 text-sm", m.done && "text-muted line-through")}>{m.title}</span>
                  <input type="date" className="input !w-auto !border-transparent !bg-transparent !px-1 !py-0.5 !text-[11px] text-muted" value={m.due || ""} aria-label="Milestone due date"
                    onChange={(ev) => update(g.id, { milestones: g.milestones.map((x) => (x.id === m.id ? { ...x, due: ev.target.value || null } : x)) })} />
                  <button className="icon-btn !h-6 !w-6 opacity-0 group-hover:opacity-100" aria-label="Remove milestone" onClick={() => update(g.id, { milestones: g.milestones.filter((x) => x.id !== m.id) })}><X size={12} /></button>
                </div>
              ))}
              <div className="flex items-center gap-2 px-2">
                <Plus size={15} className="text-muted" />
                <input className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted/60" placeholder="Add a milestone…" value={newMs} onChange={(ev) => setNewMs(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && addMs()} aria-label="New milestone" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["Start", g.start], ["Now", e.value], ["Target", g.target]].map(([k, v]) => (
              <div key={k as string} className="rounded-2xl bg-line/[.04] p-3 ring-1 ring-line/5"><div className="text-[11px] text-muted">{k as string}</div><div className={cx("num mt-0.5 text-sm font-semibold", k === "Now" && "gradient-text text-base")}>{fmtGoalValue(g, v as number | null)}</div></div>
            ))}
          </div>
          {e.rate != null && g.status === "active" && (
            <div className="rounded-xl bg-violet/10 px-3 py-2 text-xs text-muted ring-1 ring-violet/20">
              To hit it on time: <b className="num text-ink">{fmtGoalValue(g, Math.abs(e.rate))}</b> {e.rate >= 0 ? "more" : "less"} per week.
            </div>
          )}
          {g.metric === "number" && (
            <>
              <form className="flex gap-2" onSubmit={(ev) => { ev.preventDefault(); log(); }}>
                <AmountInput value={val} onChange={setVal} placeholder={`Log current ${g.unit || "value"}…`} />
                <button className="btn btn-primary shrink-0" type="submit"><Plus size={15} /> Log</button>
              </form>
              {g.log.length >= 2 && <div className="rounded-2xl bg-line/[.03] p-3 ring-1 ring-line/5"><LineArea points={g.log} format={(v) => fmtGoalValue(g, v)} height={160} /></div>}
            </>
          )}
          {g.metric !== "number" && <p className="text-[11.5px] text-muted">Updates automatically from your {g.metric === "networth" ? "Hub net worth (register + investments)" : "investment portfolio equity"}.</p>}
        </div>
      )}

      <div>
        <div className="label mb-2">Linked tasks {g.metric === "checklist" && <span className="font-normal normal-case tracking-normal">· count toward progress</span>}</div>
        <QuickAdd compact defaults={{ goalId: g.id }} placeholder="Add a next action for this goal…" />
        <div className="-mx-1 mt-2 overflow-hidden rounded-2xl ring-1 ring-line/5">
          <AnimatePresence initial={false}>{lt.map((t) => <TaskRow key={t.id} t={t} compact />)}</AnimatePresence>
          {!lt.length && <div className="px-4 py-4 text-center text-xs text-muted">No tasks yet. Next actions added here also appear in Tasks.</div>}
        </div>
      </div>

      <div className="rounded-2xl ring-1 ring-line/10">
        <button className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold" onClick={() => setEditing(!editing)}>
          Edit details <motion.span className="ml-auto" animate={{ rotate: editing ? 180 : 0 }}><ChevronDown size={16} /></motion.span>
        </button>
        <AnimatePresence>{editing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="space-y-3 border-t hairline p-4">
              <input className="input font-semibold" value={f.title} onChange={(ev) => setF({ ...f, title: ev.target.value })} maxLength={140} aria-label="Title" />
              <textarea className="input min-h-[60px] text-[13px]" value={f.why} onChange={(ev) => setF({ ...f, why: ev.target.value })} placeholder="Why does this matter?" maxLength={1000} />
              <AreaPicker value={f.area} onChange={(area) => setF({ ...f, area })} />
              <DateWithHorizons value={f.targetDate} onChange={(targetDate) => setF({ ...f, targetDate })} />
              {g.metric !== "checklist" && (
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Start"><AmountInput value={f.start} onChange={(start) => setF({ ...f, start })} /></Field>
                  <Field label="Target"><AmountInput value={f.target} onChange={(target) => setF({ ...f, target })} /></Field>
                  {g.metric === "number" && <Field label="Unit"><input className="input" value={f.unit} onChange={(ev) => setF({ ...f, unit: ev.target.value })} maxLength={16} /></Field>}
                </div>
              )}
              <button className="btn btn-primary" onClick={saveEdit}>Save changes</button>
            </div>
          </motion.div>
        )}</AnimatePresence>
      </div>

      <div className="flex flex-wrap gap-2 border-t hairline pt-4">
        {g.status !== "done"
          ? <button className="btn !text-pos" onClick={() => { setStatus(g.id, "done"); toast(`🏆 Achieved: ${g.title}`); }}><CheckCircle2 size={15} /> Mark achieved</button>
          : <button className="btn" onClick={() => setStatus(g.id, "active")}><RotateCcw size={15} /> Reopen</button>}
        {g.status === "active" && <button className="btn" onClick={() => setStatus(g.id, "paused")}><Pause size={15} /> Pause</button>}
        {(g.status === "paused" || g.status === "dropped") && <button className="btn" onClick={() => setStatus(g.id, "active")}><Play size={15} /> Resume</button>}
        {g.status !== "dropped" && g.status !== "done" && <button className="btn" onClick={() => setStatus(g.id, "dropped")}><XCircle size={15} /> Drop</button>}
        <button className="btn btn-danger ml-auto" onClick={async () => {
          if (!(await confirmDialog("Delete goal", `Delete "${g.title}"? Linked tasks are kept.`, { confirmText: "Delete", danger: true }))) return;
          const r = remove(g.id); onClose();
          if (r) toast(`Deleted "${r.title}"`, false, { label: "Undo", onClick: () => restore(r) });
        }}><Trash2 size={15} /> Delete</button>
      </div>
    </div>
  );
}

export function GoalModal() {
  const { open, id } = useActions((s) => s.goalModal);
  const close = useActions((s) => s.closeGoal);
  const openGoal = useActions((s) => s.openGoal);
  const g = useGoals((s) => (id ? s.goals.find((x) => x.id === id) : undefined));
  return (
    <Modal open={open} onClose={close} wide={!!g} title={g ? "Goal" : "New goal"} icon={<Mountain size={16} />}>
      {g ? <GoalDetail g={g} onClose={close} /> : <CreateGoal onDone={(newId) => openGoal(newId)} />}
    </Modal>
  );
}

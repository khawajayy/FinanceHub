import { motion } from "framer-motion";
import { AlertTriangle, CalendarDays, Flag, ListChecks, Mountain, Plus, Target, Trophy, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { AnimatedNumber, Card, CardHeader, Empty, Segmented, Skeleton } from "@/components/ui";
import { Sparkline } from "@/components/charts";
import { AREAS, areaInfo, areaSummary, evaluate, goalStats, linkedTasks, nextMilestone, sortGoals, type Goal } from "@/engine/goal-engine";
import { cx } from "@/lib/format";
import { useActions } from "@/stores/actions";
import { useGoals } from "@/stores/goals";
import { PageTitle } from "@/modules/expenses/common";
import { daysLeftLabel, fmtGoalValue, LifeWheel, PaceBadge, useGoalCtx } from "./common";

type StatusView = "active" | "done" | "all";

function GoalCard({ g, i }: { g: Goal; i: number }) {
  const ctx = useGoalCtx();
  const openGoal = useActions((s) => s.openGoal);
  const e = evaluate(g, ctx);
  const a = areaInfo(g.area);
  const nm = nextMilestone(g);
  const lt = linkedTasks(g, ctx.tasks);
  const openTasks = lt.filter((t) => !t.done).length;
  const R = 26, C = 2 * Math.PI * R;
  return (
    <motion.button layout initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: Math.min(i * 0.05, 0.4), ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }} onClick={() => openGoal(g.id)}
      className={cx("card group flex flex-col p-5 text-left", g.status !== "active" && "opacity-70")}>
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-25 blur-3xl transition-opacity group-hover:opacity-40" style={{ background: a.color }} />
      <div className="relative flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: a.color }}>{a.emoji} {a.label}</div>
          <div className="mt-1.5 line-clamp-2 font-display text-[15.5px] font-semibold leading-snug">{g.title}</div>
        </div>
        <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
          <svg width={64} height={64} className="-rotate-90">
            <circle cx={32} cy={32} r={R} fill="none" stroke="rgb(var(--line) / .08)" strokeWidth={6} />
            <motion.circle cx={32} cy={32} r={R} fill="none" stroke={g.status === "done" ? "rgb(var(--pos))" : a.color} strokeWidth={6} strokeLinecap="round" strokeDasharray={C}
              initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - e.pct) }} transition={{ duration: 1.2, delay: 0.15 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              style={{ filter: `drop-shadow(0 0 6px ${a.color})` }} />
          </svg>
          <div className="num absolute inset-0 grid place-items-center text-[13px] font-semibold">{Math.round(e.pct * 100)}%</div>
        </div>
      </div>
      <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
        <PaceBadge pace={e.pace} />
        <span className="inline-flex items-center gap-1 text-[11px] text-muted"><CalendarDays size={11} />{daysLeftLabel(e.daysLeft)}</span>
      </div>
      <div className="relative mt-auto pt-4 text-xs text-muted">
        {g.metric === "checklist" ? (
          <div className="space-y-1.5">
            {nm && <div className="flex items-center gap-1.5 truncate"><Flag size={11} className="shrink-0" style={{ color: a.color }} /><span className="truncate">Next: <span className="text-ink">{nm.title}</span></span></div>}
            <div className="flex items-center gap-1.5"><ListChecks size={11} />{e.done}/{e.total} done{openTasks ? ` · ${openTasks} open task${openTasks === 1 ? "" : "s"}` : ""}</div>
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <div className="min-w-0"><div className="num truncate text-sm font-semibold text-ink">{fmtGoalValue(g, e.value)}</div><div className="num truncate">of {fmtGoalValue(g, g.target)}</div></div>
            {g.metric === "number" && g.log.length >= 2 && <Sparkline values={g.log.map((p) => p.v)} positive={(g.target >= g.start) === (g.current >= g.log[0].v)} className="ml-auto h-9 w-24" />}
          </div>
        )}
      </div>
    </motion.button>
  );
}

export default function Goals() {
  const loaded = useGoals((s) => s.loaded);
  const goals = useGoals((s) => s.goals);
  const openGoal = useActions((s) => s.openGoal);
  const ctx = useGoalCtx();
  const [view, setView] = useState<StatusView>("active");
  const [area, setArea] = useState<string | null>(null);
  const st = useMemo(() => goalStats(goals, ctx), [goals, ctx]);
  const wheel = useMemo(() => areaSummary(goals, ctx), [goals, ctx]);
  const list = useMemo(() => goals
    .filter((g) => (view === "active" ? g.status === "active" || g.status === "paused" : view === "done" ? g.status === "done" : true))
    .filter((g) => !area || g.area === area)
    .sort(sortGoals), [goals, view, area]);

  return (
    <>
      <PageTitle title="Goals" sub="Long-term goals, broken into milestones and next actions" right={<button className="btn btn-primary" onClick={() => openGoal(null)}><Plus size={15} /> New goal</button>} />
      {!loaded ? <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-48" />)}</div> : !goals.length ? (
        <Card><Empty icon={<Mountain />} title="Where do you want to be?" sub="Set a long-term goal — a career move, a savings target, a skill, a fitness milestone — and break it into milestones and tasks."
          action={<button className="btn btn-primary" onClick={() => openGoal(null)}><Plus size={15} /> Create your first goal</button>} /></Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {[
                { k: "Active goals", v: st.active, icon: <Target size={15} />, c: "", glow: "bg-cyan" },
                { k: "On track", v: st.onTrack, icon: <TrendingUp size={15} />, c: "pos", glow: "bg-pos" },
                { k: "Need attention", v: st.atRisk, icon: <AlertTriangle size={15} />, c: st.atRisk ? "text-amber" : "", glow: "bg-amber" },
                { k: `Achieved in ${ctx.today.slice(0, 4)}`, v: st.doneThisYear, icon: <Trophy size={15} />, c: "text-violet", glow: "bg-violet" },
              ].map((x, i) => (
                <Card key={x.k} className="p-5" delay={i * 0.05}>
                  <div className={cx("pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-30 blur-3xl", x.glow)} />
                  <div className="flex items-center gap-2 text-muted">{x.icon}<span className="label">{x.k}</span></div>
                  <AnimatedNumber value={x.v} format={(n) => String(Math.round(n))} className={cx("mt-2 block text-4xl font-semibold", x.c)} />
                </Card>
              ))}
            </div>
            <Card delay={0.15}>
              <CardHeader title="Life wheel" sub="Average progress per area" icon={<Mountain size={16} />} />
              <div className="px-4 pb-4 pt-2"><LifeWheel data={wheel} size={250} /></div>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Segmented id="gview" value={view} onChange={setView} options={[{ value: "active", label: "Active" }, { value: "done", label: "Achieved" }, { value: "all", label: "All" }]} />
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setArea(null)} className={cx("chip !normal-case !text-[11px] transition", !area && "!bg-line/15 !text-ink")}>All areas</button>
              {AREAS.map((a) => (
                <button key={a.key} onClick={() => setArea(area === a.key ? null : a.key)} className="chip !normal-case !text-[11px] transition"
                  style={area === a.key ? { color: a.color, background: `${a.color}26`, boxShadow: `0 0 0 1px ${a.color}` } : undefined}>{a.emoji} {a.label}</button>
              ))}
            </div>
          </div>

          {!list.length ? (
            <Card><Empty icon="🏔️" title={view === "done" ? "No achieved goals yet" : "No goals here"} sub={view === "done" ? "Mark a goal achieved from its detail view." : "Try another area or create a new goal."} /></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {list.map((g, i) => <GoalCard key={g.id} g={g} i={i} />)}
              {view !== "done" && (
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} onClick={() => openGoal(null)}
                  className="grid min-h-[180px] place-items-center rounded-2xl border-2 border-dashed border-line/15 text-sm text-muted transition hover:border-cyan/50 hover:text-cyan">
                  <span className="flex flex-col items-center gap-2"><Plus size={22} /> New goal</span>
                </motion.button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

import { motion } from "framer-motion";
import { ArrowRight, Mountain, Plus } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardHeader } from "@/components/ui";
import { areaInfo, evaluate, sortGoals } from "@/engine/goal-engine";
import { useActions } from "@/stores/actions";
import { useGoals } from "@/stores/goals";
import { daysLeftLabel, PaceBadge, useGoalCtx } from "./common";

/** Active goals for the Hub — ones needing attention first, then nearest deadline. */
export function GoalsHubCard({ delay = 0 }: { delay?: number }) {
  const goals = useGoals((s) => s.goals);
  const openGoal = useActions((s) => s.openGoal);
  const ctx = useGoalCtx();
  const rows = useMemo(() => {
    const rank = { overdue: 0, "at-risk": 1, "on-track": 2, ahead: 3, "no-date": 4, paused: 5, done: 6 } as const;
    return goals.filter((g) => g.status === "active").sort(sortGoals).map((g) => ({ g, e: evaluate(g, ctx) }))
      .sort((x, y) => rank[x.e.pace] - rank[y.e.pace]).slice(0, 4);
  }, [goals, ctx]);
  const active = goals.filter((g) => g.status === "active").length;
  return (
    <Card delay={delay}>
      <CardHeader title="Goals" sub={active ? `${active} active` : "Long-term direction"} icon={<Mountain size={16} />} right={<Link to="/goals" className="icon-btn"><ArrowRight size={16} /></Link>} />
      {!rows.length ? (
        <div className="flex flex-wrap items-center gap-3 p-5 text-sm text-muted">
          Set a long-term goal and track it alongside everything else.
          <button className="btn btn-sm btn-primary ml-auto" onClick={() => openGoal(null)}><Plus size={13} /> New goal</button>
        </div>
      ) : (
        <div className="space-y-3.5 p-5">
          {rows.map(({ g, e }, i) => {
            const a = areaInfo(g.area);
            return (
              <button key={g.id} onClick={() => openGoal(g.id)} className="block w-full text-left">
                <div className="flex items-center gap-2 text-sm">
                  <span>{a.emoji}</span><span className="min-w-0 flex-1 truncate font-medium">{g.title}</span>
                  <span className="num text-xs font-semibold">{Math.round(e.pct * 100)}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/10">
                  <motion.div className="h-full rounded-full" style={{ background: a.color, boxShadow: `0 0 10px ${a.color}` }}
                    initial={{ width: 0 }} animate={{ width: `${e.pct * 100}%` }} transition={{ duration: 1, delay: 0.2 + i * 0.08, ease: [0.22, 1, 0.36, 1] }} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted"><PaceBadge pace={e.pace} /><span>{daysLeftLabel(e.daysLeft)}</span></div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

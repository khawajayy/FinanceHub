import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Flame, ListTodo } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardHeader, Ring } from "@/components/ui";
import { focusTasks, iso, taskStats } from "@/engine/task-engine";
import { useTasks } from "@/stores/tasks";
import { QuickAdd, TaskRow } from "./parts";

/** "Today's focus" for the Hub: progress, quick add, and the most urgent open tasks. */
export function TasksHubCard({ delay = 0 }: { delay?: number }) {
  const tasks = useTasks((s) => s.tasks);
  const today = iso(new Date());
  const st = useMemo(() => taskStats(tasks), [tasks]);
  const focus = useMemo(() => {
    const open = focusTasks(tasks, today, 6);
    // keep tasks ticked today visible (struck through) so finishing one feels rewarding
    const doneToday = tasks.filter((t) => t.done && t.completedAt && iso(new Date(t.completedAt)) === today).slice(0, Math.max(0, 6 - open.length));
    return [...open, ...doneToday];
  }, [tasks, today]);
  const due = st.doneToday + st.dueToday + st.overdue;
  return (
    <Card delay={delay}>
      <CardHeader title="Today's focus" sub={st.overdue ? `${st.overdue} overdue · ${st.dueToday} due today` : `${st.dueToday} due today · ${st.open} open`} icon={<ListTodo size={16} />}
        right={<>{st.streak > 0 && <span className="chip !normal-case !bg-amber/12 !text-amber"><Flame size={11} />{st.streak}-day streak</span>}<Link to="/tasks" className="icon-btn"><ArrowRight size={16} /></Link></>} />
      <div className="grid gap-5 p-5 md:grid-cols-[150px_1fr]">
        <div className="hidden flex-col items-center justify-center md:flex">
          <Ring progress={due ? (st.doneToday / due) * 100 : st.doneToday ? 100 : 0} reached={due > 0 && st.doneToday === due} size={130} stroke={10}>
            <div><div className="num text-2xl font-semibold">{st.doneToday}<span className="text-sm text-muted">/{due}</span></div><div className="text-[10px] text-muted">today</div></div>
          </Ring>
        </div>
        <div className="min-w-0 space-y-3">
          <QuickAdd compact defaults={{ due: today }} />
          <div className="-mx-1 overflow-hidden rounded-2xl ring-1 ring-line/5">
            <AnimatePresence initial={false}>
              {focus.map((t) => <TaskRow key={t.id} t={t} compact />)}
            </AnimatePresence>
            {!focus.length && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 py-6 text-center text-sm text-muted">
                All clear — nothing urgent. Tasks added here are due today.
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

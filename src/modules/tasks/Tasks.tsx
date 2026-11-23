import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCheck, Flame, ListTodo, Repeat, Search, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { AnimatedNumber, Card, Empty, Ring, Segmented, Skeleton } from "@/components/ui";
import { BUCKET_LABEL, bucketOf, dueLabel, grouped, iso, recurrenceLabel, taskStats, type Bucket } from "@/engine/task-engine";
import { cx } from "@/lib/format";
import { useTasks } from "@/stores/tasks";
import { confirmDialog, toast } from "@/stores/ui";
import { PageTitle } from "@/modules/expenses/common";
import { ListTag, QuickAdd, TaskRow } from "./parts";

type View = "focus" | "upcoming" | "all" | "done";
const FOCUS: Bucket[] = ["overdue", "today", "tomorrow"];
const BUCKET_TONE: Partial<Record<Bucket, string>> = { overdue: "text-neg", today: "text-amber", tomorrow: "text-cyan", done: "text-pos" };

export default function Tasks() {
  const loaded = useTasks((s) => s.loaded);
  const tasks = useTasks((s) => s.tasks);
  const clearCompleted = useTasks((s) => s.clearCompleted);
  const restore = useTasks((s) => s.restore);
  const update = useTasks((s) => s.update);
  const reorder = useTasks((s) => s.reorder);
  const dropToBucket = useTasks((s) => s.dropToBucket);
  const [view, setView] = useState<View>("focus");
  const [list, setList] = useState<string | null>(null);
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: "before" | "after" } | null>(null);
  const [hoveredBucket, setHoveredBucket] = useState<Bucket | null>(null);
  const touchState = useRef<{ sourceId: string; lastTargetId: string | null; lastPos: "before" | "after" | null } | null>(null);
  const today = iso(new Date());
  const st = useMemo(() => taskStats(tasks), [tasks]);

  const groups = useMemo(() => {
    let l = tasks;
    if (recurringOnly) l = l.filter((t) => !!t.recurrence);
    if (list) l = l.filter((t) => t.list === list);
    const s = q.trim().toLowerCase();
    if (s) l = l.filter((t) => t.title.toLowerCase().includes(s) || t.notes.toLowerCase().includes(s) || (t.list || "").includes(s) || (t.recurrence && recurrenceLabel(t.recurrence).toLowerCase().includes(s)));
    if (view === "focus") l = l.filter((t) => FOCUS.includes(bucketOf(t, today)) || (t.done && t.completedAt && iso(new Date(t.completedAt)) === today));
    if (view === "upcoming") l = l.filter((t) => !t.done);
    if (view === "done") l = l.filter((t) => t.done);
    return grouped(l, today);
  }, [tasks, list, recurringOnly, q, view, today]);
  const max7 = Math.max(1, ...st.last7.map((d) => d.count));
  const doneCount = tasks.filter((t) => t.done).length;

  const handleTaskDrop = (sourceId: string, targetId: string, position: "before" | "after") => {
    if (sourceId === targetId) return;
    const sourceTask = tasks.find((t) => t.id === sourceId);
    if (!sourceTask) return;
    const prevAttrs = {
      due: sourceTask.due,
      priority: sourceTask.priority,
      createdAt: sourceTask.createdAt,
      done: sourceTask.done,
      completedAt: sourceTask.completedAt,
    };
    const patch = reorder(sourceId, targetId, position);
    setDraggingId(null);
    setDropTarget(null);
    setHoveredBucket(null);

    if (patch && Object.keys(patch).length > 0) {
      const desc: string[] = [];
      if (patch.due !== undefined && patch.due !== prevAttrs.due) {
        desc.push(patch.due ? dueLabel(patch.due, today) : "Someday");
      }
      if (patch.priority !== undefined && patch.priority !== prevAttrs.priority) {
        desc.push(`!${patch.priority}`);
      }
      if (patch.done !== undefined && patch.done !== prevAttrs.done) {
        desc.push(patch.done ? "Done" : "Reopened");
      }
      const summary = desc.length ? ` · ${desc.join(", ")}` : "";
      toast(`Reordered "${sourceTask.title}"${summary}`, false, {
        label: "Undo",
        onClick: () => update(sourceId, prevAttrs),
      });
    }
  };

  const handleBucketDrop = (sourceId: string, bucket: Bucket) => {
    const sourceTask = tasks.find((t) => t.id === sourceId);
    if (!sourceTask) return;
    const prevAttrs = {
      due: sourceTask.due,
      priority: sourceTask.priority,
      createdAt: sourceTask.createdAt,
      done: sourceTask.done,
      completedAt: sourceTask.completedAt,
    };
    const patch = dropToBucket(sourceId, bucket);
    setDraggingId(null);
    setDropTarget(null);
    setHoveredBucket(null);

    if (patch && Object.keys(patch).length > 0) {
      const label = BUCKET_LABEL[bucket];
      const pri = patch.priority ? ` · !${patch.priority}` : "";
      toast(`Moved "${sourceTask.title}" to ${label}${pri}`, false, {
        label: "Undo",
        onClick: () => update(sourceId, prevAttrs),
      });
    }
  };

  const handleTouchStart = (_e: React.TouchEvent, id: string) => {
    touchState.current = { sourceId: id, lastTargetId: null, lastPos: null };
    setDraggingId(id);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchState.current) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const row = el?.closest("[data-task-id]") as HTMLElement | null;
    if (row && row.dataset.taskId && row.dataset.taskId !== touchState.current.sourceId) {
      const rect = row.getBoundingClientRect();
      const isUpper = touch.clientY - rect.top < rect.height / 2;
      const position = isUpper ? "before" : "after";
      touchState.current.lastTargetId = row.dataset.taskId;
      touchState.current.lastPos = position;
      setDropTarget({ id: row.dataset.taskId, position });
      setHoveredBucket(null);
    }
  };

  const handleTouchEnd = () => {
    if (touchState.current && touchState.current.lastTargetId && touchState.current.lastPos) {
      handleTaskDrop(touchState.current.sourceId, touchState.current.lastTargetId, touchState.current.lastPos);
    } else {
      setDraggingId(null);
      setDropTarget(null);
      setHoveredBucket(null);
    }
    touchState.current = null;
  };

  return (
    <>
      <PageTitle title="Tasks" sub="Everything on your plate — finance, home, work and life" />
      {!loaded ? <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-96" /></div> : (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-4">
            <QuickAdd id="task-quick-add" />
            <div className="flex flex-wrap items-center gap-2">
              <Segmented id="tview" value={view} onChange={(v) => { setView(v); setOpen(null); }} options={[
                { value: "focus", label: "Focus" }, { value: "upcoming", label: "Upcoming" }, { value: "all", label: "All" }, { value: "done", label: "Done" },
              ]} />
              <div className="relative ml-auto min-w-[160px] flex-1 sm:max-w-[240px]">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className="input !py-2 !pl-9" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tasks" />
              </div>
            </div>
            {(st.lists.length > 0 || st.recurring > 0) && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button onClick={() => { setList(null); setRecurringOnly(false); }} className={cx("chip !normal-case !text-[11px] transition", !list && !recurringOnly && "!bg-line/15 !text-ink")}>All lists</button>
                {st.lists.map((l) => <ListTag key={l} name={l} active={list === l && !recurringOnly} onClick={() => { setList(list === l ? null : l); setRecurringOnly(false); }} />)}
                {st.recurring > 0 && (
                  <button onClick={() => { setRecurringOnly((r) => !r); setList(null); }} className={cx("chip !normal-case !text-[11px] inline-flex items-center gap-1 transition", recurringOnly ? "!bg-violet/20 !text-violet shadow-sm" : "!text-muted hover:!text-ink")}>
                    <Repeat size={11} /> Recurring ({st.recurring})
                  </button>
                )}
              </div>
            )}

            <Card>
              <div onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
                {!groups.length ? (
                  <Empty icon={view === "done" ? "🏁" : "✨"} title={view === "focus" ? "Nothing due — you're clear" : view === "done" ? "Nothing completed yet" : "No tasks here"}
                    sub={view === "focus" ? "No overdue, today or tomorrow tasks. Enjoy it, or plan ahead in Upcoming." : "Add one above. Dates, !priority and #lists are understood automatically."} />
                ) : (
                  <div>
                  {groups.map((g) => (
                    <section key={g.bucket}>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (hoveredBucket !== g.bucket) {
                            setHoveredBucket(g.bucket);
                            setDropTarget(null);
                          }
                        }}
                        onDragLeave={(e) => {
                          if (hoveredBucket === g.bucket && !e.currentTarget.contains(e.relatedTarget as Node)) {
                            setHoveredBucket(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const srcId = draggingId || e.dataTransfer.getData("text/plain");
                          if (srcId) {
                            handleBucketDrop(srcId, g.bucket);
                          }
                        }}
                        className={cx(
                          "sticky top-0 z-[1] flex items-center gap-2 border-b border-line/5 bg-bg/40 px-4 py-2 backdrop-blur transition-all",
                          hoveredBucket === g.bucket && "bg-cyan/15 ring-1 ring-cyan/40"
                        )}
                      >
                        <span className={cx("text-[11px] font-bold uppercase tracking-[0.14em]", BUCKET_TONE[g.bucket] || "text-muted")}>{BUCKET_LABEL[g.bucket]}</span>
                        <span className="num text-[11px] text-muted">{g.tasks.length}</span>
                        {hoveredBucket === g.bucket && (
                          <span className="ml-2 text-[10px] font-semibold text-cyan animate-pulse">
                            Drop to move into {BUCKET_LABEL[g.bucket]}
                          </span>
                        )}
                        {g.bucket === "done" && (
                          <button className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted hover:text-neg" onClick={async () => {
                            if (!(await confirmDialog("Clear completed", `Delete all ${doneCount} completed task(s)?`, { confirmText: "Clear", danger: true }))) return;
                            const removed = tasks.filter((t) => t.done);
                            clearCompleted();
                            toast(`Cleared ${removed.length} task(s)`, false, { label: "Undo", onClick: () => removed.forEach(restore) });
                          }}><Trash2 size={11} /> Clear all completed</button>
                        )}
                      </div>
                      <AnimatePresence initial={false}>
                        {g.tasks.map((t) => (
                          <TaskRow
                            key={t.id}
                            t={t}
                            expanded={open === t.id}
                            onExpand={() => setOpen(open === t.id ? null : t.id)}
                            isDragging={draggingId === t.id}
                            dropPosition={dropTarget?.id === t.id ? dropTarget.position : null}
                            onDragStart={(e) => {
                              setDraggingId(t.id);
                              e.dataTransfer.setData("text/plain", t.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (draggingId && draggingId !== t.id) {
                                e.dataTransfer.dropEffect = "move";
                                const rect = e.currentTarget.getBoundingClientRect();
                                const isUpper = e.clientY - rect.top < rect.height / 2;
                                setDropTarget({ id: t.id, position: isUpper ? "before" : "after" });
                                setHoveredBucket(null);
                              }
                            }}
                            onDragLeave={(e) => {
                              if (dropTarget?.id === t.id && !e.currentTarget.contains(e.relatedTarget as Node)) {
                                setDropTarget(null);
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const srcId = draggingId || e.dataTransfer.getData("text/plain");
                              if (srcId && dropTarget && dropTarget.id === t.id) {
                                handleTaskDrop(srcId, t.id, dropTarget.position);
                              }
                            }}
                            onDragEnd={() => {
                              setDraggingId(null);
                              setDropTarget(null);
                              setHoveredBucket(null);
                            }}
                            onTouchStartHandle={handleTouchStart}
                          />
                        ))}
                      </AnimatePresence>
                    </section>
                  ))}
                </div>
              )}
              </div>
            </Card>
            <p className="px-1 text-[11.5px] text-muted">
              <b>Hold &amp; drag</b> tasks to reorder them — due dates and priorities adjust automatically (e.g. drag to the top for <b>!high</b> priority). Quick add understands <b>today</b>, <b>tomorrow</b>, weekdays (<b>fri</b>), <b>next week</b>, <b>in 3 days</b>, <b>25 oct</b>, priorities <b>!high</b> / <b>!low</b>, lists like <b>#finance</b>, recurrences like <b>daily</b> or <b>weekly</b>, and subtasks like <b>[item 1, item 2]</b>. Click a task to edit notes, dates, subtasks and recurrence.
            </p>
          </div>

          <div className="space-y-4 xl:sticky xl:top-4 xl:h-fit">
            <Card className="p-6" delay={0.05}>
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet/25 blur-3xl" />
              <div className="relative flex flex-col items-center">
                <Ring progress={(st.todayProgress ?? (st.doneToday ? 1 : 0)) * 100} reached={st.todayProgress === 1} size={170}>
                  <div>
                    <div className="num text-3xl font-semibold">{st.doneToday}<span className="text-base text-muted">/{st.doneToday + st.dueToday + st.overdue}</span></div>
                    <div className="text-[11px] text-muted">done today</div>
                  </div>
                </Ring>
                <div className="mt-3 text-center text-sm text-muted">
                  {st.todayProgress === 1 ? "Everything due today is done 🎉" : st.dueToday + st.overdue > 0 ? `${st.dueToday + st.overdue} still due today` : "Nothing due today"}
                </div>
              </div>
            </Card>
            <div className="grid grid-cols-3 gap-3">
              {[
                { k: "Open", v: st.open, icon: <ListTodo size={14} />, c: "" },
                { k: "Overdue", v: st.overdue, icon: <AlertTriangle size={14} />, c: st.overdue ? "neg" : "" },
                { k: "Streak", v: st.streak, icon: <Flame size={14} />, c: st.streak ? "text-amber" : "" },
              ].map((x, i) => (
                <Card key={x.k} className="p-3.5" delay={0.1 + i * 0.04}>
                  <div className="flex items-center gap-1 text-muted">{x.icon}<span className="text-[10px] font-semibold uppercase tracking-wider">{x.k}</span></div>
                  <AnimatedNumber value={x.v} format={(n) => String(Math.round(n))} className={cx("mt-1 block text-2xl font-semibold", x.c)} />
                </Card>
              ))}
            </div>
            <Card className="p-5" delay={0.2}>
              <div className="flex items-center gap-2"><CheckCheck size={15} className="text-muted" /><span className="label">Completed · last 7 days</span><span className="num ml-auto text-sm font-semibold">{st.last7.reduce((s, d) => s + d.count, 0)}</span></div>
              <div className="mt-4 flex h-24 items-end gap-2">
                {st.last7.map((d, i) => (
                  <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span className="num text-[10px] text-muted">{d.count || ""}</span>
                    <motion.div className={cx("w-full rounded-t-md", d.day === today ? "bg-gradient-to-t from-violet/40 to-violet shadow-glowv" : "bg-gradient-to-t from-cyan/20 to-cyan/70")}
                      initial={{ height: 0 }} animate={{ height: `${Math.max(4, (d.count / max7) * 100)}%` }} transition={{ duration: 0.8, delay: 0.25 + i * 0.05 }} />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-2">{st.last7.map((d) => <span key={d.day} className={cx("flex-1 text-center text-[10px]", d.day === today ? "font-semibold text-ink" : "text-muted")}>{new Date(d.day + "T00:00:00").toLocaleDateString(undefined, { weekday: "narrow" })}</span>)}</div>
            </Card>
            <div className="flex items-center gap-2 px-1 text-[11.5px] text-muted"><Sparkles size={12} className="text-cyan" /> Synced across your devices with your Google account.</div>
          </div>
        </div>
      )}
    </>
  );
}

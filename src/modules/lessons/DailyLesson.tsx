import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Flame, ListPlus, Quote, Sparkles, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { lessonForDay, localDayNumber, msUntilNextLesson } from "@/engine/lessons";
import { iso } from "@/engine/task-engine";
import { cx } from "@/lib/format";
import { useTasks } from "@/stores/tasks";
import { toast } from "@/stores/ui";

/* Per-device convenience state: which days' practices were done / turned into tasks. */
const KEY = "nexus.lessons.v1";
interface LocalState { practiced: Record<string, true>; tasked: Record<string, string> }
function readLocal(): LocalState {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "{}"); return { practiced: v.practiced || {}, tasked: v.tasked || {} }; }
  catch { return { practiced: {}, tasked: {} }; }
}
function writeLocal(s: LocalState) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }

function practiceStreak(practiced: Record<string, true>, today: number) {
  let n = 0;
  for (let d = practiced[today] ? today : today - 1; practiced[d]; d--) n++;
  return n;
}

function useCountdown() {
  const [ms, setMs] = useState(() => msUntilNextLesson());
  useEffect(() => { const t = setInterval(() => setMs(msUntilNextLesson()), 30000); return () => clearInterval(t); }, []);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${Math.max(1, m)}m`;
}

/** Word-by-word blur-in reveal. */
function Reveal({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => (
        <motion.span key={`${w}-${i}`} aria-hidden className="inline-block whitespace-pre"
          initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.5, delay: delay + i * 0.045, ease: [0.22, 1, 0.36, 1] }}>
          {w}{i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  );
}

export function DailyLesson() {
  const [today, setToday] = useState(() => localDayNumber());
  const [offset, setOffset] = useState(0); // 0 = today, -1 = yesterday … (up to a week back)
  const [local, setLocal] = useState(readLocal);
  const addTask = useTasks((s) => s.add);
  const tasks = useTasks((s) => s.tasks);
  const countdown = useCountdown();
  const reduce = useReducedMotion();

  // roll over to the new lesson at local midnight
  useEffect(() => {
    const t = setTimeout(() => { setToday(localDayNumber()); setOffset(0); }, msUntilNextLesson() + 1000);
    return () => clearTimeout(t);
  }, [today]);

  const day = today + offset;
  const L = useMemo(() => lessonForDay(day), [day]);
  const [c1, c2] = L.hues;
  const practiced = !!local.practiced[day];
  const taskId = local.tasked[day];
  const taskExists = taskId && tasks.some((t) => t.id === taskId);
  const streak = practiceStreak(local.practiced, today);
  const dayLabel = offset === 0 ? "Today" : offset === -1 ? "Yesterday" : new Date((day) * 86400000).toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" });

  const update = (fn: (s: LocalState) => void) => setLocal((prev) => { const next = { practiced: { ...prev.practiced }, tasked: { ...prev.tasked } }; fn(next); writeLocal(next); return next; });
  const togglePractice = () => {
    update((s) => { if (s.practiced[day]) delete s.practiced[day]; else s.practiced[day] = true; });
    if (!practiced) toast("Practice done — nice. 🌱");
  };
  const toTask = () => {
    const id = addTask({ title: L.practice.slice(0, 200), due: iso(new Date()), priority: "med", list: "mindset", notes: `Lesson: ${L.theme} — “${L.quote}” — ${L.author}` });
    update((s) => { s.tasked[day] = id; });
    toast("Added to today's tasks");
  };

  return (
    <div className="relative overflow-hidden rounded-[1.4rem] p-px" role="region" aria-label="Lesson of the day">
      {/* rotating gradient border */}
      <motion.div className="absolute -inset-[150%]" style={{ background: `conic-gradient(from 0deg, ${c1}, transparent 25%, ${c2} 50%, transparent 75%, ${c1})` }}
        animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 14, repeat: Infinity, ease: "linear" }} />
      <div className="glass-strong relative overflow-hidden rounded-[calc(1.4rem-1px)] !bg-bg/85">
        {/* ambient orbs */}
        <motion.div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full blur-3xl" style={{ background: c1, opacity: 0.22 }}
          animate={reduce ? undefined : { x: [0, 40, 0], y: [0, 20, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full blur-3xl" style={{ background: c2, opacity: 0.2 }}
          animate={reduce ? undefined : { x: [0, -30, 0], y: [0, -25, 0] }} transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }} />

        <div className="relative p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label flex items-center gap-1.5"><Sparkles size={13} style={{ color: c1 }} /> Lesson of the day</span>
            <span className="text-[11px] text-muted">· {dayLabel}</span>
            <div className="ml-auto flex items-center gap-1">
              {offset === 0 && <span className="mr-1 hidden items-center gap-1 text-[11px] text-muted sm:inline-flex"><Timer size={11} /> next in {countdown}</span>}
              <button className="icon-btn !h-7 !w-7" onClick={() => setOffset((o) => Math.max(-6, o - 1))} disabled={offset <= -6} aria-label="Previous day's lesson"><ChevronLeft size={15} /></button>
              <button className="icon-btn !h-7 !w-7 disabled:opacity-30" onClick={() => setOffset((o) => Math.min(0, o + 1))} disabled={offset === 0} aria-label="Next day's lesson"><ChevronRight size={15} /></button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={L.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8, filter: "blur(6px)" }} transition={{ duration: 0.3 }}>
              <div className="mt-4 grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-center">
                <div>
                  <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold" style={{ color: c1, background: `${c1}1f`, boxShadow: `0 0 0 1px ${c1}55, 0 0 24px -6px ${c1}` }}>
                    <span className="text-sm">{L.emoji}</span>{L.theme}
                  </motion.span>
                  <blockquote className="relative mt-4">
                    <Quote size={34} className="absolute -left-1 -top-3 opacity-15" style={{ color: c2 }} aria-hidden />
                    <Reveal text={L.quote} delay={0.15}
                      className="relative block font-display text-[1.35rem] font-semibold leading-snug tracking-tight sm:text-[1.65rem]" />
                    <motion.footer initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + L.quote.split(" ").length * 0.045 }}
                      className="mt-3 flex items-center gap-2 text-sm text-muted">
                      <span className="h-px w-8" style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }} /> {L.author}
                    </motion.footer>
                  </blockquote>
                </div>

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.5 }} className="space-y-3">
                  <p className="text-[13.5px] leading-relaxed text-ink/85">{L.lesson}</p>
                  <div className="rounded-2xl p-4 ring-1" style={{ background: `linear-gradient(135deg, ${c1}14, ${c2}10)`, boxShadow: `inset 0 0 0 1px ${c1}30` }}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: c1 }}>{offset === 0 ? "Today's practice" : "Practice"}</span>
                      {streak > 0 && offset === 0 && <span className="chip ml-auto !normal-case !bg-amber/12 !text-amber"><Flame size={11} />{streak}-day streak</span>}
                    </div>
                    <p className={cx("mt-1.5 text-sm font-medium transition", practiced && "text-muted line-through")}>{L.practice}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <motion.button whileTap={{ scale: 0.95 }} onClick={togglePractice}
                        className={cx("btn btn-sm", practiced ? "!bg-pos/15 !text-pos ring-1 ring-pos/30" : "")}>
                        <Check size={13} /> {practiced ? "Done" : "Mark done"}
                      </motion.button>
                      {offset === 0 && (taskExists
                        ? <span className="chip !normal-case !tracking-normal"><ListPlus size={11} /> In today's tasks</span>
                        : <button className="btn btn-sm" onClick={toTask}><ListPlus size={13} /> Add to tasks</button>)}
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

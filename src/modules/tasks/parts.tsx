import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Check, CornerDownLeft, Flag, GripVertical, Hash, ListChecks, Plus, Repeat, RotateCw, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Segmented } from "@/components/ui";
import { dueLabel, iso, parseQuickAdd, recurrenceLabel, type Priority, type Task, type TaskRecurrence } from "@/engine/task-engine";
import { cx } from "@/lib/format";
import { useTasks } from "@/stores/tasks";
import { useGoals } from "@/stores/goals";
import { areaInfo } from "@/engine/goal-engine";
import { toast } from "@/stores/ui";

export const PRI_STYLE: Record<Priority, { dot: string; text: string; label: string }> = {
  high: { dot: "bg-pink shadow-[0_0_10px_rgb(var(--pink))]", text: "text-pink", label: "High" },
  med: { dot: "bg-cyan shadow-[0_0_8px_rgb(var(--cyan))]", text: "text-cyan", label: "Medium" },
  low: { dot: "bg-muted/60", text: "text-muted", label: "Low" },
};

const LIST_HUES = ["#22d3ee", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#60a5fa", "#fb923c", "#f87171"];
export function listColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return LIST_HUES[h % LIST_HUES.length];
}

export function ListTag({ name, active, onClick }: { name: string; active?: boolean; onClick?: () => void }) {
  const c = listColor(name);
  const Comp = onClick ? "button" : "span";
  return (
    <Comp onClick={onClick} className={cx("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold transition", onClick && "hover:brightness-125")}
      style={{ color: c, background: `${c}${active ? "33" : "1a"}`, boxShadow: active ? `0 0 0 1px ${c}` : undefined }}>
      <Hash size={9} />{name}
    </Comp>
  );
}

/** Round checkbox: fills with the brand gradient, draws a tick, and throws a few sparks when completed. */
export function CheckOrb({ done, onToggle, size = 22, label }: { done: boolean; onToggle: () => void; size?: number; label: string }) {
  const [burst, setBurst] = useState(0);
  return (
    <button type="button" role="checkbox" aria-checked={done} aria-label={label}
      onClick={(e) => { e.stopPropagation(); if (!done) setBurst((b) => b + 1); onToggle(); }}
      className="relative grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size }}>
      <motion.span className="absolute inset-0 rounded-full border-2 transition-colors hover:border-cyan" initial={false}
        animate={{ background: done ? "linear-gradient(135deg, rgb(var(--cyan)), rgb(var(--violet)))" : "linear-gradient(135deg, rgba(0,0,0,0), rgba(0,0,0,0))",
          boxShadow: done ? "0 0 14px rgb(var(--cyan) / .6)" : "0 0 0px rgb(var(--cyan) / 0)" }}
        style={{ borderColor: done ? "transparent" : "rgb(var(--muted) / .55)" }} transition={{ duration: 0.25 }} />
      <svg viewBox="0 0 24 24" className="relative" width={size * 0.62} height={size * 0.62}>
        <motion.path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#04131a" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"
          initial={false} animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }} transition={{ duration: 0.3, delay: done ? 0.08 : 0 }} />
      </svg>
      <AnimatePresence>
        {burst > 0 && done && [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <motion.span key={`${burst}-${i}`} className="pointer-events-none absolute h-1.5 w-1.5 rounded-full"
            style={{ background: i % 2 ? "rgb(var(--violet))" : "rgb(var(--cyan))" }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos((i / 8) * Math.PI * 2) * size, y: Math.sin((i / 8) * Math.PI * 2) * size, opacity: 0, scale: 0.4 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.55, ease: "easeOut" }} />
        ))}
      </AnimatePresence>
    </button>
  );
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RecurrencePicker({
  value,
  onChange,
  compact,
}: {
  value: TaskRecurrence | null;
  onChange: (r: TaskRecurrence | null) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [customInterval, setCustomInterval] = useState<number>(value?.interval ?? 2);
  const [customUnit, setCustomUnit] = useState<"days" | "weeks" | "months">(value?.unit ?? "days");
  const [customDays, setCustomDays] = useState<number[]>(value?.daysOfWeek ?? []);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMode("preset");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectPreset = (type: "none" | "daily" | "weekly" | "custom") => {
    if (type === "none") {
      onChange(null);
      setOpen(false);
      setMode("preset");
    } else if (type === "daily") {
      onChange({ freq: "daily" });
      setOpen(false);
      setMode("preset");
    } else if (type === "weekly") {
      onChange({ freq: "weekly" });
      setOpen(false);
      setMode("preset");
    } else if (type === "custom") {
      setMode("custom");
    }
  };

  const applyCustom = () => {
    const interval = Math.max(1, Math.min(365, Number(customInterval) || 1));
    const rec: TaskRecurrence = {
      freq: "custom",
      interval,
      unit: customUnit,
    };
    if (customUnit === "weeks" && customDays.length > 0) {
      rec.daysOfWeek = [...customDays].sort();
    }
    onChange(rec);
    setOpen(false);
    setMode("preset");
  };

  const toggleDay = (day: number) => {
    setCustomDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {value ? (
        <span
          className={cx(
            "chip !normal-case !bg-violet/15 !text-violet inline-flex items-center gap-1 font-semibold cursor-pointer transition hover:brightness-110",
            compact ? "!py-1 !text-[11px]" : "!py-1.5 !text-xs"
          )}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          title={`Recurring: ${recurrenceLabel(value)}. Click to change.`}
        >
          <Repeat size={compact ? 11 : 13} />
          <span>{recurrenceLabel(value)}</span>
          <button
            type="button"
            className="ml-0.5 opacity-70 hover:opacity-100 hover:text-ink"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            aria-label="Remove recurrence"
          >
            <X size={11} />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className={cx(
            "chip !normal-case hover:!text-ink inline-flex items-center gap-1 text-muted transition",
            compact ? "!py-1 !text-[11px]" : "!py-1.5 !text-xs"
          )}
          aria-label="Set recurrence"
        >
          <Repeat size={compact ? 11 : 13} />
          <span>Repeat</span>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-full z-30 mt-1 min-w-[220px] rounded-2xl border border-line/15 bg-bg/95 p-2 shadow-2xl backdrop-blur-xl ring-1 ring-line/10"
          >
            {mode === "preset" ? (
              <div className="space-y-1 text-xs">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">Recurrence</div>
                <button
                  type="button"
                  onClick={() => selectPreset("none")}
                  className={cx(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition hover:bg-line/10",
                    !value && "font-semibold text-violet"
                  )}
                >
                  <span>Does not repeat</span>
                  {!value && <Check size={12} />}
                </button>
                <button
                  type="button"
                  onClick={() => selectPreset("daily")}
                  className={cx(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition hover:bg-line/10",
                    value?.freq === "daily" && "font-semibold text-violet"
                  )}
                >
                  <span className="flex items-center gap-1.5"><Repeat size={12} className="text-violet" /> Daily</span>
                  {value?.freq === "daily" && <Check size={12} />}
                </button>
                <button
                  type="button"
                  onClick={() => selectPreset("weekly")}
                  className={cx(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition hover:bg-line/10",
                    value?.freq === "weekly" && (!value.daysOfWeek || value.daysOfWeek.length === 0) && "font-semibold text-violet"
                  )}
                >
                  <span className="flex items-center gap-1.5"><Repeat size={12} className="text-violet" /> Weekly</span>
                  {value?.freq === "weekly" && (!value.daysOfWeek || value.daysOfWeek.length === 0) && <Check size={12} />}
                </button>
                <button
                  type="button"
                  onClick={() => selectPreset("custom")}
                  className={cx(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition hover:bg-line/10",
                    (value?.freq === "custom" || (value?.freq === "weekly" && !!value.daysOfWeek?.length)) && "font-semibold text-violet"
                  )}
                >
                  <span className="flex items-center gap-1.5"><RotateCw size={12} className="text-violet" /> Custom…</span>
                  <span className="text-[10px] text-muted">Interval & days</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 p-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Custom recurrence</span>
                  <button type="button" onClick={() => setMode("preset")} className="text-[11px] text-muted hover:text-ink">Back</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted">Every</span>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={customInterval}
                    onChange={(e) => setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))}
                    className="input !w-16 !py-1 text-center font-medium"
                    aria-label="Custom interval"
                  />
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as "days" | "weeks" | "months")}
                    className="input !w-24 !py-1 text-xs"
                    aria-label="Custom unit"
                  >
                    <option value="days">days</option>
                    <option value="weeks">weeks</option>
                    <option value="months">months</option>
                  </select>
                </div>

                {customUnit === "weeks" && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-muted">On days:</span>
                    <div className="flex items-center justify-between gap-1">
                      {DAY_LABELS.map((label, idx) => {
                        const sel = customDays.includes(idx);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleDay(idx)}
                            title={DAY_NAMES[idx]}
                            className={cx(
                              "h-6 w-6 rounded-full text-[10px] font-semibold transition",
                              sel ? "bg-violet text-white shadow-glowv" : "bg-line/10 text-muted hover:text-ink"
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <button type="button" onClick={() => setMode("preset")} className="btn btn-ghost btn-sm !py-1 !text-xs">Cancel</button>
                  <button type="button" onClick={applyCustom} className="btn btn-primary btn-sm !py-1 !text-xs">Apply</button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Quick add with live natural-language parsing preview and recurrence support. */
export function QuickAdd({ autoFocus, compact, defaults, id, placeholder }: { autoFocus?: boolean; compact?: boolean; defaults?: { due?: string | null; list?: string | null; goalId?: string | null; recurrence?: TaskRecurrence | null }; id?: string; placeholder?: string }) {
  const add = useTasks((s) => s.add);
  const [text, setText] = useState("");
  const [focus, setFocus] = useState(false);
  const [manualRecurrence, setManualRecurrence] = useState<TaskRecurrence | null>(null);
  const p = useMemo(() => parseQuickAdd(text), [text]);
  const today = iso(new Date());

  const effectiveRecurrence = manualRecurrence ?? p.recurrence ?? defaults?.recurrence ?? null;

  const submit = () => {
    if (!p.title.trim()) { if (text.trim()) toast("Give the task a name too", true); return; }
    const due = p.due ?? (effectiveRecurrence?.freq === "daily" ? today : null) ?? defaults?.due ?? null;
    add({
      title: p.title,
      due,
      priority: p.priority,
      list: p.list ?? defaults?.list ?? null,
      goalId: defaults?.goalId ?? null,
      recurrence: effectiveRecurrence,
    });
    setText("");
    setManualRecurrence(null);
  };
  const hasTokens = p.due || p.list || p.priority !== "med" || effectiveRecurrence;
  return (
    <div className={cx("relative rounded-2xl transition", focus ? "ring-1 ring-cyan/50 shadow-glow" : "ring-1 ring-line/10")}>
      <div className="flex items-center gap-2 rounded-2xl bg-line/[.04] px-3">
        <Sparkles size={16} className={cx("shrink-0 transition", focus ? "text-cyan" : "text-muted")} />
        <input id={id} autoFocus={autoFocus} value={text} onChange={(e) => setText(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          onKeyDown={(e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); submit(); } if (e.key === "Escape") { setText(""); setManualRecurrence(null); } }}
          placeholder={placeholder ?? (compact ? "Add a task…" : "Add a task — try “Pay rent tomorrow !high #finance” or “Gym daily”")} aria-label="New task"
          className={cx("min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70", compact ? "py-2.5 text-sm" : "py-3.5 text-[15px]")} />
        <RecurrencePicker value={effectiveRecurrence} onChange={setManualRecurrence} compact />
        <button type="button" onClick={submit} disabled={!p.title.trim()} className="btn btn-primary btn-sm !px-2.5" aria-label="Add task">
          {compact ? <Plus size={14} /> : <><CornerDownLeft size={13} /> Add</>}
        </button>
      </div>
      <AnimatePresence>
        {text && hasTokens && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2.5 pt-1 text-[11px]">
              <span className="text-muted">will add</span>
              {p.due && <span className="chip !normal-case !bg-amber/12 !text-amber"><CalendarDays size={10} />{dueLabel(p.due, today)}</span>}
              {!p.due && effectiveRecurrence?.freq === "daily" && <span className="chip !normal-case !bg-amber/12 !text-amber"><CalendarDays size={10} />Starts today</span>}
              {p.priority !== "med" && <span className={cx("chip !normal-case", PRI_STYLE[p.priority].text)}><Flag size={10} />{PRI_STYLE[p.priority].label}</span>}
              {p.list && <ListTag name={p.list} />}
              {effectiveRecurrence && (
                <span className="chip !normal-case !bg-violet/15 !text-violet inline-flex items-center gap-1 font-semibold">
                  <Repeat size={10} />{recurrenceLabel(effectiveRecurrence)}
                  {manualRecurrence && (
                    <button type="button" onClick={() => setManualRecurrence(null)} className="ml-0.5 hover:text-ink">
                      <X size={10} />
                    </button>
                  )}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Editor({ t }: { t: Task }) {
  const update = useTasks((s) => s.update);
  const [title, setTitle] = useState(t.title);
  const [notes, setNotes] = useState(t.notes);
  const [list, setList] = useState(t.list || "");
  const [sub, setSub] = useState("");
  const subRef = useRef<HTMLInputElement>(null);
  const saveText = () => {
    const patch: Partial<Task> = {};
    if (title.trim() && title.trim() !== t.title) patch.title = title.trim(); else if (!title.trim()) setTitle(t.title);
    if (notes !== t.notes) patch.notes = notes;
    const l = list.trim().replace(/^#/, "").toLowerCase().slice(0, 24) || null;
    if (l !== t.list) patch.list = l;
    if (Object.keys(patch).length) update(t.id, patch);
  };
  const addSub = () => {
    if (!sub.trim()) return;
    update(t.id, { subtasks: [...t.subtasks, { id: Math.random().toString(36).slice(2, 10), title: sub.trim().slice(0, 120), done: false }] });
    setSub(""); subRef.current?.focus();
  };
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-3 pb-4 pl-11 pr-4 pt-1">
        <input className="input !py-2 font-medium" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveText} aria-label="Title" />
        <textarea className="input min-h-[70px] resize-y !py-2 text-[13px]" placeholder="Notes…" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveText} aria-label="Notes" />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted"><CalendarDays size={13} />
            <input type="date" className="input !w-auto !py-1.5 !text-xs" value={t.due || ""} onChange={(e) => update(t.id, { due: e.target.value || null })} aria-label="Due date" />
          </label>
          {t.due && <button className="chip !normal-case hover:!text-ink" onClick={() => update(t.id, { due: null })}><X size={10} /> no date</button>}
          <Segmented id={`pri-${t.id}`} size="sm" value={t.priority} onChange={(priority) => update(t.id, { priority })}
            options={(["low", "med", "high"] as Priority[]).map((v) => ({ value: v, label: <span className="flex items-center gap-1"><i className={cx("h-1.5 w-1.5 rounded-full", PRI_STYLE[v].dot)} />{PRI_STYLE[v].label}</span> }))} />
          <label className="flex items-center gap-1 text-xs text-muted"><Hash size={13} />
            <input className="input !w-28 !py-1.5 !text-xs" placeholder="list" value={list} onChange={(e) => setList(e.target.value)} onBlur={saveText} aria-label="List" />
          </label>
          <RecurrencePicker value={t.recurrence ?? null} onChange={(recurrence) => update(t.id, { recurrence })} />
          <GoalPicker value={t.goalId ?? null} onChange={(goalId) => update(t.id, { goalId })} />
        </div>
        <div className="space-y-1.5">
          {t.subtasks.map((s) => (
            <div key={s.id} className="group flex items-center gap-2.5 text-sm">
              <CheckOrb size={17} done={s.done} label={`Subtask ${s.title}`} onToggle={() => update(t.id, { subtasks: t.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })} />
              <span className={cx("flex-1", s.done && "text-muted line-through")}>{s.title}</span>
              <button className="icon-btn !h-6 !w-6 opacity-0 group-hover:opacity-100" aria-label="Remove subtask" onClick={() => update(t.id, { subtasks: t.subtasks.filter((x) => x.id !== s.id) })}><X size={12} /></button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <ListChecks size={15} className="text-muted" />
            <input ref={subRef} className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted/60" placeholder="Add a subtask…" value={sub} onChange={(e) => setSub(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSub()} aria-label="New subtask" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** Small chip showing the goal a task moves forward. */
function GoalChip({ id }: { id: string }) {
  const g = useGoals((s) => s.goals.find((x) => x.id === id));
  if (!g) return null;
  const a = areaInfo(g.area);
  return <span className="inline-flex max-w-[160px] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: a.color, background: `${a.color}1a` }}>🎯 <span className="truncate">{g.title}</span></span>;
}

function GoalPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const goals = useGoals((s) => s.goals).filter((g) => g.status === "active" || g.id === value);
  if (!goals.length) return null;
  return (
    <label className="flex items-center gap-1 text-xs text-muted">🎯
      <select className="input !w-44 !py-1.5 !text-xs" value={value || ""} onChange={(e) => onChange(e.target.value || null)} aria-label="Goal">
        <option value="">No goal</option>
        {goals.map((g) => <option key={g.id} value={g.id}>{areaInfo(g.area).emoji} {g.title}</option>)}
      </select>
    </label>
  );
}

export function TaskRow({
  t,
  expanded,
  onExpand,
  compact,
  draggable = true,
  isDragging,
  dropPosition,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onTouchStartHandle,
}: {
  t: Task;
  expanded?: boolean;
  onExpand?: () => void;
  compact?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  dropPosition?: "before" | "after" | null;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onTouchStartHandle?: (e: React.TouchEvent, taskId: string) => void;
}) {
  const toggle = useTasks((s) => s.toggle);
  const remove = useTasks((s) => s.remove);
  const restore = useTasks((s) => s.restore);
  const today = iso(new Date());
  const overdue = !t.done && t.due && t.due < today;
  const subDone = t.subtasks.filter((s) => s.done).length;
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.35 : 1, y: 0, scale: isDragging ? 0.98 : 1 }}
      exit={{ opacity: 0, x: -30, height: 0, transition: { duration: 0.22 } }}
      data-task-id={t.id}
      draggable={draggable && !expanded}
      onDragStartCapture={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('input, textarea, select, [role="checkbox"]') && !target.closest(".drag-handle")) {
          e.preventDefault();
          return;
        }
        onDragStart?.(e);
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEndCapture={onDragEnd}
      className={cx(
        "group relative border-b border-line/5 last:border-none transition-colors",
        expanded && "bg-line/[.03]",
        isDragging && "bg-line/10 ring-1 ring-line/10"
      )}
    >
      {dropPosition === "before" && (
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 h-[2.5px] bg-gradient-to-r from-cyan via-violet to-cyan shadow-[0_0_10px_rgb(var(--cyan))]" />
      )}
      {dropPosition === "after" && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 h-[2.5px] bg-gradient-to-r from-cyan via-violet to-cyan shadow-[0_0_10px_rgb(var(--cyan))]" />
      )}
      {t.priority === "high" && !t.done && (
        <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-pink shadow-[0_0_10px_rgb(var(--pink))]" />
      )}
      <div className={cx("flex cursor-pointer items-center gap-2 sm:gap-3", compact ? "px-4 py-2.5" : "px-3 sm:px-4 py-3")} onClick={onExpand}>
        {!compact && draggable && (
          <button
            type="button"
            className="drag-handle -ml-1 flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-muted/30 transition hover:bg-line/10 hover:text-ink active:cursor-grabbing group-hover:text-muted/70"
            aria-label="Drag to reorder"
            title="Hold and drag to reorder / adjust attributes"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => onTouchStartHandle?.(e, t.id)}
          >
            <GripVertical size={13} />
          </button>
        )}
        <CheckOrb done={t.done} label={`Complete ${t.title}`} onToggle={() => {
          const res = toggle(t.id);
          if (!t.done) {
            const nextMsg = res && res.nextDue ? ` (next due ${dueLabel(res.nextDue, today)})` : "";
            toast(`Done: ${t.title}${nextMsg}`, false, { label: "Undo", onClick: () => toggle(t.id) });
          }
        }} />
        <div className="min-w-0 flex-1">
          <div className="relative w-fit max-w-full">
            <span className={cx("block truncate text-sm font-medium transition-colors", t.done && "text-muted")}>{t.title}</span>
            <motion.span className="absolute left-0 top-1/2 h-px bg-muted" initial={false} animate={{ width: t.done ? "100%" : "0%" }} transition={{ duration: 0.3 }} />
          </div>
          {(t.due || t.list || t.subtasks.length > 0 || (t.notes && !compact) || t.recurrence) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
              {t.due && !t.done && <span className={cx("inline-flex items-center gap-1 font-semibold", overdue ? "neg" : t.due === today ? "text-amber" : "text-muted")}><CalendarDays size={11} />{dueLabel(t.due, today)}</span>}
              {t.recurrence && (
                <span className={cx("chip !normal-case inline-flex items-center gap-1 font-semibold transition", t.done ? "!bg-line/10 !text-muted" : "!bg-violet/15 !text-violet")} title={`Recurs: ${recurrenceLabel(t.recurrence)}`}>
                  <Repeat size={10} />{recurrenceLabel(t.recurrence)}
                </span>
              )}
              {t.list && <ListTag name={t.list} />}
              {t.goalId && <GoalChip id={t.goalId} />}
              {t.subtasks.length > 0 && <span className="inline-flex items-center gap-1 text-muted"><ListChecks size={11} />{subDone}/{t.subtasks.length}</span>}
              {t.notes && !compact && <span className="max-w-[240px] truncate text-muted">· {t.notes}</span>}
            </div>
          )}
        </div>
        {!t.done && <i className={cx("h-2 w-2 shrink-0 rounded-full", PRI_STYLE[t.priority].dot)} title={`${PRI_STYLE[t.priority].label} priority`} />}
        {!compact && (
          <button className="icon-btn opacity-60 hover:!text-neg sm:opacity-0 sm:group-hover:opacity-100" aria-label="Delete task"
            onClick={(e) => { e.stopPropagation(); const r = remove(t.id); if (r) toast(`Deleted "${r.title}"`, false, { label: "Undo", onClick: () => restore(r) }); }}><Trash2 size={14} /></button>
        )}
        {t.done && compact && <Check size={14} className="text-pos" />}
      </div>
      <AnimatePresence>{expanded && !compact && <Editor t={t} />}</AnimatePresence>
    </motion.div>
  );
}

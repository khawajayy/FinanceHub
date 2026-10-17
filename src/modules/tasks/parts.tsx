import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Check, CornerDownLeft, Flag, Hash, ListChecks, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Segmented } from "@/components/ui";
import { dueLabel, iso, parseQuickAdd, type Priority, type Task } from "@/engine/task-engine";
import { cx } from "@/lib/format";
import { useTasks } from "@/stores/tasks";
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

/** Quick add with live natural-language parsing preview. */
export function QuickAdd({ autoFocus, compact, defaults, id }: { autoFocus?: boolean; compact?: boolean; defaults?: { due?: string | null; list?: string | null }; id?: string }) {
  const add = useTasks((s) => s.add);
  const [text, setText] = useState("");
  const [focus, setFocus] = useState(false);
  const p = useMemo(() => parseQuickAdd(text), [text]);
  const today = iso(new Date());
  const submit = () => {
    if (!p.title.trim()) { if (text.trim()) toast("Give the task a name too", true); return; }
    add({ title: p.title, due: p.due ?? defaults?.due ?? null, priority: p.priority, list: p.list ?? defaults?.list ?? null });
    setText("");
  };
  const hasTokens = p.due || p.list || p.priority !== "med";
  return (
    <div className={cx("relative rounded-2xl transition", focus ? "ring-1 ring-cyan/50 shadow-glow" : "ring-1 ring-line/10")}>
      <div className="flex items-center gap-2 rounded-2xl bg-line/[.04] px-3">
        <Sparkles size={16} className={cx("shrink-0 transition", focus ? "text-cyan" : "text-muted")} />
        <input id={id} autoFocus={autoFocus} value={text} onChange={(e) => setText(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          onKeyDown={(e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); submit(); } if (e.key === "Escape") setText(""); }}
          placeholder={compact ? "Add a task…" : "Add a task — try “Pay rent tomorrow !high #finance”"} aria-label="New task"
          className={cx("min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70", compact ? "py-2.5 text-sm" : "py-3.5 text-[15px]")} />
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
              {p.priority !== "med" && <span className={cx("chip !normal-case", PRI_STYLE[p.priority].text)}><Flag size={10} />{PRI_STYLE[p.priority].label}</span>}
              {p.list && <ListTag name={p.list} />}
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

export function TaskRow({ t, expanded, onExpand, compact }: { t: Task; expanded?: boolean; onExpand?: () => void; compact?: boolean }) {
  const toggle = useTasks((s) => s.toggle);
  const remove = useTasks((s) => s.remove);
  const restore = useTasks((s) => s.restore);
  const today = iso(new Date());
  const overdue = !t.done && t.due && t.due < today;
  const subDone = t.subtasks.filter((s) => s.done).length;
  return (
    <motion.div layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30, height: 0, transition: { duration: 0.22 } }}
      className={cx("group relative border-b border-line/5 last:border-none", expanded && "bg-line/[.03]")}>
      {t.priority === "high" && !t.done && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-pink shadow-[0_0_10px_rgb(var(--pink))]" />}
      <div className={cx("flex cursor-pointer items-center gap-3", compact ? "px-4 py-2.5" : "px-4 py-3")} onClick={onExpand}>
        <CheckOrb done={t.done} label={`Complete ${t.title}`} onToggle={() => { toggle(t.id); if (!t.done) toast(`Done: ${t.title}`, false, { label: "Undo", onClick: () => toggle(t.id) }); }} />
        <div className="min-w-0 flex-1">
          <div className="relative w-fit max-w-full">
            <span className={cx("block truncate text-sm font-medium transition-colors", t.done && "text-muted")}>{t.title}</span>
            <motion.span className="absolute left-0 top-1/2 h-px bg-muted" initial={false} animate={{ width: t.done ? "100%" : "0%" }} transition={{ duration: 0.3 }} />
          </div>
          {(t.due || t.list || t.subtasks.length > 0 || (t.notes && !compact)) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
              {t.due && !t.done && <span className={cx("inline-flex items-center gap-1 font-semibold", overdue ? "neg" : t.due === today ? "text-amber" : "text-muted")}><CalendarDays size={11} />{dueLabel(t.due, today)}</span>}
              {t.list && <ListTag name={t.list} />}
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

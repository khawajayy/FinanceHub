import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { X, CheckCircle2, AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type MouseEvent, type CSSProperties, type InputHTMLAttributes } from "react";
import { cx, fmtAmtStr as fmtAmt } from "@/lib/format";
import { useUi } from "@/stores/ui";

/* ---------- Card with cursor spotlight ---------- */
export function Card({ children, className, delay = 0, style, as = "div" }: { children: ReactNode; className?: string; delay?: number; style?: CSSProperties; as?: "div" | "section" }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  const Comp = as === "section" ? motion.section : motion.div;
  return (
    <Comp
      ref={ref}
      onMouseMove={onMove}
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cx("card spotlight", className)}
      style={style}
    >
      {children}
    </Comp>
  );
}

export function CardHeader({ title, icon, right, sub }: { title: ReactNode; icon?: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b hairline px-5 py-4">
      {icon && <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan/10 text-cyan">{icon}</span>}
      <div className="min-w-0">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">{title}</h2>
        {sub && <div className="text-xs text-muted">{sub}</div>}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div>
    </div>
  );
}

/* ---------- Animated number (spring count-up) ---------- */
export function AnimatedNumber({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (reduce || !Number.isFinite(value)) { setDisplay(value); prev.current = value; return; }
    const c = animate(prev.current, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: setDisplay });
    prev.current = value;
    return () => c.stop();
  }, [value, reduce]);
  return <span className={cx("num", className)}>{format(display)}</span>;
}

/* ---------- Stat tile ---------- */
export function Stat({ label, value, format, tone, sub, icon, delay, extra, glow }: {
  label: ReactNode; value: number; format: (n: number) => string; tone?: string; sub?: ReactNode;
  icon?: ReactNode; delay?: number; extra?: ReactNode; glow?: "cyan" | "violet" | "pos" | "neg";
}) {
  return (
    <Card delay={delay} className="p-5">
      {glow && <div className={cx("pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl opacity-40",
        glow === "cyan" && "bg-cyan", glow === "violet" && "bg-violet", glow === "pos" && "bg-pos", glow === "neg" && "bg-neg")} />}
      <div className="flex items-center gap-2">
        {icon && <span className="text-muted">{icon}</span>}
        <span className="label">{label}</span>
      </div>
      <div className={cx("mt-2.5 text-2xl font-semibold", tone)}><AnimatedNumber value={value} format={format} /></div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
      {extra}
    </Card>
  );
}

/* ---------- Segmented control with sliding pill ---------- */
export function Segmented<T extends string>({ options, value, onChange, id, size = "md", className }: {
  options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; id: string; size?: "sm" | "md"; className?: string;
}) {
  return (
    <div className={cx("relative inline-flex rounded-xl p-1 glass", className)} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} type="button" role="tab" aria-selected={active} onClick={() => onChange(o.value)}
            className={cx("relative z-10 flex-1 rounded-lg font-semibold transition-colors whitespace-nowrap",
              size === "sm" ? "px-2.5 py-1 text-[11.5px]" : "px-3.5 py-1.5 text-[13px]",
              active ? "text-ink" : "text-muted hover:text-ink")}>
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-cyan/25 to-violet/25 ring-1 ring-cyan/40"
              transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer, wide, icon }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean; icon?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
          <motion.div role="dialog" aria-modal="true"
            className={cx("glass-strong relative flex max-h-[92vh] w-full flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
            initial={{ y: 40, scale: 0.97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 30, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}>
            <div className="flex items-center gap-3 border-b hairline px-5 py-4">
              {icon && <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet/15 text-violet">{icon}</span>}
              <h3 className="font-display text-lg font-semibold">{title}</h3>
              <button className="icon-btn ml-auto" onClick={onClose} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto px-5 py-5">{children}</div>
            {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t hairline px-5 py-4">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Confirm / prompt host ---------- */
export function DialogHost() {
  const dialog = useUi((s) => s.dialog);
  const setDialog = useUi((s) => s.setDialog);
  const [val, setVal] = useState("");
  useEffect(() => { setVal(dialog?.input?.initial || ""); }, [dialog]);
  const close = (v: string | boolean | null) => { dialog?.resolve(v); setDialog(null); };
  return (
    <Modal open={!!dialog} onClose={() => close(null)} title={dialog?.title}
      footer={<>
        <button className="btn btn-ghost" onClick={() => close(null)}>Cancel</button>
        <button className={cx("btn", dialog?.danger ? "btn-danger" : "btn-primary")} onClick={() => close(dialog?.input ? val : true)}>
          {dialog?.confirmText || "Confirm"}
        </button>
      </>}>
      {dialog?.message && <p className="text-sm leading-relaxed text-muted">{dialog.message}</p>}
      {dialog?.input && (
        <input autoFocus className="input mt-4" type={dialog.input.type} inputMode={dialog.input.type === "number" ? "decimal" : undefined}
          placeholder={dialog.input.placeholder} value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") close(val); }} />
      )}
    </Modal>
  );
}

/* ---------- Toasts ---------- */
export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} layout role="button" tabIndex={0} onClick={() => dismiss(t.id)}
            initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={cx("glass-strong pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-xl",
              t.error ? "ring-1 ring-neg/40" : "ring-1 ring-cyan/30")}>
            {t.error ? <AlertTriangle size={16} className="shrink-0 text-neg" /> : <CheckCircle2 size={16} className="shrink-0 text-pos" />}
            <span className="text-left">{t.msg}</span>
            {t.action && <button className="ml-2 rounded-lg bg-cyan/15 px-2.5 py-1 text-xs font-bold text-cyan hover:bg-cyan/25"
              onClick={(e) => { e.stopPropagation(); t.action!.onClick(); dismiss(t.id); }}>{t.action.label}</button>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------- misc ---------- */
export function Empty({ icon, title, sub, action }: { icon: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan/20 to-violet/20 text-2xl ring-1 ring-line/10">{icon}</motion.div>
      <div className="font-display font-semibold">{title}</div>
      {sub && <div className="mt-1 max-w-sm text-sm text-muted">{sub}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Tag({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return <span title={title} className={cx("chip", className)}>{children}</span>;
}

export const TYPE_TAG: Record<string, string> = {
  DEPOSIT: "!bg-pos/12 !text-pos", WITHDRAW: "!bg-amber/12 !text-amber", BUY: "!bg-cyan/12 !text-cyan",
  SELL: "!bg-pink/12 !text-pink", ADJUST: "!bg-violet/12 !text-violet", crypto: "!bg-amber/12 !text-amber", stock: "!bg-cyan/12 !text-cyan",
};

export function Ring({ progress, size = 160, stroke = 12, reached, children }: { progress: number; size?: number; stroke?: number; reached?: boolean; children?: ReactNode }) {
  const R = size / 2 - stroke / 2 - 2, C = 2 * Math.PI * R;
  const id = useRef(`rg${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={reached ? "rgb(var(--pos))" : "rgb(var(--cyan))"} />
            <stop offset="100%" stopColor={reached ? "rgb(var(--pos))" : "rgb(var(--violet))"} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="rgb(var(--line) / .08)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - Math.max(0, Math.min(100, progress)) / 100) }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} style={{ filter: "drop-shadow(0 0 8px rgb(var(--cyan) / .45))" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11.5px] leading-snug text-muted">{hint}</span>}
    </label>
  );
}

/** Text input that formats with thousands separators as you type (value is the raw string). */
export function AmountInput({ value, onChange, className, ...rest }: { value: string; onChange: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <input {...rest} type="text" inputMode="decimal" autoComplete="off" className={cx("input num", className)} value={value}
      onChange={(e) => {
        const el = e.target, start = el.selectionStart ?? el.value.length, atEnd = start >= el.value.length;
        const digitsBefore = el.value.slice(0, start).replace(/[^\d.]/g, "").length;
        const out = fmtAmt(el.value);
        onChange(out);
        requestAnimationFrame(() => {
          let pos = 0, seen = 0;
          while (pos < out.length && seen < digitsBefore) { if (/[\d.]/.test(out[pos])) seen++; pos++; }
          if (atEnd) pos = out.length;
          try { el.setSelectionRange(pos, pos); } catch { /* not focused */ }
        });
      }} />
  );
}

export function Warn({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex gap-2 rounded-xl border border-amber/30 bg-amber/10 px-3 py-2.5 text-[12.5px] text-amber"><AlertTriangle size={15} className="mt-px shrink-0" /><div>{children}</div></div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("shimmer rounded-xl bg-line/5", className)} />;
}

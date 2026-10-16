import { motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import type { SeriesPoint } from "@/engine/ledger-engine.js";
import { fmtPct, fmtUSD, cx } from "@/lib/format";

/* ---------- Donut ---------- */
export function Donut({ data, size = 200, stroke = 22, center }: {
  data: { key: string; value: number; color: string }[]; size?: number; stroke?: number; center?: React.ReactNode;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = size / 2 - stroke / 2, C = 2 * Math.PI * R;
  const gap = data.length > 1 ? 3 : 0;
  let acc = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="rgb(var(--line) / .06)" strokeWidth={stroke} />
        {total > 0 && data.map((d, i) => {
          const len = (d.value / total) * C;
          const seg = Math.max(0, len - gap);
          const off = acc; acc += len;
          return (
            <motion.circle key={d.key} cx={size / 2} cy={size / 2} r={R} fill="none" stroke={d.color} strokeWidth={stroke}
              strokeLinecap="butt" strokeDashoffset={-off}
              initial={{ strokeDasharray: `0 ${C}` }} animate={{ strokeDasharray: `${seg} ${C - seg}` }}
              transition={{ duration: 1, delay: 0.1 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              style={{ filter: `drop-shadow(0 0 6px ${d.color}55)` }} />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{center}</div>
    </div>
  );
}

/* ---------- Income vs expense bars ---------- */
export function FlowBars({ data, format, height = 170 }: {
  data: { label: string; income: number; expenses: number; active?: boolean }[]; format: (n: number) => string; height?: number;
}) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expenses]));
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div>
      <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
        {data.map((d, i) => (
          <div key={d.label} className="relative flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {hover === i && (
              <div className="glass-strong absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl px-3 py-2 text-xs shadow-xl">
                <div className="font-semibold">{d.label}</div>
                <div className="pos num">+ {format(d.income)}</div>
                <div className="neg num">− {format(d.expenses)}</div>
              </div>
            )}
            <div className="flex h-full items-end justify-center gap-1">
              {(["income", "expenses"] as const).map((k, j) => (
                <motion.div key={k}
                  className={cx("w-full max-w-[18px] rounded-t-md", k === "income" ? "bg-gradient-to-t from-pos/30 to-pos" : "bg-gradient-to-t from-neg/30 to-neg", !d.active && "opacity-60")}
                  initial={{ height: 0 }} animate={{ height: `${(d[k] / max) * 100}%` }}
                  transition={{ duration: 0.8, delay: i * 0.05 + j * 0.04, ease: [0.22, 1, 0.36, 1] }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {data.map((d) => <div key={d.label} className={cx("flex-1 text-center text-[10.5px] font-medium", d.active ? "text-ink" : "text-muted")}>{d.label}</div>)}
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */
function smoothPath(pts: { x: number; y: number }[]) {
  if (!pts.length) return "";
  if (pts.length < 3) return pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)},${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)},${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export function niceTicks(min: number, max: number, count: number) {
  if (!(max > min)) return [min];
  const step0 = (max - min) / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(step0))), norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(+v.toFixed(6));
  return out;
}

function tickLabel(t: number, rangeDays: number) {
  const d = new Date(t);
  if (rangeDays <= 1.2) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (rangeDays <= 14) return d.toLocaleDateString([], { weekday: "short", day: "numeric" });
  if (rangeDays < 365) return d.toLocaleDateString([], { month: "short", day: "numeric" });
  return d.toLocaleDateString([], { month: "short", year: "2-digit" });
}

/* ---------- Equity / profit / return chart ---------- */
export type ChartMode = "equity" | "profit" | "return";

export function EquityChart({ series, mode, showNetcap, height = 260 }: { series: SeriesPoint[]; mode: ChartMode; showNetcap: boolean; height?: number }) {
  const W = 800, H = height, padL = 8, padR = 8, padT = 16, padB = 26;
  const w = W - padL - padR, h = H - padT - padB;
  const box = useRef<HTMLDivElement>(null);
  const [hi, setHi] = useState<number | null>(null);

  const m = useMemo(() => {
    const s = series;
    const plot = (p: SeriesPoint) => (mode === "profit" ? p.profit : mode === "return" ? p.retPct : p.v);
    const bench = (p: SeriesPoint) => (mode === "equity" ? p.nc : 0);
    const fmt = mode === "return" ? fmtPct : mode === "profit" ? (v: number) => (v >= 0 ? "+" : "") + fmtUSD(v) : fmtUSD;
    const includeBench = mode !== "equity" || showNetcap;
    const all = s.map(plot).concat(includeBench ? s.map(bench) : []);
    const rawMin = Math.min(...all), rawMax = Math.max(...all);
    let vMin = rawMin, vMax = rawMax;
    if (vMin === vMax) { vMin -= Math.max(1, Math.abs(vMin) * 0.05); vMax += Math.max(1, Math.abs(vMax) * 0.05); }
    const pv = (vMax - vMin) * 0.12; vMin -= pv; vMax += pv;
    const tMin = s[0].t, tMax = s[s.length - 1].t;
    const X = (t: number) => padL + (tMax === tMin ? 0 : (t - tMin) / (tMax - tMin)) * w;
    const Y = (v: number) => padT + (1 - (v - vMin) / (vMax - vMin)) * h;
    const pts = s.map((p) => ({ x: X(p.t), y: Y(plot(p)) }));
    const line = smoothPath(pts);
    const bottom = padT + h;
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${bottom} L${pts[0].x.toFixed(1)},${bottom} Z`;
    const zeroY = Math.min(bottom, Math.max(padT, Y(0)));
    const benchPath = mode === "equity"
      ? (showNetcap ? s.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)},${Y(p.nc).toFixed(1)}`).join(" ") : "")
      : `M${padL},${zeroY.toFixed(1)} L${W - padR},${zeroY.toFixed(1)}`;
    // profit (green) / loss (red) band between equity and net capital
    const bands: { d: string; up: boolean }[] = [];
    if (mode === "equity" && showNetcap) {
      const poly = (ax: number, ae: number, bx: number, be: number, bn: number, an: number, up: boolean) => ({
        up, d: `M${X(ax).toFixed(1)},${Y(ae).toFixed(1)} L${X(bx).toFixed(1)},${Y(be).toFixed(1)} L${X(bx).toFixed(1)},${Y(bn).toFixed(1)} L${X(ax).toFixed(1)},${Y(an).toFixed(1)} Z`,
      });
      for (let i = 0; i < s.length - 1; i++) {
        const a = s[i], b = s[i + 1], d0 = a.v - a.nc, d1 = b.v - b.nc;
        if ((d0 >= 0 && d1 >= 0) || (d0 <= 0 && d1 <= 0)) bands.push(poly(a.t, a.v, b.t, b.v, b.nc, a.nc, d0 + d1 >= 0));
        else {
          const f = d0 / (d0 - d1), xc = a.t + (b.t - a.t) * f, ec = a.v + (b.v - a.v) * f, nc = a.nc + (b.nc - a.nc) * f;
          bands.push(poly(a.t, a.v, xc, ec, nc, a.nc, d0 >= 0), poly(xc, ec, b.t, b.v, b.nc, nc, d1 >= 0));
        }
      }
    }
    const last = s[s.length - 1];
    const up = last.profit >= 0;
    const rangeDays = (tMax - tMin) / 86400000;
    const xt = Array.from({ length: 5 }, (_, i) => { const t = tMin + (i / 4) * (tMax - tMin); return { left: (X(t) / W) * 100, label: tickLabel(t, rangeDays) }; });
    const yt = niceTicks(rawMin, rawMax, 4).map((v) => ({ top: (Y(v) / H) * 100, label: fmt(v) }));
    return { s, plot, fmt, X, Y, pts, line, area, benchPath, bands, up, xt, yt };
  }, [series, mode, showNetcap, H, h, w]);

  const color = m.up ? "rgb(var(--pos))" : "rgb(var(--neg))";
  const gid = m.up ? "eqG" : "eqR";
  const move = (clientX: number) => {
    const r = box.current?.getBoundingClientRect(); if (!r) return;
    const svgX = ((clientX - r.left) / r.width) * W;
    let bi = 0, bd = Infinity;
    m.pts.forEach((p, i) => { const d = Math.abs(p.x - svgX); if (d < bd) { bd = d; bi = i; } });
    setHi(bi);
  };
  const hp = hi != null ? m.s[hi] : null;
  const hx = hi != null ? (m.pts[hi].x / W) * 100 : 0;
  const hy = hi != null ? m.pts[hi].y : 0;

  return (
    <div ref={box} className="relative select-none touch-pan-y" style={{ height: H }}
      onMouseMove={(e) => move(e.clientX)} onMouseLeave={() => setHi(null)}
      onTouchStart={(e) => e.touches[0] && move(e.touches[0].clientX)} onTouchMove={(e) => e.touches[0] && move(e.touches[0].clientX)} onTouchEnd={() => setHi(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id="eqG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgb(var(--pos))" stopOpacity=".35" /><stop offset="100%" stopColor="rgb(var(--pos))" stopOpacity="0" /></linearGradient>
          <linearGradient id="eqR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgb(var(--neg))" stopOpacity=".35" /><stop offset="100%" stopColor="rgb(var(--neg))" stopOpacity="0" /></linearGradient>
          <linearGradient id="eqStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="rgb(var(--cyan))" /><stop offset="100%" stopColor={color} /></linearGradient>
        </defs>
        {m.yt.map((t, i) => <line key={i} x1={padL} x2={W - padR} y1={(t.top / 100) * H} y2={(t.top / 100) * H} stroke="rgb(var(--line) / .07)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />)}
        <motion.path key={`a${mode}${m.s.length}`} d={m.area} fill={`url(#${gid})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
        {m.bands.map((b, i) => <path key={i} d={b.d} fill={b.up ? "rgb(var(--pos))" : "rgb(var(--neg))"} fillOpacity={0.13} />)}
        {m.benchPath && <path d={m.benchPath} fill="none" stroke="rgb(var(--muted))" strokeWidth={1.5} strokeDasharray="5 5" vectorEffect="non-scaling-stroke" opacity={0.8} />}
        <motion.path key={`l${mode}${m.s.length}`} d={m.line} fill="none" stroke="url(#eqStroke)" strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      </svg>
      <div className="pointer-events-none absolute inset-0">
        {m.yt.map((t, i) => <span key={i} className="num absolute right-1 -translate-y-1/2 rounded bg-bg/60 px-1 text-[10px] text-muted" style={{ top: `${t.top}%` }}>{t.label}</span>)}
        {m.xt.map((t, i) => <span key={i} className={cx("absolute bottom-0 text-[10px] text-muted", i === 0 ? "" : i === 4 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${t.left}%` }}>{t.label}</span>)}
        {hp && <>
          <div className="absolute w-px bg-gradient-to-b from-transparent via-cyan/60 to-transparent" style={{ left: `${hx}%`, top: padT, height: h }} />
          <div className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-bg" style={{ left: `${hx}%`, top: hy, background: color, boxShadow: `0 0 12px ${color}` }} />
          <div className={cx("glass-strong absolute z-10 rounded-xl px-3 py-2 text-xs shadow-xl", hx > 60 && "-translate-x-full")} style={{ left: `calc(${hx}% ${hx > 60 ? "- 14px" : "+ 14px"})`, top: Math.max(0, hy - 70) }}>
            <div className="text-[10.5px] text-muted">{new Date(hp.t).toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" })} · {new Date(hp.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
            {mode === "equity" && <><div className="num font-semibold">{fmtUSD(hp.v)} <span className="font-sans font-normal text-muted">equity</span></div><div className="num text-muted">{fmtUSD(hp.nc)} net capital</div></>}
            {mode === "profit" && <><div className="num font-semibold">{m.fmt(hp.profit)} <span className="font-sans font-normal text-muted">profit</span></div><div className="num text-muted">equity {fmtUSD(hp.v)}</div></>}
            {mode === "return" && <><div className="num font-semibold">{fmtPct(hp.retPct)} <span className="font-sans font-normal text-muted">return</span></div><div className="num text-muted">equity {fmtUSD(hp.v)}</div></>}
            <div className={cx("num", hp.profit >= 0 ? "pos" : "neg")}>{hp.profit >= 0 ? "▲" : "▼"} {fmtUSD(Math.abs(hp.profit))} ({fmtPct(hp.retPct)})</div>
          </div>
        </>}
      </div>
    </div>
  );
}

/* ---------- tiny sparkline ---------- */
export function Sparkline({ values, className, positive }: { values: number[]; className?: string; positive?: boolean }) {
  if (values.length < 2) return null;
  const W = 120, H = 36, min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => ({ x: (i / (values.length - 1)) * W, y: H - 3 - ((v - min) / span) * (H - 6) }));
  const d = smoothPath(pts);
  const c = positive ?? values[values.length - 1] >= values[0] ? "rgb(var(--pos))" : "rgb(var(--neg))";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none">
      <motion.path d={d} fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
    </svg>
  );
}

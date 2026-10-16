/* Number formatting shared by both modules. */

export const fmtRs = (n: number) => {
  const v = Number(n) || 0;
  return `${v < 0 ? "−" : ""}Rs ${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
};
/** Whole rupees for hero figures. */
export const fmtRs0 = (n: number) => {
  const v = Number(n) || 0;
  return `${v < 0 ? "−" : ""}Rs\u00a0${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
};
/** Compact rupees for big hero numbers: Rs 1.25M / Rs 450K. */
export const fmtRsCompact = (n: number) => {
  const v = Math.abs(Number(n) || 0), s = n < 0 ? "−" : "";
  if (v >= 1e7) return `${s}Rs ${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e5) return `${s}Rs ${(v / 1e3).toFixed(0)}K`;
  return fmtRs(n);
};

export const fmtUSD = (n: number) =>
  (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Per-unit price: keeps precision for sub-cent tokens so they don't show as $0.00. */
export function fmtPrice(n: number) {
  const a = Math.abs(n);
  if (a === 0) return "$0.00";
  const sgn = n < 0 ? "-$" : "$";
  if (a >= 1) return sgn + a.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (a >= 0.01) return sgn + a.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  let s = a.toPrecision(4);
  if (s.indexOf("e") >= 0) s = a.toFixed(20);
  s = s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return sgn + s;
}

export const fmtNum = (n: number, d = 6) => Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
export const fmtPct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
export const signed = (n: number) => (n >= 0 ? "+" : "");
export const tone = (n: number) => (n > 0 ? "pos" : n < 0 ? "neg" : "text-muted");

/** Secondary-currency amount (e.g. PKR) for a USD value. */
export function fmtCurrency(v: number, code: string) {
  try {
    return (v < 0 ? "-" : "") + new Intl.NumberFormat(undefined, { style: "currency", currency: code, maximumFractionDigits: 0 }).format(Math.abs(v));
  } catch {
    return (v < 0 ? "-" : "") + code + " " + Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
}

/** Parses "10,000.5" → 10000.5; NaN for anything that isn't a finite number. */
export const stripNum = (v: unknown) => {
  const n = parseFloat(String(v == null ? "" : v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

/** number/string → "10,000.5" (thousands separators, decimals kept as typed). */
export function fmtAmtStr(v: unknown) {
  if (v == null || v === "") return "";
  let s = String(v);
  const neg = /^-/.test(s);
  s = s.replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  let int = dot >= 0 ? s.slice(0, dot) : s;
  const dec = dot >= 0 ? s.slice(dot + 1).replace(/\./g, "") : null;
  int = int.replace(/^0+(?=\d)/, "");
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + (intFmt || (dec != null ? "0" : "")) + (dec != null ? "." + dec : "");
}

export function formatDurationDays(days: number | null | undefined) {
  if (days == null || !Number.isFinite(days) || days < 0) return "—";
  if (days < 1 / 24) return `${Math.max(1, Math.round(days * 24 * 60))}m`;
  if (days < 1) return `${Math.round(days * 24 * 10) / 10}h`;
  if (days < 14) return `${Math.round(days * 10) / 10}d`;
  if (days < 60) return `${Math.round(days)}d (${(days / 7).toFixed(1)}w)`;
  if (days < 365) return `${Math.round(days)}d (${(days / 30.4375).toFixed(1)}mo)`;
  return `${(days / 365.25).toFixed(1)}y`;
}

export function relTime(ts: number | string | null | undefined) {
  if (!ts) return "";
  const ms = typeof ts === "string" ? new Date(ts).getTime() : ts;
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

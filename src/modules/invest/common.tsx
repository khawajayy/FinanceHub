import { motion } from "framer-motion";
import { Minus, Plus, X } from "lucide-react";
import { useMemo } from "react";
import LE, { type Asset, type Summary } from "@/engine/ledger-engine.js";
import { Tag, TYPE_TAG } from "@/components/ui";
import { cx, fmtCurrency, fmtNum, fmtPct, fmtPrice, fmtUSD, relTime, tone } from "@/lib/format";
import { useActions } from "@/stores/actions";
import { activeRange, secRate, summarize, useInvest, type RangePreset } from "@/stores/invest";

export function usePortfolio(excludeId?: string | null) {
  const transactions = useInvest((s) => s.transactions);
  const assets = useInvest((s) => s.assets);
  const prices = useInvest((s) => s.prices);
  return useMemo(() => summarize({ transactions, assets, prices }, excludeId), [transactions, assets, prices, excludeId]);
}

export function useRange() {
  const prefs = useInvest((s) => s.prefs);
  return useMemo(() => activeRange(prefs), [prefs]);
}

/** "≈ ₨ 1,234" in the secondary currency, or nothing when no rate is known. */
export function Sec({ usd, colored, className }: { usd: number; colored?: boolean; className?: string }) {
  const settings = useInvest((s) => s.settings);
  const fx = useInvest((s) => s.fx);
  const r = secRate({ settings, fx });
  if (r == null) return null;
  return <div className={cx("num text-[11.5px]", colored ? tone(usd) : "text-muted", className)}>≈ {fmtCurrency(usd * r, settings.secondaryCurrency)}</div>;
}

export function useSecFmt() {
  const settings = useInvest((s) => s.settings);
  const fx = useInvest((s) => s.fx);
  const r = secRate({ settings, fx });
  return (usd: number) => (r == null ? "" : fmtCurrency(usd * r, settings.secondaryCurrency));
}

export function Arrow({ n }: { n: number }) {
  return n > 0 ? <span className="mr-0.5 text-[0.8em]">▲</span> : n < 0 ? <span className="mr-0.5 text-[0.8em]">▼</span> : null;
}

export function AssetBadge({ a, size = 34 }: { a: Asset; size?: number }) {
  const img = LE.safeUrl(a.img);
  return (
    <div className="grid shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 text-[10px] font-bold ring-1 ring-line/10" style={{ width: size, height: size }}>
      {img ? <img src={img} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover p-1" /> : (a.symbol || "?").slice(0, 3).toUpperCase()}
    </div>
  );
}

export function AssetCell({ a }: { a: Asset }) {
  return (
    <div className="flex items-center gap-3">
      <AssetBadge a={a} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 font-semibold">{(a.symbol || "").toUpperCase()} <Tag className={TYPE_TAG[a.type]}>{a.type}</Tag></div>
        <div className="max-w-[160px] truncate text-xs text-muted">{a.name}</div>
      </div>
    </div>
  );
}

const PRESETS: [RangePreset, string][] = [["all", "All"], ["ytd", "YTD"], ["24h", "24H"], ["7d", "7D"], ["30d", "30D"], ["90d", "90D"], ["1y", "1Y"], ["custom", "Custom"]];

export function RangeBar() {
  const prefs = useInvest((s) => s.prefs);
  const setPrefs = useInvest((s) => s.setPrefs);
  const load = useInvest((s) => s.loadHistoryForHeld);
  const r = prefs.range;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="glass inline-flex flex-wrap rounded-xl p-1">
        {PRESETS.map(([k, l]) => (
          <button key={k} onClick={() => { setPrefs({ range: { ...r, preset: k } }); load(); }}
            className={cx("relative rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors", r.preset === k ? "text-ink" : "text-muted hover:text-ink")}>
            {r.preset === k && <motion.span layoutId="range-pill" className="absolute inset-0 -z-0 rounded-lg bg-gradient-to-r from-cyan/25 to-violet/25 ring-1 ring-cyan/40" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative">{l}</span>
          </button>
        ))}
      </div>
      {r.preset === "custom" && (
        <div className="flex items-center gap-2 text-xs text-muted">
          From <input type="date" className="input !w-auto !py-1.5" value={r.start || ""} onChange={(e) => setPrefs({ range: { ...r, start: e.target.value || null } })} />
          To <input type="date" className="input !w-auto !py-1.5" value={r.end || ""} onChange={(e) => setPrefs({ range: { ...r, end: e.target.value || null } })} />
        </div>
      )}
    </div>
  );
}

export function freshness(times: (string | null | undefined)[]) {
  const ms = times.filter(Boolean).map((t) => new Date(t as string).getTime());
  return ms.length ? `updated ${relTime(Math.max(...ms))}` : "prices not loaded";
}

export function HoldingsTable({ p, compact }: { p: Summary; compact?: boolean }) {
  const openInvest = useActions((s) => s.openInvest);
  const open = (assetId: string, type: "BUY" | "SELL", closeAll?: boolean) =>
    openInvest(null, { type, assetId, qty: closeAll ? p.positions[assetId]?.qty : undefined });
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead><tr>
          <th>Asset</th><th className="!text-right">Qty</th><th className="!text-right">Avg cost</th><th className="!text-right">Cost basis</th>
          <th className="!text-right">Live</th><th className="!text-right">Value</th><th className="!text-right">Unrealized</th>
          <th className="!text-right" title="Price this asset must reach for total equity to equal your net capital, with cash and other holdings held constant">Break-even</th>
          {compact && <th>Weight</th>}<th />
        </tr></thead>
        <tbody>
          {p.holdings.map((h, i) => {
            const pct = p.holdingsValue > 0 && h.marketValue != null ? (h.marketValue / p.holdingsValue) * 100 : 0;
            const uPct = h.costBasis > 0 && h.unrealized != null ? (h.unrealized / h.costBasis) * 100 : null;
            const be = h.breakevenPrice;
            return (
              <motion.tr key={h.assetId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <td><AssetCell a={h.asset} /></td>
                <td className="num text-right">{fmtNum(h.qty)}</td>
                <td className="num text-right">{fmtPrice(h.avgCost)}</td>
                <td className="num text-right">{fmtUSD(h.costBasis)}</td>
                <td className="num text-right">{h.live != null ? fmtPrice(h.live) : <span className="text-muted">—</span>}</td>
                <td className="num text-right font-semibold">{h.marketValue != null ? fmtUSD(h.marketValue) : <span className="text-muted">—</span>}</td>
                <td className={cx("num text-right", h.unrealized != null && tone(h.unrealized))}>
                  {h.unrealized != null ? <><Arrow n={h.unrealized} />{fmtUSD(Math.abs(h.unrealized))}{uPct != null && <div className="text-[11px] opacity-80">{fmtPct(uPct)}</div>}</> : <span className="text-muted">—</span>}
                </td>
                <td className="num text-right">
                  {be == null ? <span className="text-muted">—</span> : be <= 0 ? <span className="pos" title="Cash + other holdings already cover net capital">✓ covered</span> : <>
                    {fmtPrice(be)}{h.live != null && <div className={cx("text-[11px]", be / h.live - 1 > 0 ? "neg" : "pos")}>{be / h.live - 1 > 0 ? "+" : ""}{((be / h.live - 1) * 100).toFixed(1)}%</div>}
                  </>}
                </td>
                {compact && <td className="w-28">
                  <div className="h-1.5 overflow-hidden rounded-full bg-line/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-cyan to-violet" initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct)}%` }} transition={{ duration: 0.9, delay: 0.2 + i * 0.05 }} /></div>
                  <div className="num mt-1 text-[11px] text-muted">{pct.toFixed(1)}%</div>
                </td>}
                <td className="text-right">
                  <div className="inline-flex gap-1">
                    <button className="btn btn-sm !text-cyan" onClick={() => open(h.assetId, "BUY")} title="Buy more"><Plus size={13} />Buy</button>
                    <button className="btn btn-sm !text-pink" onClick={() => open(h.assetId, "SELL")} title="Sell some"><Minus size={13} />Sell</button>
                    <button className="btn btn-sm" onClick={() => open(h.assetId, "SELL", true)} title="Sell the entire position"><X size={13} />Close</button>
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

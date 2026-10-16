import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import LE, { type Asset, type AssetType } from "@/engine/ledger-engine.js";
import { searchAssets, assetFromItem, type SearchItem } from "@/lib/market";
import { useInvest } from "@/stores/invest";
import { toast } from "@/stores/ui";

/** Debounced CoinGecko (crypto) / Finnhub (stock) search with a dropdown of results. */
export function AssetSearch({ type, onPick, placeholder, value, onTextChange }: {
  type: AssetType; onPick: (a: Asset) => void; placeholder?: string; value?: string; onTextChange?: (v: string) => void;
}) {
  const key = useInvest((s) => s.settings.finnhubKey);
  const [q, setQ] = useState(value ?? "");
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => { if (value !== undefined) setQ(value); }, [value]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setItems(null); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const run = (text: string) => {
    clearTimeout(timer.current);
    if (text.trim().length < 2) { setItems(null); return; }
    timer.current = setTimeout(async () => {
      setBusy(true); setErr("");
      try { setItems(await searchAssets(text.trim(), type, key)); }
      catch (e) { setErr((e as Error).message); setItems([]); }
      finally { setBusy(false); }
    }, 300);
  };

  return (
    <div ref={wrap} className="relative">
      <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <input className="input !pl-10" value={q} placeholder={placeholder || (type === "crypto" ? "Search coins — bitcoin, SOL…" : "Search tickers — AAPL, INTC…")} autoComplete="off"
        onChange={(e) => { setQ(e.target.value); onTextChange?.(e.target.value); run(e.target.value); }} />
      <AnimatePresence>
        {(items || busy) && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="glass-strong absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-2xl p-1.5 shadow-2xl">
            {busy && <div className="shimmer rounded-xl px-3 py-2.5 text-sm text-muted">Searching…</div>}
            {!busy && err && <div className="px-3 py-2.5 text-sm text-muted">Search failed: {err}</div>}
            {!busy && items?.map((it, i) => (
              <button key={i} type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-line/10"
                onClick={() => {
                  const a = assetFromItem(it);
                  if (!a) { toast("That asset can't be tracked", true); return; }
                  setItems(null); setQ(`${a.symbol} — ${a.name}`); onPick(a);
                }}>
                {LE.safeUrl(it.img) ? <img src={LE.safeUrl(it.img)} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full" />
                  : <span className="grid h-6 w-6 place-items-center rounded-full bg-line/10 text-[9px] font-bold">{it.symbol.slice(0, 3).toUpperCase()}</span>}
                <b className="text-sm">{it.symbol.toUpperCase()}</b><span className="truncate text-xs text-muted">{it.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

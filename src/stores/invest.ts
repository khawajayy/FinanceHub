import { create } from "zustand";
import { doc, onSnapshot, setDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import LE, {
  type Asset, type Goal, type InvestSettings, type PriceHistory, type PricePoint, type Range, type Summary, type Txn, type ValuationCtx,
} from "@/engine/ledger-engine.js";
import { fetchCryptoPrices, fetchFxRates, fetchPriceHistory, fetchStockPrices } from "@/lib/market";
import { DEMO, demoLedger } from "@/lib/demo";
import { toast } from "./ui";

/*
 * Synced data lives in Firestore at ledgers/{uid} — the exact document the old
 * CryptoLedger app wrote, so existing ledgers load unchanged:
 *   { transactions, assets, settings, goals, favorites, updatedAt }
 * Prices, price/equity history, FX and view prefs stay on this device (localStorage).
 */

const LOCAL_KEY = "nexus.invest.local.v1";
const FX_TTL_MS = 30 * 60 * 1000;
const HISTORY_TTL_MS = 60 * 60 * 1000;
const EPS = LE.EPS;

export type RangePreset = "all" | "ytd" | "24h" | "7d" | "30d" | "90d" | "1y" | "custom";
export interface Prefs {
  range: { preset: RangePreset; start: string | null; end: string | null };
  chartMode: "equity" | "profit" | "return";
  chartAsset: string;
  netcap: boolean;
  combineSells: boolean;
}

interface Synced {
  transactions: Txn[];
  assets: Record<string, Asset>;
  settings: InvestSettings;
  goals: Goal[];
  favorites: Asset[];
  dataUpdatedAt: number;
}
interface Local {
  prices: Record<string, PricePoint>;
  priceHistory: Record<string, PriceHistory>;
  equityHistory: { t: number; v: number }[];
  fx: { rates: Record<string, number>; updatedAt: number };
  prefs: Prefs;
}

export const DEFAULT_SETTINGS: InvestSettings = { finnhubKey: "", autoRefreshSec: 0, secondaryCurrency: "PKR", manualRate: null, owedToOthers: 0 };
const DEFAULT_PREFS: Prefs = { range: { preset: "all", start: null, end: null }, chartMode: "equity", chartAsset: "all", netcap: true, combineSells: true };

function emptySynced(): Synced {
  return { transactions: [], assets: Object.create(null), settings: { ...DEFAULT_SETTINGS }, goals: [], favorites: [], dataUpdatedAt: 0 };
}

/** Validates any untrusted ledger-shaped object (cloud doc, imported backup). */
export function normalizeSynced(s: Record<string, unknown> | null | undefined): Synced & { dropped: number } {
  const src = s && typeof s === "object" ? s : {};
  const tx = LE.sanitizeTransactions(src.transactions);
  const assets = LE.sanitizeAssets(src.assets);
  // trades must reference a known asset; rebuild a minimal record from its id if missing
  for (const t of tx.transactions) {
    if (t.assetId && !assets[t.assetId]) {
      const [type, ...rest] = t.assetId.split(":");
      const a = LE.sanitizeAsset({ id: t.assetId, type, symbol: rest.join(":") || t.assetId, name: "" });
      if (a) assets[t.assetId] = a;
    }
  }
  const upd = (src.updatedAt ?? src.dataUpdatedAt) as number;
  return {
    transactions: tx.transactions,
    assets,
    settings: LE.sanitizeSettings(src.settings, DEFAULT_SETTINGS),
    goals: LE.sanitizeGoals(src.goals, src.goal),
    favorites: LE.sanitizeFavorites(src.favorites),
    dataUpdatedAt: Number.isFinite(upd) ? upd : 0,
    dropped: tx.dropped,
  };
}

function loadLocal(): Local {
  let raw: Record<string, unknown> = {};
  try { raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}") || {}; } catch { /* corrupt or blocked */ }
  const fx = raw.fx as Local["fx"] | undefined;
  const p = (raw.prefs || {}) as Partial<Prefs>;
  const presets: RangePreset[] = ["all", "ytd", "24h", "7d", "30d", "90d", "1y", "custom"];
  return {
    prices: LE.sanitizePrices(raw.prices),
    priceHistory: LE.sanitizePriceHistory(raw.priceHistory),
    equityHistory: LE.sanitizeEquityHistory(raw.equityHistory),
    fx: fx && fx.rates && typeof fx.rates === "object" ? { rates: fx.rates, updatedAt: Number(fx.updatedAt) || 0 } : { rates: {}, updatedAt: 0 },
    prefs: {
      range: p.range && presets.includes(p.range.preset) ? { preset: p.range.preset, start: p.range.start || null, end: p.range.end || null } : DEFAULT_PREFS.range,
      chartMode: p.chartMode === "profit" || p.chartMode === "return" ? p.chartMode : "equity",
      chartAsset: typeof p.chartAsset === "string" ? p.chartAsset : "all",
      netcap: p.netcap !== false,
      combineSells: p.combineSells !== false,
    },
  };
}

interface InvestState extends Synced, Local {
  uid: string | null;
  loaded: boolean;
  cloudStatus: string;
  priceStatus: string;
  refreshing: boolean;
  start: (uid: string) => void;
  stop: () => void;
  /** Change synced data (transactions, goals, …) and schedule a cloud push. */
  mutate: (fn: (draft: Synced) => void) => void;
  replaceAll: (s: Synced) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  refreshPrices: () => Promise<void>;
  ensureFx: (force?: boolean) => Promise<void>;
  loadHistoryForHeld: () => Promise<void>;
}

let unsub: Unsubscribe | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPushedAt = 0;
let autoTimer: ReturnType<typeof setInterval> | null = null;
let refreshing: Promise<void> | null = null;
let refreshQueued = false;
let historyFetchAt = 0;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const useInvest = create<InvestState>((set, get) => {
  const persistLocal = () => {
    const { prices, priceHistory, equityHistory, fx, prefs } = get();
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ prices, priceHistory, equityHistory, fx, prefs })); }
    catch { /* quota / private mode */ }
  };

  const pushNow = () => {
    const { uid, transactions, assets, settings, goals, favorites, dataUpdatedAt } = get();
    if (!uid) return;
    if (DEMO) { set({ cloudStatus: "demo · not synced" }); return; }
    const payload = clone({ transactions, assets, settings, goals, favorites, updatedAt: dataUpdatedAt || Date.now() });
    lastPushedAt = payload.updatedAt;
    setDoc(doc(db, "ledgers", uid), payload)
      .then(() => set({ cloudStatus: "synced" }))
      .catch((e) => { console.warn("Ledger push failed", e); set({ cloudStatus: "sync error" }); toast("Couldn't sync the ledger to the cloud", true); });
  };

  const setupAuto = () => {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    const s = get().settings.autoRefreshSec || 0;
    if (s > 0) autoTimer = setInterval(() => get().refreshPrices(), s * 1000);
  };

  const recordEquityPoint = () => {
    const eq = summarize(get()).equity;
    if (!Number.isFinite(eq)) return;
    const now = Date.now();
    const h = [...get().equityHistory];
    const last = h[h.length - 1];
    if (last && now - last.t < 15 * 60 * 1000 && Math.abs(eq - last.v) < Math.max(0.01, Math.abs(last.v) * 0.0005)) return;
    h.push({ t: now, v: +eq.toFixed(2) });
    set({ equityHistory: h.slice(-1000) });
  };

  return {
    ...emptySynced(),
    ...loadLocal(),
    uid: null, loaded: false, cloudStatus: "", priceStatus: "idle", refreshing: false,

    start: (uid) => {
      if (get().uid === uid) return;
      get().stop();
      set({ uid, loaded: false, cloudStatus: "connecting…" });
      if (DEMO) {
        set({ ...normalizeSynced(demoLedger()), loaded: true, cloudStatus: "demo · not synced" });
        get().ensureFx().then(() => get().refreshPrices());
        return;
      }
      let first = true;
      unsub = onSnapshot(doc(db, "ledgers", uid), { includeMetadataChanges: false }, (snap) => {
        if (snap.metadata.hasPendingWrites) return;          // our own optimistic write
        const remote = snap.exists() ? snap.data() : null;
        if (remote && remote.updatedAt && remote.updatedAt === lastPushedAt && !first) return; // echo
        const n = normalizeSynced(remote);
        if (n.dropped) console.warn(`Dropped ${n.dropped} invalid ledger transaction(s)`);
        set({ ...n, loaded: true, cloudStatus: "synced" });
        setupAuto();
        if (first) {
          first = false;
          get().ensureFx().then(() => { if (get().transactions.length) get().refreshPrices(); });
        }
      }, (e) => { console.error(e); set({ cloudStatus: "sync error", loaded: true }); });
    },

    stop: () => {
      if (unsub) { unsub(); unsub = null; }
      if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      set({ ...emptySynced(), uid: null, loaded: false, cloudStatus: "" });
    },

    mutate: (fn) => {
      const draft: Synced = clone({
        transactions: get().transactions, assets: get().assets, settings: get().settings,
        goals: get().goals, favorites: get().favorites, dataUpdatedAt: get().dataUpdatedAt,
      });
      fn(draft);
      draft.dataUpdatedAt = Date.now();
      const prevAuto = get().settings.autoRefreshSec;
      set({ ...draft, cloudStatus: "saving…" });
      if (draft.settings.autoRefreshSec !== prevAuto) setupAuto();
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(pushNow, 700);
    },

    replaceAll: (s) => get().mutate((d) => Object.assign(d, clone(s))),

    setPrefs: (p) => { set({ prefs: { ...get().prefs, ...p } }); persistLocal(); },

    ensureFx: async (force = false) => {
      const { fx, settings } = get();
      const have = fx.rates[settings.secondaryCurrency] != null && fx.rates.PKR != null;
      if (!force && have && Date.now() - fx.updatedAt < FX_TTL_MS) return;
      const rates = await fetchFxRates();
      if (rates) { set({ fx: { rates, updatedAt: Date.now() } }); persistLocal(); }
    },

    refreshPrices: () => {
      if (refreshing) { refreshQueued = true; return refreshing; }
      refreshing = (async () => {
        set({ refreshing: true });
        await get().ensureFx();
        const s = get();
        const pos = summarize(s).positions;
        const map: Record<string, Asset> = {};
        for (const id of Object.keys(pos)) if (pos[id].qty > EPS && s.assets[id]) map[id] = s.assets[id];
        for (const f of s.favorites) map[f.id] = f;
        const targets = Object.values(map);
        const cryptos = targets.filter((a) => a.type === "crypto"), stocks = targets.filter((a) => a.type === "stock");
        if (!targets.length) { set({ priceStatus: "nothing to price", refreshing: false }); return; }
        set({ priceStatus: "updating…" });
        const [c, st]: Record<string, number>[] = await Promise.all([
          cryptos.length ? fetchCryptoPrices(cryptos).catch(() => ({})) : {},
          stocks.length ? fetchStockPrices(stocks, s.settings.finnhubKey) : {},
        ]);
        const now = new Date().toISOString();
        const prices = { ...get().prices };
        let ok = 0;
        for (const [id, price] of Object.entries({ ...c, ...st })) { prices[id] = { price, updatedAt: now }; ok++; }
        const fail = targets.length - ok;
        set({ prices, priceStatus: `${ok} live${fail ? ` · ${fail} failed` : ""}`, refreshing: false });
        recordEquityPoint();
        persistLocal();
        if (stocks.length && !s.settings.finnhubKey) toast("Add a Finnhub key in Settings for live stock prices", true);
      })().finally(() => {
        refreshing = null;
        if (refreshQueued) { refreshQueued = false; get().refreshPrices(); }
      });
      return refreshing;
    },

    loadHistoryForHeld: async () => {
      if (Date.now() - historyFetchAt < 4000) return;
      historyFetchAt = Date.now();
      const s = get();
      const daysMap: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90, "1y": 365, ytd: 365, all: 365 };
      const days = daysMap[s.prefs.range.preset] || 30;
      const pos = summarize(s).positions;
      const ids = Object.keys(pos).filter((id) => pos[id].qty > EPS && s.assets[id]?.type === "crypto");
      const todo = ids.filter((id) => { const c = s.priceHistory[id]; return !(c && c.days >= days && Date.now() - c.updatedAt < HISTORY_TTL_MS); });
      if (!todo.length) return;
      const res = await Promise.all(todo.map((id) => fetchPriceHistory(s.assets[id], days)));
      const ph = { ...get().priceHistory };
      let changed = false;
      res.forEach((h, i) => { if (h) { ph[todo[i]] = h; changed = true; } });
      if (changed) { set({ priceHistory: ph }); persistLocal(); }
    },
  };
});

/* ---------- derived helpers ---------- */
type SummState = Pick<InvestState, "transactions" | "assets" | "prices">;
export const summarize = (s: SummState, excludeId?: string | null): Summary => LE.summarize(s, excludeId);

export const valuationCtx = (s: Pick<InvestState, "transactions" | "prices" | "priceHistory">): ValuationCtx =>
  ({ transactions: s.transactions, prices: s.prices, priceHistory: s.priceHistory, now: Date.now() });

export function heldAssets(s: SummState, excludeId?: string | null) {
  const pos = summarize(s, excludeId).positions;
  return Object.keys(pos).filter((id) => pos[id].qty > EPS).map((id) => s.assets[id]).filter(Boolean);
}

export function secRate(s: Pick<InvestState, "settings" | "fx">) {
  const m = s.settings.manualRate;
  if (typeof m === "number" && m > 0) return m;
  return s.fx.rates[s.settings.secondaryCurrency] ?? null;
}

/** USD → PKR for the Hub. Uses the manual rate when the secondary currency is PKR. */
export function pkrRate(s: Pick<InvestState, "settings" | "fx">) {
  if (s.settings.secondaryCurrency === "PKR" && s.settings.manualRate) return s.settings.manualRate;
  return s.fx.rates.PKR ?? null;
}

export interface ActiveRange extends Range { preset: RangePreset; label: string }

export function activeRange(prefs: Prefs): ActiveRange {
  const r = prefs.range;
  const now = Date.now(), D = 86400000;
  const sod = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const eod = (ms: number) => { const d = new Date(ms); d.setHours(23, 59, 59, 999); return d.getTime(); };
  const short = (t: number) => new Date(t).toLocaleDateString([], { month: "short", day: "2-digit", year: "2-digit" });
  let startTs = -Infinity, endTs = now, label = "All time";
  switch (r.preset) {
    case "24h": startTs = now - D; label = "Last 24 hours"; break;
    case "7d": startTs = now - 7 * D; label = "Last 7 days"; break;
    case "30d": startTs = now - 30 * D; label = "Last 30 days"; break;
    case "90d": startTs = now - 90 * D; label = "Last 90 days"; break;
    case "1y": startTs = now - 365 * D; label = "Last 12 months"; break;
    case "ytd": startTs = new Date(new Date().getFullYear(), 0, 1).getTime(); label = "Year to date"; break;
    case "custom":
      startTs = r.start ? sod(new Date(r.start + "T00:00:00").getTime()) : -Infinity;
      endTs = r.end ? Math.min(now, eod(new Date(r.end + "T00:00:00").getTime())) : now;
      label = `${startTs === -Infinity ? "start" : short(startTs)} – ${short(endTs)}`;
      break;
  }
  return { preset: r.preset, startTs, endTs, label, isAll: r.preset === "all" };
}

/** Average days per profitable trade from the ledger (7 when there are no wins yet). */
export function ledgerTradeDays(s: Pick<InvestState, "transactions" | "assets">) {
  try {
    const a = LE.computeClosedTradesAndAnalytics(s.transactions, { isAll: true, startTs: -Infinity, endTs: Infinity }, s.assets).analytics;
    const d = a.avgHoldingTimeProfitableDays;
    if (d != null && Number.isFinite(d) && d > 0) return { days: d, hasWins: true };
  } catch (e) { console.warn(e); }
  return { days: 7, hasWins: false };
}

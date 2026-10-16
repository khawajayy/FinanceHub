/* Market data: live prices (Binance → CoinGecko, Finnhub for stocks), FX, search, history, news.
   Ported from CryptoLedger js/app.js. Every external value is validated before use. */
import LE, { type Asset, type AssetType } from "@/engine/ledger-engine.js";

const FETCH_TIMEOUT_MS = 12000;

export async function fetchJSON(url: string) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctl.signal, credentials: "omit", referrerPolicy: "no-referrer" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}

export async function fetchFxRates(): Promise<Record<string, number> | null> {
  try {
    const j = await fetchJSON("https://open.er-api.com/v6/latest/USD");
    if (j && j.rates && typeof j.rates === "object") {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(j.rates)) if (/^[A-Z]{3}$/.test(k) && Number.isFinite(v as number)) out[k] = v as number;
      return out;
    }
  } catch { /* offline / rate-limited: keep the cached rate */ }
  return null;
}

function resolveBinancePrice(symbol: string, m: Map<string, number> | null) {
  if (!symbol || !m) return null;
  const s = symbol.toUpperCase().trim();
  for (const k of [s, s + "USDT", s + "FDUSD", s + "USDC"]) if (m.has(k)) return m.get(k)!;
  if (!s.endsWith("B") && m.has(s + "BUSDT")) return m.get(s + "BUSDT")!;
  return null;
}

/** Returns assetId → price for every crypto it could price. */
export async function fetchCryptoPrices(assets: Asset[]) {
  const out: Record<string, number> = {};
  let bmap: Map<string, number> | null = null;
  try {
    const list = await fetchJSON("https://api.binance.com/api/v3/ticker/price");
    if (Array.isArray(list)) {
      bmap = new Map();
      for (const it of list) { const v = parseFloat(it.price); if (Number.isFinite(v) && v > 0) bmap.set(it.symbol, v); }
    }
  } catch { /* Binance unreachable (some regions) */ }
  const unresolved: Asset[] = [];
  for (const a of assets) {
    const p = resolveBinancePrice(a.symbol, bmap);
    if (p != null && p > 0) out[a.id] = p; else unresolved.push(a);
  }
  const cg = unresolved.filter((a) => a.coingeckoId);
  if (cg.length) {
    try {
      const ids = [...new Set(cg.map((a) => a.coingeckoId!))];
      const j = await fetchJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.map(encodeURIComponent).join(",")}&vs_currencies=usd`);
      for (const a of cg) { const usd = j?.[a.coingeckoId!]?.usd; if (Number.isFinite(usd) && usd > 0) out[a.id] = usd; }
    } catch { /* CoinGecko fallback failed */ }
  }
  return out;
}

export async function fetchStockQuote(symbol: string, key: string) {
  const j = await fetchJSON(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol.toUpperCase())}&token=${encodeURIComponent(key)}`);
  return j && Number.isFinite(j.c) && j.c > 0 ? (j.c as number) : null;
}

export async function fetchStockPrices(assets: Asset[], key: string) {
  const out: Record<string, number> = {};
  if (!key) return out;
  const res = await Promise.allSettled(assets.map((a) => fetchStockQuote(a.symbol, key)));
  res.forEach((r, i) => { if (r.status === "fulfilled" && r.value != null) out[assets[i].id] = r.value; });
  return out;
}

export async function fetchLivePrice(a: Asset, key: string): Promise<number | null> {
  if (a.type === "stock") return key ? fetchStockQuote(a.symbol, key) : null;
  const s = (a.symbol || "").toUpperCase().trim();
  const cands = [s + "USDT", s + "FDUSD", s + "USDC", s];
  if (!s.endsWith("B")) cands.push(s + "BUSDT");
  for (const c of cands) {
    try {
      const d = await fetchJSON(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(c)}`);
      const v = parseFloat(d?.price);
      if (Number.isFinite(v) && v > 0) return v;
    } catch { /* pair not listed, try next */ }
  }
  if (a.coingeckoId) {
    try {
      const j = await fetchJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(a.coingeckoId)}&vs_currencies=usd`);
      const v = j?.[a.coingeckoId]?.usd;
      if (Number.isFinite(v) && v > 0) return v;
    } catch { /* fallback failed */ }
  }
  return null;
}

export interface SearchItem { type: AssetType; symbol: string; name: string; coingeckoId: string | null; img: string | null }
const typed = (q: string, type: AssetType): SearchItem[] => [{ type, symbol: q.toUpperCase().slice(0, 32), name: q.toUpperCase().slice(0, 32), coingeckoId: null, img: null }];

export async function searchAssets(q: string, type: AssetType, finnhubKey: string): Promise<SearchItem[]> {
  if (type === "crypto") {
    try {
      const j = await fetchJSON(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`);
      const items = (Array.isArray(j?.coins) ? j.coins : [])
        .filter((c: { symbol?: unknown; id?: unknown }) => c && typeof c.symbol === "string" && c.symbol && typeof c.id === "string")
        .slice(0, 8)
        .map((c: { symbol: string; name?: string; id: string; thumb?: string }) => ({ type: "crypto" as const, symbol: c.symbol, name: String(c.name || ""), coingeckoId: c.id, img: c.thumb || null }));
      if (items.length) return items;
    } catch { /* fall through to a typed symbol */ }
    return typed(q, "crypto");
  }
  if (!finnhubKey) return typed(q, "stock");
  const j = await fetchJSON(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${encodeURIComponent(finnhubKey)}`);
  const items = (Array.isArray(j?.result) ? j.result : [])
    .filter((x: { symbol?: unknown }) => x && typeof x.symbol === "string" && x.symbol && !(x.symbol as string).includes("."))
    .slice(0, 8)
    .map((x: { symbol: string; description?: string }) => ({ type: "stock" as const, symbol: x.symbol, name: String(x.description || ""), coingeckoId: null, img: null }));
  return items.length ? items : typed(q, "stock");
}

export function assetFromItem(it: SearchItem): Asset | null {
  const symbol = String(it.symbol || "").toUpperCase().slice(0, 32);
  return LE.sanitizeAsset({ id: `${it.type}:${symbol}`, type: it.type, symbol, name: it.name, coingeckoId: it.coingeckoId, img: it.img });
}

export async function fetchPriceHistory(a: Asset, days: number) {
  if (a.type !== "crypto" || !a.coingeckoId) return null;
  try {
    const j = await fetchJSON(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(a.coingeckoId)}/market_chart?vs_currency=usd&days=${days}`);
    if (!j || !Array.isArray(j.prices) || !j.prices.length) return null;
    const points = j.prices
      .filter((x: unknown) => Array.isArray(x) && Number.isFinite(x[0]) && Number.isFinite(x[1]))
      .map(([t, p]: [number, number]) => ({ t, p: +p.toPrecision(8) }))
      .sort((x: { t: number }, y: { t: number }) => x.t - y.t);
    return points.length ? { points, days, updatedAt: Date.now() } : null;
  } catch { return null; }
}

export interface Article { id: string; ticker: string; headline: string; summary: string; source: string; url: string; image: string | null; datetime: number; placeholder?: boolean }

function placeholderNews(sym: string, reason: "nokey" | "error"): Article[] {
  return [{
    id: `fallback-${sym}`, ticker: sym, placeholder: true,
    headline: `Open the latest ${sym} news on Yahoo Finance`,
    summary: reason === "error"
      ? `Live news for ${sym} couldn't be loaded right now. Try Refresh, or follow the link for the latest coverage.`
      : `Add your free Finnhub API key in Settings to see live ${sym} company news here.`,
    source: "Nexus", url: `https://finance.yahoo.com/quote/${encodeURIComponent(sym)}/news`, image: null, datetime: Date.now(),
  }];
}

const newsCache: Record<string, { time: number; articles: Article[] }> = Object.create(null);

export async function fetchNews(symbol: string, key: string, force = false): Promise<Article[]> {
  const sym = symbol.toUpperCase();
  const c = newsCache[sym];
  if (!force && c && Date.now() - c.time < 15 * 60 * 1000) return c.articles;
  let articles: Article[];
  if (!key) articles = placeholderNews(sym, "nokey");
  else {
    try {
      const to = new Date().toISOString().slice(0, 10);
      const f = new Date(); f.setDate(f.getDate() - 30);
      const data = await fetchJSON(`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(sym)}&from=${f.toISOString().slice(0, 10)}&to=${to}&token=${encodeURIComponent(key)}`);
      const items: Article[] = (Array.isArray(data) ? data.slice(0, 100) : []).map((it: Record<string, unknown>, i: number) => {
        const url = LE.safeUrl(it?.url);
        const headline = typeof it?.headline === "string" ? it.headline.slice(0, 300) : "";
        if (!url || !headline) return null;
        return {
          id: String(it.id ?? `${sym}-${i}`), ticker: sym, headline,
          summary: typeof it.summary === "string" ? it.summary.slice(0, 1000) : "",
          source: typeof it.source === "string" && it.source ? it.source.slice(0, 80) : "Market News",
          url, image: LE.safeUrl(it.image) || null,
          datetime: Number.isFinite(it.datetime) && (it.datetime as number) > 0 ? (it.datetime as number) * 1000 : Date.now(),
        };
      }).filter(Boolean) as Article[];
      articles = items.length ? items : placeholderNews(sym, "error");
    } catch { articles = placeholderNews(sym, "error"); }
  }
  newsCache[sym] = { time: Date.now(), articles };
  return articles;
}

import { motion } from "framer-motion";
import { ExternalLink, Newspaper, RefreshCw, Search, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardHeader, Empty, Skeleton } from "@/components/ui";
import { fetchNews, type Article } from "@/lib/market";
import { cx, relTime } from "@/lib/format";
import { useInvest } from "@/stores/invest";
import { PageTitle } from "@/modules/expenses/common";

export default function News() {
  const favs = useInvest((s) => s.favorites);
  const key = useInvest((s) => s.settings.finnhubKey);
  const stocks = useMemo(() => favs.filter((f) => f.type === "stock"), [favs]);
  const [params, setParams] = useSearchParams();
  const want = (params.get("t") || "ALL").toUpperCase();
  const ticker = want === "ALL" || stocks.some((s) => s.symbol.toUpperCase() === want) ? want : "ALL";
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);

  const load = useCallback(async (force: boolean) => {
    if (!stocks.length) return;
    setArticles(null);
    const syms = ticker === "ALL" ? stocks.map((s) => s.symbol) : [ticker];
    const res = (await Promise.all(syms.map((s) => fetchNews(s, key, force)))).flat().sort((a, b) => b.datetime - a.datetime);
    setArticles(res); setAt(Date.now());
  }, [stocks, ticker, key]);
  useEffect(() => { load(false); }, [load]);

  const list = (articles || []).filter((a) => {
    const s = q.trim().toLowerCase();
    return !s || a.headline.toLowerCase().includes(s) || a.summary.toLowerCase().includes(s) || a.ticker.toLowerCase().includes(s);
  });

  if (!stocks.length) return (
    <>
      <PageTitle title="Stock news" />
      <Card><Empty icon="📰" title="No stocks in your watchlist" sub="Add stocks like AAPL, NVDA or TSLA to your Watchlist to follow their company news here."
        action={<Link to="/invest/watchlist" className="btn btn-primary">Go to Watchlist</Link>} /></Card>
    </>
  );

  return (
    <>
      <PageTitle title="Stock news" sub={at ? `updated ${relTime(at)}` : undefined} />
      {!key && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber">
          <Zap size={16} /> Add your free Finnhub API key in Settings for real-time company news.
          <Link to="/invest/settings" className="btn btn-sm ml-auto">Open Settings</Link>
        </div>
      )}
      <Card>
        <CardHeader title="Headlines" icon={<Newspaper size={16} />} right={<button className="btn btn-sm" onClick={() => load(true)}><RefreshCw size={13} /> Refresh</button>} />
        <div className="flex flex-wrap items-center gap-2 border-b hairline p-4">
          {["ALL", ...stocks.map((s) => s.symbol.toUpperCase())].map((t) => (
            <button key={t} onClick={() => setParams(t === "ALL" ? {} : { t })}
              className={cx("chip !px-3 !py-1.5 !text-xs !normal-case transition", ticker === t && "!bg-cyan/15 !text-cyan ring-1 ring-cyan/30")}>
              {t === "ALL" ? <>All <span className="opacity-60">{stocks.length}</span></> : t}
            </button>
          ))}
          <div className="relative ml-auto min-w-[180px]">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input !py-1.5 !pl-9" placeholder="Filter headlines…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {!articles ? [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-64" />) :
            !list.length ? <div className="col-span-full"><Empty icon="🔍" title="No news found" sub={q ? `No articles matching "${q}"` : `No recent articles for ${ticker}`} /></div> :
            list.map((a, i) => (
              <motion.a key={a.id + i} href={a.url} target="_blank" rel="noopener noreferrer"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}
                className="group flex flex-col overflow-hidden rounded-2xl bg-line/[.03] ring-1 ring-line/5 transition hover:-translate-y-0.5 hover:ring-cyan/30">
                <div className="relative h-36 overflow-hidden bg-gradient-to-br from-cyan/15 to-violet/15">
                  {a.image ? <img src={a.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : null}
                  <span className="absolute inset-0 grid place-items-center font-display text-3xl font-bold text-ink/20">{a.ticker}</span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center gap-2 text-[11px] text-muted"><span className="chip !bg-cyan/12 !text-cyan">{a.ticker}</span>{a.source}<span>·</span>{relTime(a.datetime)}</div>
                  <h3 className="mt-2 line-clamp-3 font-display text-[15px] font-semibold leading-snug group-hover:text-cyan">{a.headline}</h3>
                  {a.summary && <p className="mt-1.5 line-clamp-3 text-xs text-muted">{a.summary}</p>}
                  <div className="mt-auto flex items-center pt-3 text-xs font-semibold text-cyan">Read article <ExternalLink size={12} className="ml-1" /></div>
                </div>
              </motion.a>
            ))}
        </div>
      </Card>
    </>
  );
}

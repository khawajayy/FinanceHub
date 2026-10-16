import { Activity, Briefcase, Coins, HandCoins, PiggyBank, Receipt, TrendingUp, Wallet, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import LE from "@/engine/ledger-engine.js";
import { AmountInput, AnimatedNumber, Card, CardHeader, Empty, Segmented, Skeleton, Stat } from "@/components/ui";
import { EquityChart, type ChartMode } from "@/components/charts";
import { cx, fmtAmtStr, fmtPct, fmtUSD, stripNum, tone } from "@/lib/format";
import { useActions } from "@/stores/actions";
import { useInvest, valuationCtx } from "@/stores/invest";
import { toast } from "@/stores/ui";
import { Arrow, HoldingsTable, RangeBar, Sec, freshness, usePortfolio, useRange } from "./common";

function OwedCard({ equity }: { equity: number }) {
  const owed = useInvest((s) => s.settings.owedToOthers) || 0;
  const mutate = useInvest((s) => s.mutate);
  const [v, setV] = useState(owed ? fmtAmtStr(owed) : "");
  useEffect(() => setV(owed ? fmtAmtStr(owed) : ""), [owed]);
  const commit = () => {
    const n = v.trim() === "" ? 0 : stripNum(v);
    if (!(n >= 0)) { toast("Enter a valid amount (0 or more)", true); setV(owed ? fmtAmtStr(owed) : ""); return; }
    const next = Math.round(n * 100) / 100;
    if (next === owed) return;
    mutate((d) => { d.settings.owedToOthers = next; });
    toast(next > 0 ? `Owed to others set to ${fmtUSD(next)}` : "Cleared money owed to others");
  };
  const after = equity - owed;
  return (
    <Card className="p-5" delay={0.3}>
      <div className="flex items-center gap-2"><HandCoins size={15} className="text-muted" /><span className="label">Owed to others</span><span className="chip ml-auto !text-[9px]">editable</span></div>
      <div className="mt-2 flex items-center gap-1">
        <span className={cx("text-2xl font-semibold", owed > 0 && "neg")}>$</span>
        <AmountInput value={v} onChange={setV} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} placeholder="0.00"
          className={cx("!border-dashed !bg-transparent !px-2 !py-0.5 !text-2xl font-semibold", owed > 0 && "!text-neg")} aria-label="Money owed to others (USD)" />
      </div>
      <div className="mt-1 text-xs text-muted">equity after debts <b className={cx("num", tone(after))}>{fmtUSD(after)}</b></div>
    </Card>
  );
}

export default function InvestDashboard() {
  const loaded = useInvest((s) => s.loaded);
  const transactions = useInvest((s) => s.transactions);
  const prices = useInvest((s) => s.prices);
  const priceHistory = useInvest((s) => s.priceHistory);
  const equityHistory = useInvest((s) => s.equityHistory);
  const prefs = useInvest((s) => s.prefs);
  const setPrefs = useInvest((s) => s.setPrefs);
  const loadHistory = useInvest((s) => s.loadHistoryForHeld);
  const openInvest = useActions((s) => s.openInvest);
  const p = usePortfolio();
  const R = useRange();

  useEffect(() => { if (loaded) loadHistory(); }, [loaded, loadHistory, transactions.length]);

  const stats = useMemo(() => LE.rangeStats(valuationCtx({ transactions, prices, priceHistory }), R), [transactions, prices, priceHistory, R]);
  const series = useMemo(() => LE.equitySeries(valuationCtx({ transactions, prices, priceHistory }), R, prefs.chartAsset, p.equity, equityHistory),
    [transactions, prices, priceHistory, R, prefs.chartAsset, p.equity, equityHistory]);

  if (!loaded) return <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-32" />)}</div>;

  const all = R.isAll;
  const headVal = all ? p.totalReturn : stats.periodReturn;
  const headPct = all ? p.totalReturnPct : stats.periodReturnPct;
  const rz = all ? p.realized : stats.realizedP;
  const inv = all ? p.netCapital : stats.netInvestedP;
  const fees = all ? p.feesPaid : stats.feesP;
  const tag = all ? null : <span className="chip !text-[9px]">{R.label}</span>;
  const now = <span className="chip !text-[9px]">now</span>;

  const last = series[series.length - 1], first = series[0];
  const plotVal = (pt: typeof last) => (prefs.chartMode === "profit" ? pt.profit : prefs.chartMode === "return" ? pt.retPct : pt.v);
  const fmtMetric = prefs.chartMode === "return" ? fmtPct : prefs.chartMode === "profit" ? (v: number) => (v >= 0 ? "+" : "") + fmtUSD(v) : fmtUSD;
  const vals = series.map(plotVal);

  return (
    <>
      <RangeBar />
      {!transactions.length && (
        <Card className="mb-4"><Empty icon="🚀" title="Start your ledger" sub="Add a Deposit for your initial capital, then record buys and sells. Everything is measured against the capital you put in."
          action={<button className="btn btn-primary" onClick={() => openInvest(null, { type: "DEPOSIT" })}><Plus size={15} /> Add deposit</button>} /></Card>
      )}
      <Card className="mb-4 p-6" delay={0}>
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-10 h-64 w-64 rounded-full bg-cyan/20 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-2">
          <div>
            <div className="label">{all ? "Total return vs original capital" : `Return · ${R.label}`}</div>
            <div className={cx("mt-2 flex items-baseline gap-2 text-4xl font-semibold sm:text-5xl", tone(headVal))}>
              <Arrow n={headVal} /><AnimatedNumber value={Math.abs(headVal)} format={fmtUSD} />
            </div>
            <div className={cx("num mt-1 text-sm", tone(headVal))}>
              {fmtPct(headPct)} {all ? <>on {fmtUSD(p.netCapital)} net capital</> : <>· {fmtUSD(stats.equityStart)} → {fmtUSD(stats.equityEnd)}</>}
              {!all && stats.approx && <span className="chip ml-2 !bg-amber/15 !text-amber">approx</span>}
            </div>
            <Sec usd={headVal} colored />
          </div>
          <div className="md:border-l md:hairline md:pl-6">
            <div className="label">Current equity</div>
            <AnimatedNumber value={p.equity} format={fmtUSD} className="mt-2 block text-4xl font-semibold sm:text-5xl" />
            <div className="mt-1 text-sm text-muted">cash <span className="num">{fmtUSD(p.cash)}</span> + holdings <span className="num">{fmtUSD(p.holdingsValue)}</span></div>
            <Sec usd={p.equity} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label={all ? "Net capital" : <>Net invested {tag}</>} icon={<PiggyBank size={15} />} value={inv} format={fmtUSD} delay={0.05}
          sub={<>{fmtUSD(all ? p.deposits : stats.depositsP)} in · {fmtUSD(all ? p.withdrawals : stats.withdrawalsP)} out<Sec usd={inv} /></>} />
        <Stat label={<>Cash {now}</>} icon={<Wallet size={15} />} value={p.cash} format={fmtUSD} tone={p.cash < 0 ? "neg" : ""} delay={0.1} sub={<>buying power<Sec usd={p.cash} /></>} />
        <Stat label={<>Holdings {now}</>} icon={<Briefcase size={15} />} value={p.holdingsValue} format={fmtUSD} delay={0.15} sub={<>cost {fmtUSD(p.holdingsCost)}<Sec usd={p.holdingsValue} /></>} />
        <Stat label={<>Realized P&L {tag}</>} icon={<Coins size={15} />} value={rz} format={(n) => (n >= 0 ? "+" : "") + fmtUSD(n)} tone={tone(rz)} delay={0.2}
          sub={<>{all ? "locked in from sells" : `from ${stats.sellsP} sell${stats.sellsP === 1 ? "" : "s"}`}<Sec usd={rz} colored /></>} />
        <Stat label={<>Unrealized {now}</>} icon={<TrendingUp size={15} />} value={p.unrealized} format={(n) => (n >= 0 ? "+" : "") + fmtUSD(n)} tone={tone(p.unrealized)} delay={0.22}
          sub={<>open positions<Sec usd={p.unrealized} colored /></>} />
        <Stat label={<>Fees {tag}</>} icon={<Receipt size={15} />} value={fees} format={fmtUSD} delay={0.25} sub={<>{all ? "total trading fees" : "in range"}<Sec usd={fees} /></>} />
        <OwedCard equity={p.equity} />
        <Stat label="Positions" icon={<Activity size={15} />} value={p.holdings.length} format={(n) => String(Math.round(n))} delay={0.32}
          sub={`${transactions.length} transactions`} />
      </div>

      <Card className="mt-4" delay={0.2}>
        <CardHeader title="Performance" icon={<Activity size={16} />}
          right={<>
            {p.holdings.length > 0 && (
              <select className="input !w-auto !py-1.5 !text-xs" value={prefs.chartAsset} onChange={(e) => setPrefs({ chartAsset: e.target.value })} aria-label="Filter chart by asset">
                <option value="all">Entire portfolio</option>
                {p.holdings.map((h) => <option key={h.assetId} value={h.assetId}>{h.asset.symbol.toUpperCase()} · {h.asset.name || h.asset.symbol}</option>)}
              </select>
            )}
            <Segmented id="cmode" size="sm" value={prefs.chartMode} onChange={(v: ChartMode) => setPrefs({ chartMode: v })}
              options={[{ value: "equity", label: "Equity $" }, { value: "profit", label: "Profit $" }, { value: "return", label: "Return %" }]} />
          </>} />
        {series.length < 2 ? (
          <Empty icon="📉" title="Not enough history to chart" sub="Record a trade or wait for price history to build up." />
        ) : (
          <div className="p-5">
            <div className="mb-4 flex flex-wrap items-end gap-4">
              <div>
                <div className={cx("num text-3xl font-semibold", prefs.chartMode !== "equity" && tone(last.profit))}>{fmtMetric(plotVal(last))}</div>
                <div className="text-xs text-muted">
                  <span className={cx("num font-semibold", tone(last.profit))}><Arrow n={last.profit} />{fmtUSD(Math.abs(last.profit))} ({fmtPct(last.retPct)})</span> vs {fmtUSD(last.nc)} net capital · {R.label}
                </div>
              </div>
              <div className="ml-auto flex flex-wrap gap-4 text-xs">
                <div><span className="text-muted">Low</span> <b className="num">{fmtMetric(Math.min(...vals))}</b></div>
                <div><span className="text-muted">High</span> <b className="num">{fmtMetric(Math.max(...vals))}</b></div>
                <div><span className="text-muted">Change</span> <b className={cx("num", tone(plotVal(last) - plotVal(first)))}>{fmtMetric(plotVal(last) - plotVal(first))}</b></div>
                {prefs.chartMode === "equity" && (
                  <label className="flex cursor-pointer items-center gap-1.5 text-muted">
                    <input type="checkbox" checked={prefs.netcap} onChange={(e) => setPrefs({ netcap: e.target.checked })} /> ╌ Net capital
                  </label>
                )}
              </div>
            </div>
            <EquityChart series={series} mode={prefs.chartMode} showNetcap={prefs.netcap} />
            <p className="mt-3 text-[11.5px] text-muted">
              {prefs.chartMode === "equity" ? "The band shows profit (green) or loss (red) against your invested capital — new deposits lift both lines together, so they never look like gains."
                : prefs.chartMode === "profit" ? "Net dollar gain/loss over time against a zero baseline." : "Portfolio percentage return over time against 0%."}
            </p>
          </div>
        )}
      </Card>

      <Card className="mt-4" delay={0.25}>
        <CardHeader title="Open positions" icon={<Briefcase size={16} />} right={<span className="text-xs text-muted">{freshness(p.holdings.map((h) => h.updatedAt))}</span>} />
        {p.holdings.length ? <HoldingsTable p={p} compact /> : <Empty icon="📈" title="No open positions" sub="Add a Buy transaction to start tracking a holding." />}
      </Card>
    </>
  );
}

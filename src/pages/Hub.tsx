import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Calculator, LineChart, Plus, Sparkles, Target, Wallet, ArrowRight, Activity } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import LE from "@/engine/ledger-engine.js";
import { accountTotals, byCategory, categoryColor, categoryEmoji, currentMonth, inMonth, monthLabel, totals } from "@/engine/expense-engine";
import { AnimatedNumber, Card, CardHeader, Empty, Ring, Skeleton } from "@/components/ui";
import { Sparkline } from "@/components/charts";
import { cx, fmtPct, fmtRs, fmtRs0, fmtUSD, relTime, tone } from "@/lib/format";
import { useActions } from "@/stores/actions";
import { useExpenses } from "@/stores/expenses";
import { pkrRate, useInvest, valuationCtx } from "@/stores/invest";
import { Arrow, AssetBadge, usePortfolio } from "@/modules/invest/common";
import { PowerHubCard } from "@/modules/power/HubCard";

export default function Hub() {
  const eLoaded = useExpenses((s) => s.loaded);
  const iLoaded = useInvest((s) => s.loaded);
  const etx = useExpenses((s) => s.txns);
  const accounts = useExpenses((s) => s.accounts);
  const inv = useInvest();
  const { openExpense, openInvest, setPf, setMonth } = useActions();
  const p = usePortfolio();
  const rate = pkrRate(inv);
  const nw = accountTotals(accounts);
  const owed = inv.settings.owedToOthers || 0;
  const investPkr = rate != null ? (p.equity - owed) * rate : null;
  const total = nw.net + (investPkr ?? 0);

  const cm = currentMonth();
  const month = useMemo(() => etx.filter((t) => inMonth(t, cm)), [etx]);
  const mt = totals(month);
  const topCats = byCategory(month).slice(0, 4);

  const spark = useMemo(() => {
    if (inv.transactions.length < 1) return [];
    return LE.equitySeries(valuationCtx(inv), { isAll: true, startTs: -Infinity, endTs: Date.now() }, "all", p.equity, inv.equityHistory).map((x) => x.v);
  }, [inv.transactions, inv.prices, inv.priceHistory, inv.equityHistory, p.equity]);

  const activity = useMemo(() => {
    const a = etx.map((t) => ({ k: "e" + t.id, at: new Date(t.txn_date + "T12:00:00").getTime() + (t.created_at % 1000), icon: t.direction === "IN" ? "💰" : categoryEmoji(t.category),
      title: t.description, sub: t.direction === "IN" ? "Income" : t.category || "Expense", amt: (t.direction === "IN" ? "+ " : "− ") + fmtRs(t.amount), tone: t.direction === "IN" ? "pos" : "neg", open: () => openExpense(t) }));
    const b = inv.transactions.map((t) => {
      const sym = t.assetId ? (inv.assets[t.assetId]?.symbol || "").toUpperCase() : "";
      const v = t.type === "DEPOSIT" ? t.amount! : t.type === "WITHDRAW" ? -t.amount! : t.type === "BUY" ? -(t.qty! * t.price! + (t.fee || 0)) : t.type === "SELL" ? t.qty! * t.price! - (t.fee || 0) : t.target === "cash" ? t.delta! : 0;
      return { k: "i" + t.id, at: new Date(t.date).getTime(), icon: t.type === "BUY" ? "🟢" : t.type === "SELL" ? "🔴" : t.type === "DEPOSIT" ? "📥" : t.type === "WITHDRAW" ? "📤" : "⚙️",
        title: `${t.type[0]}${t.type.slice(1).toLowerCase()}${sym ? " " + sym : ""}`, sub: t.note || "Investments", amt: `${v >= 0 ? "+" : "−"}${fmtUSD(Math.abs(v))}`, tone: v >= 0 ? "pos" : "neg", open: () => openInvest(t) };
    });
    return [...a, ...b].sort((x, y) => y.at - x.at).slice(0, 8);
  }, [etx, inv.transactions, inv.assets, openExpense, openInvest]);

  const goal = [...inv.goals].sort((a, b) => (a.target || 0) - (b.target || 0)).find((g) => p.equity < g.target) || inv.goals[0];
  const parts = [
    { k: "Assets", v: nw.assets, c: "bg-violet" },
    { k: "Banks", v: nw.banks, c: "bg-cyan" },
    { k: "Investments", v: Math.max(0, investPkr ?? 0), c: "bg-pink" },
  ];
  const partsTotal = parts.reduce((s, x) => s + Math.max(0, x.v), 0) || 1;

  if (!eLoaded || !iLoaded) return <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-56 lg:col-span-3" />{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64" />)}</div>;

  return (
    <div className="space-y-4">
      <Card className="p-6 sm:p-8">
        <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-cyan/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -bottom-40 h-96 w-96 rounded-full bg-violet/25 blur-3xl" />
        <div className="relative flex flex-wrap items-end gap-6">
          <div>
            <div className="label flex items-center gap-2"><Sparkles size={13} className="text-cyan" /> Total net worth</div>
            <AnimatedNumber value={total} format={fmtRs0} className="mt-3 block whitespace-nowrap text-[clamp(2rem,10vw,3.75rem)] font-semibold leading-none tracking-tight" />
            <div className="mt-2 text-sm text-muted">
              {rate != null ? <>Net worth register + investments at <span className="num">USD/PKR {rate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>{owed > 0 && <> · less {fmtUSD(owed)} owed</>}</>
                : "Investments excluded until the USD/PKR rate loads"}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <button className="btn" onClick={() => openExpense()}><Plus size={15} /> Expense</button>
            <button className="btn" onClick={() => openInvest()}><LineChart size={15} /> Trade</button>
            <button className="btn" onClick={() => setPf(true)}><Calculator size={15} /> PF calc</button>
          </div>
        </div>
        <div className="relative mt-7">
          <div className="flex h-3 gap-1 overflow-hidden rounded-full">
            {parts.map((x, i) => (
              <motion.div key={x.k} className={cx("h-full rounded-full", x.c)} style={{ boxShadow: "0 0 14px currentColor" }}
                initial={{ width: 0 }} animate={{ width: `${(Math.max(0, x.v) / partsTotal) * 100}%` }} transition={{ duration: 1.1, delay: 0.2 + i * 0.1, ease: [0.22, 1, 0.36, 1] }} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
            {parts.map((x) => <span key={x.k} className="flex items-center gap-2 text-muted"><i className={cx("h-2 w-2 rounded-full", x.c)} />{x.k} <b className="num text-ink">{fmtRs(x.v)}</b></span>)}
            <span className="flex items-center gap-2 text-muted"><i className="h-2 w-2 rounded-full bg-neg" />Debts <b className="num neg">− {fmtRs(nw.debts)}</b></span>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card delay={0.08}>
          <CardHeader title={monthLabel(cm)} sub="Cash flow this month" icon={<Wallet size={16} />}
            right={<Link to="/expenses" onClick={() => setMonth(cm)} className="icon-btn"><ArrowRight size={16} /></Link>} />
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-pos/[.07] p-3 ring-1 ring-pos/15"><div className="flex items-center gap-1 text-[11px] text-muted"><ArrowUpRight size={13} className="text-pos" />In</div><AnimatedNumber value={mt.income} format={fmtRs} className="mt-1 block font-semibold pos" /></div>
              <div className="rounded-2xl bg-neg/[.07] p-3 ring-1 ring-neg/15"><div className="flex items-center gap-1 text-[11px] text-muted"><ArrowDownRight size={13} className="text-neg" />Out</div><AnimatedNumber value={mt.expenses} format={fmtRs} className="mt-1 block font-semibold neg" /></div>
            </div>
            <div className="flex items-baseline"><span className="text-sm text-muted">Net</span><AnimatedNumber value={mt.net} format={fmtRs} className={cx("ml-auto text-xl font-semibold", mt.net < 0 && "neg")} /></div>
            <div className="flex items-baseline text-sm"><span className="text-muted">Savings rate</span><span className={cx("num ml-auto font-semibold", mt.savingsRate == null ? "text-muted" : mt.savingsRate >= 20 ? "pos" : mt.savingsRate >= 0 ? "text-amber" : "neg")}>{mt.savingsRate == null ? "—" : `${mt.savingsRate}%`}</span></div>
            {topCats.length > 0 && <div className="space-y-2 border-t hairline pt-4">
              {topCats.map((c) => (
                <div key={c.category} className="flex items-center gap-2 text-xs">
                  <span>{categoryEmoji(c.category)}</span><span className="truncate text-muted">{c.category}</span>
                  <div className="ml-auto h-1 w-16 overflow-hidden rounded-full bg-line/10"><motion.div className="h-full" style={{ background: categoryColor(c.category) }} initial={{ width: 0 }} animate={{ width: `${(c.amount / mt.expenses) * 100}%` }} transition={{ duration: 1 }} /></div>
                  <span className="num w-24 text-right">{fmtRs(c.amount)}</span>
                </div>
              ))}
            </div>}
          </div>
        </Card>

        <Card delay={0.14}>
          <CardHeader title="Portfolio" sub="Crypto & stocks" icon={<LineChart size={16} />} right={<Link to="/invest" className="icon-btn"><ArrowRight size={16} /></Link>} />
          {!inv.transactions.length ? <Empty icon="🚀" title="No trades yet" sub="Deposit capital and log your first buy." action={<button className="btn btn-primary btn-sm" onClick={() => openInvest(null, { type: "DEPOSIT" })}>Add deposit</button>} /> : (
            <div className="p-5">
              <AnimatedNumber value={p.equity} format={fmtUSD} className="block text-3xl font-semibold" />
              <div className={cx("num mt-1 text-sm font-semibold", tone(p.totalReturn))}><Arrow n={p.totalReturn} />{fmtUSD(Math.abs(p.totalReturn))} ({fmtPct(p.totalReturnPct)}) <span className="font-sans font-normal text-muted">all-time</span></div>
              <Sparkline values={spark} className="mt-4 h-16 w-full" />
              <div className="mt-4 space-y-2.5 border-t hairline pt-4">
                {p.holdings.slice(0, 4).map((h) => {
                  const u = h.costBasis > 0 && h.unrealized != null ? (h.unrealized / h.costBasis) * 100 : null;
                  return (
                    <div key={h.assetId} className="flex items-center gap-2.5 text-sm">
                      <AssetBadge a={h.asset} size={26} /><span className="font-semibold">{h.asset.symbol.toUpperCase()}</span>
                      <span className="num ml-auto">{fmtUSD(h.marketValue ?? h.costBasis)}</span>
                      <span className={cx("num w-16 text-right text-xs", u != null ? tone(u) : "text-muted")}>{u != null ? fmtPct(u) : "—"}</span>
                    </div>
                  );
                })}
                {!p.holdings.length && <div className="text-xs text-muted">All in cash · {fmtUSD(p.cash)}</div>}
              </div>
            </div>
          )}
        </Card>

        <Card delay={0.2}>
          <CardHeader title="Next goal" icon={<Target size={16} />} right={<Link to="/invest/goals" className="icon-btn"><ArrowRight size={16} /></Link>} />
          {!goal ? <Empty icon="🎯" title="No goals yet" sub="Set a target portfolio value to track it here." action={<Link to="/invest/goals" className="btn btn-primary btn-sm">Add goal</Link>} /> : (
            <div className="flex flex-col items-center p-6">
              <Ring progress={(p.equity / goal.target) * 100} reached={p.equity >= goal.target} size={170}>
                <div><div className="num text-3xl font-semibold">{Math.min(100, (p.equity / goal.target) * 100).toFixed(0)}%</div><div className="text-[11px] text-muted">{goal.name}</div></div>
              </Ring>
              <div className="mt-4 text-center text-sm"><span className="num font-semibold">{fmtUSD(p.equity)}</span> <span className="text-muted">of</span> <span className="num font-semibold">{fmtUSD(goal.target)}</span></div>
              {p.equity < goal.target && <div className="mt-1 text-xs text-muted"><span className="num">{fmtUSD(goal.target - p.equity)}</span> to go</div>}
            </div>
          )}
        </Card>
      </div>

      <PowerHubCard delay={0.23} />

      <Card delay={0.26}>
        <CardHeader title="Recent activity" sub="Across expenses and investments" icon={<Activity size={16} />} />
        {!activity.length ? <Empty icon="✨" title="Nothing yet" sub="Your latest transactions and trades will appear here." /> : (
          <div className="grid divide-y divide-line/5 md:grid-cols-2 md:divide-y-0">
            {activity.map((a, i) => (
              <motion.button key={a.k} onClick={a.open} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.03 }}
                className="flex items-center gap-3 px-5 py-3 text-left transition hover:bg-line/[.03] md:border-b md:border-line/5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-line/[.05] text-base">{a.icon}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{a.title}</div><div className="truncate text-xs text-muted">{a.sub} · {relTime(a.at)}</div></div>
                <span className={cx("num text-sm font-semibold", a.tone)}>{a.amt}</span>
              </motion.button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

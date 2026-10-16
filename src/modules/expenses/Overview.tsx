import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, PieChart, Scale, BarChart3, Landmark, Plus } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardHeader, Empty, Stat, AnimatedNumber } from "@/components/ui";
import { Donut, FlowBars } from "@/components/charts";
import {
  MONTH_NAMES, accountTotals, byCategory, categoryColor, categoryEmoji, inMonth, monthLabel, shiftMonth, totals,
} from "@/engine/expense-engine";
import { cx, fmtRs, fmtRsCompact } from "@/lib/format";
import { useActions } from "@/stores/actions";
import { useExpenses } from "@/stores/expenses";
import { LoadingGrid, MonthNav, PageTitle, useMonthTxns } from "./common";

export default function ExpenseOverview() {
  const loaded = useExpenses((s) => s.loaded);
  const all = useExpenses((s) => s.txns);
  const accounts = useExpenses((s) => s.accounts);
  const month = useActions((s) => s.month);
  const openExpense = useActions((s) => s.openExpense);
  const txns = useMonthTxns();
  const t = totals(txns);
  const cats = byCategory(txns);
  const nw = accountTotals(accounts);

  const flow = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const ym = shiftMonth(month, i - 5);
    const tt = totals(all.filter((x) => inMonth(x, ym)));
    return { label: MONTH_NAMES[ym.month - 1].slice(0, 3), income: tt.income, expenses: tt.expenses, active: i === 5 };
  }), [all, month]);

  const top = [...txns].filter((x) => x.direction === "OUT").sort((a, b) => b.amount - a.amount).slice(0, 5);
  const rateTone = t.savingsRate == null ? "text-muted" : t.savingsRate >= 20 ? "pos" : t.savingsRate >= 0 ? "text-amber" : "neg";

  return (
    <>
      <PageTitle title="Spending" sub={`Cash flow for ${monthLabel(month)}`} right={<MonthNav />} />
      {!loaded ? <LoadingGrid /> : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Income" icon={<ArrowUpRight size={15} />} value={t.income} format={fmtRs} tone="pos" glow="pos" delay={0}
              sub={`${txns.filter((x) => x.direction === "IN").length} credits`} />
            <Stat label="Expenses" icon={<ArrowDownRight size={15} />} value={t.expenses} format={fmtRs} tone="neg" glow="neg" delay={0.05}
              sub={`${txns.filter((x) => x.direction === "OUT").length} debits`} />
            <Stat label="Net balance" icon={<Scale size={15} />} value={t.net} format={fmtRs} tone={t.net < 0 ? "neg" : ""} glow="cyan" delay={0.1}
              extra={<div className="mt-3">
                <div className="mb-1 flex justify-between text-[11px]"><span className="text-muted">Savings rate</span>
                  <span className={cx("num font-semibold", rateTone)}>{t.savingsRate == null ? "—" : `${t.savingsRate}%`}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-line/10">
                  <motion.div className={cx("h-full rounded-full", t.savingsRate != null && t.savingsRate >= 20 ? "bg-pos" : t.savingsRate != null && t.savingsRate >= 0 ? "bg-amber" : "bg-neg")}
                    initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, t.savingsRate ?? 0))}%` }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
                </div>
              </div>} />
          </div>

          <div className="grid gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-3" delay={0.12}>
              <CardHeader title="Spending by category" icon={<PieChart size={16} />} sub={monthLabel(month)} />
              {cats.length === 0 ? (
                <Empty icon="🧾" title="No expenses this month" sub="Add a transaction to see where your money goes."
                  action={<button className="btn btn-primary" onClick={() => openExpense()}><Plus size={15} /> Add transaction</button>} />
              ) : (
                <div className="flex flex-col items-center gap-6 p-5 md:flex-row">
                  <Donut data={cats.map((c) => ({ key: c.category, value: c.amount, color: categoryColor(c.category) }))}
                    center={<div><div className="label !text-[9.5px]">Spent</div><div className="num mt-1 text-lg font-semibold">{fmtRsCompact(t.expenses)}</div></div>} />
                  <div className="w-full flex-1 space-y-3">
                    {cats.map((c, i) => {
                      const pct = t.expenses > 0 ? (c.amount / t.expenses) * 100 : 0;
                      return (
                        <motion.div key={c.category} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
                          <div className="mb-1 flex items-center gap-2 text-sm">
                            <span>{categoryEmoji(c.category)}</span>
                            <span className="truncate">{c.category}</span>
                            <span className="num ml-auto font-semibold">{fmtRs(c.amount)}</span>
                            <span className="num w-10 text-right text-xs text-muted">{pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-line/[.07]">
                            <motion.div className="h-full rounded-full" style={{ background: categoryColor(c.category), boxShadow: `0 0 10px ${categoryColor(c.category)}` }}
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, delay: 0.2 + i * 0.05, ease: [0.22, 1, 0.36, 1] }} />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>

            <Card className="xl:col-span-2" delay={0.16}>
              <CardHeader title="6-month flow" icon={<BarChart3 size={16} />} sub="Income vs expenses"
                right={<div className="flex gap-3 text-[11px] text-muted"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-pos" />In</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-neg" />Out</span></div>} />
              <div className="p-5"><FlowBars data={flow} format={fmtRs} /></div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card delay={0.2}>
              <CardHeader title="Biggest expenses" icon={<ArrowDownRight size={16} />} right={<Link to="/expenses/transactions" className="btn btn-sm">View all</Link>} />
              {top.length === 0 ? <div className="p-6 text-sm text-muted">Nothing spent yet this month.</div> : (
                <div className="divide-y divide-line/5">
                  {top.map((x) => (
                    <button key={x.id} onClick={() => openExpense(x)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-line/[.03]">
                      <span className="grid h-9 w-9 place-items-center rounded-xl text-base" style={{ background: `${categoryColor(x.category)}22` }}>{categoryEmoji(x.category)}</span>
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{x.description}</div><div className="text-xs text-muted">{new Date(x.txn_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {x.category}</div></div>
                      <span className="num text-sm font-semibold neg">− {fmtRs(x.amount)}</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
            <Card delay={0.24}>
              <CardHeader title="Net worth" icon={<Landmark size={16} />} right={<Link to="/expenses/networth" className="btn btn-sm">Manage</Link>} />
              <div className="space-y-3 p-5">
                {[["Assets", nw.assets, "bg-violet"], ["Bank balances", nw.banks, "bg-cyan"], ["Debts", -nw.debts, "bg-neg"]].map(([k, v, c]) => (
                  <div key={k as string} className="flex items-center gap-3 text-sm">
                    <i className={cx("h-2.5 w-2.5 rounded-full", c as string)} /><span className="text-muted">{k}</span>
                    <span className={cx("num ml-auto font-semibold", (v as number) < 0 && "neg")}>{fmtRs(v as number)}</span>
                  </div>
                ))}
                <div className="flex items-center border-t hairline pt-4">
                  <span className="font-display font-semibold">Net worth</span>
                  <AnimatedNumber value={nw.net} format={fmtRs} className="ml-auto text-xl font-semibold gradient-text" />
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

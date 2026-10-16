import { AnimatePresence, motion } from "framer-motion";
import { Download, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Card, Empty } from "@/components/ui";
import { CATEGORIES, categoryColor, categoryEmoji, filterTxns, groupByDay, monthKey, toCSV, totals } from "@/engine/expense-engine";
import { cx, downloadFile, fmtRs } from "@/lib/format";
import { useActions } from "@/stores/actions";
import { useExpenses } from "@/stores/expenses";
import { confirmDialog, toast } from "@/stores/ui";
import { LoadingGrid, MonthNav, PageTitle, useMonthTxns } from "./common";

export default function ExpenseTransactions() {
  const loaded = useExpenses((s) => s.loaded);
  const del = useExpenses((s) => s.deleteTxn);
  const month = useActions((s) => s.month);
  const openExpense = useActions((s) => s.openExpense);
  const txns = useMonthTxns();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const filtered = filterTxns(txns, q, cat);
  const groups = groupByDay(filtered);
  const ft = totals(filtered);

  const exportCSV = () => {
    if (!txns.length) { toast("No transactions to export.", true); return; }
    downloadFile(`expenses_${monthKey(month)}.csv`, toCSV(txns), "text/csv;charset=utf-8;");
    toast("CSV exported");
  };

  const remove = async (id: string, name: string) => {
    if (await confirmDialog("Delete transaction", `Delete "${name}"? This cannot be undone.`, { confirmText: "Delete", danger: true })) {
      await del(id); toast("Deleted");
    }
  };

  return (
    <>
      <PageTitle title="Transactions" sub={txns.length ? `${txns.length} this month${filtered.length !== txns.length ? ` · ${filtered.length} shown` : ""}` : "Every rupee in and out"}
        right={<><MonthNav /><button className="btn" onClick={exportCSV}><Download size={15} /> CSV</button></>} />
      {!loaded ? <LoadingGrid /> : (
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b hairline p-4">
            <div className="relative min-w-[200px] flex-1">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input !pl-10" placeholder="Search transactions…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search transactions" />
            </div>
            <select className="input !w-auto min-w-[180px]" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
              <option value="">All categories</option>
              <option value="__income__">💰 Income</option>
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.emoji} {c.key}</option>)}
            </select>
            {(q || cat) && filtered.length > 0 && (
              <div className="num ml-auto text-xs"><span className="pos">+{fmtRs(ft.income)}</span> <span className="text-muted">/</span> <span className="neg">−{fmtRs(ft.expenses)}</span></div>
            )}
          </div>
          {filtered.length === 0 ? (
            <Empty icon={txns.length ? "🔍" : "🧾"} title={txns.length ? "No matches" : "No transactions this month"}
              sub={txns.length ? "Try a different search or category." : "Log income and spending to build your monthly picture."}
              action={!txns.length && <button className="btn btn-primary" onClick={() => openExpense()}><Plus size={15} /> Add transaction</button>} />
          ) : (
            <div className="divide-y divide-line/5">
              {groups.map((g, gi) => {
                const dt = totals(g.items);
                return (
                  <motion.div key={g.day} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(gi * 0.03, 0.3) }}>
                    <div className="flex items-center bg-line/[.02] px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                      {new Date(g.day + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                      <span className="num ml-auto normal-case tracking-normal">{dt.income > 0 && <span className="pos mr-2">+{fmtRs(dt.income)}</span>}{dt.expenses > 0 && <span className="neg">−{fmtRs(dt.expenses)}</span>}</span>
                    </div>
                    <AnimatePresence initial={false}>
                      {g.items.map((t) => {
                        const isIn = t.direction === "IN";
                        return (
                          <motion.div key={t.id} layout exit={{ opacity: 0, x: -20, height: 0 }} className="group flex items-center gap-3 px-5 py-3 transition hover:bg-line/[.03]">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: isIn ? "rgb(var(--pos) / .12)" : `${categoryColor(t.category)}22` }}>
                              {isIn ? "💰" : categoryEmoji(t.category)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{t.description}</div>
                              <div className="truncate text-xs text-muted">{isIn ? "Income" : t.category || "Uncategorised"}</div>
                            </div>
                            <div className={cx("num text-sm font-semibold", isIn ? "pos" : "neg")}>{isIn ? "+" : "−"} {fmtRs(t.amount)}</div>
                            <div className="flex opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                              <button className="icon-btn" title="Edit" onClick={() => openExpense(t)}><Pencil size={15} /></button>
                              <button className="icon-btn hover:!text-neg" title="Delete" onClick={() => remove(t.id, t.description)}><Trash2 size={15} /></button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </>
  );
}

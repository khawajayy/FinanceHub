import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { currentMonth, inMonth, monthLabel, shiftMonth } from "@/engine/expense-engine";
import { useActions } from "@/stores/actions";
import { useExpenses } from "@/stores/expenses";
import { Skeleton } from "@/components/ui";

export function MonthNav() {
  const month = useActions((s) => s.month);
  const setMonth = useActions((s) => s.setMonth);
  const isNow = (() => { const c = currentMonth(); return c.year === month.year && c.month === month.month; })();
  return (
    <div className="glass inline-flex items-center gap-1 rounded-xl p-1">
      <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeft size={17} /></button>
      <button className="min-w-[132px] rounded-lg px-2 py-1 text-center font-display text-sm font-semibold hover:bg-line/5" onClick={() => setMonth(currentMonth())}
        title={isNow ? "Current month" : "Jump to current month"}>
        {monthLabel(month)}{!isNow && <span className="ml-1.5 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-cyan" />}
      </button>
      <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month"><ChevronRight size={17} /></button>
    </div>
  );
}

/** Transactions for the selected month. */
export function useMonthTxns() {
  const txns = useExpenses((s) => s.txns);
  const month = useActions((s) => s.month);
  return useMemo(() => txns.filter((t) => inMonth(t, month)), [txns, month]);
}

export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div>
    </div>
  );
}

export function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
      <Skeleton className="h-72 sm:col-span-3" />
    </div>
  );
}

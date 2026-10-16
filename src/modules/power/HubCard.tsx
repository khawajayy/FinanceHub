import { motion } from "framer-motion";
import { ArrowRight, Zap } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AnimatedNumber, Card, CardHeader } from "@/components/ui";
import { continuousDaily } from "@/engine/power-engine";
import { usePower } from "@/stores/power";
import { fmt2, money, usePowerStats, useUnits } from "./common";

/** Electricity summary for the Hub. */
export function PowerHubCard({ delay = 0 }: { delay?: number }) {
  const readings = usePower((s) => s.readings);
  const st = usePowerStats();
  const { unit, u } = useUnits();
  const week = useMemo(() => continuousDaily(readings, 14), [readings]);
  const max = Math.max(1, ...week.map((d) => d.used));
  return (
    <Card delay={delay}>
      <CardHeader title="Electricity" sub="Current billing cycle" icon={<Zap size={16} />} right={<Link to="/power" className="icon-btn"><ArrowRight size={16} /></Link>} />
      {!st ? (
        <div className="flex flex-wrap items-center gap-3 p-5 text-sm text-muted">
          Log two meter readings to see usage and your projected bill.
          <Link to="/power" className="btn btn-sm btn-primary ml-auto"><Zap size={13} /> Log reading</Link>
        </div>
      ) : (
        <div className="grid items-end gap-5 p-5 sm:grid-cols-[auto_auto_1fr]">
          <div>
            <div className="text-[11px] text-muted">Used so far</div>
            <div className="flex items-baseline gap-1.5"><AnimatedNumber value={st.cycleUsed} format={fmt2} className="text-2xl font-semibold" /><span className="text-sm text-muted">{unit}</span></div>
            <div className="text-xs text-muted">bill so far <span className="num text-ink">{money(st.billSoFar)}</span></div>
          </div>
          <div className="rounded-2xl bg-amber/10 px-4 py-2.5 ring-1 ring-amber/25">
            <div className="text-[11px] text-muted">Projected bill</div>
            <AnimatedNumber value={st.projectedBill} format={money} className="block text-xl font-semibold text-amber" />
            <div className="text-[11px] text-muted">{u(st.projected)} by {st.cycleEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
          </div>
          <div>
            <div className="mb-1 text-right text-[11px] text-muted">last 14 days</div>
            <div className="flex h-14 items-end gap-[3px]">
              {week.map((d, i) => (
                <motion.div key={d.day} title={`${d.day}: ${u(d.used)}`} className="flex-1 rounded-t-[3px] bg-gradient-to-t from-amber/30 to-amber"
                  initial={{ height: 0 }} animate={{ height: `${(d.used / max) * 100}%` }} transition={{ duration: 0.7, delay: 0.2 + i * 0.03 }} />
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

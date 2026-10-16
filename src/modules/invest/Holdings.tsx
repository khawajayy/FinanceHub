import { Briefcase } from "lucide-react";
import { Card, CardHeader, Empty } from "@/components/ui";
import { fmtUSD } from "@/lib/format";
import { HoldingsTable, freshness, usePortfolio } from "./common";
import { PageTitle } from "@/modules/expenses/common";

export default function Holdings() {
  const p = usePortfolio();
  return (
    <>
      <PageTitle title="Holdings" sub={`${p.holdings.length} open position${p.holdings.length === 1 ? "" : "s"} · ${fmtUSD(p.holdingsValue)} market value`} />
      <Card>
        <CardHeader title="Positions" icon={<Briefcase size={16} />} right={<span className="text-xs text-muted">{freshness(p.holdings.map((h) => h.updatedAt))}</span>} />
        {p.holdings.length ? <HoldingsTable p={p} /> : <Empty icon="📈" title="No open positions" sub="Add a Buy transaction to start tracking a holding." />}
      </Card>
      <p className="mt-3 px-1 text-xs text-muted"><b>Break-even</b> is the price a holding must reach for your total equity to equal your net capital, with cash and every other position held constant.</p>
    </>
  );
}

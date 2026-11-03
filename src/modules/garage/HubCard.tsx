import { ArrowRight, CarFront, Fuel, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { AnimatedNumber, Card, CardHeader } from "@/components/ui";
import { useGarage } from "@/stores/garage";
import { StatusBadge, dueSummary, fmtKm, useGarageAlerts, useVehicleData } from "./common";

/** Garage summary for the Hub: selected vehicle's fuel average, plus what's due across all vehicles. */
export function GarageHubCard({ delay = 0 }: { delay?: number }) {
  const { vehicle: v, stats, odo, costs } = useVehicleData();
  const alerts = useGarageAlerts();
  const openModal = useGarage((s) => s.openModal);
  return (
    <Card delay={delay}>
      <CardHeader title="Garage" sub={v ? v.name : "Fuel, mileage and maintenance"} icon={<CarFront size={16} />} right={<Link to="/garage" className="icon-btn" aria-label="Open garage"><ArrowRight size={16} /></Link>} />
      {!v ? (
        <div className="flex flex-wrap items-center gap-3 p-5 text-sm text-muted">
          Track fuel average and never miss a service.
          <button className="btn btn-sm btn-primary ml-auto" onClick={() => openModal({ type: "vehicle" })}><Plus size={13} /> Add vehicle</button>
        </div>
      ) : (
        <div className="p-5">
          <div className="grid grid-cols-3 gap-3">
            <div><div className="text-[11px] text-muted">Fuel average</div><AnimatedNumber value={stats.avgKmpl ?? 0} format={(n) => (stats.avgKmpl == null ? "—" : n.toFixed(1))} className="text-xl font-semibold" /><span className="ml-1 text-[11px] text-muted">km/l</span></div>
            <div><div className="text-[11px] text-muted">Odometer</div><div className="num truncate text-sm font-semibold leading-7">{fmtKm(odo)}</div></div>
            <div><div className="text-[11px] text-muted">Cost</div><div className="num truncate text-sm font-semibold leading-7">{costs.perKm != null ? `Rs ${costs.perKm.toFixed(1)}/km` : "—"}</div></div>
          </div>
          <div className="mt-3 space-y-2 border-t hairline pt-3">
            {alerts.slice(0, 3).map(({ r, st, vehicleName }) => (
              <Link key={r.id} to="/garage/maintenance" className="flex items-center gap-2 rounded-lg text-sm hover:bg-line/[.03]">
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{r.title}</div><div className="truncate text-[11px] text-muted">{vehicleName} · {dueSummary(st)}</div></div>
                <StatusBadge status={st.status} />
              </Link>
            ))}
            {!alerts.length && <div className="text-xs text-muted">Nothing due soon. 👍</div>}
          </div>
          <button className="btn btn-sm mt-3 w-full" onClick={() => openModal({ type: "fuel" })}><Fuel size={13} /> Log a fill-up</button>
        </div>
      )}
    </Card>
  );
}

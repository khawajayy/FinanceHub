import { AnimatePresence, motion } from "framer-motion";
import { Download, Gauge, Trash2, Upload } from "lucide-react";
import { useMemo } from "react";
import { Card, CardHeader, Empty } from "@/components/ui";
import { intervals, sortReadings } from "@/engine/power-engine";
import { cx, downloadFile } from "@/lib/format";
import { usePower } from "@/stores/power";
import { confirmDialog, toast } from "@/stores/ui";
import { LoadingGrid, PageTitle } from "@/modules/expenses/common";
import { fmt2, useUnits } from "./common";

export default function Readings() {
  const loaded = usePower((s) => s.loaded);
  const readings = usePower((s) => s.readings);
  const appliances = usePower((s) => s.appliances);
  const del = usePower((s) => s.deleteReading);
  const importBackup = usePower((s) => s.importBackup);
  const { u } = useUnits();

  const rows = useMemo(() => {
    const byTo: Record<string, ReturnType<typeof intervals>[number]> = {};
    intervals(readings).forEach((iv) => (byTo[iv.to.id] = iv));
    return sortReadings(readings).reverse().map((r) => ({ r, iv: byTo[r.id] }));
  }, [readings]);

  const exportJSON = () => {
    downloadFile(`electricity-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ readings: readings.map(({ v, t }) => ({ v, t })), appliances: appliances.map(({ name, watts, qty, hours }) => ({ name, watts, qty, hours })), exported: new Date().toISOString() }, null, 2), "application/json");
  };
  const importJSON = () => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json,.json";
    inp.onchange = () => {
      const f = inp.files?.[0]; if (!f) return;
      if (f.size > 5 * 1024 * 1024) { toast("Import failed: file is larger than 5 MB", true); return; }
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const d = JSON.parse(String(rd.result));
          if (!d || typeof d !== "object" || (!Array.isArray(d.readings) && !Array.isArray(d.appliances))) throw new Error("not an Electricity Guru backup");
          if (!(await confirmDialog("Import backup", `Add ${Array.isArray(d.readings) ? d.readings.length : 0} reading(s) and ${Array.isArray(d.appliances) ? d.appliances.length : 0} appliance(s) to your current data?`, { confirmText: "Import" }))) return;
          const n = importBackup(d);
          toast(`Imported ${n.readings} reading(s) and ${n.appliances} appliance(s)`);
        } catch (e) { toast("Import failed: " + (e as Error).message, true); }
      };
      rd.readAsText(f);
    };
    inp.click();
  };
  const remove = async (id: string) => {
    if (await confirmDialog("Delete reading", "Delete this meter reading? This cannot be undone.", { confirmText: "Delete", danger: true })) { del(id); toast("Deleted"); }
  };

  return (
    <>
      <PageTitle title="Readings" sub={`${readings.length} meter reading${readings.length === 1 ? "" : "s"}`}
        right={<><button className="btn" onClick={exportJSON}><Download size={15} /> Export</button><button className="btn" onClick={importJSON}><Upload size={15} /> Import</button></>} />
      {!loaded ? <LoadingGrid /> : (
        <Card>
          <CardHeader title="All readings" icon={<Gauge size={16} />} sub="Import accepts the JSON exported from the original Electricity Guru app" />
          {!rows.length ? <Empty icon="📟" title="No readings yet" sub="Log one from the Electricity dashboard." /> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>When</th><th className="!text-right">Reading</th><th className="!text-right">Used since prev</th><th className="!text-right">Rate</th><th /></tr></thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {rows.map(({ r, iv }, i) => (
                      <motion.tr key={r.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(i * 0.015, 0.3) }}>
                        <td className="text-sm">{new Date(r.t).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="num text-right font-semibold">{fmt2(r.v)}</td>
                        <td className={cx("num text-right", iv && iv.used < 0 ? "text-amber" : "")}>{iv ? <>{iv.used < 0 && <span className="chip mr-1 !bg-amber/15 !text-amber">reset</span>}{u(iv.used)}</> : <span className="text-muted">—</span>}</td>
                        <td className="num text-right text-muted">{iv && iv.ms > 0 ? `${fmt2(iv.used / (iv.ms / 86400000))}/day` : ""}</td>
                        <td className="w-px"><button className="icon-btn hover:!text-neg" title="Delete" onClick={() => remove(r.id)}><Trash2 size={14} /></button></td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

import { useMemo } from "react";
import { stats } from "@/engine/power-engine";
import { usePower } from "@/stores/power";

export const fmt2 = (n: number) => (Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
export const money = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;
export const prettyIso = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); };
export const toLocalInput = (ms: number) => {
  const d = new Date(ms), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Formatter that appends the chosen unit label ("kWh" or "units"; 1 unit = 1 kWh). */
export function useUnits() {
  const unit = usePower((s) => s.settings.unit);
  return { unit, u: (n: number) => `${fmt2(n)} ${unit}` };
}

export function usePowerStats() {
  const readings = usePower((s) => s.readings);
  const settings = usePower((s) => s.settings);
  return useMemo(() => stats(readings, settings), [readings, settings]);
}

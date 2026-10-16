import { create } from "zustand";
import { collection, doc, onSnapshot, setDoc, writeBatch, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEMO, demoPower } from "@/lib/demo";
import { DEFAULT_POWER_SETTINGS, type Appliance, type Cycle, type PowerSettings, type Reading } from "@/engine/power-engine";
import { toast } from "./ui";

/*
 * Firestore layout (owner-only, see firestore.rules):
 *   power/{uid}                      { rate, billDay, unit }
 *   power/{uid}/readings/{id}        { v, t }
 *   power/{uid}/appliances/{id}      { name, watts, qty, hours }
 *   power/{uid}/cycles/{id}          { start, end, units, rate, est, actual, actualUnits, actualReading }
 * Changes apply locally first, then go out as one batch (queued while offline).
 */

type Coll = "readings" | "appliances" | "cycles";
type Op =
  | { kind: "set"; coll: Coll; id: string; data: Record<string, unknown> }
  | { kind: "update"; coll: Coll; id: string; data: Record<string, unknown> }
  | { kind: "delete"; coll: Coll; id: string };

interface PowerState {
  uid: string | null;
  readings: Reading[];
  appliances: Appliance[];
  cycles: Cycle[];
  settings: PowerSettings;
  loaded: boolean;
  start: (uid: string) => void;
  stop: () => void;
  addReading: (v: number, t: number) => void;
  deleteReading: (id: string) => void;
  addAppliance: (a: Omit<Appliance, "id">) => void;
  deleteAppliance: (id: string) => void;
  saveCycle: (c: Omit<Cycle, "id">) => void;
  updateCycle: (id: string, patch: Partial<Pick<Cycle, "actual" | "actualUnits" | "actualReading">>) => void;
  deleteCycle: (id: string) => void;
  setSettings: (p: Partial<PowerSettings>) => void;
  importBackup: (d: { readings?: unknown; appliances?: unknown }) => { readings: number; appliances: number };
}

let unsubs: Unsubscribe[] = [];
const newId = () => doc(collection(db, "_ids")).id;
const fin = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const numOrNull = (v: unknown) => (fin(v) ? (v as number) : null);

function cleanSettings(s: Record<string, unknown> | undefined): PowerSettings {
  const o = { ...DEFAULT_POWER_SETTINGS };
  if (!s) return o;
  if (fin(s.rate) && (s.rate as number) >= 0) o.rate = s.rate as number;
  if (fin(s.billDay) && (s.billDay as number) >= 1 && (s.billDay as number) <= 31) o.billDay = Math.round(s.billDay as number);
  if (s.unit === "units" || s.unit === "kWh") o.unit = s.unit;
  return o;
}

export const usePower = create<PowerState>((set, get) => {
  function applyLocal(ops: Op[]) {
    const next = { readings: get().readings, appliances: get().appliances, cycles: get().cycles } as Record<Coll, { id: string }[]>;
    for (const op of ops) {
      const list = next[op.coll];
      next[op.coll] = op.kind === "set" ? [...list.filter((x) => x.id !== op.id), { id: op.id, ...op.data }]
        : op.kind === "update" ? list.map((x) => (x.id === op.id ? { ...x, ...op.data } : x))
        : list.filter((x) => x.id !== op.id);
    }
    set(next as unknown as Pick<PowerState, Coll>);
  }

  function commit(ops: Op[]) {
    applyLocal(ops);
    const uid = get().uid;
    if (DEMO || !uid || !ops.length) return;
    // Firestore batches cap at 500 writes
    for (let i = 0; i < ops.length; i += 450) {
      const batch = writeBatch(db);
      for (const op of ops.slice(i, i + 450)) {
        const ref = doc(db, "power", uid, op.coll, op.id);
        if (op.kind === "set") batch.set(ref, op.data);
        else if (op.kind === "update") batch.update(ref, op.data as { [k: string]: number | null });
        else batch.delete(ref);
      }
      batch.commit().catch(onFail);
    }
  }
  const onFail = (e: { code?: string }) => {
    console.error("Power write failed", e);
    toast(e?.code === "permission-denied" ? "Cloud rejected the change — deploy the latest firestore.rules (see README)" : "Couldn't save to the cloud", true);
  };

  return {
    uid: null, readings: [], appliances: [], cycles: [], settings: { ...DEFAULT_POWER_SETTINGS }, loaded: false,

    start: (uid) => {
      if (get().uid === uid) return;
      get().stop();
      set({ uid, loaded: false });
      if (DEMO) { set({ ...demoPower(), loaded: true }); return; }
      const got = { readings: false, appliances: false, cycles: false };
      const done = (k: keyof typeof got) => { got[k] = true; if (got.readings && got.appliances && got.cycles) set({ loaded: true }); };
      const onErr = (e: Error) => { console.error(e); set({ loaded: true }); };
      unsubs = [
        onSnapshot(doc(db, "power", uid), (s) => set({ settings: cleanSettings(s.data()) }), onErr),
        onSnapshot(collection(db, "power", uid, "readings"), (s) => {
          set({ readings: s.docs.map((d) => ({ id: d.id, v: Number(d.get("v")), t: Number(d.get("t")) })) }); done("readings");
        }, onErr),
        onSnapshot(collection(db, "power", uid, "appliances"), (s) => {
          set({ appliances: s.docs.map((d) => ({ id: d.id, name: String(d.get("name")), watts: Number(d.get("watts")), qty: Number(d.get("qty")), hours: Number(d.get("hours")) })) }); done("appliances");
        }, onErr),
        onSnapshot(collection(db, "power", uid, "cycles"), (s) => {
          set({ cycles: s.docs.map((d) => {
            const x = d.data();
            return { id: d.id, start: x.start, end: x.end, units: Number(x.units), rate: Number(x.rate), est: Number(x.est),
              actual: numOrNull(x.actual), actualUnits: numOrNull(x.actualUnits), actualReading: numOrNull(x.actualReading) };
          }) }); done("cycles");
        }, onErr),
      ];
    },

    stop: () => { unsubs.forEach((u) => u()); unsubs = []; set({ uid: null, readings: [], appliances: [], cycles: [], loaded: false, settings: { ...DEFAULT_POWER_SETTINGS } }); },

    addReading: (v, t) => commit([{ kind: "set", coll: "readings", id: newId(), data: { v, t } }]),
    deleteReading: (id) => commit([{ kind: "delete", coll: "readings", id }]),
    addAppliance: (a) => commit([{ kind: "set", coll: "appliances", id: newId(), data: { ...a, name: a.name.slice(0, 60) } }]),
    deleteAppliance: (id) => commit([{ kind: "delete", coll: "appliances", id }]),
    saveCycle: (c) => commit([{ kind: "set", coll: "cycles", id: newId(), data: { ...c } }]),
    updateCycle: (id, patch) => commit([{ kind: "update", coll: "cycles", id, data: patch }]),
    deleteCycle: (id) => commit([{ kind: "delete", coll: "cycles", id }]),

    setSettings: (p) => {
      const settings = { ...get().settings, ...p };
      set({ settings });
      const uid = get().uid;
      if (!DEMO && uid) setDoc(doc(db, "power", uid), settings).catch(onFail);
    },

    // Accepts ElectricityGuru's "Export JSON" backup ({ readings:[{v,t}], appliances:[...] }); adds to existing data.
    importBackup: (d) => {
      const ops: Op[] = [];
      let nr = 0, na = 0;
      if (Array.isArray(d.readings)) for (const x of d.readings.slice(0, 20000)) {
        if (x && fin(x.v) && fin(x.t)) { ops.push({ kind: "set", coll: "readings", id: newId(), data: { v: x.v, t: x.t } }); nr++; }
      }
      if (Array.isArray(d.appliances)) for (const x of d.appliances.slice(0, 500)) {
        if (x && typeof x.name === "string" && x.name.trim() && fin(x.watts) && fin(x.hours)) {
          ops.push({ kind: "set", coll: "appliances", id: newId(), data: { name: x.name.trim().slice(0, 60), watts: x.watts, qty: fin(x.qty) ? Math.max(1, Math.round(x.qty)) : 1, hours: x.hours } });
          na++;
        }
      }
      commit(ops);
      return { readings: nr, appliances: na };
    },
  };
});

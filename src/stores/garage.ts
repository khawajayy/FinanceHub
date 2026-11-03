import { create } from "zustand";
import { collection, doc, onSnapshot, writeBatch, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEMO, demoGarage } from "@/lib/demo";
import { advanceReminder, type FuelImportRow, type FuelLog, type OdoLog, type Reminder, type ServiceLog, type Vehicle } from "@/engine/garage-engine";
import { toast } from "./ui";

/*
 * Firestore (owner-only, see firestore.rules):
 *   garage/{uid}/vehicles/{id}   garage/{uid}/fuel/{id}   garage/{uid}/odometer/{id}
 *   garage/{uid}/service/{id}    garage/{uid}/reminders/{id}
 * Changes apply locally first, then go out as batches (queued while offline).
 */

type Coll = "vehicles" | "fuel" | "odometer" | "service" | "reminders";
type Row = { id: string } & Record<string, unknown>;
type Change = { coll: Coll; id: string; data: Record<string, unknown> | null };

export type GarageModal =
  | { type: "vehicle"; id?: string }
  | { type: "fuel"; id?: string }
  | { type: "odometer"; id?: string }
  | { type: "service"; id?: string; reminderId?: string }
  | { type: "reminder"; id?: string };

interface GarageState {
  uid: string | null;
  vehicles: Vehicle[];
  fuel: FuelLog[];
  odometer: OdoLog[];
  service: ServiceLog[];
  reminders: Reminder[];
  loaded: boolean;
  selectedId: string | null;
  modal: GarageModal | null;
  start: (uid: string) => void;
  stop: () => void;
  select: (id: string) => void;
  openModal: (m: GarageModal) => void;
  closeModal: () => void;
  saveVehicle: (v: Omit<Vehicle, "id" | "createdAt">, id?: string) => string;
  deleteVehicle: (id: string) => void;
  saveFuel: (f: Omit<FuelLog, "id" | "createdAt">, id?: string) => void;
  /** Adds many fill-ups in one go; returns their ids so the import can be undone. */
  importFuel: (vehicleId: string, rows: FuelImportRow[]) => string[];
  removeFuelMany: (ids: string[]) => void;
  saveOdo: (o: Omit<OdoLog, "id" | "createdAt">, id?: string) => void;
  saveReminder: (r: Omit<Reminder, "id" | "createdAt">, id?: string) => void;
  /** Saves a service record; with `reminderId` it also rolls that reminder's next due point forward. */
  saveService: (s: Omit<ServiceLog, "id" | "createdAt">, id?: string, reminderId?: string) => void;
  /** Removes one log row. Returns it, so callers can offer undo. */
  remove: (coll: Exclude<Coll, "vehicles">, id: string) => Row | undefined;
  restore: (coll: Exclude<Coll, "vehicles">, row: Row) => void;
}

const SEL_KEY = "nexus.garage.selected";
const readSel = () => { try { return localStorage.getItem(SEL_KEY); } catch { return null; } };
const newId = () => doc(collection(db, "_ids")).id;
let unsubs: Unsubscribe[] = [];

export const useGarage = create<GarageState>((set, get) => {
  function commit(changes: Change[]) {
    const s = get();
    const next: Record<Coll, Row[]> = { vehicles: s.vehicles as unknown as Row[], fuel: s.fuel as unknown as Row[], odometer: s.odometer as unknown as Row[], service: s.service as unknown as Row[], reminders: s.reminders as unknown as Row[] };
    for (const c of changes) {
      const rest = next[c.coll].filter((x) => x.id !== c.id);
      next[c.coll] = c.data ? [...rest, { id: c.id, ...c.data }] : rest;
    }
    set(next as unknown as Partial<GarageState>);
    const uid = get().uid;
    if (DEMO || !uid || !changes.length) return;
    for (let i = 0; i < changes.length; i += 450) { // Firestore batches cap at 500 writes
      const batch = writeBatch(db);
      for (const c of changes.slice(i, i + 450)) {
        const ref = doc(db, "garage", uid, c.coll, c.id);
        if (c.data) batch.set(ref, c.data); else batch.delete(ref);
      }
      batch.commit().catch((e) => {
        console.error("Garage write failed", e);
        toast(e?.code === "permission-denied" ? "Cloud rejected the change — deploy the latest firestore.rules (see README)" : "Couldn't save to the cloud", true);
      });
    }
  }

  const strip = <T extends { id?: string }>(row: T) => { const { id: _id, ...rest } = row; void _id; return rest as Record<string, unknown>; };
  const createdAtOf = (list: { id: string; createdAt: number }[], id?: string) => (id && list.find((x) => x.id === id)?.createdAt) || Date.now();

  return {
    uid: null, vehicles: [], fuel: [], odometer: [], service: [], reminders: [], loaded: false, selectedId: readSel(), modal: null,

    start: (uid) => {
      if (get().uid === uid) return;
      get().stop();
      set({ uid, loaded: false });
      if (DEMO) { set({ ...demoGarage(), loaded: true }); return; }
      const colls: Coll[] = ["vehicles", "fuel", "odometer", "service", "reminders"];
      const got = new Set<Coll>();
      unsubs = colls.map((c) => onSnapshot(collection(db, "garage", uid, c), (snap) => {
        set({ [c]: snap.docs.map((d) => ({ id: d.id, ...d.data() })) } as unknown as Partial<GarageState>);
        got.add(c);
        if (got.size === colls.length) set({ loaded: true });
      }, (e) => { console.error(e); set({ loaded: true }); }));
    },

    stop: () => { unsubs.forEach((u) => u()); unsubs = []; set({ uid: null, vehicles: [], fuel: [], odometer: [], service: [], reminders: [], loaded: false, modal: null }); },

    select: (id) => { try { localStorage.setItem(SEL_KEY, id); } catch { /* private mode */ } set({ selectedId: id }); },
    openModal: (modal) => set({ modal }),
    closeModal: () => set({ modal: null }),

    saveVehicle: (v, id) => {
      const vid = id || newId();
      commit([{ coll: "vehicles", id: vid, data: { ...v, createdAt: createdAtOf(get().vehicles, id) } }]);
      if (!id) get().select(vid);
      return vid;
    },

    deleteVehicle: (id) => {
      const s = get();
      const changes: Change[] = [{ coll: "vehicles", id, data: null }];
      for (const c of ["fuel", "odometer", "service", "reminders"] as const) {
        for (const row of s[c] as { id: string; vehicleId: string }[]) if (row.vehicleId === id) changes.push({ coll: c, id: row.id, data: null });
      }
      commit(changes);
    },

    saveFuel: (f, id) => commit([{ coll: "fuel", id: id || newId(), data: { ...f, createdAt: createdAtOf(get().fuel, id) } }]),
    importFuel: (vehicleId, rows) => {
      const now = Date.now();
      const changes: Change[] = rows.map((r, i) => ({ coll: "fuel", id: newId(), data: { ...r, vehicleId, createdAt: now + i } }));
      commit(changes);
      return changes.map((c) => c.id);
    },
    removeFuelMany: (ids) => commit(ids.map((id) => ({ coll: "fuel" as const, id, data: null }))),
    saveOdo: (o, id) => commit([{ coll: "odometer", id: id || newId(), data: { ...o, createdAt: createdAtOf(get().odometer, id) } }]),
    saveReminder: (r, id) => commit([{ coll: "reminders", id: id || newId(), data: { ...r, createdAt: createdAtOf(get().reminders, id) } }]),

    saveService: (x, id, reminderId) => {
      const changes: Change[] = [{ coll: "service", id: id || newId(), data: { ...x, createdAt: createdAtOf(get().service, id) } }];
      const r = reminderId && get().reminders.find((y) => y.id === reminderId);
      if (r) changes.push({ coll: "reminders", id: r.id, data: strip({ ...r, ...advanceReminder(r, x.date, x.odo) }) });
      commit(changes);
    },

    remove: (coll, id) => {
      const row = (get()[coll] as unknown as Row[]).find((x) => x.id === id);
      if (row) commit([{ coll, id, data: null }]);
      return row;
    },
    restore: (coll, row) => commit([{ coll, id: row.id, data: strip(row) }]),
  };
});

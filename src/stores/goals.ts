import { create } from "zustand";
import { collection, doc, onSnapshot, writeBatch, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEMO, demoGoals } from "@/lib/demo";
import { AREAS, isoDay, type Area, type Goal, type GoalStatus, type LogPoint, type Metric, type Milestone } from "@/engine/goal-engine";
import { toast } from "./ui";

/*
 * Firestore: goals/{uid}/items/{id}
 *   { title, why, area, status, startDate, targetDate, metric, unit, start, target, current, log, milestones, createdAt, completedAt }
 * Owner-only (see firestore.rules). Changes apply locally first, then sync.
 */

export type GoalInput = Pick<Goal, "title" | "why" | "area" | "targetDate" | "metric" | "unit" | "start" | "target"> & { milestones?: Milestone[] };

interface GoalState {
  uid: string | null;
  goals: Goal[];
  loaded: boolean;
  start: (uid: string) => void;
  stop: () => void;
  add: (g: GoalInput) => string;
  update: (id: string, patch: Partial<Omit<Goal, "id" | "createdAt">>) => void;
  setStatus: (id: string, status: GoalStatus) => void;
  logValue: (id: string, v: number) => void;
  remove: (id: string) => Goal | undefined;
  restore: (g: Goal) => void;
}

let unsub: Unsubscribe | null = null;
const newId = () => doc(collection(db, "_ids")).id;
const METRICS: Metric[] = ["checklist", "number", "networth", "portfolio"];
const STATUSES: GoalStatus[] = ["active", "paused", "done", "dropped"];
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function clean(id: string, x: Record<string, unknown>): Goal {
  return {
    id,
    title: String(x.title ?? ""),
    why: typeof x.why === "string" ? x.why : "",
    area: AREAS.some((a) => a.key === x.area) ? (x.area as Area) : "personal",
    status: STATUSES.includes(x.status as GoalStatus) ? (x.status as GoalStatus) : "active",
    startDate: day(x.startDate) || isoDay(new Date(num(x.createdAt, Date.now()))),
    targetDate: day(x.targetDate),
    metric: METRICS.includes(x.metric as Metric) ? (x.metric as Metric) : "checklist",
    unit: typeof x.unit === "string" ? x.unit : "",
    start: num(x.start), target: num(x.target), current: num(x.current),
    log: Array.isArray(x.log) ? (x.log as LogPoint[]).filter((p) => p && Number.isFinite(p.t) && Number.isFinite(p.v)) : [],
    milestones: Array.isArray(x.milestones) ? (x.milestones as Milestone[]).filter((m) => m && typeof m.title === "string").map((m) => ({ id: String(m.id), title: m.title, done: m.done === true, due: day(m.due) })) : [],
    createdAt: num(x.createdAt),
    completedAt: typeof x.completedAt === "number" ? x.completedAt : null,
  };
}

export const useGoals = create<GoalState>((set, get) => {
  function commit(changes: { id: string; data: Goal | null }[]) {
    const map = new Map(get().goals.map((g) => [g.id, g]));
    for (const c of changes) { if (c.data) map.set(c.id, c.data); else map.delete(c.id); }
    set({ goals: [...map.values()] });
    const uid = get().uid;
    if (DEMO || !uid) return;
    const batch = writeBatch(db);
    for (const c of changes) {
      const ref = doc(db, "goals", uid, "items", c.id);
      if (c.data) { const { id: _id, ...rest } = c.data; void _id; batch.set(ref, rest); } else batch.delete(ref);
    }
    batch.commit().catch((e) => {
      console.error("Goal write failed", e);
      toast(e?.code === "permission-denied" ? "Cloud rejected the change — deploy the latest firestore.rules (see README)" : "Couldn't save to the cloud", true);
    });
  }
  const find = (id: string) => get().goals.find((g) => g.id === id);

  return {
    uid: null, goals: [], loaded: false,

    start: (uid) => {
      if (get().uid === uid) return;
      get().stop();
      set({ uid, loaded: false });
      if (DEMO) { set({ goals: demoGoals(), loaded: true }); return; }
      unsub = onSnapshot(collection(db, "goals", uid, "items"),
        (s) => set({ goals: s.docs.map((d) => clean(d.id, d.data())), loaded: true }),
        (e) => { console.error(e); set({ loaded: true }); });
    },

    stop: () => { if (unsub) { unsub(); unsub = null; } set({ uid: null, goals: [], loaded: false }); },

    add: (g) => {
      const id = newId();
      commit([{ id, data: {
        id, title: g.title.trim().slice(0, 140), why: g.why.slice(0, 1000), area: g.area, status: "active",
        startDate: isoDay(new Date()), targetDate: g.targetDate, metric: g.metric, unit: g.unit.slice(0, 16),
        start: g.start, target: g.target, current: g.start, log: g.metric === "number" ? [{ t: Date.now(), v: g.start }] : [],
        milestones: g.milestones || [], createdAt: Date.now(), completedAt: null,
      } }]);
      return id;
    },

    update: (id, patch) => {
      const g = find(id); if (!g) return;
      const next = { ...g, ...patch };
      next.title = next.title.slice(0, 140); next.why = next.why.slice(0, 1000);
      commit([{ id, data: next }]);
    },

    setStatus: (id, status) => {
      const g = find(id); if (!g) return;
      get().update(id, { status, completedAt: status === "done" ? (g.completedAt ?? Date.now()) : null });
    },

    logValue: (id, v) => {
      const g = find(id); if (!g) return;
      get().update(id, { current: v, log: [...g.log, { t: Date.now(), v }].slice(-365) });
    },

    remove: (id) => { const g = find(id); if (g) commit([{ id, data: null }]); return g; },
    restore: (g) => commit([{ id: g.id, data: g }]),
  };
});

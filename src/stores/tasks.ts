import { create } from "zustand";
import { collection, doc, onSnapshot, writeBatch, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEMO, demoTasks } from "@/lib/demo";
import type { Priority, Subtask, Task } from "@/engine/task-engine";
import { toast } from "./ui";

/*
 * Firestore: tasks/{uid}/items/{id}  { title, notes, done, priority, due, list, subtasks, createdAt, completedAt }
 * Owner-only (see firestore.rules). Changes apply locally first, then sync.
 */

export type TaskInput = Pick<Task, "title" | "priority" | "due" | "list"> & Partial<Pick<Task, "notes" | "subtasks">>;

interface TaskState {
  uid: string | null;
  tasks: Task[];
  loaded: boolean;
  start: (uid: string) => void;
  stop: () => void;
  add: (t: TaskInput) => string;
  update: (id: string, patch: Partial<Omit<Task, "id" | "createdAt">>) => void;
  toggle: (id: string) => void;
  remove: (id: string) => Task | undefined;
  restore: (t: Task) => void;
  clearCompleted: () => number;
}

let unsub: Unsubscribe | null = null;
const newId = () => doc(collection(db, "_ids")).id;
const PRIS: Priority[] = ["low", "med", "high"];

function clean(id: string, x: Record<string, unknown>): Task {
  return {
    id,
    title: String(x.title ?? ""),
    notes: typeof x.notes === "string" ? x.notes : "",
    done: x.done === true,
    priority: PRIS.includes(x.priority as Priority) ? (x.priority as Priority) : "med",
    due: typeof x.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.due) ? x.due : null,
    list: typeof x.list === "string" && x.list ? x.list : null,
    subtasks: Array.isArray(x.subtasks) ? (x.subtasks as Subtask[]).filter((s) => s && typeof s.title === "string").map((s) => ({ id: String(s.id), title: s.title, done: s.done === true })) : [],
    createdAt: Number(x.createdAt) || 0,
    completedAt: typeof x.completedAt === "number" ? x.completedAt : null,
  };
}

export const useTasks = create<TaskState>((set, get) => {
  /** Applies new task versions (or deletions) locally, then writes them as one batch. */
  function commit(changes: { id: string; data: Task | null }[]) {
    const map = new Map(get().tasks.map((t) => [t.id, t]));
    for (const c of changes) { if (c.data) map.set(c.id, c.data); else map.delete(c.id); }
    set({ tasks: [...map.values()] });
    const uid = get().uid;
    if (DEMO || !uid) return;
    const batch = writeBatch(db);
    for (const c of changes) {
      const ref = doc(db, "tasks", uid, "items", c.id);
      if (c.data) { const { id: _id, ...rest } = c.data; void _id; batch.set(ref, rest); } else batch.delete(ref);
    }
    batch.commit().catch((e) => {
      console.error("Task write failed", e);
      toast(e?.code === "permission-denied" ? "Cloud rejected the change — deploy the latest firestore.rules (see README)" : "Couldn't save to the cloud", true);
    });
  }
  const find = (id: string) => get().tasks.find((t) => t.id === id);

  return {
    uid: null, tasks: [], loaded: false,

    start: (uid) => {
      if (get().uid === uid) return;
      get().stop();
      set({ uid, loaded: false });
      if (DEMO) { set({ tasks: demoTasks(), loaded: true }); return; }
      unsub = onSnapshot(collection(db, "tasks", uid, "items"),
        (s) => set({ tasks: s.docs.map((d) => clean(d.id, d.data())), loaded: true }),
        (e) => { console.error(e); set({ loaded: true }); });
    },

    stop: () => { if (unsub) { unsub(); unsub = null; } set({ uid: null, tasks: [], loaded: false }); },

    add: (t) => {
      const id = newId();
      commit([{ id, data: { id, title: t.title.trim().slice(0, 200), notes: (t.notes || "").slice(0, 2000), done: false, priority: t.priority, due: t.due, list: t.list, subtasks: t.subtasks || [], createdAt: Date.now(), completedAt: null } }]);
      return id;
    },

    update: (id, patch) => {
      const t = find(id); if (!t) return;
      const next = { ...t, ...patch };
      if (patch.done !== undefined) next.completedAt = patch.done ? (t.completedAt ?? Date.now()) : null;
      next.title = next.title.slice(0, 200); next.notes = next.notes.slice(0, 2000);
      commit([{ id, data: next }]);
    },

    toggle: (id) => { const t = find(id); if (t) get().update(id, { done: !t.done }); },

    remove: (id) => { const t = find(id); if (t) commit([{ id, data: null }]); return t; },
    restore: (t) => commit([{ id: t.id, data: t }]),

    clearCompleted: () => {
      const done = get().tasks.filter((t) => t.done);
      commit(done.map((t) => ({ id: t.id, data: null })));
      return done.length;
    },
  };
});

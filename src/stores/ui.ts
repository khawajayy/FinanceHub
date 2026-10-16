import { create } from "zustand";

export interface Toast { id: number; msg: string; error?: boolean }
interface DialogReq {
  title: string;
  message?: string;
  confirmText?: string;
  danger?: boolean;
  input?: { type: "text" | "number"; placeholder?: string; initial?: string };
  resolve: (v: string | boolean | null) => void;
}

interface UiState {
  toasts: Toast[];
  dialog: DialogReq | null;
  theme: "dark" | "light";
  toast: (msg: string, error?: boolean) => void;
  dismiss: (id: number) => void;
  setDialog: (d: DialogReq | null) => void;
  toggleTheme: () => void;
}

let seq = 0;
const initialTheme = (document.documentElement.dataset.theme as "dark" | "light") || "dark";

export const useUi = create<UiState>((set, get) => ({
  toasts: [],
  dialog: null,
  theme: initialTheme,
  toast: (msg, error) => {
    const id = ++seq;
    set({ toasts: [...get().toasts.slice(-3), { id, msg, error }] });
    setTimeout(() => get().dismiss(id), 3200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setDialog: (dialog) => set({ dialog }),
  toggleTheme: () => {
    const theme = get().theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("nexus.theme", theme); } catch { /* private mode */ }
    set({ theme });
  },
}));

export const toast = (msg: string, error = false) => useUi.getState().toast(msg, error);

export function confirmDialog(title: string, message: string, opts: { confirmText?: string; danger?: boolean } = {}) {
  return new Promise<boolean>((resolve) =>
    useUi.getState().setDialog({ title, message, ...opts, resolve: (v) => resolve(v === true) }));
}

export function promptDialog(title: string, message: string, input: { type?: "text" | "number"; placeholder?: string; initial?: string } = {}) {
  return new Promise<string | null>((resolve) =>
    useUi.getState().setDialog({
      title, message, confirmText: "Confirm",
      input: { type: input.type || "text", placeholder: input.placeholder, initial: input.initial },
      resolve: (v) => resolve(typeof v === "string" ? v : null),
    }));
}

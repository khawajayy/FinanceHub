import { create } from "zustand";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, clearOfflineCache, googleProvider, writesSyncedWithin } from "@/lib/firebase";
import { DEMO } from "@/lib/demo";
import { useInvest } from "./invest";
import { confirmDialog, toast } from "./ui";

interface AuthState {
  user: User | null;
  ready: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>(() => ({
  user: null,
  ready: false,
  signIn: async () => {
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) {
      const code = (e as { code?: string }).code || "";
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") toast(`Sign-in failed: ${code || (e as Error).message}`, true);
    }
  },
  signOut: async () => {
    useInvest.getState().flush();
    const synced = await writesSyncedWithin(4000);
    if (!synced) {
      // Clearing the cache now would lose these edits, so they stay on this device until the same account returns.
      const ok = await confirmDialog("Unsynced changes", "Some changes haven't reached the cloud yet. If you sign out now, they and a copy of your data stay on this device until you sign in again.", { confirmText: "Sign out", danger: true });
      if (!ok) return;
    }
    await signOut(auth);
    if (!synced) return;
    await new Promise((resolve) => setTimeout(resolve)); // let App stop the Firestore listeners first
    await clearOfflineCache();
    location.reload();
  },
}));

if (DEMO) {
  const demoUser = { uid: "demo", displayName: "Hamza Demo", email: "demo@localhost", photoURL: null } as unknown as User;
  useAuth.setState({ user: demoUser, ready: true, signOut: async () => { location.href = location.pathname; } });
} else {
  onAuthStateChanged(auth, (user) => useAuth.setState({ user, ready: true }));
}

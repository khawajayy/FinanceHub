import { create } from "zustand";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { DEMO } from "@/lib/demo";
import { toast } from "./ui";

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
  signOut: async () => { await signOut(auth); },
}));

if (DEMO) {
  const demoUser = { uid: "demo", displayName: "Hamza Demo", email: "demo@localhost", photoURL: null } as unknown as User;
  useAuth.setState({ user: demoUser, ready: true, signOut: async () => { location.href = location.pathname; } });
} else {
  onAuthStateChanged(auth, (user) => useAuth.setState({ user, ready: true }));
}

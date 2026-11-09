import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { clearIndexedDbPersistence, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, terminate, waitForPendingWrites } from "firebase/firestore";

// Same Firebase project the old CryptoLedger used, so its ledger (ledgers/{uid}) carries over.
// These values identify the project and are not secrets: access is enforced by
// Google sign-in + firestore.rules (each user can only reach their own documents).
const firebaseConfig = {
  apiKey: "AIzaSyCufGxkKs9Lj-p_2KUSt25tlNSk5No2LeQ",
  authDomain: "investmenttracker-b544e.firebaseapp.com",
  projectId: "investmenttracker-b544e",
  storageBucket: "investmenttracker-b544e.firebasestorage.app",
  messagingSenderId: "550008652473",
  appId: "1:550008652473:web:0cecd578732c5fabcc5168",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Offline cache: the app keeps working without a connection and syncs when back online.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

/** True once every local write has reached the server; false if that takes longer than `ms` (usually offline). */
export function writesSyncedWithin(ms: number) {
  return Promise.race([
    waitForPendingWrites(db).then(() => true, () => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms)),
  ]);
}

/** Removes the offline copy of the user's data from this browser. `db` is unusable afterwards, so reload next. */
export async function clearOfflineCache() {
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (e) {
    console.warn("Couldn't clear the offline cache (is another tab open?)", e); // that tab still holds the database
  }
}

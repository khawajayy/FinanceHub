import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

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

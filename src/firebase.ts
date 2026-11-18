import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, User } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

let pendingAnonymousAuth: Promise<User> | null = null;

function waitForInitialAuthState(): Promise<User | null> {
  return new Promise((resolve) => {
    let settled = false;
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (settled) return;
        settled = true;
        unsubscribe();
        resolve(user);
      },
      () => {
        if (settled) return;
        settled = true;
        unsubscribe();
        resolve(auth.currentUser);
      }
    );
  });
}

export async function ensureAnonymousAuth(): Promise<User> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  if (!pendingAnonymousAuth) {
    pendingAnonymousAuth = (async () => {
      try {
        const restoredUser = await waitForInitialAuthState();
        if (restoredUser) {
          return restoredUser;
        }
        const credential = await signInAnonymously(auth);
        return credential.user;
      } finally {
        pendingAnonymousAuth = null;
      }
    })();
  }

  return pendingAnonymousAuth;
}

export async function testConnection(): Promise<{ ok: boolean; offline: boolean }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true, offline: false };
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return { ok: false, offline: true };
    }
    return { ok: true, offline: false };
  }
}

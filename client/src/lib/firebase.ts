import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  signOut as firebaseSignOut,
  GithubAuthProvider,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        "bm-compilor.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "bm-compilor",
  storageBucket:     "bm-compilor.firebasestorage.app",
  messagingSenderId: "98358335395",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     "G-02GCNE2DQG",
};

const firebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (firebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    console.log("[Firebase] initialized — project:", firebaseConfig.projectId);
  } catch (e) {
    console.warn("[Firebase] initialization failed:", e);
  }
} else {
  console.warn("[Firebase] not configured — running in guest mode");
}

export { auth };

const githubProvider = new GithubAuthProvider();
githubProvider.addScope("repo");

export async function signInWithGithub() {
  if (!auth) {
    throw new Error(
      "Firebase is not configured. Add VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID and VITE_FIREBASE_APP_ID to your environment."
    );
  }
  const result = await signInWithPopup(auth, githubProvider);
  const credential = GithubAuthProvider.credentialFromResult(result);
  const githubToken = credential?.accessToken ?? null;
  return { user: result.user, githubToken };
}

export async function signOut() {
  if (!auth) return;
  await firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export type { User };

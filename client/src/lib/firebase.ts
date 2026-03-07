import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  signOut as firebaseSignOut,
  GithubAuthProvider,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const githubProvider = new GithubAuthProvider();
githubProvider.addScope("repo");

export async function signInWithGithub() {
  const result = await signInWithPopup(auth, githubProvider);
  const credential = GithubAuthProvider.credentialFromResult(result);
  const githubToken = credential?.accessToken ?? null;
  return { user: result.user, githubToken };
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export type { User };

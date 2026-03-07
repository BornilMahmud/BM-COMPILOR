import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthChange, signInWithGithub, signOut, type User } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  githubToken: string | null;
  loginError: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("github_token");
    }
    return null;
  });

  useEffect(() => {
    const unsubscribe = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    setLoginError(null);
    try {
      const result = await signInWithGithub();
      if (result.githubToken) {
        setGithubToken(result.githubToken);
        localStorage.setItem("github_token", result.githubToken);
      }
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/unauthorized-domain") {
        setLoginError(
          `This domain is not authorized in Firebase. Go to Firebase Console > Authentication > Settings > Authorized domains, and add: ${window.location.hostname}`
        );
      } else if (code === "auth/popup-closed-by-user") {
        setLoginError(null);
      } else if (code === "auth/account-exists-with-different-credential") {
        setLoginError("An account already exists with the same email. Try a different login method.");
      } else {
        setLoginError(err?.message || "Login failed. Please try again.");
      }
      throw err;
    }
  };

  const logout = async () => {
    await signOut();
    setGithubToken(null);
    setLoginError(null);
    localStorage.removeItem("github_token");
  };

  return (
    <AuthContext.Provider value={{ user, loading, githubToken, loginError, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

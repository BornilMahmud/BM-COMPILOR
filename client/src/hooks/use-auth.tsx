import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthChange, signInWithGithub, signOut, type User } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  githubToken: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
    const result = await signInWithGithub();
    if (result.githubToken) {
      setGithubToken(result.githubToken);
      localStorage.setItem("github_token", result.githubToken);
    }
  };

  const logout = async () => {
    await signOut();
    setGithubToken(null);
    localStorage.removeItem("github_token");
  };

  return (
    <AuthContext.Provider value={{ user, loading, githubToken, login, logout }}>
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

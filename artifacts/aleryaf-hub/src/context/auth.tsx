import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AuthUser {
  username: string;
  isAdmin: boolean;
  canUseTurkishInvoices: boolean;
}

interface LoginResult {
  ok: boolean;
  error?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchCurrentUser() {
  const response = await fetch(`${BASE}/api/auth/me`, {
    credentials: "same-origin",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { user?: AuthUser | null };
  return data.user ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const refreshUser = async () => {
    try {
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    refreshUser().catch(() => {
      setUser(null);
      setReady(true);
    });
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    ready,
    login: async (username: string, password: string) => {
      const response = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { user?: AuthUser; error?: string };

      if (!response.ok || !data.user) {
        return { ok: false, error: data.error || "خطأ في تسجيل الدخول" };
      }

      setUser(data.user);
      return { ok: true };
    },
    logout: async () => {
      try {
        await fetch(`${BASE}/api/auth/logout`, {
          method: "POST",
          credentials: "same-origin",
        });
      } finally {
        setUser(null);
      }
    },
    refreshUser,
  }), [user, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

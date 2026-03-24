import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const USER_PASSWORD = "الارياف";
const ADMIN_USERNAME = "الارياف";
const ADMIN_PASSWORD = "admin5713";
const STORAGE_KEY = "aleryaf_auth";

interface AuthUser {
  username: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = (username: string, password: string) => {
    const trimUser = username.trim();
    const trimPass = password.trim();

    if (!trimUser) return { ok: false, error: "يرجى إدخال اسم المستخدم" };
    if (!trimPass) return { ok: false, error: "يرجى إدخال كلمة المرور" };

    let authUser: AuthUser | null = null;

    if (trimUser === ADMIN_USERNAME && trimPass === ADMIN_PASSWORD) {
      authUser = { username: trimUser, isAdmin: true };
    } else if (trimUser === ADMIN_USERNAME) {
      return { ok: false, error: "كلمة المرور غير صحيحة" };
    } else if (trimPass === USER_PASSWORD) {
      authUser = { username: trimUser, isAdmin: false };
    } else {
      return { ok: false, error: "كلمة المرور غير صحيحة" };
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    setUser(authUser);
    return { ok: true };
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

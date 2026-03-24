import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const USER_PASSWORD = "الارياف";
const ADMIN_USERNAME = "الارياف";
const ADMIN_PASSWORD = "admin5713";
const STORAGE_KEY = "aleryaf_auth";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

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

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.username === "string" &&
    typeof candidate.isAdmin === "boolean"
  );
}

function readCookieValue(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;
  const match = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(prefix));

  return match ? match.slice(prefix.length) : null;
}

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const localValue = window.localStorage.getItem(STORAGE_KEY);
    if (localValue) {
      const parsed = JSON.parse(localValue);
      if (isAuthUser(parsed)) {
        return parsed;
      }
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  try {
    const cookieValue = readCookieValue(STORAGE_KEY);
    if (!cookieValue) {
      return null;
    }

    const parsed = JSON.parse(decodeURIComponent(cookieValue));
    return isAuthUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persistUser(user: AuthUser | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!user) {
    window.localStorage.removeItem(STORAGE_KEY);
    document.cookie = `${STORAGE_KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
    return;
  }

  const serialized = JSON.stringify(user);
  window.localStorage.setItem(STORAGE_KEY, serialized);
  document.cookie = `${STORAGE_KEY}=${encodeURIComponent(serialized)}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  useEffect(() => {
    const syncAuthState = () => {
      setUser(readStoredUser());
    };

    syncAuthState();
    window.addEventListener("storage", syncAuthState);
    window.addEventListener("focus", syncAuthState);

    return () => {
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("focus", syncAuthState);
    };
  }, []);

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

    persistUser(authUser);
    setUser(authUser);
    return { ok: true };
  };

  const logout = () => {
    persistUser(null);
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

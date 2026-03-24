import { useState } from "react";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";
import { APP_NAME_AR, APP_NAME_EN } from "@/lib/branding";

export function LoginPage() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = login(username, password);
      if (result.ok) {
        navigate("/");
      } else {
        setError(result.error || "خطأ في تسجيل الدخول");
      }
      setLoading(false);
    }, 300);
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-background flex items-center justify-center p-4"
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground mb-1">
            {APP_NAME_AR}
          </h1>
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            {APP_NAME_EN}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-panel border border-white/10 rounded-2xl p-6 flex flex-col gap-4"
        >
          <h2 className="text-lg font-bold text-foreground mb-1">تسجيل الدخول</h2>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">اسم المستخدم</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="أدخل اسم المستخدم"
              autoComplete="username"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="أدخل كلمة المرور"
              autoComplete="current-password"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "جاري الدخول..." : "دخول"}
          </button>
        </form>
      </div>
    </div>
  );
}

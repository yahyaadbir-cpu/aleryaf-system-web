import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Layout } from "@/components/layout";
import { formatDate } from "@/lib/format";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface LogEntry {
  id: number;
  username: string;
  action: string;
  details: string | null;
  createdAt: string;
}

export function AdminLogPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!user?.isAdmin) navigate("/");
  }, [user, navigate]);

  const { data, isLoading } = useQuery<LogEntry[]>({
    queryKey: ["activity-log"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/activity-log`);
      if (!res.ok) throw new Error("فشل في جلب السجل");
      return res.json();
    },
    enabled: !!user?.isAdmin,
    refetchInterval: 15000,
  });

  if (!user?.isAdmin) return null;

  return (
    <Layout>
      <div className="mx-auto max-w-4xl" dir="rtl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-foreground">سجل النشاط</h1>
          <p className="text-sm text-muted-foreground mt-1">جميع العمليات التي قام بها المستخدمون</p>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">جاري التحميل...</div>
        ) : !data?.length ? (
          <div className="py-16 text-center text-muted-foreground">لا توجد سجلات بعد</div>
        ) : (
          <div className="flex flex-col gap-2">
            {[...data].reverse().map((entry) => (
              <div
                key={entry.id}
                className="glass-panel border border-white/10 rounded-xl px-4 py-3 flex items-start gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-primary bg-primary/10 rounded px-2 py-0.5">
                      {entry.username}
                    </span>
                    <span className="text-sm font-medium text-foreground">{entry.action}</span>
                  </div>
                  {entry.details && (
                    <p className="text-xs text-muted-foreground mt-1">{entry.details}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground/60 shrink-0 mt-0.5 tabular-nums" dir="ltr">
                  {new Date(entry.createdAt).toLocaleString("ar-SA")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

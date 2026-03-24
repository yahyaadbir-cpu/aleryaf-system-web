import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface LogEntry {
  id: number;
  username: string;
  action: string;
  details: string | null;
  createdAt: string;
}

type ActivityType = "all" | "invoice" | "item" | "branch" | "warehouse" | "inventory" | "other";

function classifyLogEntry(entry: LogEntry): ActivityType {
  const text = `${entry.action} ${entry.details ?? ""}`;

  if (text.includes("فاتورة")) return "invoice";
  if (text.includes("منتج")) return "item";
  if (text.includes("مستودع")) return "warehouse";
  if (text.includes("فرع")) return "branch";
  if (text.includes("مخزون")) return "inventory";

  return "other";
}

function getActivityTypeLabel(type: ActivityType) {
  switch (type) {
    case "invoice":
      return "فاتورة";
    case "item":
      return "منتج";
    case "branch":
      return "فرع";
    case "warehouse":
      return "مستودع";
    case "inventory":
      return "مخزون";
    case "other":
      return "أخرى";
    default:
      return "الكل";
  }
}

export function AdminLogPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activityType, setActivityType] = useState<ActivityType>("all");
  const [usernameFilter, setUsernameFilter] = useState("all");

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

  const usernames = useMemo(() => {
    return Array.from(new Set((data ?? []).map((entry) => entry.username))).sort((a, b) => a.localeCompare(b, "ar"));
  }, [data]);

  const filteredData = useMemo(() => {
    const source = [...(data ?? [])].reverse();
    return source.filter((entry) => {
      const matchesType = activityType === "all" || classifyLogEntry(entry) === activityType;
      const matchesUser = usernameFilter === "all" || entry.username === usernameFilter;
      return matchesType && matchesUser;
    });
  }, [activityType, data, usernameFilter]);

  if (!user?.isAdmin) return null;

  return (
    <Layout>
      <div className="mx-auto max-w-4xl" dir="rtl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-foreground">سجل النشاط</h1>
          <p className="text-sm text-muted-foreground mt-1">جميع العمليات التي قام بها المستخدمون</p>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Select value={activityType} onValueChange={(value) => setActivityType(value as ActivityType)}>
            <SelectTrigger className="bg-black/30 border-white/10">
              <SelectValue placeholder="فلترة حسب النوع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل العمليات</SelectItem>
              <SelectItem value="invoice">فاتورة</SelectItem>
              <SelectItem value="item">منتج</SelectItem>
              <SelectItem value="branch">فرع</SelectItem>
              <SelectItem value="warehouse">مستودع</SelectItem>
              <SelectItem value="inventory">مخزون</SelectItem>
              <SelectItem value="other">أخرى</SelectItem>
            </SelectContent>
          </Select>

          <Select value={usernameFilter} onValueChange={setUsernameFilter}>
            <SelectTrigger className="bg-black/30 border-white/10">
              <SelectValue placeholder="فلترة حسب المستخدم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المستخدمين</SelectItem>
              {usernames.map((username) => (
                <SelectItem key={username} value={username}>
                  {username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">جاري التحميل...</div>
        ) : !data?.length ? (
          <div className="py-16 text-center text-muted-foreground">لا توجد سجلات بعد</div>
        ) : !filteredData.length ? (
          <div className="py-16 text-center text-muted-foreground">لا توجد نتائج مطابقة للفلاتر الحالية</div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredData.map((entry) => (
              <div
                key={entry.id}
                className="glass-panel border border-white/10 rounded-xl px-4 py-3 flex items-start gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-primary bg-primary/10 rounded px-2 py-0.5">
                      {entry.username}
                    </span>
                    <span className="text-[10px] font-medium text-slate-300 bg-white/5 rounded px-2 py-0.5">
                      {getActivityTypeLabel(classifyLogEntry(entry))}
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

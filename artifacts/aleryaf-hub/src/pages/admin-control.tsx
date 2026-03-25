import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Bell, Send, Shield, Terminal } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth";
import { logActivity } from "@/lib/activity";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const DEFAULT_NOTIFICATION_TITLE = "ALERYAF";
const DEFAULT_NOTIFICATION_URL = "/";

type CommandAudience = "all" | "admin";

type ParsedCommand = {
  audience: CommandAudience;
  title: string;
  body: string;
  url: string;
};

type ConsoleEntry = {
  id: number;
  type: "info" | "success" | "error";
  text: string;
};

const EXAMPLES = [
  "send noti all تم تحديث النظام بنجاح",
  "send admin all تم حذف فاتورة رقم INV0004",
];

function parseCommand(raw: string): ParsedCommand {
  const text = raw.trim();
  const lowered = text.toLowerCase();
  const allPrefix = "send noti all ";
  const adminPrefix = "send admin all ";

  const isAll = lowered.startsWith(allPrefix);
  const isAdmin = lowered.startsWith(adminPrefix);

  if (!isAll && !isAdmin) {
    throw new Error("الأمر غير معروف. استخدم: send noti all ... أو send admin all ...");
  }

  const body = text.slice(isAll ? allPrefix.length : adminPrefix.length).trim();
  if (!body) {
    throw new Error("اكتب الرسالة بعد الأمر مباشرة.");
  }

  return {
    audience: isAll ? "all" : "admin",
    title: DEFAULT_NOTIFICATION_TITLE,
    body,
    url: DEFAULT_NOTIFICATION_URL,
  };
}

export function AdminControlPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [command, setCommand] = useState(EXAMPLES[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([
    { id: 1, type: "info", text: "الأوامر المتاحة: send noti all ... و send admin all ..." },
  ]);

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate("/");
    }
  }, [navigate, user]);

  const commandPreview = useMemo(() => {
    try {
      return parseCommand(command);
    } catch {
      return null;
    }
  }, [command]);

  if (!user?.isAdmin) return null;

  const pushConsole = (entry: Omit<ConsoleEntry, "id">) => {
    setConsoleEntries((current) => [
      { id: Date.now() + Math.floor(Math.random() * 1000), ...entry },
      ...current,
    ]);
  };

  const runCommand = async () => {
    const trimmed = command.trim();
    if (!trimmed || isRunning) return;

    setIsRunning(true);
    pushConsole({ type: "info", text: `> ${trimmed}` });

    try {
      const parsed = parseCommand(trimmed);
      const response = await fetch(`${BASE}/api/notifications/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      if (!response.ok) {
        throw new Error("فشل إرسال الإشعار");
      }

      await logActivity(
        user.username,
        parsed.audience === "all" ? "إرسال إشعار عام" : "إرسال إشعار إداري",
        parsed.body,
      );

      pushConsole({
        type: "success",
        text:
          parsed.audience === "all"
            ? `تم إرسال الإشعار لكل المستخدمين: ${parsed.body}`
            : `تم إرسال الإشعار للإدارة فقط: ${parsed.body}`,
      });

      toast({
        title: "تم تنفيذ الأمر",
        description:
          parsed.audience === "all"
            ? "تم إرسال الإشعار إلى كل الأجهزة المشتركة."
            : "تم إرسال الإشعار إلى أجهزة الإدارة فقط.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل تنفيذ الأمر";
      pushConsole({ type: "error", text: message });
      toast({
        title: "تعذر تنفيذ الأمر",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-6" dir="rtl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">مركز الأوامر</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              مساحة إدارية سريعة لإرسال التنبيهات بدون صيغة معقدة.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
            <Shield className="h-4 w-4" />
            مدراء فقط
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-3xl border border-white/10 bg-card/70 p-5 shadow-2xl shadow-black/20">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Terminal className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">لوحة الأوامر</h2>
                <p className="text-xs text-muted-foreground">اكتب الرسالة بعد الأمر مباشرة ثم نفّذها.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-3 shadow-inner shadow-black/20">
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-emerald-300/80">
                <Terminal className="h-3.5 w-3.5" />
                admin shell
              </div>
              <Textarea
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                spellCheck={false}
                className="min-h-32 border-0 bg-transparent p-0 font-mono text-sm leading-7 text-foreground shadow-none focus-visible:ring-0"
                placeholder="send noti all اكتب الرسالة هنا"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={runCommand}
                disabled={isRunning}
                className="rounded-2xl bg-primary px-5 text-white hover:bg-primary/90"
              >
                <Send className="ml-2 h-4 w-4" />
                {isRunning ? "جارٍ التنفيذ..." : "تنفيذ الأمر"}
              </Button>
              {EXAMPLES.map((example) => (
                <Button
                  key={example}
                  type="button"
                  variant="outline"
                  onClick={() => setCommand(example)}
                  className="rounded-2xl border-white/10 bg-white/[0.03] text-xs text-muted-foreground hover:bg-white/10 hover:text-foreground"
                >
                  مثال جاهز
                </Button>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-card/70 p-5">
              <div className="mb-3 flex items-center gap-2 text-primary">
                <Bell className="h-4 w-4" />
                <h2 className="text-sm font-bold">الأوامر المدعومة</h2>
              </div>
              <div className="space-y-3 text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="font-mono text-xs text-emerald-300">send noti all الرسالة</p>
                  <p className="mt-1 text-xs text-muted-foreground">يرسل إشعارًا لكل المستخدمين المشتركين.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="font-mono text-xs text-amber-300">send admin all الرسالة</p>
                  <p className="mt-1 text-xs text-muted-foreground">يرسل إشعارًا لأجهزة الإدارة فقط.</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-card/70 p-5">
              <h2 className="mb-3 text-sm font-bold text-foreground">معاينة التنفيذ</h2>
              <div className="space-y-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs text-muted-foreground">الوجهة</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {commandPreview ? (commandPreview.audience === "all" ? "كل المستخدمين" : "الإدارة فقط") : "غير صالح"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs text-muted-foreground">الرسالة</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{commandPreview?.body ?? "--"}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-white/10 bg-card/70 p-5">
          <h2 className="mb-4 text-sm font-bold text-foreground">مخرجات التنفيذ</h2>
          <div className="rounded-2xl border border-white/10 bg-black/45 p-3">
            <div className="space-y-2 font-mono text-xs">
              {consoleEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={
                    entry.type === "success"
                      ? "text-emerald-300"
                      : entry.type === "error"
                        ? "text-rose-300"
                        : "text-slate-300"
                  }
                >
                  {entry.text}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}

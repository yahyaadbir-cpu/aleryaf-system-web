import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { BookOpenText, KeyRound, Lock, ShieldAlert } from "lucide-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type HandbookSecrets = {
  login: {
    adminUsername: string;
    adminPassword: string;
    employeeBootstrapPassword: string;
  };
  infrastructure: {
    appDomain: string;
    localFrontend: string;
    localApi: string;
  };
  operations: {
    databaseMigrationsCommand: string;
    frontendDevCommand: string;
    apiDevCommand: string;
  };
  notes: string[];
};

const handbookSections = [
  {
    title: "فهم سريع للنظام",
    items: [
      "لوحة التحكم تعرض المبيعات والأرباح والمخزون والفواتير حسب الفرع والعملات.",
      "الفواتير هي قلب النظام: إنشاء، تعديل، طباعة عادية، وطباعة DX للإدارة فقط.",
      "DX تعني نسخة/واجهة طباعة خاصة وسريعة للإدارة فقط، وتُستخدم عندما تحتاج شكل التشغيل الداخلي بدل الطباعة العادية.",
      "إدارة المستخدمين مخصصة للمدير فقط، ومنها التفعيل والتعطيل وتغيير كلمات المرور ومنح صلاحية الطباعة التركية.",
    ],
  },
  {
    title: "أهم الصفحات",
    items: [
      "لوحة التحكم: متابعة الأرقام اليومية والشهرية بسرعة.",
      "الفواتير: إنشاء وإدارة وطباعة ومراجعة الفواتير.",
      "المنتجات والفروع والمخزون: إدارة البيانات الأساسية.",
      "مركز الأوامر: إرسال إشعارات وتعديل صلاحيات معينة بسرعة.",
      "إدارة المستخدمين: إنشاء الحسابات وتغيير الصلاحيات وكلمات المرور.",
    ],
  },
  {
    title: "أوامر التشغيل اليومية",
    items: [
      "لإرسال إشعار للجميع: send noti all الرسالة",
      "لإرسال إشعار للإدارة فقط: send admin all الرسالة",
      "لمنح الطباعة التركية: set access to اسم_المستخدم turkish print",
      "لسحب الطباعة التركية: remove access from اسم_المستخدم turkish print",
    ],
  },
  {
    title: "لو استلم شخص بعدك",
    items: [
      "ابدأ من هذا الدليل ثم راجع إدارة المستخدمين وسجل النشاط ومركز الأوامر.",
      "تحقق من Railway وPostgres قبل أي تعديل كبير أو تحديث.",
      "لا تغيّر كلمات المرور الحساسة أو المتغيرات السرية بدون تدوين التغيير هنا أو في مكان آمن متفق عليه.",
    ],
  },
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "حدث خطأ في الطلب");
  }

  return response.json() as Promise<T>;
}

export function AdminHandbookPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [masterPassword, setMasterPassword] = useState("");
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [secrets, setSecrets] = useState<HandbookSecrets | null>(null);

  useEffect(() => {
    if (user && !user.isAdmin) {
      navigate("/");
    }
  }, [navigate, user]);

  useEffect(() => {
    if (!user?.isAdmin) return;

    void api<{ enabled: boolean }>("/api/handbook/status")
      .then((data) => setIsConfigured(data.enabled))
      .catch(() => setIsConfigured(false));
  }, [user]);

  const secretCards = useMemo(() => {
    if (!secrets) return [];

    return [
      {
        title: "بيانات الدخول",
        rows: [
          ["اسم مستخدم الإدارة", secrets.login.adminUsername],
          ["كلمة مرور الإدارة", secrets.login.adminPassword],
          ["كلمة مرور الموظف الافتراضية", secrets.login.employeeBootstrapPassword],
        ],
      },
      {
        title: "روابط مهمة",
        rows: [
          ["رابط النظام", secrets.infrastructure.appDomain],
          ["الواجهة محليًا", secrets.infrastructure.localFrontend],
          ["الـ API محليًا", secrets.infrastructure.localApi],
        ],
      },
      {
        title: "أوامر مهمة",
        rows: [
          ["تطبيق تغييرات قاعدة البيانات", secrets.operations.databaseMigrationsCommand],
          ["تشغيل الواجهة", secrets.operations.frontendDevCommand],
          ["تشغيل الـ API", secrets.operations.apiDevCommand],
        ],
      },
    ];
  }, [secrets]);

  const unlockSecrets = async () => {
    if (!masterPassword.trim()) {
      toast({ title: "أدخل كلمة المرور", description: "القسم السري يحتاج كلمة مرور منفصلة.", variant: "destructive" });
      return;
    }

    setIsUnlocking(true);
    try {
      const data = await api<{ secrets: HandbookSecrets }>("/api/handbook/unlock", {
        method: "POST",
        body: JSON.stringify({ password: masterPassword }),
      });

      setSecrets(data.secrets);
      toast({ title: "تم فتح القسم السري", description: "المعلومات الحساسة ظاهرة الآن." });
      setMasterPassword("");
    } catch (error) {
      toast({
        title: "تعذر فتح القسم السري",
        description: error instanceof Error ? error.message : "فشل التحقق من كلمة المرور",
        variant: "destructive",
      });
    } finally {
      setIsUnlocking(false);
    }
  };

  if (!user?.isAdmin) return null;

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold text-foreground">دليل التشغيل</h1>
          <p className="text-sm text-muted-foreground">
            مرجع سريع لفهم المشروع وتشغيله وتسليمه لشخص آخر، مع قسم سري محمي للمعلومات الحساسة.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="glass-panel border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpenText className="h-5 w-5 text-primary" />
                الدليل العام
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {handbookSections.map((section) => (
                <div key={section.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <h2 className="text-base font-bold text-foreground">{section.title}</h2>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-muted-foreground">
                    {section.items.map((item) => (
                      <li key={item} className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-panel border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-300" />
                القسم السري
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-amber-400/15 bg-amber-500/10 p-4 text-sm text-amber-100">
                هذا القسم مخصص للمعلومات الحساسة فقط: بيانات دخول الإدارة، أوامر التشغيل المهمة، وملاحظات التسليم.
              </div>

              {isConfigured === false && (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                  لم يتم ضبط كلمة مرور منفصلة للدليل بعد. أضف المتغير HANDBOOK_MASTER_PASSWORD في السيرفر لفتح القسم السري.
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">كلمة مرور الدليل السري</label>
                <Input
                  type="password"
                  value={masterPassword}
                  onChange={(event) => setMasterPassword(event.target.value)}
                  placeholder="أدخل كلمة المرور المنفصلة"
                  className="bg-black/40"
                />
              </div>

              <Button onClick={() => void unlockSecrets()} disabled={isUnlocking || isConfigured === false} className="w-full rounded-2xl">
                <KeyRound className="ml-2 h-4 w-4" />
                {isUnlocking ? "جارٍ الفتح..." : "فتح القسم السري"}
              </Button>

              {!secrets ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                  بعد التحقق، ستظهر هنا كلمات المرور المهمة وروابط التشغيل والأوامر الأساسية لتسليم المشروع بشكل مرتب.
                </div>
              ) : (
                <div className="space-y-4">
                  {secretCards.map((card) => (
                    <div key={card.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <h3 className="text-sm font-bold text-foreground">{card.title}</h3>
                      <div className="mt-3 space-y-2">
                        {card.rows.map(([label, value]) => (
                          <div
                            key={label}
                            className="flex flex-col gap-1 rounded-xl border border-white/5 bg-black/25 px-3 py-3"
                          >
                            <span className="text-xs font-medium text-muted-foreground">{label}</span>
                            <code className="overflow-x-auto text-sm text-slate-100">{value}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/10 p-4">
                    <div className="mb-3 flex items-center gap-2 text-cyan-100">
                      <ShieldAlert className="h-4 w-4" />
                      <span className="text-sm font-bold">ملاحظات حساسة</span>
                    </div>
                    <ul className="space-y-2 text-sm text-cyan-50">
                      {secrets.notes.map((note) => (
                        <li key={note} className="rounded-xl border border-cyan-300/10 bg-black/15 px-3 py-2">
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

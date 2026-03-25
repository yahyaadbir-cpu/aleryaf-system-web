import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Shield, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activity";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ManagedUser = {
  id: number;
  username: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "لم يسجل دخول بعد";
  return new Intl.DateTimeFormat("ar", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

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

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function AdminUsersPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [passwordDialogUser, setPasswordDialogUser] = useState<ManagedUser | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [replacementPassword, setReplacementPassword] = useState("");

  useEffect(() => {
    if (user && !user.isAdmin) {
      navigate("/");
    }
  }, [navigate, user]);

  const { data: users, isLoading } = useQuery<ManagedUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => api<ManagedUser[]>("/api/users"),
    enabled: !!user?.isAdmin,
  });

  const sortedUsers = useMemo(() => {
    return [...(users ?? [])].sort((a, b) => {
      if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
      return a.username.localeCompare(b.username, "ar");
    });
  }, [users]);

  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const createUserMutation = useMutation({
    mutationFn: async () =>
      api<ManagedUser>("/api/users", {
        method: "POST",
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          isAdmin: newIsAdmin,
        }),
      }),
    onSuccess: async (created) => {
      toast({ title: "تم إنشاء المستخدم", description: `تم إنشاء الحساب ${created.username}` });
      if (user) {
        await logActivity(
          user.username,
          "إنشاء مستخدم",
          `المستخدم: ${created.username} | الصلاحية: ${created.isAdmin ? "مدير" : "مستخدم"}`,
        );
      }
      setNewUsername("");
      setNewPassword("");
      setNewIsAdmin(false);
      setIsCreateOpen(false);
      refreshUsers();
    },
    onError: (error) => {
      toast({
        title: "تعذر إنشاء المستخدم",
        description: error instanceof Error ? error.message : "فشل إنشاء المستخدم",
        variant: "destructive",
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ managedUser, nextStatus }: { managedUser: ManagedUser; nextStatus: boolean }) =>
      api<ManagedUser>(`/api/users/${managedUser.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextStatus }),
      }),
    onSuccess: async (updated, variables) => {
      toast({
        title: updated.isActive ? "تم تفعيل المستخدم" : "تم تعطيل المستخدم",
        description: updated.username,
      });
      if (user) {
        await logActivity(
          user.username,
          updated.isActive ? "تفعيل مستخدم" : "تعطيل مستخدم",
          `المستخدم: ${variables.managedUser.username}`,
        );
      }
      refreshUsers();
    },
    onError: (error) => {
      toast({
        title: "تعذر تحديث حالة المستخدم",
        description: error instanceof Error ? error.message : "فشل تحديث الحالة",
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () =>
      api<void>(`/api/users/${passwordDialogUser?.id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: replacementPassword }),
      }),
    onSuccess: async () => {
      if (!passwordDialogUser) return;
      toast({
        title: "تم تغيير كلمة المرور",
        description: passwordDialogUser.username,
      });
      if (user) {
        await logActivity(user.username, "تغيير كلمة مرور مستخدم", `المستخدم: ${passwordDialogUser.username}`);
      }
      setReplacementPassword("");
      setPasswordDialogUser(null);
    },
    onError: (error) => {
      toast({
        title: "تعذر تغيير كلمة المرور",
        description: error instanceof Error ? error.message : "فشل تغيير كلمة المرور",
        variant: "destructive",
      });
    },
  });

  if (!user?.isAdmin) return null;

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">إدارة المستخدمين</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              عرض الحسابات المحفوظة، تفعيل وتعطيل المستخدمين، وتغيير كلمات المرور.
            </p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl bg-primary text-white hover:bg-primary/90">
                <UserPlus className="ml-2 h-4 w-4" />
                مستخدم جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-white/10 sm:max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>إنشاء مستخدم جديد</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">اسم المستخدم</label>
                  <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="bg-black/40" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">كلمة المرور</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-black/40"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setNewIsAdmin((value) => !value)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                    newIsAdmin
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-white/10 bg-white/[0.03] text-muted-foreground"
                  }`}
                >
                  <span>صلاحية مدير</span>
                  {newIsAdmin ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                </button>

                <Button
                  onClick={() => createUserMutation.mutate()}
                  disabled={!newUsername.trim() || !newPassword.trim() || createUserMutation.isPending}
                  className="w-full rounded-2xl"
                >
                  {createUserMutation.isPending ? "جارٍ الإنشاء..." : "حفظ المستخدم"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="glass-panel border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">إجمالي المستخدمين</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold text-foreground">{users?.length ?? 0}</CardContent>
          </Card>
          <Card className="glass-panel border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">المفعّلون</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold text-emerald-400">
              {users?.filter((entry) => entry.isActive).length ?? 0}
            </CardContent>
          </Card>
          <Card className="glass-panel border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">المدراء</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold text-primary">
              {users?.filter((entry) => entry.isAdmin).length ?? 0}
            </CardContent>
          </Card>
        </div>

        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              قائمة المستخدمين
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">جارٍ تحميل المستخدمين...</div>
            ) : !sortedUsers.length ? (
              <div className="py-12 text-center text-muted-foreground">لا يوجد مستخدمون بعد</div>
            ) : (
              <div className="space-y-3">
                {sortedUsers.map((managedUser) => (
                  <div
                    key={managedUser.id}
                    className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold text-foreground">{managedUser.username}</span>
                        <span
                          className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                            managedUser.isAdmin
                              ? "bg-primary/15 text-primary"
                              : "bg-white/10 text-slate-300"
                          }`}
                        >
                          {managedUser.isAdmin ? "مدير" : "مستخدم"}
                        </span>
                        <span
                          className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                            managedUser.isActive
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-rose-500/15 text-rose-300"
                          }`}
                        >
                          {managedUser.isActive ? "مفعّل" : "معطّل"}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <p>آخر دخول: {formatDate(managedUser.lastLoginAt)}</p>
                        <p>تاريخ الإنشاء: {formatDate(managedUser.createdAt)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          toggleStatusMutation.mutate({
                            managedUser,
                            nextStatus: !managedUser.isActive,
                          })
                        }
                        disabled={toggleStatusMutation.isPending}
                        className="rounded-2xl border-white/10 bg-white/[0.03]"
                      >
                        {managedUser.isActive ? "تعطيل" : "تفعيل"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setReplacementPassword("");
                          setPasswordDialogUser(managedUser);
                        }}
                        className="rounded-2xl border-white/10 bg-white/[0.03]"
                      >
                        <KeyRound className="ml-2 h-4 w-4" />
                        تغيير كلمة المرور
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!passwordDialogUser} onOpenChange={(open) => !open && setPasswordDialogUser(null)}>
          <DialogContent className="glass-panel border-white/10 sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>تغيير كلمة المرور</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-muted-foreground">
                المستخدم: <span className="font-bold text-foreground">{passwordDialogUser?.username}</span>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">كلمة المرور الجديدة</label>
                <Input
                  type="password"
                  value={replacementPassword}
                  onChange={(e) => setReplacementPassword(e.target.value)}
                  className="bg-black/40"
                />
              </div>

              <Button
                onClick={() => changePasswordMutation.mutate()}
                disabled={!replacementPassword.trim() || changePasswordMutation.isPending}
                className="w-full rounded-2xl"
              >
                {changePasswordMutation.isPending ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

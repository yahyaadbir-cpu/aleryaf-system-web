import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Link2, Shield, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activity";
import { apiFetch } from "@/lib/http";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ManagedUser = {
  id: number;
  username: string;
  isAdmin: boolean;
  isActive: boolean;
  canUseTurkishInvoices: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

type PendingInvite = {
  id: number;
  invitedUsername: string;
  isAdmin: boolean;
  canUseTurkishInvoices: boolean;
  createdByUsername: string | null;
  expiresAt: string;
  createdAt: string;
  redeemedAt: string | null;
  revokedAt: string | null;
  isRedeemable: boolean;
  token?: string;
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
  const response = await apiFetch(path, {
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
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [passwordDialogUser, setPasswordDialogUser] = useState<ManagedUser | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newCanUseTurkishInvoices, setNewCanUseTurkishInvoices] = useState(false);
  const [inviteExpiresInHours, setInviteExpiresInHours] = useState("24");
  const [latestInviteToken, setLatestInviteToken] = useState("");
  const [replacementPassword, setReplacementPassword] = useState("");
  const [deleteDialogUser, setDeleteDialogUser] = useState<ManagedUser | null>(null);

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

  const { data: invites } = useQuery<PendingInvite[]>({
    queryKey: ["admin-user-invites"],
    queryFn: () => api<PendingInvite[]>("/api/users/invites"),
    enabled: !!user?.isAdmin,
  });

  const sortedUsers = useMemo(() => {
    return [...(users ?? [])].sort((a, b) => {
      if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
      return a.username.localeCompare(b.username, "ar");
    });
  }, [users]);

  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  const refreshInvites = () => queryClient.invalidateQueries({ queryKey: ["admin-user-invites"] });

  const createInviteMutation = useMutation({
    mutationFn: async () =>
      api<PendingInvite & { token: string }>("/api/users/invites", {
        method: "POST",
        body: JSON.stringify({
          username: newUsername,
          isAdmin: newIsAdmin,
          canUseTurkishInvoices: newCanUseTurkishInvoices,
          expiresInHours: Number(inviteExpiresInHours || "24"),
        }),
      }),
    onSuccess: async (created) => {
      setLatestInviteToken(created.token);
      toast({ title: "تم إنشاء الدعوة", description: `الدعوة مخصصة للمستخدم ${created.invitedUsername}` });
      if (user) {
        await logActivity(
          user.username,
          "إنشاء دعوة مستخدم",
          `المستخدم: ${created.invitedUsername} | الصلاحية: ${created.isAdmin ? "مدير" : "مستخدم"}`,
        );
      }
      setNewUsername("");
      setNewIsAdmin(false);
      setNewCanUseTurkishInvoices(false);
      setInviteExpiresInHours("24");
      refreshInvites();
    },
    onError: (error) => {
      toast({
        title: "تعذر إنشاء الدعوة",
        description: error instanceof Error ? error.message : "فشل إنشاء الدعوة",
        variant: "destructive",
      });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (inviteId: number) => api<void>(`/api/users/invites/${inviteId}/revoke`, { method: "POST" }),
    onSuccess: async () => {
      toast({ title: "تم إلغاء الدعوة" });
      refreshInvites();
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
  });

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ managedUser, nextValue }: { managedUser: ManagedUser; nextValue: boolean }) =>
      api<ManagedUser>(`/api/users/${managedUser.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ isAdmin: nextValue }),
      }),
    onSuccess: async (updated) => {
      toast({
        title: updated.isAdmin ? "تم منح صلاحية المدير" : "تم سحب صلاحية المدير",
        description: updated.username,
      });
      refreshUsers();
    },
  });

  const revokeSessionsMutation = useMutation({
    mutationFn: async (managedUser: ManagedUser) => api<void>(`/api/users/${managedUser.id}/revoke-sessions`, { method: "POST" }),
    onSuccess: async (_value, managedUser) => {
      toast({ title: "تم إبطال الجلسات", description: managedUser.username });
      refreshUsers();
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
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (managedUser: ManagedUser) =>
      api<void>(`/api/users/${managedUser.id}`, {
        method: "DELETE",
      }),
    onSuccess: async (_value, managedUser) => {
      toast({
        title: "تم حذف المستخدم",
        description: managedUser.username,
      });
      if (user) {
        await logActivity(user.username, "حذف مستخدم", `المستخدم: ${managedUser.username}`);
      }
      setDeleteDialogUser(null);
      refreshUsers();
    },
    onError: (error) => {
      toast({
        title: "تعذر حذف المستخدم",
        description: error instanceof Error ? error.message : "فشل حذف المستخدم",
        variant: "destructive",
      });
    },
  });

  const toggleTurkishInvoiceMutation = useMutation({
    mutationFn: async ({
      managedUser,
      nextValue,
    }: {
      managedUser: ManagedUser;
      nextValue: boolean;
    }) =>
      api<ManagedUser>(`/api/users/${managedUser.id}/turkish-invoices`, {
        method: "PATCH",
        body: JSON.stringify({ canUseTurkishInvoices: nextValue }),
      }),
    onSuccess: async (updated) => {
      toast({
        title: updated.canUseTurkishInvoices ? "تم منح صلاحية الطباعة التركية" : "تم سحب صلاحية الطباعة التركية",
        description: updated.username,
      });
      refreshUsers();
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
              إنشاء الحسابات الجديدة يتم الآن عبر دعوات آمنة مؤقتة بدل كلمات مرور مشتركة أو إنشاء مباشر.
            </p>
          </div>

          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl bg-primary text-white hover:bg-primary/90">
                <UserPlus className="ml-2 h-4 w-4" />
                دعوة مستخدم
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-white/10 sm:max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>إنشاء دعوة مستخدم</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">اسم المستخدم</label>
                  <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="bg-black/40" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">مدة صلاحية الدعوة بالساعات</label>
                  <Input value={inviteExpiresInHours} onChange={(e) => setInviteExpiresInHours(e.target.value)} className="bg-black/40" />
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
                  <span>دعوة بصلاحية مدير</span>
                  {newIsAdmin ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setNewCanUseTurkishInvoices((value) => !value)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                    newCanUseTurkishInvoices
                      ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-300"
                      : "border-white/10 bg-white/[0.03] text-muted-foreground"
                  }`}
                >
                  <span>الوصول للطباعة التركية</span>
                  <span className="text-xs font-bold">{newCanUseTurkishInvoices ? "مفعل" : "غير مفعل"}</span>
                </button>

                <Button
                  onClick={() => createInviteMutation.mutate()}
                  disabled={!newUsername.trim() || createInviteMutation.isPending}
                  className="w-full rounded-2xl"
                >
                  {createInviteMutation.isPending ? "جارٍ إنشاء الدعوة..." : "إنشاء الدعوة"}
                </Button>

                {latestInviteToken ? (
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                    <div className="mb-2 flex items-center gap-2 text-cyan-100">
                      <Link2 className="h-4 w-4" />
                      <span className="text-sm font-bold">رمز الدعوة</span>
                    </div>
                    <code className="block overflow-x-auto rounded-xl bg-black/30 px-3 py-2 text-sm text-cyan-50">{latestInviteToken}</code>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigator.clipboard.writeText(latestInviteToken).then(() => toast({ title: "تم نسخ رمز الدعوة" }))}
                      className="mt-3 w-full rounded-2xl border-cyan-300/20 bg-cyan-500/10 text-cyan-100"
                    >
                      <Copy className="ml-2 h-4 w-4" />
                      نسخ الرمز
                    </Button>
                  </div>
                ) : null}
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
              <CardTitle className="text-sm text-muted-foreground">الدعوات النشطة</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold text-cyan-300">
              {invites?.filter((entry) => entry.isRedeemable).length ?? 0}
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
              <Link2 className="h-5 w-5 text-cyan-300" />
              الدعوات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!invites?.length ? (
              <div className="py-6 text-center text-muted-foreground">لا توجد دعوات بعد</div>
            ) : (
              <div className="space-y-3">
                {invites.map((invite) => (
                  <div key={invite.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-foreground">{invite.invitedUsername}</span>
                          <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${invite.isRedeemable ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-slate-300"}`}>
                            {invite.isRedeemable ? "صالحة" : invite.redeemedAt ? "مستخدمة" : "ملغاة/منتهية"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          الإنشاء: {formatDate(invite.createdAt)} | الانتهاء: {formatDate(invite.expiresAt)}
                        </p>
                      </div>
                      {invite.isRedeemable ? (
                        <Button
                          variant="outline"
                          onClick={() => revokeInviteMutation.mutate(invite.id)}
                          className="rounded-2xl border-white/10 bg-white/[0.03]"
                        >
                          إلغاء الدعوة
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
                        <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${managedUser.isAdmin ? "bg-primary/15 text-primary" : "bg-white/10 text-slate-300"}`}>
                          {managedUser.isAdmin ? "مدير" : "مستخدم"}
                        </span>
                        <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${managedUser.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
                          {managedUser.isActive ? "مفعل" : "معطل"}
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
                          toggleRoleMutation.mutate({
                            managedUser,
                            nextValue: !managedUser.isAdmin,
                          })
                        }
                        className="rounded-2xl border-white/10 bg-white/[0.03]"
                      >
                        {managedUser.isAdmin ? "سحب صفة المدير" : "منح صفة المدير"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          toggleTurkishInvoiceMutation.mutate({
                            managedUser,
                            nextValue: !managedUser.canUseTurkishInvoices,
                          })
                        }
                        className="rounded-2xl border-white/10 bg-white/[0.03]"
                      >
                        {managedUser.canUseTurkishInvoices ? "سحب الطباعة التركية" : "منح الطباعة التركية"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          toggleStatusMutation.mutate({
                            managedUser,
                            nextStatus: !managedUser.isActive,
                          })
                        }
                        disabled={user.id === managedUser.id && managedUser.isActive}
                        className="rounded-2xl border-white/10 bg-white/[0.03]"
                      >
                        {managedUser.isActive ? "تعطيل" : "تفعيل"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => revokeSessionsMutation.mutate(managedUser)}
                        className="rounded-2xl border-white/10 bg-white/[0.03]"
                      >
                        إبطال الجلسات
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
                      {!managedUser.isAdmin && user.id !== managedUser.id ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setDeleteDialogUser(managedUser)}
                          className="rounded-2xl border-rose-500/20 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                        >
                          <Trash2 className="ml-2 h-4 w-4" />
                          حذف المستخدم
                        </Button>
                      ) : null}
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

        <AlertDialog open={!!deleteDialogUser} onOpenChange={(open) => !open && setDeleteDialogUser(null)}>
          <AlertDialogContent className="glass-panel border-white/10" dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>حذف المستخدم</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف الحساب نهائيًا مع جلساته الحالية. هذا الإجراء لا يمكن التراجع عنه.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              المستخدم: <span className="font-bold">{deleteDialogUser?.username}</span>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-2xl">إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  if (!deleteDialogUser) return;
                  deleteUserMutation.mutate(deleteDialogUser);
                }}
                className="rounded-2xl bg-rose-600 text-white hover:bg-rose-700"
              >
                {deleteUserMutation.isPending ? "جارٍ الحذف..." : "تأكيد الحذف"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}

import { useState } from "react";
import { Layout } from "@/components/layout";
import { useGetBranchAnalytics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { formatCurrency, formatNumber } from "@/lib/format";

function getRiskAlerts(analytics: ReturnType<typeof useGetBranchAnalytics>["data"], currency: "USD" | "TRY") {
  if (!analytics || analytics.length === 0) return [];

  const alerts: { level: "حرج" | "تنبيه"; text: string }[] = [];
  const pctKey = currency === "USD" ? "contributionPctUsd" : "contributionPctTry";
  const revKey = currency === "USD" ? "revenueUsd" : "revenueTry";
  const profitKey = currency === "USD" ? "profitUsd" : "profitTry";

  const sorted = [...analytics].sort((a, b) => (b[revKey] as number) - (a[revKey] as number));
  const top = sorted[0];
  const second = sorted[1];

  if (top && (top[pctKey] as number) > 70) {
    alerts.push({ level: "حرج", text: `اعتماد مرتفع على فرع ${top.branchName} بنسبة ${formatNumber(top[pctKey] as number)}% في ${currency}.` });
  }

  if (top && second && (top[revKey] as number) > 0 && (second[revKey] as number) > 0) {
    const ratio = (top[revKey] as number) / (second[revKey] as number);
    if (ratio > 2.5) {
      alerts.push({ level: "تنبيه", text: `فجوة كبيرة بين الفرع الأول والثاني في ${currency}.` });
    }
  }

  analytics.forEach(b => {
    const revenue = b[revKey] as number;
    const profit = b[profitKey] as number;
    if (revenue > 0) {
      const margin = (profit / revenue) * 100;
      if (margin < 15) {
        alerts.push({ level: "تنبيه", text: `هامش منخفض في فرع ${b.branchName} (${formatNumber(margin)}% في ${currency}).` });
      }
    }
  });

  analytics.forEach(b => {
    if (b.invoiceCount === 0) {
      alerts.push({ level: "تنبيه", text: `فرع ${b.branchName} لا يملك أي فواتير في الفترة المحددة.` });
    }
  });

  return alerts;
}

const RANK_COLORS = ["#f59e0b", "#94a3b8", "#b45309"];
const STATUS_COLORS: Record<string, string> = {
  high: "bg-rose-500/15 text-rose-400 border border-rose-500/30",
  stable: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
};

const REV_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"];
const PROFIT_COLORS = ["#10b981", "#14b8a6", "#22c55e", "#84cc16"];

export function BranchAnalytics() {
  const [currency, setCurrency] = useState<"TRY" | "USD">("USD");

  const { data: analytics, isLoading } = useGetBranchAnalytics({ currency });

  const revKey = currency === "USD" ? "revenueUsd" : "revenueTry";
  const profitKey = currency === "USD" ? "profitUsd" : "profitTry";

  const pctKey = currency === "USD" ? "contributionPctUsd" : "contributionPctTry";

  const sorted = analytics
    ? [...analytics].sort((a, b) => (b[revKey] as number) - (a[revKey] as number))
    : [];

  const riskAlerts = getRiskAlerts(analytics, currency);

  const getStatusLabel = (pct: number) =>
    pct > 60 ? { label: "اعتماد مرتفع", cls: STATUS_COLORS.high } : { label: "مستقر", cls: STATUS_COLORS.stable };

  return (
    <Layout>
      <div className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">تحليل الفروع</h1>
          <div className="flex bg-card rounded-lg p-1 border border-white/10">
            <button
              onClick={() => setCurrency("USD")}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-bold transition-all ${currency === "USD" ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:text-white"}`}
            >
              USD
            </button>
            <button
              onClick={() => setCurrency("TRY")}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-bold transition-all ${currency === "TRY" ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:text-white"}`}
            >
              TRY
            </button>
          </div>
        </div>

        {/* ترتيب الفروع */}
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base sm:text-lg">ترتيب الفروع</CardTitle>
              <span className="text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded-md border border-white/10">
                الترتيب حسب {currency}
              </span>
            </div>
          </CardHeader>
          <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white/5 rounded-xl p-5 animate-pulse h-44" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {sorted.slice(0, 3).map((branch, idx) => {
                const revenue = branch[revKey] as number;
                const profit = branch[profitKey] as number;
                const pct = branch[pctKey] as number;
                const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
                const status = getStatusLabel(pct);

                return (
                  <div
                    key={branch.branchId}
                    className="glass-panel rounded-xl p-4 sm:p-5 flex flex-col gap-3 relative overflow-hidden"
                    style={{ borderTop: `3px solid ${RANK_COLORS[idx]}` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black"
                          style={{ background: RANK_COLORS[idx] }}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-lg font-bold text-foreground">{branch.branchName}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.cls}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block mb-0.5">الإيرادات</span>
                        <span className="font-bold text-blue-400 text-sm">{formatCurrency(revenue, currency)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">الأرباح</span>
                        <span className="font-bold text-emerald-400 text-sm">{formatCurrency(profit, currency)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">الفواتير</span>
                        <span className="font-medium">{formatNumber(branch.invoiceCount)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">الهامش</span>
                        <span className={`font-medium ${margin < 15 ? "text-rose-400" : "text-foreground"}`}>
                          {formatNumber(margin)}%
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>الحصة من الإجمالي</span>
                        <span className="font-bold text-foreground">{formatNumber(pct)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: RANK_COLORS[idx] }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </CardContent>
        </Card>

        {/* المشهد المالي للفروع */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="font-display text-base sm:text-lg">المشهد المالي للفروع</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px] sm:h-[360px]">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">جاري التحميل...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sorted}
                  margin={{ top: 16, right: 16, left: 0, bottom: 8 }}
                  barCategoryGap="30%"
                  barGap={4}
                >
                  <defs>
                    {sorted.map((_, i) => (
                      <linearGradient key={`rg-${i}`} id={`revGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={REV_COLORS[i % REV_COLORS.length]} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={REV_COLORS[i % REV_COLORS.length]} stopOpacity={0.45} />
                      </linearGradient>
                    ))}
                    {sorted.map((_, i) => (
                      <linearGradient key={`pg-${i}`} id={`profGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PROFIT_COLORS[i % PROFIT_COLORS.length]} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={PROFIT_COLORS[i % PROFIT_COLORS.length]} stopOpacity={0.45} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="branchName"
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.1)"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    width={56}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                      padding: "10px 14px",
                    }}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    formatter={(val: number) => formatCurrency(val, currency)}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar name="الإيرادات" dataKey={revKey} radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {sorted.map((_, i) => (
                      <Cell key={`rv-${i}`} fill={`url(#revGrad-${i})`} />
                    ))}
                  </Bar>
                  <Bar name="الأرباح" dataKey={profitKey} radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {sorted.map((_, i) => (
                      <Cell key={`pr-${i}`} fill={`url(#profGrad-${i})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* المقارنة الذكية */}
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <CardTitle className="font-display text-base sm:text-lg">المقارنة الذكية</CardTitle>
              {sorted.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {sorted[0].branchName} يستحوذ على {formatNumber(sorted[0][pctKey] as number)}% من إجمالي {currency}
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-right text-xs">الفرع</TableHead>
                    <TableHead className="text-right text-xs">الحصة %</TableHead>
                    <TableHead className="text-right text-xs hidden sm:table-cell">الإيرادات</TableHead>
                    <TableHead className="text-right text-xs hidden md:table-cell">الفواتير</TableHead>
                    <TableHead className="text-right text-xs hidden md:table-cell">متوسط الفاتورة</TableHead>
                    <TableHead className="text-right text-xs hidden sm:table-cell">الهامش</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">جاري التحميل...</TableCell>
                    </TableRow>
                  ) : (
                    sorted.map((branch, idx) => {
                      const revenue = branch[revKey] as number;
                      const profit = branch[profitKey] as number;
                      const pct = branch[pctKey] as number;
                      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
                      const avg = branch.invoiceCount > 0 ? revenue / branch.invoiceCount : 0;

                      return (
                        <TableRow key={branch.branchId} className="border-white/5 hover:bg-white/5">
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-black flex-shrink-0"
                                style={{ background: RANK_COLORS[idx] ?? "#64748b" }}
                              >
                                {idx + 1}
                              </span>
                              <span className="font-medium text-sm">{branch.branchName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${pct}%`, background: RANK_COLORS[idx] ?? "#64748b" }}
                                />
                              </div>
                              <span className="font-bold text-sm">{formatNumber(pct)}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm font-medium">{formatCurrency(revenue, currency)}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{formatNumber(branch.invoiceCount)}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{avg > 0 ? formatCurrency(avg, currency) : "—"}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${margin >= 30 ? "bg-emerald-500/15 text-emerald-400" : margin >= 15 ? "bg-amber-500/15 text-amber-400" : "bg-rose-500/15 text-rose-400"}`}>
                              {formatNumber(margin)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ذكاء المخاطر */}
        {!isLoading && riskAlerts.length > 0 && (
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="font-display text-base sm:text-lg">ذكاء المخاطر</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {riskAlerts.map((alert, i) => (
                  <li
                    key={i}
                    className={`flex items-start gap-3 px-4 py-3 rounded-lg text-sm ${alert.level === "حرج" ? "bg-rose-500/10 border border-rose-500/20" : "bg-amber-500/10 border border-amber-500/20"}`}
                  >
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0 ${alert.level === "حرج" ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"}`}
                    >
                      {alert.level}
                    </span>
                    <span className={alert.level === "حرج" ? "text-rose-200" : "text-amber-200"}>{alert.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {!isLoading && riskAlerts.length === 0 && analytics && analytics.length > 0 && (
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="font-display text-base sm:text-lg">ذكاء المخاطر</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 flex-shrink-0">سليم</span>
                لا توجد مخاطر مكتشفة — توزيع الفروع صحي في الفترة المحددة.
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </Layout>
  );
}

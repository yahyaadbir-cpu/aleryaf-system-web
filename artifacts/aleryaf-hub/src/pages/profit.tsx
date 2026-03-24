import { useState } from "react";
import { Layout } from "@/components/layout";
import { useGetProfitAnalysis, useGetProfitByItem, useGetBranchAnalytics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ComposedChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency, formatNumber } from "@/lib/format";

export function ProfitAnalysisPage() {
  const [currency, setCurrency] = useState<"TRY" | "USD">("USD");

  const { data: analysis, isLoading: isAnalysisLoading } = useGetProfitAnalysis({ currency });
  const { data: itemProfits, isLoading: isItemsLoading } = useGetProfitByItem({ currency, limit: 10 });
  const { data: branchAnalytics, isLoading: isBranchLoading } = useGetBranchAnalytics({ currency });

  const revKey = currency === "USD" ? "revenueUsd" : "revenueTry";
  const profitKey = currency === "USD" ? "profitUsd" : "profitTry";
  const costKey = currency === "USD" ? "costUsd" : "costTry";

  const sortedBranches = branchAnalytics
    ? [...branchAnalytics].sort((a, b) => (b[profitKey] as number) - (a[profitKey] as number))
    : [];


  return (
    <Layout>
      <div className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">تحليل الأرباح الشامل</h1>

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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="glass-panel">
            <CardContent className="p-3 sm:p-6">
              <p className="text-[11px] sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">إجمالي الإيرادات</p>
              <h3 className="text-base sm:text-2xl font-bold text-blue-400">
                {isAnalysisLoading ? "-" : formatCurrency(analysis?.totalRevenue || 0, currency)}
              </h3>
            </CardContent>
          </Card>
          <Card className="glass-panel">
            <CardContent className="p-3 sm:p-6">
              <p className="text-[11px] sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">إجمالي التكلفة</p>
              <h3 className="text-base sm:text-2xl font-bold text-rose-400">
                {isAnalysisLoading ? "-" : formatCurrency(analysis?.totalCost || 0, currency)}
              </h3>
            </CardContent>
          </Card>
          <Card className="glass-panel border-emerald-500/30">
            <CardContent className="p-3 sm:p-6">
              <p className="text-[11px] sm:text-sm font-medium text-emerald-400 mb-1 sm:mb-2">إجمالي الربح</p>
              <h3 className="text-xl sm:text-3xl font-bold text-emerald-400">
                {isAnalysisLoading ? "-" : formatCurrency(analysis?.totalProfit || 0, currency)}
              </h3>
            </CardContent>
          </Card>
          <Card className="glass-panel">
            <CardContent className="p-3 sm:p-6">
              <p className="text-[11px] sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">هامش الربح</p>
              <h3 className="text-base sm:text-2xl font-bold text-foreground">
                {isAnalysisLoading ? "-" : `${formatNumber(analysis?.profitMargin || 0)}%`}
              </h3>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="font-display text-base sm:text-lg">الأداء الشهري</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] sm:h-[380px]">
            {isAnalysisLoading ? (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">جاري التحميل...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={analysis?.monthlyData}
                  margin={{ top: 16, right: 40, bottom: 8, left: 0 }}
                >
                  <defs>
                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="rgba(255,255,255,0.15)"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="rgba(255,255,255,0.1)"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    width={56}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="rgba(255,255,255,0.1)"
                    tick={{ fontSize: 11, fill: "#eab308" }}
                    width={36}
                    axisLine={false}
                    tickLine={false}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                      padding: "10px 14px",
                    }}
                    formatter={(val: number, name: string) =>
                      name === "هامش %" ? `${formatNumber(val)}%` : formatCurrency(val, currency)
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} iconType="circle" iconSize={8} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    name="التكلفة"
                    dataKey="cost"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fill="url(#costGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#f43f5e" }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    name="الربح"
                    dataKey="profit"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#profitGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#10b981" }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    name="هامش %"
                    dataKey="margin"
                    stroke="#eab308"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 3, fill: "#eab308", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* أداء الفروع */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="font-display text-base sm:text-lg">أداء الفروع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-white/10 overflow-x-auto">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-right">الفرع</TableHead>
                    <TableHead className="text-right hidden md:table-cell">الإيراد</TableHead>
                    <TableHead className="text-right hidden md:table-cell">تكلفة البضاعة</TableHead>
                    <TableHead className="text-right">الربح</TableHead>
                    <TableHead className="text-right">الهامش</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isBranchLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell>
                    </TableRow>
                  ) : sortedBranches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell>
                    </TableRow>
                  ) : (
                    sortedBranches.map(branch => {
                      const revenue = branch[revKey] as number;
                      const cost = branch[costKey] as number;
                      const profit = branch[profitKey] as number;
                      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

                      return (
                        <TableRow key={branch.branchId} className="border-white/5 hover:bg-white/5">
                          <TableCell className="font-medium text-sm">{branch.branchName}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {formatCurrency(revenue, currency)}
                          </TableCell>
                          <TableCell className="text-rose-400 hidden md:table-cell">
                            {formatCurrency(cost, currency)}
                          </TableCell>
                          <TableCell className="text-emerald-400 font-bold">
                            {formatCurrency(profit, currency)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded ${margin >= 30 ? "bg-emerald-500/15 text-emerald-400" : margin >= 15 ? "bg-amber-500/15 text-amber-400" : "bg-rose-500/15 text-rose-400"}`}
                            >
                              +{formatNumber(margin)}%
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

        {/* أعلى المنتجات ربحية */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="font-display text-base sm:text-lg">أعلى المنتجات ربحية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-white/10 overflow-x-auto">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/10">
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">الكمية</TableHead>
                    <TableHead className="text-right hidden md:table-cell">الإيرادات</TableHead>
                    <TableHead className="text-right">الربح</TableHead>
                    <TableHead className="text-right">الهامش</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isItemsLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">جاري التحميل...</TableCell>
                    </TableRow>
                  ) : (
                    itemProfits?.map(item => (
                      <TableRow key={item.itemId} className="border-white/5 hover:bg-white/5">
                        <TableCell>
                          <div>
                            <span className="font-medium text-sm">{item.itemName}</span>
                            <span className="block text-[10px] font-mono text-muted-foreground">{item.itemCode}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{formatNumber(item.quantitySold)}</TableCell>
                        <TableCell className="hidden md:table-cell">{formatCurrency(item.revenue, currency)}</TableCell>
                        <TableCell className="text-emerald-400 font-bold">{formatCurrency(item.profit, currency)}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-bold">
                            {formatNumber(item.margin)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

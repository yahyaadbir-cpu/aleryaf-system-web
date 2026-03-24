import { useState } from "react";
import { Layout } from "@/components/layout";
import { useGetDashboardKpis, useGetDailySales, useGetBranches } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatNumber } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Wallet, TrendingUp, Receipt, PackageSearch, Activity } from "lucide-react";

export function Dashboard() {
  const [currency, setCurrency] = useState<"TRY" | "USD">("USD");
  const [branchId, setBranchId] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<"1m" | "3m" | "6m" | "1y">("1m");
  const dateFrom = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - (timeRange === "1m" ? 1 : timeRange === "3m" ? 3 : timeRange === "6m" ? 6 : 12));
    return d.toISOString().split("T")[0];
  })();

  const { data: kpis, isLoading: isKpisLoading } = useGetDashboardKpis({
    dateFrom,
    branchId: branchId !== "all" ? Number(branchId) : undefined
  });
  
  const { data: sales, isLoading: isSalesLoading } = useGetDailySales({
    currency,
    dateFrom,
    branchId: branchId !== "all" ? Number(branchId) : undefined,
    groupBy: "monthly",
  });

  const { data: branches } = useGetBranches();

  return (
    <Layout>
      <div className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">لوحة التحكم التنفيذية</h1>
          
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="flex-1 sm:w-[180px] bg-card border-white/10 text-foreground">
                <SelectValue placeholder="كل الفروع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفروع</SelectItem>
                {branches?.map(b => (
                  <SelectItem key={b.id} value={b.id.toString()}>{b.nameAr || b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={timeRange} onValueChange={(value) => setTimeRange(value as "1m" | "3m" | "6m" | "1y")}>
              <SelectTrigger className="flex-1 sm:w-[120px] bg-card border-white/10 text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1m">شهر</SelectItem>
                <SelectItem value="3m">3 أشهر</SelectItem>
                <SelectItem value="6m">6 أشهر</SelectItem>
                <SelectItem value="1y">سنة</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex bg-card rounded-lg p-1 border border-white/10 shrink-0">
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
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard 
            title={`المبيعات (${currency})`}
            value={kpis ? formatCurrency(currency === "TRY" ? kpis.totalRevenueTry : kpis.totalRevenueUsd, currency) : "-"}
            icon={<Wallet className="w-5 h-5 text-blue-400" />}
            trend={kpis ? (currency === "TRY" ? kpis.revenueGrowthTry : kpis.revenueGrowthUsd) : 0}
            loading={isKpisLoading}
          />
          <KpiCard 
            title={`الأرباح (${currency})`}
            value={kpis ? formatCurrency(currency === "TRY" ? kpis.totalProfitTry : kpis.totalProfitUsd, currency) : "-"}
            icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
            loading={isKpisLoading}
            valueColor="text-emerald-400"
          />
          <KpiCard 
            title={`التكلفة (${currency})`}
            value={kpis ? formatCurrency(currency === "TRY" ? kpis.totalCostTry : kpis.totalCostUsd, currency) : "-"}
            icon={<Activity className="w-5 h-5 text-rose-400" />}
            loading={isKpisLoading}
          />
          <KpiCard 
            title="قيمة المخزون"
            value={kpis ? formatCurrency(kpis.inventoryValueUsd, "USD") : "-"}
            icon={<PackageSearch className="w-5 h-5 text-purple-400" />}
            loading={isKpisLoading}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card className="glass-panel hover-elevate">
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">عدد الفواتير</p>
                <h3 className="text-xl sm:text-2xl font-bold mt-1 text-foreground">{kpis ? formatNumber(kpis.totalInvoices) : "-"}</h3>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-panel hover-elevate">
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">متوسط الطلب ({currency})</p>
                <h3 className="text-xl sm:text-2xl font-bold mt-1 text-foreground">{kpis ? formatCurrency(currency === "TRY" ? kpis.avgOrderValueTry : kpis.avgOrderValueUsd, currency) : "-"}</h3>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-panel hover-elevate border-rose-500/20">
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-rose-400">مخزون منخفض</p>
                <h3 className="text-xl sm:text-2xl font-bold mt-1 text-rose-500">{kpis ? formatNumber(kpis.lowStockCount) : "-"}</h3>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
                <PackageSearch className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg font-display">المبيعات والأرباح الشهرية ({currency})</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 h-[300px] sm:h-[400px]">
            {isSalesLoading ? (
              <div className="w-full h-full flex items-center justify-center">جاري التحميل...</div>
            ) : sales && sales.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sales} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#888" tick={{ fill: '#888', fontSize: 11 }} />
                  <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 11 }} width={60} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend />
                  <Line type="monotone" name="المبيعات" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" name="الأرباح" dataKey="profit" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">لا توجد بيانات متاحة</div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function KpiCard({ title, value, icon, trend, loading, valueColor = "text-foreground" }: { title: string, value: string, icon: React.ReactNode, trend?: number, loading?: boolean, valueColor?: string }) {
  return (
    <Card className="glass-panel hover-elevate overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardContent className="p-3 sm:p-5">
        <div className="flex justify-between items-start">
          <div className="space-y-1 sm:space-y-2 min-w-0 flex-1">
            <p className="text-[11px] sm:text-sm font-medium text-muted-foreground leading-tight">{title}</p>
            {loading ? (
              <div className="h-6 sm:h-8 w-20 sm:w-24 bg-white/10 animate-pulse rounded" />
            ) : (
              <h3 className={`text-base sm:text-2xl font-bold ${valueColor} truncate`}>{value}</h3>
            )}
          </div>
          <div className="p-2 sm:p-3 bg-white/5 rounded-xl border border-white/5 shrink-0 mr-2">
            {icon}
          </div>
        </div>
        {trend !== undefined && !loading && trend !== 0 && (
          <div className="mt-2 sm:mt-4 flex items-center text-xs sm:text-sm">
            <span className={trend >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {trend >= 0 ? "+" : ""}{trend}%
            </span>
            <span className="text-muted-foreground mr-2 hidden sm:inline">مقارنة بالفترة السابقة</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

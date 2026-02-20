"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  CreditCard,
  Users,
  TrendingUp,
  Clock,
  AlertCircle,
  ChevronRight,
  Plus,
  FileText,
  Ban,
  Building2,
  Euro,
  Settings,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { STUDIOS, formatPrice } from "@/lib/booking";
import { generateMonthlyReportPDF } from "@/lib/export";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  todayBookings: number;
  todayRevenue: number;
  weekBookings: number;
  weekRevenue: number;
  monthBookings: number;
  monthRevenue: number;
  pendingPayments: number;
  pendingAmount: number;
  occupancyToday: number;
}

interface RevenuePoint {
  date: string;
  revenue: number;
}

interface OccupancyPoint {
  day: string;
  bookings: number;
}

interface StudioPoint {
  studio: string;
  count: number;
  revenue: number;
}

interface PaymentPoint {
  method: string;
  count: number;
  revenue: number;
}

interface UpcomingBooking {
  id: string;
  booking_ref: string;
  user_name: string | null;
  studio_id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_price: number;
}

interface PendingPayment {
  id: string;
  amount: number;
  user_name: string | null;
  booking_date: string | null;
  start_time: string | null;
  studio_id: string | null;
}

type Period = "week" | "month" | "quarter" | "year";
type RevenuePeriod = "day" | "month" | "year";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "week", label: "Semaine" },
  { value: "month", label: "30 jours" },
  { value: "quarter", label: "90 jours" },
  { value: "year", label: "12 mois" },
];

const REVENUE_PERIOD_OPTIONS: { value: RevenuePeriod; label: string }[] = [
  { value: "day", label: "Par jour (7j)" },
  { value: "month", label: "Par mois (30j)" },
  { value: "year", label: "Par an (365j)" },
];

const CHART_COLORS = {
  primary: "#ffde59",
  secondary: "#a78bfa",
  green: "#4ade80",
  red: "#f87171",
  blue: "#60a5fa",
  zinc400: "#a1a1aa",
  zinc700: "#3f3f46",
  zinc800: "#27272a",
  zinc900: "#18181b",
};

const PIE_COLORS = [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.blue, CHART_COLORS.green];

const MONTH_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function formatShortDate(dateStr: string): string {
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [y, m] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString("fr-FR", { month: "short" });
  }

  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

interface PieLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}

function renderPiePercentLabel(props: PieLabelProps): React.ReactNode {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    typeof midAngle !== "number" ||
    typeof innerRadius !== "number" ||
    typeof outerRadius !== "number" ||
    typeof percent !== "number"
  ) {
    return null;
  }

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.42;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const pct = Math.round(percent * 100);
  if (pct <= 0) return "";

  return (
    <text x={x} y={y} fill={CHART_COLORS.zinc900} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${pct}%`}
    </text>
  );
}

function StatCard({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  color = "primary",
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: string;
  color?: "primary" | "green" | "red" | "blue";
}) {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-500",
    red: "bg-red-500/10 text-red-500",
    blue: "bg-blue-500/10 text-blue-500",
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {subValue && <p className="mt-1 text-sm text-zinc-500">{subValue}</p>}
        </div>
        <div className={`rounded-lg p-2 ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <p className="mt-2 text-xs text-green-500">{trend}</p>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="mb-4 text-sm font-medium text-zinc-400">{title}</h3>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs text-zinc-400">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" ? formatPrice(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { count: number; revenue: number } }> }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
      <p className="mb-1 text-sm font-medium text-zinc-100">{entry.name}</p>
      <p className="text-xs text-zinc-400">{entry.payload.count} réservations</p>
      <p className="text-xs text-primary">{formatPrice(entry.payload.revenue)}</p>
    </div>
  );
}

function PaymentPieTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { count: number } }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const count = entry.payload.count;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
      <p className="mb-1 text-sm font-medium text-zinc-100">{entry.name}</p>
      <p className="text-xs text-zinc-400">{count} paiements · {pct}%</p>
    </div>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsMeta, setStatsMeta] = useState<{ minYear: number | null; maxYear: number | null } | null>(null);
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [occupancyData, setOccupancyData] = useState<OccupancyPoint[]>([]);
  const [studioData, setStudioData] = useState<StudioPoint[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentPoint[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [period, setPeriod] = useState<Period>("month");
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>("month");
  const [rangeMode, setRangeMode] = useState<"rolling" | "month" | "year">("rolling");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [loading, setLoading] = useState(true);
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    fetch("/api/admin/stats/meta")
      .then((res) => res.json())
      .then((json: any) => {
        if (json?.success && json?.data) {
          setStatsMeta({
            minYear: typeof json.data.minYear === "number" ? json.data.minYear : null,
            maxYear: typeof json.data.maxYear === "number" ? json.data.maxYear : null,
          });
        }
      })
      .catch((err) => console.error("Failed to fetch stats meta:", err));
  }, []);

  useEffect(() => {
    const min = statsMeta?.minYear;
    const max = statsMeta?.maxYear;
    if (!Number.isFinite(min) || !Number.isFinite(max)) return;

    const currentSelected = parseInt(selectedYear, 10);
    if (!Number.isFinite(currentSelected)) {
      setSelectedYear(String(max));
      return;
    }
    if (currentSelected < (min as number) || currentSelected > (max as number)) {
      setSelectedYear(String(max));
    }
  }, [statsMeta, selectedYear]);

  useEffect(() => {
    if (rangeMode !== "month") return;
    const parts = reportMonth.split("-");
    const monthPart = parts[1] || "01";
    if (parts[0] !== selectedYear) {
      setReportMonth(`${selectedYear}-${monthPart}`);
    }
  }, [rangeMode, selectedYear, reportMonth]);


  const fetchStats = useCallback(async () => {
    try {
      const url = new URL("/api/admin/stats", window.location.origin);
      if (rangeMode === "month") {
        const [y, m] = reportMonth.split("-").map(Number);
        url.searchParams.set("year", String(y));
        url.searchParams.set("month", String(m));
      }
      if (rangeMode === "year") {
        url.searchParams.set("year", selectedYear);
      }

      const res = await fetch(url.toString());
      const json = await res.json() as { success: boolean; data?: DashboardStats };
      if (json.success && json.data) setStats(json.data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, [rangeMode, reportMonth, selectedYear]);

  const fetchCharts = useCallback(async (p: Period, rp: RevenuePeriod) => {
    try {
      const chartsUrl = new URL("/api/admin/stats/charts", window.location.origin);
      const revenueUrl = new URL("/api/admin/stats/revenue", window.location.origin);

      if (rangeMode === "month") {
        const [y, m] = reportMonth.split("-").map(Number);
        chartsUrl.searchParams.set("mode", "month");
        chartsUrl.searchParams.set("year", String(y));
        chartsUrl.searchParams.set("month", String(m));
        revenueUrl.searchParams.set("mode", "month");
        revenueUrl.searchParams.set("year", String(y));
        revenueUrl.searchParams.set("month", String(m));
      } else if (rangeMode === "year") {
        chartsUrl.searchParams.set("mode", "year");
        chartsUrl.searchParams.set("year", selectedYear);
        revenueUrl.searchParams.set("mode", "year");
        revenueUrl.searchParams.set("year", selectedYear);
      } else {
        chartsUrl.searchParams.set("period", p);
        revenueUrl.searchParams.set("period", rp === "day" ? "week" : rp);
      }

      const [revenueRes, chartsRes] = await Promise.all([
        fetch(revenueUrl.toString()),
        fetch(chartsUrl.toString()),
      ]);

      const revenueJson = await revenueRes.json() as { success: boolean; data?: RevenuePoint[] };
      if (revenueJson.success && revenueJson.data) setRevenueData(revenueJson.data);

      const chartsJson = await chartsRes.json() as {
        success: boolean;
        data?: {
          occupancy: OccupancyPoint[];
          studios: StudioPoint[];
          payments: PaymentPoint[];
          upcomingBookings: UpcomingBooking[];
          pendingPayments: PendingPayment[];
        };
      };
      if (chartsJson.success && chartsJson.data) {
        setOccupancyData(chartsJson.data.occupancy);
        setStudioData(chartsJson.data.studios);
        setPaymentData(chartsJson.data.payments);
        setUpcomingBookings(chartsJson.data.upcomingBookings);
        setPendingPayments(chartsJson.data.pendingPayments);
      }
    } catch (err) {
      console.error("Failed to fetch chart data:", err);
    }
  }, [rangeMode, reportMonth, selectedYear]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchCharts(period, revenuePeriod)]).finally(() => setLoading(false));
  }, [fetchStats, fetchCharts, period, revenuePeriod]);

  const handleGenerateMonthlyReport = async () => {
    const [year, month] = reportMonth.split("-").map(Number);
    try {
      const res = await fetch(`/api/admin/stats?month=${month}&year=${year}`);
      const json = await res.json() as { success: boolean; data?: DashboardStats };
      
      const chartsRes = await fetch(`/api/admin/stats/charts?mode=month&month=${month}&year=${year}`);
      const chartsJson = await chartsRes.json() as {
        success: boolean;
        data?: { studios: StudioPoint[] };
      };

      if (json.success && json.data) {
        const studioStats = (chartsJson.data?.studios || []).map(s => ({
          studio_id: s.studio,
          count: s.count,
          revenue: s.revenue,
        }));
        const reportStats = {
          revenue: json.data.monthRevenue,
          bookingCount: json.data.monthBookings,
          occupancyRate: json.data.occupancyToday || 0,
          noShowRate: 0,
          studioStats,
          weeklyStats: Array.from({ length: 5 }, (_, i) => ({ week: i + 1, count: 0, revenue: 0 })),
        };
        generateMonthlyReportPDF(reportStats, { month, year });
      }
    } catch (err) {
      console.error("Failed to generate report:", err);
    }
  };

  const monthOptions = MONTH_LABELS.map((label, idx) => {
    const month = String(idx + 1).padStart(2, "0");
    return { value: `${selectedYear}-${month}`, label: `${label} ${selectedYear}` };
  });

  const yearOptions = (() => {
    const current = new Date().getFullYear();
    const min = statsMeta?.minYear ?? (current - 5);
    const max = statsMeta?.maxYear ?? current;
    const safeMin = Number.isFinite(min) ? min : (current - 5);
    const safeMax = Number.isFinite(max) ? max : current;

    const items: Array<{ value: string; label: string }> = [];
    for (let y = safeMax; y >= safeMin; y--) items.push({ value: String(y), label: String(y) });
    return items;
  })();

  if (loading && !stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-zinc-400">Vue d&apos;ensemble de votre activité</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Select value={rangeMode} onValueChange={(v) => setRangeMode(v as "rolling" | "month" | "year")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rolling">Période</SelectItem>
                <SelectItem value="month">Mois</SelectItem>
                <SelectItem value="year">Année</SelectItem>
              </SelectContent>
            </Select>

            <Select value={reportMonth} onValueChange={setReportMonth}>
              <SelectTrigger className="w-[160px]" disabled={rangeMode !== "month"}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px]" disabled={rangeMode !== "year"}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateMonthlyReport}
              className="border-primary/30 text-primary hover:bg-primary/10"
            >
              <FileText className="mr-2 h-4 w-4" />
              Rapport PDF
            </Button>
          </div>
          <a
            href="/admin/bookings/new"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-black transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Nouvelle réservation
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Réservations aujourd'hui"
          value={stats?.todayBookings ?? 0}
          subValue={`${stats?.occupancyToday ?? 0}% d'occupation`}
          icon={Calendar}
          color="primary"
        />
        <StatCard
          title="CA réservé (jour)"
          value={formatPrice(stats?.todayRevenue ?? 0)}
          subValue={`${stats?.weekBookings ?? 0} résa. (7j)`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Sur place à encaisser"
          value={stats?.pendingPayments ?? 0}
          subValue={formatPrice(stats?.pendingAmount ?? 0)}
          icon={CreditCard}
          color={(stats?.pendingPayments ?? 0) > 0 ? "red" : "blue"}
        />
        <StatCard
          title="CA réservé (30j)"
          value={formatPrice(stats?.monthRevenue ?? 0)}
          subValue={`${stats?.monthBookings ?? 0} réservations`}
          icon={Users}
          color="blue"
        />
      </div>

      <Tabs defaultValue="charts" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="charts">Statistiques</TabsTrigger>
            <TabsTrigger value="activity">Activité</TabsTrigger>
            <TabsTrigger value="quick">Accès rapide</TabsTrigger>
          </TabsList>

          {rangeMode === "rolling" && (
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value="charts">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-400">Revenus</h3>
                <Select value={revenuePeriod} onValueChange={(v) => setRevenuePeriod(v as RevenuePeriod)}>
                  <SelectTrigger className="w-[140px]" disabled={rangeMode !== "rolling"}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REVENUE_PERIOD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.zinc800} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatShortDate}
                      stroke={CHART_COLORS.zinc400}
                      tick={{ fontSize: 11 }}
                      axisLine={{ stroke: CHART_COLORS.zinc700 }}
                    />
                    <YAxis
                      stroke={CHART_COLORS.zinc400}
                      tick={{ fontSize: 11 }}
                      axisLine={{ stroke: CHART_COLORS.zinc700 }}
                      tickFormatter={(v: number) => `${v}€`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="Revenu"
                      stroke={CHART_COLORS.primary}
                      strokeWidth={2}
                      dot={{ fill: CHART_COLORS.primary, r: 3 }}
                      activeDot={{ r: 5, fill: CHART_COLORS.primary }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <ChartCard title="Occupation par jour">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={occupancyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.zinc800} />
                    <XAxis
                      dataKey="day"
                      stroke={CHART_COLORS.zinc400}
                      tick={{ fontSize: 11 }}
                      axisLine={{ stroke: CHART_COLORS.zinc700 }}
                    />
                    <YAxis
                      stroke={CHART_COLORS.zinc400}
                      tick={{ fontSize: 11 }}
                      axisLine={{ stroke: CHART_COLORS.zinc700 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: CHART_COLORS.zinc900,
                        border: `1px solid ${CHART_COLORS.zinc700}`,
                        borderRadius: "8px",
                        fontSize: "13px",
                      }}
                      labelStyle={{ color: CHART_COLORS.zinc400 }}
                    />
                    <Bar
                      dataKey="bookings"
                      name="Réservations"
                      fill={CHART_COLORS.primary}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Répartition par studio">
              {(() => {
                const totalStudioCount = studioData.reduce((acc, s) => acc + s.count, 0);
                const pctByStudio = Object.fromEntries(
                  studioData.map((s) => [
                    s.studio,
                    totalStudioCount > 0 ? Math.round((s.count / totalStudioCount) * 100) : 0,
                  ]),
                ) as Record<string, number>;

                return (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={studioData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="studio"
                      labelLine={false}
                      label={renderPiePercentLabel}
                    >
                      {studioData.map((_, i) => (
                        <Cell key={`studio-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      formatter={(value: string) => (
                        <span className="text-sm text-zinc-300">
                          {value} {pctByStudio[value] ? `(${pctByStudio[value]}%)` : ""}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
                );
              })()}
            </ChartCard>

            <ChartCard title="Méthodes de paiement">
              <div className="h-[280px]">
                {(() => {
                  const totalCount = paymentData.reduce((acc, p) => acc + p.count, 0);
                  const labels = paymentData.map((p) => {
                    const pct = totalCount > 0 ? Math.round((p.count / totalCount) * 100) : 0;
                    return { method: p.method, count: p.count, pct };
                  });

                  return (
                    <div className="flex h-full flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="h-[220px] w-full sm:h-full sm:w-1/2">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={paymentData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={95}
                              paddingAngle={3}
                              dataKey="count"
                              nameKey="method"
                              labelLine={false}
                              label={renderPiePercentLabel}
                            >
                              {paymentData.map((_, i) => (
                                <Cell key={`pay-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<PaymentPieTooltip total={totalCount} />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="w-full sm:w-1/2">
                        <div className="space-y-2">
                          {labels.map((l, i) => (
                            <div key={l.method} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                                />
                                <span className="text-sm text-zinc-300">{l.method}</span>
                              </div>
                              <span className="text-sm text-zinc-200">{l.count} · {l.pct}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Prochaines réservations</h2>
                <a href="/admin/bookings" className="text-sm text-primary hover:underline">
                  Voir tout
                </a>
              </div>
              <div className="space-y-2">
                {upcomingBookings.length === 0 ? (
                  <p className="py-8 text-center text-zinc-500">Aucune réservation à venir</p>
                ) : (
                  upcomingBookings.map((booking) => {
                    const studio = STUDIOS[booking.studio_id as keyof typeof STUDIOS];
                    return (
                      <a
                        key={booking.id}
                        href={`/admin/bookings/${booking.id}`}
                        className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 transition-colors hover:bg-zinc-800/50"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Clock className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{booking.user_name || "Client inconnu"}</p>
                          <p className="text-sm text-zinc-400">
                            {studio?.name ?? booking.studio_id} &middot; {booking.start_time}-{booking.end_time}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-primary">{formatPrice(booking.total_price)}</p>
                          <p className="text-xs text-zinc-500">{formatDate(booking.date)}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-zinc-600" />
                      </a>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Paiements en attente</h2>
                <a href="/admin/payments?status=pending" className="text-sm text-primary hover:underline">
                  Voir tout
                </a>
              </div>
              <div className="space-y-2">
                {pendingPayments.length === 0 ? (
                  <p className="py-8 text-center text-zinc-500">Aucun paiement en attente</p>
                ) : (
                  pendingPayments.map((payment) => {
                    const studio = payment.studio_id ? STUDIOS[payment.studio_id as keyof typeof STUDIOS] : null;
                    return (
                      <div
                        key={payment.id}
                        className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-500">
                          <AlertCircle className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{payment.user_name || "Client inconnu"}</p>
                          <p className="text-sm text-zinc-400">
                            {payment.booking_date ? `${formatDate(payment.booking_date)} · ${payment.start_time}` : "—"}
                            {studio ? ` · ${studio.name}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-yellow-500">{formatPrice(payment.amount)}</p>
                          <p className="text-xs text-zinc-500">Sur place</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="quick">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="mb-4 font-semibold">Accès rapide</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <a
                href="/admin/calendar"
                className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Calendar className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Calendrier</p>
                  <p className="text-sm text-zinc-400">Vue planning</p>
                </div>
              </a>
              <a
                href="/admin/bookings"
                className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Clock className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Réservations</p>
                  <p className="text-sm text-zinc-400">Gérer les créneaux</p>
                </div>
              </a>
              <a
                href="/admin/blocked-slots"
                className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Ban className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Blocages</p>
                  <p className="text-sm text-zinc-400">Fermetures / Vacances</p>
                </div>
              </a>
              <a
                href="/admin/users"
                className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Users className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Clients</p>
                  <p className="text-sm text-zinc-400">Gérer les comptes</p>
                </div>
              </a>
              <a
                href="/admin/studios"
                className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Building2 className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Studios</p>
                  <p className="text-sm text-zinc-400">Configuration</p>
                </div>
              </a>
              <a
                href="/admin/pricing"
                className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Euro className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Tarifs</p>
                  <p className="text-sm text-zinc-400">Prix des créneaux</p>
                </div>
              </a>
              <a
                href="/admin/settings"
                className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Settings className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Paramètres</p>
                  <p className="text-sm text-zinc-400">Config générale</p>
                </div>
              </a>
              <a
                href="/admin/audit-log"
                className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <FileText className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Journal d'audit</p>
                  <p className="text-sm text-zinc-400">Historique</p>
                </div>
              </a>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Package, Truck, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import { useCompany } from "@/hooks/useCompany";

type RangeKey = "7" | "30" | "90" | "365";
const RANGES: { key: RangeKey; label: string; bucket: "day" | "week" | "month" }[] = [
  { key: "7", label: "7 días", bucket: "day" },
  { key: "30", label: "30 días", bucket: "day" },
  { key: "90", label: "90 días", bucket: "week" },
  { key: "365", label: "Año", bucket: "month" },
];

const fmtCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const pct = (curr: number, prev: number) => {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / Math.abs(prev)) * 100;
};

const Dashboard = () => {
  const { activeCompanyId, activeCompany, activeBranchId, activeBranch } = useCompany();
  const [range, setRange] = useState<RangeKey>("30");
  const [loading, setLoading] = useState(false);

  const [salesSeries, setSalesSeries] = useState<{ label: string; current: number; previous: number }[]>([]);
  const [attendanceSeries, setAttendanceSeries] = useState<{ label: string; count: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; units: number; revenue: number }[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<{ status: string; count: number }[]>([]);
  const [ordersAvgTime, setOrdersAvgTime] = useState<number | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);

  const [totals, setTotals] = useState({
    salesCurr: 0, salesPrev: 0,
    ordersCurr: 0, ordersPrev: 0,
    attendCurr: 0, attendPrev: 0,
    lowStockCount: 0,
  });

  useEffect(() => { if (activeCompanyId) void load(); }, [activeCompanyId, activeBranchId, range]);

  const load = async () => {
    if (!activeCompanyId) return;
    setLoading(true);

    const days = parseInt(range, 10);
    const now = new Date();
    const currStart = startOfDay(subDays(now, days - 1));
    const prevStart = startOfDay(subDays(now, days * 2 - 1));
    const prevEnd = startOfDay(subDays(now, days));

    let prodQ = supabase.from("products").select("*").eq("company_id", activeCompanyId);
    if (activeBranchId) prodQ = prodQ.eq("branch_id", activeBranchId);
    const { data: products } = await prodQ;
    const productIds = (products ?? []).map((p: any) => p.id);
    const productById = new Map((products ?? []).map((p: any) => [p.id, p]));

    let empQ = supabase.from("employees").select("id").eq("company_id", activeCompanyId);
    if (activeBranchId) empQ = empQ.eq("branch_id", activeBranchId);
    let ordQ = supabase.from("orders").select("status, created_at, dispatched_at, delivered_at")
      .eq("company_id", activeCompanyId)
      .gte("created_at", prevStart.toISOString());
    if (activeBranchId) ordQ = ordQ.eq("branch_id", activeBranchId);

    const [{ data: movements }, { data: emps }, { data: orders }, { data: alarmsData }] = await Promise.all([
      productIds.length
        ? supabase.from("inventory_movements")
            .select("product_id, type, quantity, unit_price, created_at")
            .in("product_id", productIds)
            .gte("created_at", prevStart.toISOString())
        : Promise.resolve({ data: [] as any[] } as any),
      empQ,
      ordQ,
      supabase.from("alarms")
        .select("id, title, severity, created_at, company_id, target_company_id, is_resolved, companies:company_id(name)")
        .or(`company_id.eq.${activeCompanyId},target_company_id.eq.${activeCompanyId}`)
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    setAlerts(alarmsData ?? []);

    const empIds = (emps ?? []).map((e: any) => e.id);
    const { data: attendance } = empIds.length
      ? await supabase.from("attendance").select("employee_id, check_in")
          .in("employee_id", empIds)
          .gte("check_in", prevStart.toISOString())
      : { data: [] as any[] };

    // Sales totals (salidas)
    const sales = (movements ?? []).filter((m: any) => m.type === "salida");
    const salesCurr = sales.filter((m: any) => m.created_at >= currStart.toISOString())
      .reduce((s: number, m: any) => s + Number(m.quantity) * Number(m.unit_price), 0);
    const salesPrev = sales.filter((m: any) => m.created_at < currStart.toISOString())
      .reduce((s: number, m: any) => s + Number(m.quantity) * Number(m.unit_price), 0);

    // Series sales current vs previous (bucketed by day)
    const buckets = eachDayOfInterval({ start: currStart, end: now });
    const series = buckets.map((d, i) => {
      const dStr = d.toISOString();
      const next = new Date(d.getTime() + 86400000).toISOString();
      const prevD = subDays(d, days);
      const prevDStr = prevD.toISOString();
      const prevNext = new Date(prevD.getTime() + 86400000).toISOString();
      const curr = sales.filter((m: any) => m.created_at >= dStr && m.created_at < next)
        .reduce((s: number, m: any) => s + Number(m.quantity) * Number(m.unit_price), 0);
      const prev = sales.filter((m: any) => m.created_at >= prevDStr && m.created_at < prevNext)
        .reduce((s: number, m: any) => s + Number(m.quantity) * Number(m.unit_price), 0);
      return {
        label: days <= 30 ? format(d, "dd MMM", { locale: es }) : format(d, "dd/MM"),
        current: Math.round(curr),
        previous: Math.round(prev),
      };
    });
    // Reduce points for long ranges
    const step = days > 90 ? 7 : days > 30 ? 3 : 1;
    setSalesSeries(series.filter((_, i) => i % step === 0));

    // Top products by units sold (current period)
    const productSales = new Map<string, { units: number; revenue: number }>();
    sales.filter((m: any) => m.created_at >= currStart.toISOString()).forEach((m: any) => {
      const cur = productSales.get(m.product_id) ?? { units: 0, revenue: 0 };
      cur.units += Number(m.quantity);
      cur.revenue += Number(m.quantity) * Number(m.unit_price);
      productSales.set(m.product_id, cur);
    });
    const top = [...productSales.entries()]
      .map(([id, v]) => ({ name: (productById.get(id) as any)?.name ?? "—", ...v }))
      .sort((a, b) => b.units - a.units).slice(0, 5);
    setTopProducts(top);

    // Low stock list
    const low = (products ?? []).filter((p: any) => Number(p.stock) <= Number(p.min_stock));
    setLowStock(low.slice(0, 6));

    // Attendance series
    const attCurr = (attendance ?? []).filter((a: any) => a.check_in >= currStart.toISOString());
    const attPrev = (attendance ?? []).filter((a: any) => a.check_in < currStart.toISOString());
    const attSeries = buckets.map((d) => {
      const dStr = d.toISOString();
      const next = new Date(d.getTime() + 86400000).toISOString();
      const count = new Set(
        attCurr.filter((a: any) => a.check_in >= dStr && a.check_in < next).map((a: any) => a.employee_id)
      ).size;
      return { label: format(d, "dd/MM"), count };
    }).filter((_, i) => i % step === 0);
    setAttendanceSeries(attSeries);

    // Orders by status (current period) + avg delivery time
    const ordersCurr = (orders ?? []).filter((o: any) => o.created_at >= currStart.toISOString());
    const ordersPrev = (orders ?? []).filter((o: any) => o.created_at < currStart.toISOString());
    const statusMap = new Map<string, number>();
    ordersCurr.forEach((o: any) => statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1));
    setOrdersByStatus([...statusMap.entries()].map(([status, count]) => ({ status, count })));

    const delivered = ordersCurr.filter((o: any) => o.delivered_at && o.dispatched_at);
    if (delivered.length) {
      const avgMs = delivered.reduce(
        (s: number, o: any) => s + (new Date(o.delivered_at).getTime() - new Date(o.dispatched_at).getTime()), 0
      ) / delivered.length;
      setOrdersAvgTime(Math.round(avgMs / 60000));
    } else setOrdersAvgTime(null);

    setTotals({
      salesCurr, salesPrev,
      ordersCurr: ordersCurr.length, ordersPrev: ordersPrev.length,
      attendCurr: new Set(attCurr.map((a: any) => a.employee_id + a.check_in.slice(0, 10))).size,
      attendPrev: new Set(attPrev.map((a: any) => a.employee_id + a.check_in.slice(0, 10))).size,
      lowStockCount: low.length,
    });

    setLoading(false);
  };

  const STATUS_COLORS: Record<string, string> = {
    pendiente: "hsl(var(--warning))",
    en_camino: "hsl(var(--info))",
    entregado: "hsl(var(--success))",
    cancelado: "hsl(var(--destructive))",
  };

  const Delta = ({ curr, prev, currency }: { curr: number; prev: number; currency?: boolean }) => {
    const p = pct(curr, prev);
    const up = p >= 0;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? "text-success" : "text-destructive"}`}>
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {p.toFixed(1)}% vs anterior ({currency ? fmtCOP(prev) : prev})
      </span>
    );
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={activeCompany ? `Comparativo de ${activeCompany.name}` : "Visión general"}
        icon={<LayoutDashboard className="h-5 w-5" />}
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {RANGES.map((r) => (
          <Button
            key={r.key}
            size="sm"
            variant={range === r.key ? "default" : "outline"}
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </Button>
        ))}
        {loading && <span className="text-xs text-muted-foreground self-center ml-2">Cargando…</span>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><DollarSign className="h-4 w-4" /> Ventas</div>
          <div className="text-2xl font-bold mt-1">{fmtCOP(totals.salesCurr)}</div>
          <Delta curr={totals.salesCurr} prev={totals.salesPrev} currency />
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Truck className="h-4 w-4" /> Pedidos</div>
          <div className="text-2xl font-bold mt-1">{totals.ordersCurr}</div>
          <Delta curr={totals.ordersCurr} prev={totals.ordersPrev} />
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Users className="h-4 w-4" /> Asistencias</div>
          <div className="text-2xl font-bold mt-1">{totals.attendCurr}</div>
          <Delta curr={totals.attendCurr} prev={totals.attendPrev} />
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Package className="h-4 w-4" /> Bajo stock</div>
          <div className="text-2xl font-bold mt-1">{totals.lowStockCount}</div>
          <span className="text-xs text-muted-foreground">productos por reponer</span>
        </CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas — periodo actual vs anterior</CardTitle>
            <CardDescription>Comparativo por día</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={salesSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => fmtCOP(v)} />
                <Legend />
                <Line type="monotone" dataKey="current" name="Actual" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="previous" name="Anterior" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asistencia</CardTitle>
            <CardDescription>Empleados únicos por día</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={attendanceSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Top productos</CardTitle><CardDescription>Más vendidos en el periodo</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {topProducts.length === 0 && <p className="text-sm text-muted-foreground">Sin ventas registradas.</p>}
            {topProducts.map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.units.toFixed(0)} uds</p>
                </div>
                <span className="text-sm font-semibold">{fmtCOP(p.revenue)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Bajo stock</CardTitle><CardDescription>Productos por reponer</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {lowStock.length === 0 && <p className="text-sm text-muted-foreground">Inventario en orden ✓</p>}
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border bg-warning/5 p-3">
                <div><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-muted-foreground">{p.category}</p></div>
                <Badge variant="outline" className="border-warning text-warning">
                  {Number(p.stock).toFixed(0)} / {Number(p.min_stock).toFixed(0)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos por estado</CardTitle>
            <CardDescription>
              {ordersAvgTime !== null ? `Tiempo prom. entrega: ${ordersAvgTime} min` : "Sin tiempos de entrega"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ordersByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin pedidos en el periodo.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={ordersByStatus} dataKey="count" nameKey="status" innerRadius={45} outerRadius={80} paddingAngle={3}>
                    {ordersByStatus.map((s) => (
                      <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? "hsl(var(--muted))"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;

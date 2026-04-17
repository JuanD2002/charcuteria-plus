import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Users, Package, Truck, AlertTriangle, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";

const Dashboard = () => {
  const [stats, setStats] = useState({
    activeToday: 0,
    salesToday: 0,
    lowStock: 0,
    activeOrders: 0,
  });
  const [salesData, setSalesData] = useState<{ day: string; total: number }[]>([]);
  const [attendanceData, setAttendanceData] = useState<{ day: string; count: number }[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    const todayStart = startOfDay(new Date()).toISOString();

    const [{ data: attToday }, { count: ordersActive }, { data: products }, { data: orders }, { data: movements }] = await Promise.all([
      supabase.from("attendance").select("employee_id").gte("check_in", todayStart),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["pendiente", "en_camino"]),
      supabase.from("products").select("*"),
      supabase.from("orders").select("*, employees(full_name)").order("created_at", { ascending: false }).limit(20),
      supabase.from("inventory_movements").select("type, quantity, unit_price, created_at").gte("created_at", subDays(new Date(), 6).toISOString()),
    ]);

    const uniqueEmps = new Set((attToday ?? []).map((r) => r.employee_id));
    const lowStock = (products ?? []).filter((p: any) => Number(p.stock) <= Number(p.min_stock));

    const todaySales = (movements ?? [])
      .filter((m: any) => m.type === "salida" && m.created_at >= todayStart)
      .reduce((s: number, m: any) => s + Number(m.quantity) * Number(m.unit_price), 0);

    setStats({
      activeToday: uniqueEmps.size,
      salesToday: todaySales,
      lowStock: lowStock.length,
      activeOrders: ordersActive ?? 0,
    });
    setLowStockProducts(lowStock.slice(0, 5));
    setActiveOrders((orders ?? []).filter((o: any) => o.status !== "entregado" && o.status !== "cancelado").slice(0, 5));

    // Build last 7 days sales chart
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = startOfDay(subDays(new Date(), 6 - i));
      return { date: d, key: d.toISOString(), label: format(d, "EEE", { locale: es }) };
    });
    const sales = days.map((d) => {
      const next = new Date(d.date.getTime() + 86400000).toISOString();
      const total = (movements ?? [])
        .filter((m: any) => m.type === "salida" && m.created_at >= d.key && m.created_at < next)
        .reduce((s: number, m: any) => s + Number(m.quantity) * Number(m.unit_price), 0);
      return { day: d.label, total: Math.round(total) };
    });
    setSalesData(sales);

    // Attendance fake-aggregated for the chart from real data
    const { data: attRange } = await supabase
      .from("attendance")
      .select("check_in")
      .gte("check_in", subDays(new Date(), 6).toISOString());
    const att = days.map((d) => {
      const next = new Date(d.date.getTime() + 86400000).toISOString();
      const count = new Set(
        (attRange ?? [])
          .filter((a: any) => a.check_in >= d.key && a.check_in < next)
          .map((a: any) => a.check_in)
      ).size;
      return { day: d.label, count };
    });
    setAttendanceData(att);
  };

  const fmtCOP = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

  const statusColor = (s: string) =>
    s === "pendiente" ? "bg-warning/15 text-warning border-warning/30"
    : s === "en_camino" ? "bg-info/15 text-info border-info/30"
    : "bg-muted text-muted-foreground";

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visión general de la operación"
        icon={<LayoutDashboard className="h-5 w-5" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Empleados hoy" value={stats.activeToday} hint="con asistencia registrada" icon={<Users className="h-5 w-5" />} variant="info" />
        <StatCard label="Ventas del día" value={fmtCOP(stats.salesToday)} hint="movimientos de salida" icon={<DollarSign className="h-5 w-5" />} variant="primary" />
        <StatCard label="Bajo stock" value={stats.lowStock} hint="productos por reponer" icon={<AlertTriangle className="h-5 w-5" />} variant="warning" />
        <StatCard label="Pedidos activos" value={stats.activeOrders} hint="pendientes y en camino" icon={<Truck className="h-5 w-5" />} variant="success" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas últimos 7 días</CardTitle>
            <CardDescription>Total facturado por día</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => fmtCOP(v)}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asistencia 7 días</CardTitle>
            <CardDescription>Registros de entrada únicos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--accent))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--accent))" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-warning" />
              Productos con bajo stock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStockProducts.length === 0 && <p className="text-sm text-muted-foreground">Todo el inventario está en orden ✓</p>}
            {lowStockProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border bg-warning/5 p-3">
                <div>
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                </div>
                <Badge variant="outline" className="border-warning text-warning">
                  {Number(p.stock).toFixed(2)} / {Number(p.min_stock).toFixed(0)} {p.unit}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4 text-info" />
              Pedidos en curso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeOrders.length === 0 && <p className="text-sm text-muted-foreground">Sin pedidos activos.</p>}
            {activeOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{o.customer_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{o.address}</p>
                </div>
                <Badge variant="outline" className={statusColor(o.status)}>{o.status.replace("_", " ")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;

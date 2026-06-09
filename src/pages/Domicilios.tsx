import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Plus, MapPin, Clock, CheckCircle2, Navigation } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useCompany } from "@/hooks/useCompany";

const STATUSES = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_camino", label: "En camino" },
  { value: "entregado", label: "Entregado" },
  { value: "cancelado", label: "Cancelado" },
];

const Domicilios = () => {
  const { activeCompanyId, activeBranchId } = useCompany();
  const [orders, setOrders] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", address: "", total: "", notes: "" });

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("orders-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [activeCompanyId, activeBranchId]);

  const load = async () => {
    if (!activeCompanyId) { setOrders([]); setDrivers([]); return; }
    let oq = supabase.from("orders").select("*, employees(full_name)").eq("company_id", activeCompanyId);
    if (activeBranchId) oq = oq.eq("branch_id", activeBranchId);
    let eq2 = supabase.from("employees").select("*").eq("company_id", activeCompanyId).eq("is_delivery", true).eq("is_active", true);
    if (activeBranchId) eq2 = eq2.eq("branch_id", activeBranchId);
    const [{ data: ords }, { data: emps }] = await Promise.all([
      oq.order("created_at", { ascending: false }),
      eq2,
    ]);
    setOrders(ords ?? []);
    setDrivers(emps ?? []);
  };

  const fmtCOP = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

  const submit = async () => {
    if (!form.customer_name.trim() || !form.address.trim()) {
      toast.error("Cliente y dirección son obligatorios");
      return;
    }
    if (!activeCompanyId) return toast.error("Selecciona una empresa primero");
    const { error } = await supabase.from("orders").insert({
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim() || null,
      address: form.address.trim(),
      total: Number(form.total) || 0,
      notes: form.notes.trim() || null,
      company_id: activeCompanyId,
      branch_id: activeBranchId,
    });
    if (error) return toast.error(error.message);
    toast.success("Pedido creado");
    setOpen(false);
    setForm({ customer_name: "", customer_phone: "", address: "", total: "", notes: "" });
  };

  const assignDriver = async (orderId: string, driverId: string) => {
    const { error } = await supabase.from("orders").update({ delivery_employee_id: driverId }).eq("id", orderId);
    if (error) return toast.error(error.message);
    toast.success("Domiciliario asignado");
  };

  const updateStatus = async (orderId: string, status: string) => {
    const updates: any = { status };
    if (status === "en_camino") updates.dispatched_at = new Date().toISOString();
    if (status === "entregado") updates.delivered_at = new Date().toISOString();
    const { error } = await supabase.from("orders").update(updates).eq("id", orderId);
    if (error) return toast.error(error.message);
    toast.success(`Estado: ${status.replace("_", " ")}`);
  };

  const statusBadge = (s: string) => {
    const cls: Record<string, string> = {
      pendiente: "bg-warning/15 text-warning border-warning/30",
      en_camino: "bg-info/15 text-info border-info/30",
      entregado: "bg-success/15 text-success border-success/30",
      cancelado: "bg-muted text-muted-foreground",
    };
    return <Badge variant="outline" className={cls[s] ?? ""}>{s.replace("_", " ")}</Badge>;
  };

  // Mock GPS — deterministic position based on order id
  const mockGps = (id: string) => {
    const seed = id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
    const lat = 6.244 + ((seed % 100) - 50) / 5000;
    const lng = -75.581 + ((seed % 73) - 36) / 5000;
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  const stats = {
    pendiente: orders.filter((o) => o.status === "pendiente").length,
    en_camino: orders.filter((o) => o.status === "en_camino").length,
    entregado: orders.filter((o) => o.status === "entregado").length,
  };

  return (
    <div>
      <PageHeader
        title="Domicilios"
        description="Gestión de pedidos y entregas"
        icon={<Truck className="h-5 w-5" />}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nuevo pedido</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar pedido</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Cliente *</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} maxLength={100} /></div>
                <div><Label>Teléfono</Label><Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} maxLength={20} /></div>
                <div><Label>Dirección *</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={200} /></div>
                <div><Label>Total (COP)</Label><Input type="number" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} /></div>
                <div><Label>Notas</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={300} /></div>
              </div>
              <DialogFooter><Button onClick={submit}>Crear pedido</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pendientes</p><p className="text-2xl font-bold font-display text-warning">{stats.pendiente}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">En camino</p><p className="text-2xl font-bold font-display text-info">{stats.en_camino}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Entregados</p><p className="text-2xl font-bold font-display text-success">{stats.entregado}</p></CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {orders.map((o) => (
          <Card key={o.id} className="transition-smooth hover:shadow-elegant">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{o.customer_name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(o.created_at), "dd MMM HH:mm", { locale: es })} · {o.customer_phone ?? "sin tel."}</p>
                </div>
                {statusBadge(o.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{o.address}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium font-display text-lg">{fmtCOP(Number(o.total))}</span>
                {o.status === "en_camino" && (
                  <div className="flex items-center gap-1.5 text-xs text-info animate-pulse">
                    <Navigation className="h-3.5 w-3.5" />
                    <span className="tabular-nums">{mockGps(o.id)}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                <Select value={o.delivery_employee_id ?? ""} onValueChange={(v) => assignDriver(o.id, v)} disabled={o.status === "entregado" || o.status === "cancelado"}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Asignar domiciliario" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {(o.dispatched_at || o.delivered_at) && (
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
                  {o.dispatched_at && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Salió: {format(new Date(o.dispatched_at), "HH:mm", { locale: es })}</span>}
                  {o.delivered_at && <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" />Entregado: {format(new Date(o.delivered_at), "HH:mm", { locale: es })}</span>}
                </div>
              )}
              {o.employees?.full_name && (
                <p className="text-xs text-muted-foreground">Domiciliario: <span className="font-medium text-foreground">{o.employees.full_name}</span></p>
              )}
            </CardContent>
          </Card>
        ))}
        {orders.length === 0 && (
          <Card className="lg:col-span-2"><CardContent className="p-8 text-center text-muted-foreground">Sin pedidos registrados</CardContent></Card>
        )}
      </div>
    </div>
  );
};

export default Domicilios;

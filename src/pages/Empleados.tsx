import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Users, Plus, LogIn, LogOut, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { useCompany } from "@/hooks/useCompany";

interface Employee {
  id: string;
  full_name: string;
  document_number: string;
  position: string;
  hourly_rate: number;
  is_active: boolean;
  is_delivery: boolean;
}

interface Attendance {
  id: string;
  employee_id: string;
  check_in: string;
  check_out: string | null;
}

const Empleados = () => {
  const { activeCompanyId, canEdit } = useCompany();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", document_number: "", position: "", hourly_rate: "", is_delivery: false });

  useEffect(() => { void load(); }, [activeCompanyId]);

  const load = async () => {
    if (!activeCompanyId) { setEmployees([]); setAttendance([]); return; }
    const { data: emps } = await supabase.from("employees").select("*").eq("company_id", activeCompanyId).order("full_name");
    const ids = (emps ?? []).map((e: any) => e.id);
    const { data: att } = ids.length
      ? await supabase.from("attendance").select("*").in("employee_id", ids).order("check_in", { ascending: false }).limit(100)
      : { data: [] as any[] };
    setEmployees(emps ?? []);
    setAttendance(att ?? []);
  };

  const fmtCOP = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

  const openSession = (empId: string) =>
    attendance.find((a) => a.employee_id === empId && !a.check_out);

  const checkIn = async (emp: Employee) => {
    if (openSession(emp.id)) {
      toast.error(`${emp.full_name} ya tiene entrada abierta`);
      return;
    }
    const { error } = await supabase.from("attendance").insert({ employee_id: emp.id });
    if (error) return toast.error(error.message);
    toast.success(`Entrada registrada: ${emp.full_name}`);
    void load();
  };

  const checkOut = async (emp: Employee) => {
    const sess = openSession(emp.id);
    if (!sess) {
      toast.error(`${emp.full_name} no tiene entrada abierta`);
      return;
    }
    const { error } = await supabase.from("attendance").update({ check_out: new Date().toISOString() }).eq("id", sess.id);
    if (error) return toast.error(error.message);
    toast.success(`Salida registrada: ${emp.full_name}`);
    void load();
  };

  const submit = async () => {
    if (!form.full_name.trim() || !form.document_number.trim() || !form.position.trim()) {
      toast.error("Completa los campos obligatorios");
      return;
    }
    if (!activeCompanyId) return toast.error("Selecciona una empresa primero");
    const { error } = await supabase.from("employees").insert({
      full_name: form.full_name.trim(),
      document_number: form.document_number.trim(),
      position: form.position.trim(),
      hourly_rate: Number(form.hourly_rate) || 0,
      is_delivery: form.is_delivery,
      company_id: activeCompanyId,
    });
    if (error) return toast.error(error.message);
    toast.success("Empleado registrado");
    setOpen(false);
    setForm({ full_name: "", document_number: "", position: "", hourly_rate: "", is_delivery: false });
    void load();
  };

  // Aggregate hours and pay per employee for current period
  const summary = employees.map((e) => {
    const sessions = attendance.filter((a) => a.employee_id === e.id && a.check_out);
    const totalMin = sessions.reduce((s, a) => s + differenceInMinutes(new Date(a.check_out!), new Date(a.check_in)), 0);
    const hours = totalMin / 60;
    const regular = Math.min(hours, 48);
    const extra = Math.max(0, hours - 48);
    const pay = regular * Number(e.hourly_rate) + extra * Number(e.hourly_rate) * 1.25;
    const isLate = sessions.some((a) => {
      const d = new Date(a.check_in);
      return d.getHours() > 8 || (d.getHours() === 8 && d.getMinutes() > 15);
    });
    return { ...e, hours, extra, pay, isLate, working: !!openSession(e.id) };
  });

  return (
    <div>
      <PageHeader
        title="Empleados"
        description="Gestión de personal y asistencia"
        icon={<Users className="h-5 w-5" />}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nuevo empleado</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar empleado</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nombre completo *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={100} /></div>
                <div><Label>Documento *</Label><Input value={form.document_number} onChange={(e) => setForm({ ...form, document_number: e.target.value })} maxLength={30} /></div>
                <div><Label>Cargo *</Label><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} maxLength={50} placeholder="Charcutero, Cajero, Domiciliario..." /></div>
                <div><Label>Salario por hora (COP)</Label><Input type="number" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} /></div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="del">¿Es domiciliario?</Label>
                  <Switch id="del" checked={form.is_delivery} onCheckedChange={(v) => setForm({ ...form, is_delivery: v })} />
                </div>
              </div>
              <DialogFooter><Button onClick={submit}>Guardar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Personal</TabsTrigger>
          <TabsTrigger value="history">Historial de asistencia</TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-right">Extra</TableHead>
                    <TableHead className="text-right">Pago est.</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="font-medium">{e.full_name}</div>
                        <div className="text-xs text-muted-foreground">{e.document_number}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{e.position}</span>
                          {e.is_delivery && <Badge variant="secondary" className="text-[10px]">domicilio</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{e.hours.toFixed(1)}h</TableCell>
                      <TableCell className="text-right tabular-nums text-warning">{e.extra > 0 ? `+${e.extra.toFixed(1)}h` : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmtCOP(e.pay)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {e.working ? (
                            <Badge className="bg-success text-success-foreground w-fit">En turno</Badge>
                          ) : (
                            <Badge variant="outline" className="w-fit">Fuera</Badge>
                          )}
                          {e.isLate && (
                            <Badge variant="outline" className="w-fit border-warning text-warning text-[10px]">
                              <AlertCircle className="h-3 w-3 mr-1" />tarde
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => checkIn(e)} disabled={e.working}>
                            <LogIn className="h-3.5 w-3.5 mr-1" />Entrada
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => checkOut(e)} disabled={!e.working}>
                            <LogOut className="h-3.5 w-3.5 mr-1" />Salida
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {summary.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin empleados registrados</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Salida</TableHead>
                    <TableHead className="text-right">Duración</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((a) => {
                    const emp = employees.find((e) => e.id === a.employee_id);
                    const dur = a.check_out ? differenceInMinutes(new Date(a.check_out), new Date(a.check_in)) : null;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{emp?.full_name ?? "—"}</TableCell>
                        <TableCell className="text-sm">{format(new Date(a.check_in), "dd MMM HH:mm", { locale: es })}</TableCell>
                        <TableCell className="text-sm">
                          {a.check_out ? format(new Date(a.check_out), "dd MMM HH:mm", { locale: es }) : <Badge className="bg-success text-success-foreground">activo</Badge>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{dur != null ? `${(dur / 60).toFixed(1)}h` : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Empleados;

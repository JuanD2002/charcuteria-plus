import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bell, Plus, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/hooks/useCompany";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Alarm {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  is_resolved: boolean;
  trigger_at: string | null;
  created_at: string;
}

const sevColor: Record<string, string> = {
  info: "bg-primary/15 text-primary",
  warning: "bg-warning/15 text-warning",
  critical: "bg-destructive/15 text-destructive",
};

const Alarmas = () => {
  const { activeCompanyId, canEdit } = useCompany();
  const [rows, setRows] = useState<Alarm[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", severity: "info", trigger_at: "" });
  const editable = canEdit("alarmas");

  useEffect(() => { void load(); }, [activeCompanyId]);

  const load = async () => {
    if (!activeCompanyId) return setRows([]);
    const { data } = await supabase.from("alarms").select("*").eq("company_id", activeCompanyId).order("created_at", { ascending: false });
    setRows((data ?? []) as Alarm[]);
  };

  const submit = async () => {
    if (!form.title.trim()) return toast.error("El título es obligatorio");
    if (!activeCompanyId) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("alarms").insert({
      company_id: activeCompanyId,
      title: form.title.trim(),
      description: form.description || null,
      severity: form.severity,
      trigger_at: form.trigger_at || null,
      created_by: u.user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Alarma creada");
    setOpen(false);
    setForm({ title: "", description: "", severity: "info", trigger_at: "" });
    void load();
  };

  const resolve = async (a: Alarm) => {
    const { error } = await supabase.from("alarms").update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq("id", a.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta alarma?")) return;
    const { error } = await supabase.from("alarms").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <div>
      <PageHeader
        title="Alarmas"
        description="Avisos, alertas y recordatorios operativos"
        icon={<Bell className="h-5 w-5" />}
        action={editable && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nueva alarma</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Crear alarma</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Descripción</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Severidad</Label>
                    <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warning">Advertencia</SelectItem>
                        <SelectItem value="critical">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Fecha objetivo</Label><Input type="datetime-local" value={form.trigger_at} onChange={(e) => setForm({ ...form, trigger_at: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={submit}>Guardar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Alarma</TableHead><TableHead>Severidad</TableHead>
            <TableHead>Programada</TableHead><TableHead>Estado</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="font-medium">{a.title}</div>
                  {a.description && <div className="text-xs text-muted-foreground line-clamp-1">{a.description}</div>}
                </TableCell>
                <TableCell><Badge className={sevColor[a.severity] ?? sevColor.info}>{a.severity}</Badge></TableCell>
                <TableCell className="text-sm">{a.trigger_at ? format(new Date(a.trigger_at), "dd MMM yyyy HH:mm", { locale: es }) : "—"}</TableCell>
                <TableCell>
                  {a.is_resolved
                    ? <Badge variant="outline" className="border-success text-success">Resuelta</Badge>
                    : <Badge>Activa</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {editable && !a.is_resolved && (
                      <Button size="sm" variant="ghost" onClick={() => resolve(a)}><CheckCircle2 className="h-4 w-4 mr-1" />Resolver</Button>
                    )}
                    {editable && <Button size="icon" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sin alarmas</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
};

export default Alarmas;

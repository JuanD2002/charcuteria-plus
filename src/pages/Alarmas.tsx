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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bell, Plus, CheckCircle2, Trash2, Send, Inbox, Home, Building2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
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
  company_id: string;
  target_company_id: string | null;
  created_by: string | null;
}

const sevColor: Record<string, string> = {
  info: "bg-primary/15 text-primary",
  warning: "bg-warning/15 text-warning",
  critical: "bg-destructive/15 text-destructive",
};

type FilterKey = "all" | "received" | "sent" | "internal";

const Alarmas = () => {
  const { activeCompanyId, canEdit, companies } = useCompany();
  const { user } = useAuth();
  const [rows, setRows] = useState<Alarm[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Alarm | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", severity: "info", trigger_at: "", target_company_id: "__internal__",
  });
  const editable = canEdit("alarmas");

  useEffect(() => { void load(); }, [activeCompanyId]);

  const load = async () => {
    if (!activeCompanyId) return setRows([]);
    // Origin OR target = active company
    const { data } = await supabase
      .from("alarms")
      .select("*")
      .or(`company_id.eq.${activeCompanyId},target_company_id.eq.${activeCompanyId}`)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Alarm[]);
  };

  const companyName = (id: string | null) => id ? (companies.find((c) => c.id === id)?.name ?? "—") : "—";

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", description: "", severity: "info", trigger_at: "", target_company_id: "__internal__" });
    setOpen(true);
  };

  const openEdit = (a: Alarm) => {
    setEditing(a);
    setForm({
      title: a.title,
      description: a.description ?? "",
      severity: a.severity,
      trigger_at: a.trigger_at ? a.trigger_at.slice(0, 16) : "",
      target_company_id: a.target_company_id ?? "__internal__",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.title.trim()) return toast.error("El título es obligatorio");
    if (!activeCompanyId) return;

    const target = form.target_company_id === "__internal__" ? null : form.target_company_id;
    const payload: any = {
      title: form.title.trim(),
      description: form.description || null,
      severity: form.severity,
      trigger_at: form.trigger_at || null,
      target_company_id: target,
    };

    if (editing) {
      const { error } = await supabase.from("alarms").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Alarma actualizada");
    } else {
      payload.company_id = activeCompanyId;
      payload.created_by = user?.id;
      const { error } = await supabase.from("alarms").insert(payload);
      if (error) return toast.error(error.message);
      toast.success(target ? "Alarma enviada" : "Alarma creada");
    }
    setOpen(false);
    setEditing(null);
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

  const classify = (a: Alarm): FilterKey => {
    if (a.company_id === activeCompanyId && a.target_company_id == null) return "internal";
    if (a.company_id === activeCompanyId) return "sent";
    return "received";
  };

  const filtered = rows.filter((a) => filter === "all" || classify(a) === filter);

  const otherCompanies = companies.filter((c) => c.id !== activeCompanyId);

  return (
    <div>
      <PageHeader
        title="Alarmas"
        description="Avisos internos y entre empresas del grupo"
        icon={<Bell className="h-5 w-5" />}
        action={editable && (
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Nueva alarma</Button>
        )}
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="received"><Inbox className="h-3.5 w-3.5 mr-1" />Recibidas</TabsTrigger>
          <TabsTrigger value="sent"><Send className="h-3.5 w-3.5 mr-1" />Enviadas</TabsTrigger>
          <TabsTrigger value="internal"><Home className="h-3.5 w-3.5 mr-1" />Internas</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Alarma</TableHead>
            <TableHead>Origen → Destino</TableHead>
            <TableHead>Severidad</TableHead>
            <TableHead>Programada</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map((a) => {
              const kind = classify(a);
              const isOwnerCompany = a.company_id === activeCompanyId;
              const canResolve = editable; // either side with permission can resolve
              const canEditAlarm = editable && isOwnerCompany;
              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-medium flex items-center gap-2">
                      {kind === "received" && <Badge variant="outline" className="text-[10px]"><Inbox className="h-3 w-3 mr-1" />recibida</Badge>}
                      {kind === "sent" && <Badge variant="outline" className="text-[10px]"><Send className="h-3 w-3 mr-1" />enviada</Badge>}
                      {a.title}
                    </div>
                    {a.description && <div className="text-xs text-muted-foreground line-clamp-1">{a.description}</div>}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex items-center gap-1"><Building2 className="h-3 w-3" />{companyName(a.company_id)}</div>
                    {a.target_company_id && (
                      <div className="flex items-center gap-1 text-muted-foreground mt-0.5">→ {companyName(a.target_company_id)}</div>
                    )}
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
                      {canEditAlarm && (
                        <Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                      )}
                      {canResolve && !a.is_resolved && (
                        <Button size="sm" variant="ghost" onClick={() => resolve(a)}><CheckCircle2 className="h-4 w-4 mr-1" />Resolver</Button>
                      )}
                      {canEditAlarm && <Button size="icon" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin alarmas</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar alarma" : "Crear alarma"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Descripción</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div>
              <Label>Dirigir a</Label>
              <Select value={form.target_company_id} onValueChange={(v) => setForm({ ...form, target_company_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__internal__">Interna (esta empresa)</SelectItem>
                  {otherCompanies.map((c) => <SelectItem key={c.id} value={c.id}>→ {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
          <DialogFooter><Button onClick={submit}>{editing ? "Guardar cambios" : "Crear"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Alarmas;

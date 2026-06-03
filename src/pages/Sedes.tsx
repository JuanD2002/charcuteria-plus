import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/hooks/useCompany";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  manager_name: string | null;
  is_active: boolean;
}

const Sedes = () => {
  const { activeCompanyId, canEdit } = useCompany();
  const [rows, setRows] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", phone: "", manager_name: "" });
  const editable = canEdit("sedes");

  useEffect(() => { void load(); }, [activeCompanyId]);

  const load = async () => {
    if (!activeCompanyId) return setRows([]);
    const { data } = await supabase.from("branches").select("*").eq("company_id", activeCompanyId).order("name");
    setRows((data ?? []) as Branch[]);
  };

  const submit = async () => {
    if (!form.name.trim()) return toast.error("El nombre es obligatorio");
    if (!activeCompanyId) return;
    const { error } = await supabase.from("branches").insert({ ...form, company_id: activeCompanyId });
    if (error) return toast.error(error.message);
    toast.success("Sede creada");
    setOpen(false);
    setForm({ name: "", address: "", phone: "", manager_name: "" });
    void load();
  };

  const toggle = async (b: Branch) => {
    const { error } = await supabase.from("branches").update({ is_active: !b.is_active }).eq("id", b.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta sede?")) return;
    const { error } = await supabase.from("branches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <div>
      <PageHeader
        title="Sedes"
        description="Puntos de operación de la empresa"
        icon={<MapPin className="h-5 w-5" />}
        action={editable && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nueva sede</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar sede</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Dirección</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>Responsable</Label><Input value={form.manager_name} onChange={(e) => setForm({ ...form, manager_name: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={submit}>Guardar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Sede</TableHead><TableHead>Dirección</TableHead><TableHead>Responsable</TableHead>
            <TableHead>Teléfono</TableHead><TableHead>Activa</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{b.address || "—"}</TableCell>
                <TableCell>{b.manager_name || "—"}</TableCell>
                <TableCell>{b.phone || "—"}</TableCell>
                <TableCell>
                  {editable ? <Switch checked={b.is_active} onCheckedChange={() => toggle(b)} />
                    : <Badge variant={b.is_active ? "default" : "outline"}>{b.is_active ? "Sí" : "No"}</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {editable && (
                    <Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin sedes registradas</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
};

export default Sedes;

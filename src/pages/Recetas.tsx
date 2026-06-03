import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChefHat, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/hooks/useCompany";

interface Recipe {
  id: string;
  name: string;
  description: string | null;
  yield_quantity: number;
  yield_unit: string;
  instructions: string | null;
}

const Recetas = () => {
  const { activeCompanyId, canEdit } = useCompany();
  const [rows, setRows] = useState<Recipe[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", yield_quantity: "1", yield_unit: "porciones", instructions: "" });
  const editable = canEdit("recetas");

  useEffect(() => { void load(); }, [activeCompanyId]);

  const load = async () => {
    if (!activeCompanyId) return setRows([]);
    const { data } = await supabase.from("recipes").select("*").eq("company_id", activeCompanyId).order("name");
    setRows((data ?? []) as Recipe[]);
  };

  const submit = async () => {
    if (!form.name.trim()) return toast.error("El nombre es obligatorio");
    if (!activeCompanyId) return;
    const { error } = await supabase.from("recipes").insert({
      company_id: activeCompanyId,
      name: form.name.trim(),
      description: form.description || null,
      yield_quantity: Number(form.yield_quantity) || 1,
      yield_unit: form.yield_unit || "porciones",
      instructions: form.instructions || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Receta creada");
    setOpen(false);
    setForm({ name: "", description: "", yield_quantity: "1", yield_unit: "porciones", instructions: "" });
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta receta?")) return;
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <div>
      <PageHeader
        title="Recetas"
        description="Fichas técnicas y preparaciones"
        icon={<ChefHat className="h-5 w-5" />}
        action={editable && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nueva receta</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Registrar receta</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Descripción</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Rendimiento</Label><Input type="number" value={form.yield_quantity} onChange={(e) => setForm({ ...form, yield_quantity: e.target.value })} /></div>
                  <div><Label>Unidad</Label><Input value={form.yield_unit} onChange={(e) => setForm({ ...form, yield_unit: e.target.value })} /></div>
                </div>
                <div><Label>Instrucciones</Label><Textarea rows={5} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={submit}>Guardar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Receta</TableHead><TableHead>Descripción</TableHead>
            <TableHead className="text-right">Rendimiento</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground line-clamp-2">{r.description || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.yield_quantity} {r.yield_unit}</TableCell>
                <TableCell className="text-right">
                  {editable && <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sin recetas registradas</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
};

export default Recetas;

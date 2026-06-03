import { useEffect, useState, useRef } from "react";
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
import { BookOpen, Plus, Trash2, Download, FolderPlus, Folder } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/hooks/useCompany";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Category { id: string; name: string; description: string | null; }
interface Manual {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

const Manuales = () => {
  const { activeCompanyId, canEdit } = useCompany();
  const editable = canEdit("manuales");
  const [categories, setCategories] = useState<Category[]>([]);
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category_id: "none" });
  const [cat, setCat] = useState({ name: "", description: "" });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void load(); }, [activeCompanyId]);

  const load = async () => {
    if (!activeCompanyId) { setCategories([]); setManuals([]); return; }
    const [{ data: cats }, { data: mans }] = await Promise.all([
      supabase.from("manual_categories").select("*").eq("company_id", activeCompanyId).order("name"),
      supabase.from("manuals").select("*").eq("company_id", activeCompanyId).order("created_at", { ascending: false }),
    ]);
    setCategories((cats ?? []) as Category[]);
    setManuals((mans ?? []) as Manual[]);
  };

  const upload = async () => {
    if (!form.title.trim()) return toast.error("Título obligatorio");
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Selecciona un archivo PDF");
    if (file.type !== "application/pdf") return toast.error("Solo se permiten archivos PDF");
    if (!activeCompanyId) return;
    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${activeCompanyId}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage.from("manuals").upload(path, file, { contentType: "application/pdf" });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("manuals").insert({
      company_id: activeCompanyId,
      category_id: form.category_id === "none" ? null : form.category_id,
      title: form.title.trim(),
      description: form.description || null,
      file_path: path,
      file_size: file.size,
      uploaded_by: u.user?.id,
    });
    setUploading(false);
    if (error) {
      await supabase.storage.from("manuals").remove([path]);
      return toast.error(error.message);
    }
    toast.success("Manual subido");
    setUploadOpen(false);
    setForm({ title: "", description: "", category_id: "none" });
    if (fileRef.current) fileRef.current.value = "";
    void load();
  };

  const remove = async (m: Manual) => {
    if (!confirm("¿Eliminar este manual?")) return;
    await supabase.storage.from("manuals").remove([m.file_path]);
    const { error } = await supabase.from("manuals").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const download = async (m: Manual) => {
    const { data, error } = await supabase.storage.from("manuals").createSignedUrl(m.file_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Error al obtener archivo");
    window.open(data.signedUrl, "_blank");
  };

  const submitCat = async () => {
    if (!cat.name.trim()) return toast.error("Nombre obligatorio");
    if (!activeCompanyId) return;
    const { error } = await supabase.from("manual_categories").insert({
      company_id: activeCompanyId, name: cat.name.trim(), description: cat.description || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Categoría creada");
    setCatOpen(false);
    setCat({ name: "", description: "" });
    void load();
  };

  const removeCat = async (id: string) => {
    if (!confirm("¿Eliminar esta categoría? Los manuales quedarán sin categoría.")) return;
    const { error } = await supabase.from("manual_categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  const filtered = filter === "all" ? manuals : filter === "none" ? manuals.filter((m) => !m.category_id) : manuals.filter((m) => m.category_id === filter);
  const fmtSize = (n: number | null) => n ? `${(n / 1024 / 1024).toFixed(2)} MB` : "—";

  return (
    <div>
      <PageHeader
        title="Manuales"
        description="Documentación, procedimientos y guías por categoría"
        icon={<BookOpen className="h-5 w-5" />}
        action={editable && (
          <div className="flex gap-2">
            <Dialog open={catOpen} onOpenChange={setCatOpen}>
              <DialogTrigger asChild><Button variant="outline"><FolderPlus className="h-4 w-4 mr-2" />Categoría</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nueva categoría</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Nombre *</Label><Input value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} /></div>
                  <div><Label>Descripción</Label><Input value={cat.description} onChange={(e) => setCat({ ...cat, description: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={submitCat}>Crear</Button></DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Subir manual</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Subir manual PDF</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div><Label>Descripción</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  <div>
                    <Label>Categoría</Label>
                    <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin categoría</SelectItem>
                        {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Archivo PDF *</Label>
                    <Input ref={fileRef} type="file" accept="application/pdf" />
                  </div>
                </div>
                <DialogFooter><Button onClick={upload} disabled={uploading}>{uploading ? "Subiendo…" : "Subir"}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      />

      {categories.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Todas ({manuals.length})</Button>
          {categories.map((c) => {
            const count = manuals.filter((m) => m.category_id === c.id).length;
            return (
              <div key={c.id} className="inline-flex items-center rounded-md border bg-card">
                <Button size="sm" variant={filter === c.id ? "default" : "ghost"} onClick={() => setFilter(c.id)} className="rounded-r-none">
                  <Folder className="h-3.5 w-3.5 mr-1.5" />{c.name} <span className="ml-1.5 text-xs opacity-70">{count}</span>
                </Button>
                {editable && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-l-none border-l" onClick={() => removeCat(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
          <Button size="sm" variant={filter === "none" ? "default" : "outline"} onClick={() => setFilter("none")}>Sin categoría</Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => {
          const cat = categories.find((c) => c.id === m.category_id);
          return (
            <Card key={m.id} className="transition-shadow hover:shadow-elegant">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-display font-semibold truncate">{m.title}</h3>
                    {cat && <Badge variant="secondary" className="mt-1 text-[10px]">{cat.name}</Badge>}
                  </div>
                  <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
                {m.description && <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{format(new Date(m.created_at), "dd MMM yyyy", { locale: es })}</span>
                  <span>{fmtSize(m.file_size)}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => download(m)}>
                    <Download className="h-3.5 w-3.5 mr-1" />Ver
                  </Button>
                  {editable && <Button size="icon" variant="ghost" onClick={() => remove(m)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3"><CardContent className="p-10 text-center text-muted-foreground">
            No hay manuales {filter !== "all" ? "en esta categoría" : "aún"}.
          </CardContent></Card>
        )}
      </div>
    </div>
  );
};

export default Manuales;

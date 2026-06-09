import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Shield, Building2, Save, Loader2, UserPlus, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useCompany, AppModule } from "@/hooks/useCompany";
import { Navigate } from "react-router-dom";
import GoogleIntegrationsTab from "@/components/GoogleIntegrationsTab";

const MODULES: { value: AppModule; label: string }[] = [
  { value: "dashboard", label: "Dashboard" },
  { value: "sedes", label: "Sedes" },
  { value: "empleados", label: "Empleados" },
  { value: "inventario", label: "Inventario" },
  { value: "recetas", label: "Recetas" },
  { value: "domicilios", label: "Domicilios" },
  { value: "alarmas", label: "Alarmas" },
  { value: "manuales", label: "Manuales" },
];

interface Profile { user_id: string; display_name: string | null; is_active: boolean; }
interface UserRole { user_id: string; role: string; }
interface Perm { user_id: string; company_id: string; module: AppModule; can_view: boolean; can_edit: boolean; }
interface AdminBranch { id: string; company_id: string; name: string; address: string | null; phone: string | null; manager_name: string | null; is_active: boolean; }

const Admin = () => {
  const { isSuperAdmin, companies, refresh: refreshCompany, loading } = useCompany();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [companyForm, setCompanyForm] = useState<Record<string, { name: string; description: string }>>({});
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", display_name: "" });
  const [creating, setCreating] = useState(false);

  // Empresas / sedes
  const [newCompanyOpen, setNewCompanyOpen] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", slug: "", description: "" });
  const [allBranches, setAllBranches] = useState<AdminBranch[]>([]);
  const [newBranch, setNewBranch] = useState<Record<string, { name: string; address: string; phone: string; manager_name: string }>>({});

  useEffect(() => { if (isSuperAdmin) void load(); }, [isSuperAdmin]);

  const load = async () => {
    const [{ data: pf }, { data: rl }, { data: pm }, { data: br }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, is_active").order("display_name"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_company_permissions").select("user_id, company_id, module, can_view, can_edit"),
      supabase.from("branches").select("id, company_id, name, address, phone, manager_name, is_active").order("name"),
    ]);
    setProfiles((pf ?? []) as Profile[]);
    setRoles((rl ?? []) as UserRole[]);
    setPerms((pm ?? []) as Perm[]);
    setAllBranches((br ?? []) as AdminBranch[]);
    if (!selectedUser && pf && pf.length) setSelectedUser(pf[0].user_id);
    const cf: Record<string, { name: string; description: string }> = {};
    companies.forEach((c) => { cf[c.id] = { name: c.name, description: c.description ?? "" }; });
    setCompanyForm(cf);
  };

  const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const createCompany = async () => {
    if (!newCompany.name.trim()) return toast.error("Nombre obligatorio");
    const slug = (newCompany.slug || slugify(newCompany.name)).trim();
    const { error } = await supabase.from("companies").insert({
      name: newCompany.name.trim(),
      slug,
      description: newCompany.description || null,
      is_active: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Empresa creada");
    setNewCompanyOpen(false);
    setNewCompany({ name: "", slug: "", description: "" });
    await refreshCompany();
    void load();
  };

  const toggleCompanyActive = async (id: string, value: boolean) => {
    const { error } = await supabase.from("companies").update({ is_active: value }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(value ? "Empresa activa" : "Empresa inactiva");
    await refreshCompany();
  };

  const deleteCompany = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar la empresa "${name}" y todos sus datos asociados?`)) return;
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Empresa eliminada");
    await refreshCompany();
    void load();
  };

  const addBranch = async (companyId: string) => {
    const f = newBranch[companyId] ?? { name: "", address: "", phone: "", manager_name: "" };
    if (!f.name.trim()) return toast.error("Nombre de sede obligatorio");
    const { error } = await supabase.from("branches").insert({
      company_id: companyId,
      name: f.name.trim(),
      address: f.address || null,
      phone: f.phone || null,
      manager_name: f.manager_name || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Sede creada");
    setNewBranch({ ...newBranch, [companyId]: { name: "", address: "", phone: "", manager_name: "" } });
    void load();
  };

  const toggleBranchActive = async (b: AdminBranch) => {
    const { error } = await supabase.from("branches").update({ is_active: !b.is_active }).eq("id", b.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const deleteBranch = async (id: string) => {
    if (!confirm("¿Eliminar esta sede?")) return;
    const { error } = await supabase.from("branches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const userIsSuper = (uid: string) => roles.some((r) => r.user_id === uid && r.role === "super_admin");

  const getPerm = (companyId: string, module: AppModule) =>
    perms.find((p) => p.user_id === selectedUser && p.company_id === companyId && p.module === module);

  const togglePerm = async (companyId: string, module: AppModule, field: "can_view" | "can_edit", value: boolean) => {
    if (!selectedUser) return;
    const existing = getPerm(companyId, module);
    let next: any;
    if (existing) {
      next = { ...existing, [field]: value };
      if (field === "can_view" && !value) next.can_edit = false;
      if (field === "can_edit" && value) next.can_view = true;
    } else {
      next = {
        user_id: selectedUser, company_id: companyId, module,
        can_view: field === "can_view" ? value : field === "can_edit" && value ? true : false,
        can_edit: field === "can_edit" ? value : false,
      };
    }
    const { error } = await supabase
      .from("user_company_permissions")
      .upsert(next, { onConflict: "user_id,company_id,module" });
    if (error) return toast.error(error.message);
    setPerms((prev) => {
      const without = prev.filter((p) => !(p.user_id === selectedUser && p.company_id === companyId && p.module === module));
      return [...without, next];
    });
  };

  const toggleSuperAdmin = async (uid: string, value: boolean) => {
    if (value) {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "super_admin" });
      if (error) return toast.error(error.message);
      setRoles((r) => [...r, { user_id: uid, role: "super_admin" }]);
      toast.success("Promovido a super administrador");
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "super_admin");
      if (error) return toast.error(error.message);
      setRoles((r) => r.filter((x) => !(x.user_id === uid && x.role === "super_admin")));
      toast.success("Permisos de super admin removidos");
    }
  };

  const toggleActive = async (uid: string, value: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_active: value }).eq("user_id", uid);
    if (error) return toast.error(error.message);
    setProfiles((p) => p.map((x) => x.user_id === uid ? { ...x, is_active: value } : x));
    toast.success(value ? "Usuario habilitado" : "Usuario deshabilitado");
  };

  const saveCompany = async (id: string) => {
    setSaving(true);
    const f = companyForm[id];
    const { error } = await supabase.from("companies").update({ name: f.name, description: f.description || null }).eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Empresa actualizada");
    await refreshCompany();
  };

  const createUser = async () => {
    if (!newUser.email.trim() || !newUser.password) return toast.error("Email y contraseña obligatorios");
    if (newUser.password.length < 6) return toast.error("Mínimo 6 caracteres en la contraseña");
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { email: newUser.email.trim(), password: newUser.password, display_name: newUser.display_name || null },
    });
    setCreating(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error ?? error?.message ?? "Error al crear usuario");
    }
    toast.success("Usuario creado y habilitado");
    setCreateOpen(false);
    setNewUser({ email: "", password: "", display_name: "" });
    void load();
  };

  const selectedProfile = profiles.find((p) => p.user_id === selectedUser);

  return (
    <div>
      <PageHeader
        title="Administración"
        description="Gestiona usuarios, empresas y permisos del Grupo Apolo"
        icon={<Shield className="h-5 w-5" />}
      />

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="permissions">Permisos por usuario</TabsTrigger>
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="google"><FileSpreadsheet className="h-3.5 w-3.5 mr-1" />Google Sheets</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild><Button><UserPlus className="h-4 w-4 mr-2" />Crear usuario</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuevo usuario</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Nombre</Label><Input value={newUser.display_name} onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })} /></div>
                  <div><Label>Email *</Label><Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
                  <div><Label>Contraseña *</Label><Input type="text" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Mínimo 6 caracteres" /></div>
                  <p className="text-xs text-muted-foreground">El usuario se crea habilitado. Comparte la contraseña por un canal seguro y luego asigna sus permisos.</p>
                </div>
                <DialogFooter><Button onClick={createUser} disabled={creating}>{creating ? "Creando…" : "Crear"}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="text-center">Habilitado</TableHead>
                <TableHead className="text-right">Super administrador</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.user_id}>
                    <TableCell className="font-medium">
                      {p.display_name ?? "Sin nombre"}
                      {!p.is_active && <Badge variant="outline" className="ml-2 text-[10px]">deshabilitado</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{p.user_id.slice(0, 8)}…</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={p.is_active} onCheckedChange={(v) => toggleActive(p.user_id, v)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch checked={userIsSuper(p.user_id)} onCheckedChange={(v) => toggleSuperAdmin(p.user_id, v)} />
                    </TableCell>
                  </TableRow>
                ))}
                {profiles.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sin usuarios</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <div className="grid lg:grid-cols-[280px_1fr] gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Usuarios</CardTitle></CardHeader>
              <CardContent className="p-2 space-y-1">
                {profiles.map((p) => (
                  <button
                    key={p.user_id}
                    onClick={() => setSelectedUser(p.user_id)}
                    className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${selectedUser === p.user_id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{p.display_name || p.user_id.slice(0, 8)}</span>
                      {userIsSuper(p.user_id) && <Badge variant="outline" className="text-[10px]">super</Badge>}
                    </div>
                  </button>
                ))}
                {profiles.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">Sin usuarios registrados.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Matriz de permisos</CardTitle>
                <CardDescription>
                  {selectedProfile ? `${selectedProfile.display_name ?? "Usuario"} — define qué puede ver y editar en cada empresa.` : "Selecciona un usuario."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedUser && userIsSuper(selectedUser) && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                    Este usuario es <strong>super administrador</strong> y tiene acceso total a todas las empresas y módulos.
                  </div>
                )}
                {selectedUser && companies.map((c) => (
                  <div key={c.id} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{c.name}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Módulo</TableHead>
                            <TableHead className="text-center">Ver</TableHead>
                            <TableHead className="text-center">Editar</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {MODULES.map((m) => {
                            const p = getPerm(c.id, m.value);
                            return (
                              <TableRow key={m.value}>
                                <TableCell className="font-medium">{m.label}</TableCell>
                                <TableCell className="text-center">
                                  <Checkbox checked={!!p?.can_view} onCheckedChange={(v) => togglePerm(c.id, m.value, "can_view", !!v)} />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox checked={!!p?.can_edit} onCheckedChange={(v) => togglePerm(c.id, m.value, "can_edit", !!v)} />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="companies" className="space-y-3">
          {companies.map((c) => {
            const f = companyForm[c.id] ?? { name: c.name, description: c.description ?? "" };
            return (
              <Card key={c.id}>
                <CardContent className="p-4 grid sm:grid-cols-[1fr_2fr_auto] gap-3 items-end">
                  <div>
                    <Label>Nombre</Label>
                    <Input value={f.name} onChange={(e) => setCompanyForm({ ...companyForm, [c.id]: { ...f, name: e.target.value } })} />
                  </div>
                  <div>
                    <Label>Descripción</Label>
                    <Input value={f.description} onChange={(e) => setCompanyForm({ ...companyForm, [c.id]: { ...f, description: e.target.value } })} />
                  </div>
                  <Button onClick={() => saveCompany(c.id)} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />Guardar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="google">
          <GoogleIntegrationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;

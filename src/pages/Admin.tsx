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
import { Shield, Building2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCompany, AppModule } from "@/hooks/useCompany";
import { Navigate } from "react-router-dom";

const MODULES: { value: AppModule; label: string }[] = [
  { value: "dashboard", label: "Dashboard" },
  { value: "empleados", label: "Empleados" },
  { value: "inventario", label: "Inventario" },
  { value: "domicilios", label: "Domicilios" },
];

interface Profile { user_id: string; display_name: string | null; }
interface UserRole { user_id: string; role: string; }
interface Perm { user_id: string; company_id: string; module: AppModule; can_view: boolean; can_edit: boolean; }

const Admin = () => {
  const { isSuperAdmin, companies, refresh: refreshCompany, loading } = useCompany();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [companyForm, setCompanyForm] = useState<Record<string, { name: string; description: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (isSuperAdmin) void load(); }, [isSuperAdmin]);

  const load = async () => {
    const [{ data: pf }, { data: rl }, { data: pm }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name").order("display_name"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_company_permissions").select("user_id, company_id, module, can_view, can_edit"),
    ]);
    setProfiles((pf ?? []) as Profile[]);
    setRoles((rl ?? []) as UserRole[]);
    setPerms((pm ?? []) as Perm[]);
    if (!selectedUser && pf && pf.length) setSelectedUser(pf[0].user_id);
    const cf: Record<string, { name: string; description: string }> = {};
    companies.forEach((c) => { cf[c.id] = { name: c.name, description: c.description ?? "" }; });
    setCompanyForm(cf);
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

  const saveCompany = async (id: string) => {
    setSaving(true);
    const f = companyForm[id];
    const { error } = await supabase.from("companies").update({ name: f.name, description: f.description || null }).eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Empresa actualizada");
    await refreshCompany();
  };

  const selectedProfile = profiles.find((p) => p.user_id === selectedUser);

  return (
    <div>
      <PageHeader
        title="Administración"
        description="Gestiona usuarios, empresas y permisos del Grupo Apolo"
        icon={<Shield className="h-5 w-5" />}
      />

      <Tabs defaultValue="permissions">
        <TabsList>
          <TabsTrigger value="permissions">Permisos por usuario</TabsTrigger>
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
        </TabsList>

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

        <TabsContent value="users">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="text-right">Super administrador</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.user_id}>
                    <TableCell className="font-medium">{p.display_name ?? "Sin nombre"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{p.user_id.slice(0, 8)}…</TableCell>
                    <TableCell className="text-right">
                      <Switch checked={userIsSuper(p.user_id)} onCheckedChange={(v) => toggleSuperAdmin(p.user_id, v)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
          <p className="text-xs text-muted-foreground mt-3">
            Para crear nuevos usuarios, pídeles registrarse desde la pantalla de acceso. Una vez creados aparecerán aquí y podrás asignarles permisos.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;

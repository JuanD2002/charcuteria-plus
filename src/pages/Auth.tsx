import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Beef, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { z } from "zod";

const credSchema = z.object({
  email: z.string().trim().email({ message: "Email inválido" }).max(255),
  password: z.string().min(6, { message: "Mínimo 6 caracteres" }).max(72),
});

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [asSuperAdmin, setAsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate("/", { replace: true });
  }, [user, authLoading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const parse = credSchema.safeParse({ email, password });
    if (!parse.success) {
      toast.error(parse.error.errors[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error(error.message === "Invalid login credentials" ? "Credenciales inválidas" : error.message);
      return;
    }
    if (asSuperAdmin) {
      const { error: rpcError } = await supabase.rpc("claim_super_admin");
      if (rpcError) {
        setLoading(false);
        toast.error("No se pudo asignar super admin: " + rpcError.message);
        return;
      }
      toast.success("Sesión iniciada como Super Admin");
    } else {
      toast.success("Bienvenido");
    }
    setLoading(false);
    navigate("/", { replace: true });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parse = credSchema.safeParse({ email, password });
    if (!parse.success) {
      toast.error(parse.error.errors[0].message);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: name || email.split("@")[0] },
      },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message.includes("already") ? "Este email ya está registrado" : error.message);
      return;
    }
    if (asSuperAdmin && data.session) {
      const { error: rpcError } = await supabase.rpc("claim_super_admin");
      if (rpcError) {
        setLoading(false);
        toast.error("Cuenta creada, pero no se pudo asignar super admin: " + rpcError.message);
        return;
      }
      setLoading(false);
      toast.success("Cuenta creada como Super Admin");
      navigate("/", { replace: true });
      return;
    }
    setLoading(false);
    if (asSuperAdmin && !data.session) {
      toast.success("Cuenta creada. Inicia sesión y vuelve a marcar Super Admin si es necesario.");
    } else {
      toast.success("Cuenta creada. Ya puedes iniciar sesión.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-subtle">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-glow">
            <Beef className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold">Charcutería Manager</h1>
          <p className="text-sm text-muted-foreground">Gestiona empleados, inventario y domicilios</p>
        </div>

        <Card className="shadow-elegant">
          <CardHeader className="pb-3">
            <CardTitle>Acceso administrador</CardTitle>
            <CardDescription>Inicia sesión o crea tu cuenta</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4 pt-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-in">Email</Label>
                    <Input id="email-in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@charcuteria.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pass-in">Contraseña</Label>
                    <Input id="pass-in" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-amber-400/50 bg-amber-50 p-3 dark:bg-amber-950/20">
                    <Checkbox id="sa-in" checked={asSuperAdmin} onCheckedChange={(v) => setAsSuperAdmin(!!v)} />
                    <Label htmlFor="sa-in" className="text-xs font-normal cursor-pointer">
                      Entrar como Super Admin (temporal)
                    </Label>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Entrar al dashboard
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 pt-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name-up">Nombre</Label>
                    <Input id="name-up" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" maxLength={80} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-up">Email</Label>
                    <Input id="email-up" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pass-up">Contraseña</Label>
                    <Input id="pass-up" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required />
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-amber-400/50 bg-amber-50 p-3 dark:bg-amber-950/20">
                    <Checkbox id="sa-up" checked={asSuperAdmin} onCheckedChange={(v) => setAsSuperAdmin(!!v)} />
                    <Label htmlFor="sa-up" className="text-xs font-normal cursor-pointer">
                      Crear como Super Admin (temporal)
                    </Label>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Crear cuenta
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">El primer usuario registrado obtiene rol de administrador.</p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;

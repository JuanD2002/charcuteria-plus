import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Beef, Building2, Shield, LogOut, Loader2, MapPin, ArrowLeft, Globe } from "lucide-react";
import { useCompany, Branch } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CompanySelector = () => {
  const navigate = useNavigate();
  const {
    companies, setActiveCompanyId, activeCompanyId,
    isSuperAdmin, loading, permissions,
    setActiveBranchId,
  } = useCompany();
  const { user, signOut } = useAuth();

  const [step, setStep] = useState<"company" | "branch">("company");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [pickedCompanyId, setPickedCompanyId] = useState<string | null>(null);

  const visibleCompanies = isSuperAdmin
    ? companies
    : companies.filter((c) => permissions.some((p) => p.company_id === c.id && p.can_view));

  const pickedCompany = companies.find((c) => c.id === pickedCompanyId) ?? null;

  const handleCompany = async (companyId: string) => {
    setPickedCompanyId(companyId);
    setStep("branch");
    setLoadingBranches(true);
    const { data } = await supabase
      .from("branches")
      .select("id, company_id, name, address, is_active")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name");
    setBranches((data ?? []) as Branch[]);
    setLoadingBranches(false);
  };

  const enterWith = (branchId: string | null) => {
    if (!pickedCompanyId) return;
    setActiveCompanyId(pickedCompanyId);
    // setActiveCompanyId already resets branch; set explicitly after a tick
    setTimeout(() => setActiveBranchId(branchId), 0);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen gradient-subtle">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-glow">
            <Beef className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold leading-tight">Grupo Empresarial Apolo</h1>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar sesión
        </Button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 animate-fade-in">
        {step === "company" ? (
          <>
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl sm:text-4xl font-bold mb-2">Selecciona tu empresa</h2>
              <p className="text-muted-foreground">Luego elegirás la sede dentro de la empresa</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : visibleCompanies.length === 0 && !isSuperAdmin ? (
              <Card className="p-10 text-center">
                <p className="text-muted-foreground">
                  No tienes acceso a ninguna empresa aún. Pide al administrador que te asigne permisos.
                </p>
              </Card>
            ) : (
              <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {visibleCompanies.map((c) => (
                  <button key={c.id} onClick={() => handleCompany(c.id)} className="group text-left">
                    <Card className="h-full p-6 transition-all duration-300 hover:shadow-elegant hover:-translate-y-1 hover:border-primary/40 cursor-pointer">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <Building2 className="h-6 w-6" />
                        </div>
                        {!c.is_active && (
                          <span className="text-[10px] uppercase tracking-wider bg-muted px-2 py-0.5 rounded">Inactiva</span>
                        )}
                      </div>
                      <h3 className="font-display text-lg font-semibold mb-1">{c.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {c.description || "Acceder al panel de gestión de esta empresa"}
                      </p>
                    </Card>
                  </button>
                ))}

                {isSuperAdmin && (
                  <button onClick={() => { setActiveCompanyId(visibleCompanies[0]?.id ?? ""); navigate("/admin"); }} className="group text-left">
                    <Card className="h-full p-6 transition-all duration-300 hover:shadow-elegant hover:-translate-y-1 hover:border-primary/40 cursor-pointer border-dashed">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 text-accent-foreground group-hover:bg-accent group-hover:text-accent-foreground transition-colors mb-4">
                        <Shield className="h-6 w-6" />
                      </div>
                      <h3 className="font-display text-lg font-semibold mb-1">Administración</h3>
                      <p className="text-sm text-muted-foreground">Usuarios, empresas, sedes y permisos</p>
                    </Card>
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-8">
              <Button variant="ghost" size="sm" onClick={() => setStep("company")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Cambiar empresa
              </Button>
            </div>
            <div className="text-center mb-10">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{pickedCompany?.name}</p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold mt-1">Selecciona la sede</h2>
              <p className="text-muted-foreground mt-2">Los datos se filtrarán por esta sede</p>
            </div>

            {loadingBranches ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <button onClick={() => enterWith(null)} className="group text-left">
                  <Card className="h-full p-6 transition-all duration-300 hover:shadow-elegant hover:-translate-y-1 hover:border-primary/40 cursor-pointer border-dashed">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                      <Globe className="h-6 w-6" />
                    </div>
                    <h3 className="font-display text-lg font-semibold mb-1">Toda la empresa</h3>
                    <p className="text-sm text-muted-foreground">Vista consolidada de todas las sedes</p>
                  </Card>
                </button>
                {branches.map((b) => (
                  <button key={b.id} onClick={() => enterWith(b.id)} className="group text-left">
                    <Card className="h-full p-6 transition-all duration-300 hover:shadow-elegant hover:-translate-y-1 hover:border-primary/40 cursor-pointer">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors mb-4">
                        <MapPin className="h-6 w-6" />
                      </div>
                      <h3 className="font-display text-lg font-semibold mb-1">{b.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{b.address || "Sin dirección registrada"}</p>
                    </Card>
                  </button>
                ))}
                {branches.length === 0 && (
                  <Card className="p-6 sm:col-span-2 lg:col-span-3 text-center text-sm text-muted-foreground">
                    Esta empresa aún no tiene sedes registradas. Puedes entrar como "Toda la empresa" o pedir al administrador que cree una sede.
                  </Card>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default CompanySelector;

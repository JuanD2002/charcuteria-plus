import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppModule = "dashboard" | "empleados" | "inventario" | "domicilios";

export interface Company {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
}

interface Permission {
  company_id: string;
  module: AppModule;
  can_view: boolean;
  can_edit: boolean;
}

interface CompanyContextType {
  loading: boolean;
  isSuperAdmin: boolean;
  companies: Company[];
  activeCompanyId: string | null;
  setActiveCompanyId: (id: string) => void;
  activeCompany: Company | null;
  permissions: Permission[];
  canView: (module: AppModule, companyId?: string | null) => boolean;
  canEdit: (module: AppModule, companyId?: string | null) => boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<CompanyContextType>({
  loading: true, isSuperAdmin: false, companies: [], activeCompanyId: null,
  setActiveCompanyId: () => {}, activeCompany: null, permissions: [],
  canView: () => false, canEdit: () => false, refresh: async () => {},
});

const STORAGE_KEY = "apolo_active_company";

export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [activeCompanyId, _setActiveCompanyId] = useState<string | null>(null);

  const setActiveCompanyId = (id: string) => {
    _setActiveCompanyId(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  };

  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    const [{ data: roles }, { data: comps }, { data: perms }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("companies").select("*").order("name"),
      supabase.from("user_company_permissions").select("company_id, module, can_view, can_edit").eq("user_id", user.id),
    ]);

    const superAdmin = (roles ?? []).some((r: any) => r.role === "super_admin");
    setIsSuperAdmin(superAdmin);
    setCompanies((comps ?? []) as Company[]);
    setPermissions((perms ?? []) as Permission[]);

    const allowed = (comps ?? []) as Company[];
    const saved = (() => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } })();
    const next = (saved && allowed.find((c) => c.id === saved)?.id) || allowed[0]?.id || null;
    _setActiveCompanyId(next);

    setLoading(false);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const canView = (module: AppModule, companyId?: string | null) => {
    if (isSuperAdmin) return true;
    const cid = companyId ?? activeCompanyId;
    if (!cid) return false;
    return permissions.some((p) => p.company_id === cid && p.module === module && p.can_view);
  };
  const canEdit = (module: AppModule, companyId?: string | null) => {
    if (isSuperAdmin) return true;
    const cid = companyId ?? activeCompanyId;
    if (!cid) return false;
    return permissions.some((p) => p.company_id === cid && p.module === module && p.can_edit);
  };

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? null;

  return (
    <Ctx.Provider value={{ loading, isSuperAdmin, companies, activeCompanyId, setActiveCompanyId, activeCompany, permissions, canView, canEdit, refresh }}>
      {children}
    </Ctx.Provider>
  );
};

export const useCompany = () => useContext(Ctx);

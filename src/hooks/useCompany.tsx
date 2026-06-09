import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppModule = "dashboard" | "empleados" | "inventario" | "domicilios" | "sedes" | "recetas" | "alarmas" | "manuales";

export interface Company {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
}

export interface Branch {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
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
  branches: Branch[];
  activeBranchId: string | null;
  setActiveBranchId: (id: string | null) => void;
  activeBranch: Branch | null;
  permissions: Permission[];
  canView: (module: AppModule, companyId?: string | null) => boolean;
  canEdit: (module: AppModule, companyId?: string | null) => boolean;
  refresh: () => Promise<void>;
  refreshBranches: () => Promise<void>;
}

const Ctx = createContext<CompanyContextType>({
  loading: true, isSuperAdmin: false, companies: [], activeCompanyId: null,
  setActiveCompanyId: () => {}, activeCompany: null,
  branches: [], activeBranchId: null, setActiveBranchId: () => {}, activeBranch: null,
  permissions: [], canView: () => false, canEdit: () => false,
  refresh: async () => {}, refreshBranches: async () => {},
});

const STORAGE_COMPANY = "apolo_active_company";
const STORAGE_BRANCH = "apolo_active_branch";

export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [activeCompanyId, _setActiveCompanyId] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, _setActiveBranchId] = useState<string | null>(null);

  const setActiveCompanyId = (id: string) => {
    _setActiveCompanyId(id);
    _setActiveBranchId(null);
    try {
      localStorage.setItem(STORAGE_COMPANY, id);
      localStorage.removeItem(STORAGE_BRANCH);
    } catch {}
  };

  const setActiveBranchId = (id: string | null) => {
    _setActiveBranchId(id);
    try {
      if (id) localStorage.setItem(STORAGE_BRANCH, id);
      else localStorage.removeItem(STORAGE_BRANCH);
    } catch {}
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
    const saved = (() => { try { return localStorage.getItem(STORAGE_COMPANY); } catch { return null; } })();
    const next = (saved && allowed.find((c) => c.id === saved)?.id) || null;
    _setActiveCompanyId(next);

    setLoading(false);
  }, [user]);

  const refreshBranches = useCallback(async () => {
    if (!activeCompanyId) { setBranches([]); return; }
    const { data } = await supabase.from("branches").select("id, company_id, name, address, is_active").eq("company_id", activeCompanyId).order("name");
    setBranches((data ?? []) as Branch[]);
  }, [activeCompanyId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    void refreshBranches();
    // restore saved branch (only if matches new company)
    const savedB = (() => { try { return localStorage.getItem(STORAGE_BRANCH); } catch { return null; } })();
    if (savedB) _setActiveBranchId(savedB);
  }, [refreshBranches]);

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
  const activeBranch = branches.find((b) => b.id === activeBranchId) ?? null;

  return (
    <Ctx.Provider value={{
      loading, isSuperAdmin, companies, activeCompanyId, setActiveCompanyId, activeCompany,
      branches, activeBranchId, setActiveBranchId, activeBranch,
      permissions, canView, canEdit, refresh, refreshBranches,
    }}>
      {children}
    </Ctx.Provider>
  );
};

export const useCompany = () => useContext(Ctx);

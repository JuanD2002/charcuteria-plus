import { useCompany } from "@/hooks/useCompany";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";

export const CompanySwitcher = () => {
  const { companies, activeCompanyId, setActiveCompanyId, loading } = useCompany();
  if (loading || companies.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={activeCompanyId ?? undefined} onValueChange={setActiveCompanyId}>
        <SelectTrigger className="h-8 w-[200px] text-sm">
          <SelectValue placeholder="Selecciona empresa" />
        </SelectTrigger>
        <SelectContent>
          {companies.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

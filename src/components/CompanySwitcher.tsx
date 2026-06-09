import { useNavigate } from "react-router-dom";
import { useCompany } from "@/hooks/useCompany";
import { Building2, ChevronLeft, MapPin, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const CompanySwitcher = () => {
  const { activeCompany, loading, branches, activeBranchId, setActiveBranchId } = useCompany();
  const navigate = useNavigate();
  if (loading) return null;
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/")}
        className="gap-2 -ml-1 hover:bg-muted"
        title="Volver a selección de empresa"
      >
        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        <Building2 className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">{activeCompany?.name ?? "Administración"}</span>
      </Button>
      {activeCompany && (
        <Select
          value={activeBranchId ?? "__all__"}
          onValueChange={(v) => setActiveBranchId(v === "__all__" ? null : v)}
        >
          <SelectTrigger className="h-8 w-auto gap-2 text-xs">
            {activeBranchId ? <MapPin className="h-3.5 w-3.5 text-primary" /> : <Globe className="h-3.5 w-3.5 text-muted-foreground" />}
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toda la empresa</SelectItem>
            {branches.filter((b) => b.is_active).map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

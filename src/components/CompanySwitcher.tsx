import { useNavigate } from "react-router-dom";
import { useCompany } from "@/hooks/useCompany";
import { Building2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const CompanySwitcher = () => {
  const { activeCompany, loading } = useCompany();
  const navigate = useNavigate();
  if (loading) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate("/")}
      className="gap-2 -ml-1 hover:bg-muted"
      title="Volver a selección de empresa"
    >
      <ChevronLeft className="h-4 w-4 text-muted-foreground" />
      <Building2 className="h-4 w-4 text-primary" />
      <span className="font-medium text-sm">
        {activeCompany?.name ?? "Administración"}
      </span>
    </Button>
  );
};

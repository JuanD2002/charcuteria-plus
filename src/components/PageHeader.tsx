import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export const PageHeader = ({ title, description, icon, action }: PageHeaderProps) => (
  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-3">
      {icon && (
        <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-primary text-primary-foreground shadow-elegant">
          {icon}
        </div>
      )}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
    {action && <div>{action}</div>}
  </div>
);

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  variant?: "default" | "success" | "warning" | "info" | "primary";
}

export const StatCard = ({ label, value, hint, icon, variant = "default" }: StatCardProps) => {
  const variantClasses = {
    default: "bg-card",
    success: "bg-card border-success/30",
    warning: "bg-card border-warning/30",
    info: "bg-card border-info/30",
    primary: "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground border-transparent",
  };
  const iconBg = {
    default: "bg-muted text-muted-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    info: "bg-info/15 text-info",
    primary: "bg-primary-foreground/20 text-primary-foreground",
  };
  return (
    <Card className={cn("transition-smooth hover:shadow-elegant", variantClasses[variant])}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={cn("text-xs font-medium uppercase tracking-wider", variant === "primary" ? "text-primary-foreground/80" : "text-muted-foreground")}>{label}</p>
            <p className="mt-2 text-3xl font-bold font-display">{value}</p>
            {hint && <p className={cn("mt-1 text-xs", variant === "primary" ? "text-primary-foreground/80" : "text-muted-foreground")}>{hint}</p>}
          </div>
          {icon && (
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", iconBg[variant])}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

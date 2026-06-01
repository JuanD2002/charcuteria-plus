import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { CompanyProvider } from "@/hooks/useCompany";
import { CompanySwitcher } from "@/components/CompanySwitcher";

export const AppLayout = () => {
  return (
    <CompanyProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center gap-3 border-b bg-card/60 backdrop-blur px-4 sticky top-0 z-30">
              <SidebarTrigger />
              <CompanySwitcher />
              <div className="flex-1" />
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <span>Sistema en línea</span>
              </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-fade-in">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </CompanyProvider>
  );
};

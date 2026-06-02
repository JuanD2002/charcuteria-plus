import { Outlet } from "react-router-dom";
import { CompanyProvider } from "@/hooks/useCompany";

export const CompanyProviderLayout = () => (
  <CompanyProvider>
    <Outlet />
  </CompanyProvider>
);

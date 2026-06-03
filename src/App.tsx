import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { CompanyProviderLayout } from "@/components/CompanyProviderLayout";
import Auth from "./pages/Auth";
import CompanySelector from "./pages/CompanySelector";
import Dashboard from "./pages/Dashboard";
import Empleados from "./pages/Empleados";
import Inventario from "./pages/Inventario";
import Domicilios from "./pages/Domicilios";
import Sedes from "./pages/Sedes";
import Recetas from "./pages/Recetas";
import Alarmas from "./pages/Alarmas";
import Manuales from "./pages/Manuales";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><CompanyProviderLayout /></ProtectedRoute>}>
              <Route path="/" element={<CompanySelector />} />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/sedes" element={<Sedes />} />
                <Route path="/empleados" element={<Empleados />} />
                <Route path="/inventario" element={<Inventario />} />
                <Route path="/recetas" element={<Recetas />} />
                <Route path="/domicilios" element={<Domicilios />} />
                <Route path="/alarmas" element={<Alarmas />} />
                <Route path="/manuales" element={<Manuales />} />
                <Route path="/admin" element={<Admin />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

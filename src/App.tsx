import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

import Index from "./pages/Index";
import Menu from "./pages/Menu";
import Acompanhamento from "./pages/Acompanhamento";
import Matriz from "./pages/Matriz";
import Graficos from "./pages/Graficos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Redireciona a raiz com base no estado de autenticação
const RootRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? <Navigate to="/menu" replace /> : <Index />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRoute />} />
            
            <Route path="/menu" element={<ProtectedRoute><Menu /></ProtectedRoute>} />
            <Route path="/acompanhamento" element={<ProtectedRoute><Acompanhamento /></ProtectedRoute>} />
            <Route path="/matriz" element={<ProtectedRoute><Matriz /></ProtectedRoute>} />
            <Route path="/graficos" element={<ProtectedRoute><Graficos /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
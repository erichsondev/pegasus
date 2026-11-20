import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Menu from "./pages/Menu";
import Acompanhamento from "./pages/Acompanhamento";
import Matriz from "./pages/Matriz";
import Graficos from "./pages/Graficos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const PublicHome = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? <Navigate to="/menu" replace /> : <Landing />;
};

const PublicAuth = () => {
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
            <Route path="/" element={<PublicHome />} />
            <Route path="/acesso" element={<PublicAuth />} />
            <Route path="/login" element={<Navigate to="/acesso" replace />} />
            <Route path="/cadastro" element={<Navigate to="/acesso?modo=cadastro" replace />} />

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
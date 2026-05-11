import { Navigate } from "react-router-dom";
import { estaLogado } from "@/lib/storage";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  if (!estaLogado()) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

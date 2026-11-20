import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
}

const AuthContext = createContext<AuthContextType>({ 
  isAuthenticated: false, 
  isLoading: true, 
  user: null 
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error("Auth: Erro ao buscar sessão do Supabase", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
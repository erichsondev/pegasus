import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Moon,
  Sun,
  Home,
  LayoutDashboard,
  PieChart,
  Settings,
  LogOut,
  User,
} from "lucide-react";
import { useTheme } from "./theme-provider";
import { useAuth } from "@/contexts/AuthContext";
import { fazerLogout } from "@/lib/storage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/logo.png";

interface NavigationProps {
  title?: string;
}

export const Navigation = ({ title }: NavigationProps) => {
  const location = useLocation();
  const { setTheme } = useTheme();
  const { user } = useAuth();

  const nomeUsuario =
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "Usuário";

  return (
    <nav className="fixed top-0 left-0 right-0 bg-background/80 backdrop-blur-md border-b z-50">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Logo e Título */}
          <Link to="/menu" className="flex items-center gap-3 shrink-0">
            <img
              src={logo}
              alt="Pegasus Finance"
              className="h-10 w-10 object-contain bg-white p-1 rounded-lg shadow-sm"
            />
            <div className="flex items-center">
              <span className="font-semibold text-xl pr-2 border-r text-foreground">
                Pegasus Finance
              </span>
              {title && (
                <span className="hidden sm:inline font-normal text-base text-muted-foreground pl-2">
                  {title}
                </span>
              )}
            </div>
          </Link>

          {/* Navegação e Ações */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Link to="/menu">
              <Button
                variant={location.pathname === "/menu" ? "default" : "ghost"}
                size="sm"
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                <span className="hidden md:inline">Início</span>
              </Button>
            </Link>

            <Link to="/acompanhamento">
              <Button
                variant={location.pathname === "/acompanhamento" ? "default" : "ghost"}
                size="sm"
                className="gap-2"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden md:inline">Acompanhamento</span>
              </Button>
            </Link>

            <Link to="/graficos">
              <Button
                variant={location.pathname === "/graficos" ? "default" : "ghost"}
                size="sm"
                className="gap-2"
              >
                <PieChart className="h-4 w-4" />
                <span className="hidden md:inline">Inteligência</span>
              </Button>
            </Link>

            <Link to="/matriz">
              <Button
                variant={location.pathname === "/matriz" ? "default" : "ghost"}
                size="sm"
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden md:inline">Configurações</span>
              </Button>
            </Link>

            {/* Alternador de Tema (Claro / Escuro / Sistema) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title="Alternar tema">
                  <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Alternar tema</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>Claro</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>Escuro</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>Sistema</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Usuário + Sair */}
            <div className="hidden lg:flex items-center gap-2 pl-2 border-l text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="font-medium text-foreground">{nomeUsuario}</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => fazerLogout()}
              className="text-muted-foreground hover:text-destructive gap-1.5"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};
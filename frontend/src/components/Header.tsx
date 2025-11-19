import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { fazerLogout, obterNomeUsuario } from "@/lib/storage";
import logo from "@/assets/logo.png";

export const Header = () => {
  const navigate = useNavigate();
  const nomeUsuario = obterNomeUsuario();

  const handleLogout = () => {
    fazerLogout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200/50 bg-white/70 backdrop-blur-md shadow-sm transition-all">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img 
            src={logo} 
            alt="Pegasus Finance" 
            className="w-10 h-10 md:w-12 md:h-12 object-contain drop-shadow-sm" 
          />
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">
            Pegasus Finance
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-slate-600">
            <div className="p-1.5 bg-slate-100 rounded-full">
              <User className="w-5 h-5 text-slate-700" />
            </div>
            <span className="font-semibold text-sm md:text-base">{nomeUsuario}</span>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
};
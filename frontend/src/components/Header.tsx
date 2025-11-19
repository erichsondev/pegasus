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
    <header className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Pegasus Finance" className="w-10 h-10 md:w-12 md:h-12" />
          <h1 className="text-2xl md:text-3xl font-bold">Pegasus Finance</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2">
            <User className="w-5 h-5" />
            <span className="font-semibold">{nomeUsuario}</span>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
};

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, User, ArrowLeft } from "lucide-react";
import { fazerLogout, obterNomeUsuario } from "@/lib/storage";
import logo from "@/assets/logo.png";

interface HeaderProps {
  showBack?: boolean; // Nova propriedade opcional
  backPath?: string;  // Para onde ele volta? (Opcional, padrão é voltar 1 passo)
}

export const Header = ({ showBack = false, backPath }: HeaderProps) => {
  const navigate = useNavigate();
  const nomeUsuario = obterNomeUsuario();

  const handleLogout = () => {
    fazerLogout();
    navigate("/");
  };

  const handleBack = () => {
    if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1); // Volta para a página anterior no histórico
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200/50 bg-white/70 backdrop-blur-md shadow-sm transition-all">
      <div className="container mx-auto px-4 py-3 md:py-4 flex justify-between items-center">
        
        <div className="flex items-center gap-3 md:gap-4">
          {/* Botão de Voltar Condicional */}
          {showBack && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBack}
              className="mr-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full"
              title="Voltar"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
          )}

          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/menu')}>
            <img 
              src={logo} 
              alt="Pegasus Finance" 
              className="w-9 h-9 md:w-10 md:h-10 object-contain drop-shadow-sm" 
            />
            {/* Esconde o nome em mobile se tiver o botão voltar pra economizar espaço */}
            <h1 className={`text-xl md:text-2xl font-bold text-slate-800 tracking-tight ${showBack ? 'hidden md:block' : 'block'}`}>
              Pegasus Finance
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3 md:gap-4">
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
            className="text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5 md:mr-2" />
            <span className="hidden md:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  PieChart, 
  Settings, 
  ArrowRight, 
  Wallet, 
  Lightbulb // Ícone de lâmpada para dicas
} from "lucide-react";
import { obterResumo, obterNomeUsuario } from "@/lib/storage";

const Menu = () => {
  const navigate = useNavigate();
  const [nome, setNome] = useState("Usuário");
  const [saldo, setSaldo] = useState<number | null>(null);
  const [saudacao, setSaudacao] = useState("");

  useEffect(() => {
    // 1. Carregar Nome de forma segura
    try {
      const nomeSalvo = obterNomeUsuario();
      if (nomeSalvo) setNome(nomeSalvo.split(" ")[0]); 
    } catch (e) {
      console.error("Erro ao carregar nome", e);
    }

    // 2. Definir Saudação
    const hora = new Date().getHours();
    if (hora < 12) setSaudacao("Bom dia");
    else if (hora < 18) setSaudacao("Boa tarde");
    else setSaudacao("Boa noite");

    // 3. Carregar Saldo Rápido (Resumo do Mês Atual)
    const carregarSaldo = async () => {
      const hoje = new Date();
      try {
        const resumo = await obterResumo(hoje.getFullYear(), hoje.getMonth() + 1);
        if (resumo) {
          setSaldo(resumo.saldoAtualAcumulado);
        } else {
          setSaldo(0);
        }
      } catch (e) {
        console.error("Erro ao carregar saldo", e);
        setSaldo(0);
      }
    };
    carregarSaldo();
  }, []);

  const formatarMoeda = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen pb-10 bg-background">
      {/* Header Padrão */}
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-4xl animate-fade-in">
        
        {/* Boas Vindas */}
        <div className="mb-8 space-y-1">
          <h1 className="text-3xl font-bold text-slate-800">
            {saudacao}, <span className="text-primary">{nome}</span>!
          </h1>
          <p className="text-muted-foreground">Aqui está o panorama das suas finanças hoje.</p>
        </div>

        {/* Card Destaque: Saldo */}
        <div className="mb-10">
           <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-xl shadow-blue-200 hover:shadow-2xl transition-shadow duration-300">
              {/* Efeitos de fundo */}
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl animate-pulse"></div>
              <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-white/10 blur-3xl"></div>
              
              <div className="relative z-10">
                <p className="flex items-center gap-2 text-blue-100 font-medium mb-2">
                  <Wallet className="w-5 h-5" /> Saldo Previsto em Conta
                </p>
                <h2 className="text-4xl font-bold tracking-tight">
                  {saldo !== null ? formatarMoeda(saldo) : "Carregando..."}
                </h2>
                <div className="mt-6">
                   <Button 
                     onClick={() => navigate("/acompanhamento")}
                     className="bg-white text-blue-600 hover:bg-blue-50 border-none font-semibold shadow-md hover:shadow-lg transition-all"
                   >
                     Ver Extrato Completo
                   </Button>
                </div>
              </div>
           </div>
        </div>

        {/* Grid de Acesso Rápido */}
        <h3 className="text-lg font-semibold text-slate-700 mb-4">Acesso Rápido</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Acompanhamento */}
          <Card 
            className="group cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-slate-100 glass-card"
            onClick={() => navigate("/acompanhamento")}
          >
            <CardContent className="p-6 flex flex-col h-full justify-between">
              <div>
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <LayoutDashboard className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Acompanhamento</h3>
                <p className="text-muted-foreground text-sm">
                  Registre entradas, saídas e acompanhe seu fluxo de caixa.
                </p>
              </div>
              <div className="mt-4 flex items-center text-green-600 font-medium text-sm">
                Acessar <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>

          {/* Gráficos */}
          <Card 
            className="group cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-slate-100 glass-card"
            onClick={() => navigate("/graficos")}
          >
            <CardContent className="p-6 flex flex-col h-full justify-between">
              <div>
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <PieChart className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Inteligência</h3>
                <p className="text-muted-foreground text-sm">
                  Gráficos de evolução, DRE gerencial e análise de gastos.
                </p>
              </div>
              <div className="mt-4 flex items-center text-purple-600 font-medium text-sm">
                Visualizar <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>

          {/* Configurações */}
          <Card 
            className="group cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-slate-100 glass-card"
            onClick={() => navigate("/matriz")}
          >
            <CardContent className="p-6 flex flex-col h-full justify-between">
              <div>
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Settings className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Configurações</h3>
                <p className="text-muted-foreground text-sm">
                  Gerencie contas fixas, categorias e recorrências.
                </p>
              </div>
              <div className="mt-4 flex items-center text-orange-600 font-medium text-sm">
                Configurar <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Dica Financeira */}
        <div className="mt-12 bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-200 flex items-start gap-3 shadow-sm">
           <Lightbulb className="w-5 h-5 text-slate-400 mt-0.5" />
           <div>
             <h4 className="text-sm font-semibold text-slate-700">Dica Financeira</h4>
             <p className="text-sm text-slate-500">
               Para gráficos mais precisos, categorize todas as suas despesas na aba "Configurações".
             </p>
           </div>
        </div>

      </main>
    </div>
  );
};

export default Menu;
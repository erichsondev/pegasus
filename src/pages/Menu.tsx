import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  PieChart, 
  Settings, 
  ArrowRight, 
  Wallet, 
  Lightbulb, 
  CalendarClock,
  TrendingUp,
  ArrowUpCircle,   // Novo ícone para Receita
  ArrowDownCircle  // Novo ícone para Despesa
} from "lucide-react";
import { obterResumo, obterNomeUsuario } from "@/lib/storage";

// Interface simplificada para transações na home
interface TransacaoResumo {
  id: number;
  descricao: string;
  valor: number;
  data: string;
  tipo: 'receita' | 'despesa';
}

const Menu = () => {
  const navigate = useNavigate();
  const [nome, setNome] = useState("Usuário");
  const [saldo, setSaldo] = useState<number | null>(null);
  const [resumoMes, setResumoMes] = useState<any>(null);
  const [saudacao, setSaudacao] = useState("");
  const [proximosVencimentos, setProximosVencimentos] = useState<TransacaoResumo[]>([]);
  
  // Dados de Data
  const hoje = new Date();
  const mesAtualNome = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const diaAtual = hoje.getDate();
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const progressoMes = (diaAtual / ultimoDiaMes) * 100;

  useEffect(() => {
    try {
      const nomeSalvo = obterNomeUsuario();
      if (nomeSalvo) setNome(nomeSalvo.split(" ")[0]); 
    } catch (e) {
      console.error("Erro ao carregar nome", e);
    }

    const hora = new Date().getHours();
    if (hora < 12) setSaudacao("Bom dia");
    else if (hora < 18) setSaudacao("Boa tarde");
    else setSaudacao("Boa noite");

    const carregarDados = async () => {
      try {
        const resumo = await obterResumo(hoje.getFullYear(), hoje.getMonth() + 1);
        if (resumo) {
          setSaldo(resumo.saldoAtualAcumulado);
          setResumoMes(resumo);
        } else {
          setSaldo(0);
        }

        const token = localStorage.getItem("token");
        if(token) {
            const ano = hoje.getFullYear();
            const mes = hoje.getMonth() + 1;
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/transacoes?ano=${ano}&mes=${mes}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if(res.ok) {
                const lista: TransacaoResumo[] = await res.json();
                const dataHojeStr = hoje.toISOString().split('T')[0];
                const pendentes = lista
                    .filter(t => t.data >= dataHojeStr && (t as any).status === 'previsto')
                    .sort((a, b) => a.data.localeCompare(b.data))
                    .slice(0, 3);
                setProximosVencimentos(pendentes);
            }
        }

      } catch (e) {
        console.error("Erro ao carregar dados", e);
        setSaldo(0);
      }
    };
    carregarDados();
  }, []);

  const formatarMoeda = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen pb-10 bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-4xl animate-fade-in">
        
        {/* Cabeçalho de Boas Vindas + Info Mês */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
            <div className="space-y-1">
                <h1 className="text-3xl font-bold text-slate-800">
                    {saudacao}, <span className="text-primary">{nome}</span>!
                </h1>
                <p className="text-muted-foreground">Visão geral das suas finanças.</p>
            </div>
            
            <div className="text-right bg-white/50 p-3 rounded-lg border border-slate-100 shadow-sm min-w-[200px]">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">{mesAtualNome}</p>
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-slate-600 font-medium">Dia {diaAtual} de {ultimoDiaMes}</span>
                </div>
                <Progress value={progressoMes} className="h-2 bg-slate-200" />
            </div>
        </div>

        {/* CARD PRINCIPAL UNIFICADO (AZUL DEGRADÊ) */}
        <div className="mb-10">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-xl shadow-blue-200 hover:shadow-2xl transition-all duration-300">
              
              {/* Efeitos de fundo (bolhas) */}
              <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-pulse pointer-events-none"></div>
              <div className="absolute -left-20 -bottom-20 h-80 w-80 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col gap-6">
                
                {/* Linha Superior: Saldos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Saldo Atual */}
                    <div>
                        <p className="flex items-center gap-2 text-blue-100 font-medium mb-1 text-sm uppercase tracking-wide">
                           <Wallet className="w-4 h-4" /> Saldo Atual
                        </p>
                        <h2 className="text-4xl font-bold tracking-tight">
                           {saldo !== null ? formatarMoeda(saldo) : "..."}
                        </h2>
                        <p className="text-xs text-blue-200 mt-1">Disponível agora</p>
                    </div>

                    {/* Saldo Previsto */}
                    <div className="md:border-l md:border-white/20 md:pl-8">
                        <p className="flex items-center gap-2 text-blue-100 font-medium mb-1 text-sm uppercase tracking-wide">
                           <TrendingUp className="w-4 h-4" /> Saldo Previsto
                        </p>
                        <h2 className="text-4xl font-bold tracking-tight text-white/90">
                           {resumoMes ? formatarMoeda(resumoMes.saldoFinalProjetado) : "..."}
                        </h2>
                        <p className="text-xs text-blue-200 mt-1">Ao final do mês</p>
                    </div>
                </div>

                {/* Divisor */}
                <div className="h-px bg-white/20 w-full"></div>

                {/* Linha Inferior: Entradas/Saídas + Botão */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex w-full md:w-auto gap-8 justify-between md:justify-start">
                        {/* Entradas */}
                        <div>
                            <p className="text-xs text-blue-100 font-bold uppercase mb-1 flex items-center gap-1">
                               <ArrowUpCircle className="w-3.5 h-3.5 text-green-300" /> Receitas
                            </p>
                            <p className="text-lg font-bold text-green-50">
                               {resumoMes ? formatarMoeda(resumoMes.totalReceitasEfetivadas + resumoMes.totalReceitasPrevistas) : "..."}
                            </p>
                        </div>

                        {/* Saídas */}
                        <div>
                            <p className="text-xs text-blue-100 font-bold uppercase mb-1 flex items-center gap-1">
                               <ArrowDownCircle className="w-3.5 h-3.5 text-red-300" /> Despesas
                            </p>
                            <p className="text-lg font-bold text-red-50">
                               {resumoMes ? formatarMoeda(resumoMes.totalDespesasEfetivadas + resumoMes.totalDespesasPrevistas) : "..."}
                            </p>
                        </div>
                    </div>

                    <Button 
                     onClick={() => navigate("/acompanhamento")}
                     className="bg-white text-blue-600 hover:bg-blue-50 border-none font-semibold shadow-md w-full md:w-auto"
                    >
                     Ver Extrato Completo
                    </Button>
                </div>

              </div>
            </div>
        </div>

        {/* Próximos Vencimentos */}
        <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-slate-500" /> Próximos Vencimentos
        </h3>
        
        <div className="mb-10 grid gap-3">
            {proximosVencimentos.length > 0 ? (
                proximosVencimentos.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-all border-l-4 border-l-blue-500">
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col items-center justify-center bg-slate-100 rounded-lg p-2 min-w-[50px]">
                                <span className="text-xs text-slate-500 uppercase font-bold">{new Date(item.data).toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                                <span className="text-xl font-bold text-slate-800">{new Date(item.data).getDate()}</span>
                            </div>
                            <div>
                                <p className="font-semibold text-slate-800">{item.descricao}</p>
                                <p className="text-xs text-slate-500 capitalize">{item.tipo}</p>
                            </div>
                        </div>
                        <p className={`font-bold ${item.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                            {formatarMoeda(item.valor)}
                        </p>
                    </div>
                ))
            ) : (
                <div className="text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                    Nenhuma conta próxima para vencer! 🎉
                </div>
            )}
        </div>

        {/* Grid de Acesso Rápido */}
        <h3 className="text-lg font-semibold text-slate-700 mb-4">Acesso Rápido</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
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
import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
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
  ArrowUpCircle,
  ArrowDownCircle
} from "lucide-react";
import { obterResumo, obterTransacoes } from "@/lib/storage";
import { useAuth } from "@/contexts/AuthContext";

interface TransacaoResumo {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  tipo: 'receita' | 'despesa' | 'investimento';
}

const Menu = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const nome = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Usuário";
  const [saldo, setSaldo] = useState<number | null>(null);
  const [resumoMes, setResumoMes] = useState<any>(null);
  const [saudacao, setSaudacao] = useState("");
  const [proximosVencimentos, setProximosVencimentos] = useState<TransacaoResumo[]>([]);

  const hoje = new Date();
  const mesAtualNome = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const diaAtual = hoje.getDate();
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const progressoMes = (diaAtual / ultimoDiaMes) * 100;

  useEffect(() => {
    document.title = "Início | Pegasus Finance";
    const hora = new Date().getHours();
    if (hora < 12) setSaudacao("Bom dia");
    else if (hora < 18) setSaudacao("Boa tarde");
    else setSaudacao("Boa noite");

    const carregarDados = async () => {
      try {
        const ano = hoje.getFullYear();
        const mes = hoje.getMonth() + 1;

        const resumo = await obterResumo(ano, mes);
        if (resumo) {
          setSaldo(resumo.saldoAtualAcumulado);
          setResumoMes(resumo);
        } else {
          setSaldo(0);
        }

        const transacoes = await obterTransacoes(ano, mes);
        const dataHojeStr = `${ano}-${String(mes).padStart(2, '0')}-${String(diaAtual).padStart(2, '0')}`;

        const pendentes = transacoes
          .filter(t => t.data >= dataHojeStr && t.status === 'previsto')
          .sort((a, b) => a.data.localeCompare(b.data))
          .slice(0, 3)
          .map(t => ({
            id: t.id,
            descricao: t.descricao,
            valor: t.valor,
            data: t.data,
            tipo: t.tipo
          }));

        setProximosVencimentos(pendentes);
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
    <div className="min-h-screen pb-10">
      <Navigation />
      <div className="max-w-7xl mx-auto pt-24 p-6 space-y-8 animate-fade-in">
        {/* Cabeçalho Hero Translúcido */}
        <div className="text-white bg-black/50 p-8 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              {saudacao}, <span className="text-primary">{nome}</span>!
            </h1>
            <p className="text-base md:text-lg text-gray-200">
              Visão geral consolidada das suas finanças pessoais e domésticas.
            </p>
          </div>

          <div className="bg-white/10 p-4 rounded-xl border border-white/15 min-w-[220px]">
            <p className="text-xs font-bold text-gray-300 uppercase mb-1">{mesAtualNome}</p>
            <div className="flex items-center justify-between text-sm text-white font-medium mb-2">
              <span>Dia {diaAtual} de {ultimoDiaMes}</span>
              <span>{Math.round(progressoMes)}%</span>
            </div>
            <Progress value={progressoMes} className="h-2 bg-white/20" />
          </div>
        </div>

        {/* Card Principal em Glassmorphism com Luz Ambiente Sutil */}
        <Card className="relative overflow-hidden rounded-2xl glass-card shadow-lg border-t-2 border-t-primary/60">
          {/* Reflexo sutil no canto superior esquerdo */}
          <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

          <CardContent className="relative z-10 p-6 md:p-8 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/15 border border-primary/20 text-primary shrink-0 mt-1">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold mb-1 text-xs uppercase tracking-wider">
                    Saldo Atual
                  </p>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                    {saldo !== null ? formatarMoeda(saldo) : "..."}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">Disponível agora (efetivado)</p>
                </div>
              </div>

              <div className="md:border-l md:border-border/60 md:pl-8 flex items-start gap-4">
                <div className="p-3 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400 shrink-0 mt-1">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold mb-1 text-xs uppercase tracking-wider">
                    Saldo Previsto
                  </p>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                    {resumoMes ? formatarMoeda(resumoMes.saldoFinalProjetado) : "..."}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">Projeção ao final do mês</p>
                </div>
              </div>
            </div>

            <div className="h-px bg-border/60 w-full"></div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex flex-wrap w-full md:w-auto gap-8 justify-between md:justify-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/15 text-green-600 dark:text-green-400">
                    <ArrowUpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase">
                      Receitas do Mês
                    </p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {resumoMes ? formatarMoeda(resumoMes.totalReceitasEfetivadas + resumoMes.totalReceitasPrevistas) : "..."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/15 text-red-600 dark:text-red-400">
                    <ArrowDownCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase">
                      Despesas do Mês
                    </p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">
                      {resumoMes ? formatarMoeda(resumoMes.totalDespesasEfetivadas + resumoMes.totalDespesasPrevistas) : "..."}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                variant="secondary"
                onClick={() => navigate("/acompanhamento")}
                className="font-semibold border border-border/60 hover:border-primary/50 w-full md:w-auto gap-2"
              >
                Ver Extrato Completo <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Próximos Vencimentos */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" /> Próximos Vencimentos
          </h3>

          <div className="grid gap-3">
            {proximosVencimentos.length > 0 ? (
              proximosVencimentos.map(item => (
                <Card key={item.id} className="glass-card border-l-4 border-l-primary">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center justify-center bg-muted/70 rounded-lg p-2 min-w-[52px]">
                        <span className="text-xs text-muted-foreground uppercase font-bold">
                          {new Date(item.data).toLocaleString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '')}
                        </span>
                        <span className="text-xl font-bold">{new Date(item.data).getUTCDate()}</span>
                      </div>
                      <div>
                        <p className="font-semibold">{item.descricao}</p>
                        <p className="text-xs text-muted-foreground capitalize">{item.tipo}</p>
                      </div>
                    </div>
                    <p className={`font-bold ${item.tipo === 'receita' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatarMoeda(item.valor)}
                    </p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="glass-card border-dashed">
                <CardContent className="p-6 text-center text-muted-foreground">
                  Nenhuma conta próxima para vencer neste mês!
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Acesso Rápido */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Módulos do Sistema</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card
              className="group cursor-pointer glass-card hover:border-primary/50 hover:shadow-lg transition-all"
              onClick={() => navigate("/acompanhamento")}
            >
              <CardContent className="p-6 flex flex-col h-full justify-between">
                <div>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <LayoutDashboard className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Acompanhamento</h3>
                  <p className="text-muted-foreground text-sm">Registre entradas, saídas e acompanhe seu fluxo de caixa.</p>
                </div>
                <div className="mt-4 flex items-center text-primary font-medium text-sm">
                  Acessar <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="group cursor-pointer glass-card hover:border-primary/50 hover:shadow-lg transition-all"
              onClick={() => navigate("/graficos")}
            >
              <CardContent className="p-6 flex flex-col h-full justify-between">
                <div>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <PieChart className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Inteligência</h3>
                  <p className="text-muted-foreground text-sm">Gráficos de evolução, DRE gerencial e análise de gastos.</p>
                </div>
                <div className="mt-4 flex items-center text-primary font-medium text-sm">
                  Visualizar <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="group cursor-pointer glass-card hover:border-primary/50 hover:shadow-lg transition-all"
              onClick={() => navigate("/matriz")}
            >
              <CardContent className="p-6 flex flex-col h-full justify-between">
                <div>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Settings className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Configurações</h3>
                  <p className="text-muted-foreground text-sm">Gerencie contas fixas, categorias e recorrências.</p>
                </div>
                <div className="mt-4 flex items-center text-primary font-medium text-sm">
                  Configurar <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="glass-card">
          <CardContent className="p-4 flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold">Dica Financeira</h4>
              <p className="text-sm text-muted-foreground">
                Para gráficos e DRE mais precisos, categorize todas as suas receitas e despesas na aba "Configurações".
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Menu;
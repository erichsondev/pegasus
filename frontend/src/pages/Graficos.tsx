import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { ArrowUpCircle, ArrowDownCircle, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Cores modernas para os gráficos
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

interface Transacao {
  id: number;
  descricao: string;
  valor: number; // Vem como string ou number do banco
  tipo: 'receita' | 'despesa';
  status: string;
  data: string;
  nome_categoria: string;
  cartao_id?: number;
}

const Graficos = () => {
  const [mesInicio, setMesInicio] = useState("");
  const [mesFim, setMesFim] = useState("");
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Configuração inicial de datas (Mês atual)
  useEffect(() => {
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    
    // Padrão: Começa no dia 1 do ano atual ou 3 meses atrás
    const dataInicio = new Date();
    dataInicio.setMonth(dataInicio.getMonth() - 3);
    const mesPassado = `${dataInicio.getFullYear()}-${String(dataInicio.getMonth() + 1).padStart(2, '0')}`;
    
    setMesInicio(mesPassado);
    setMesFim(mesAtual);
  }, []);

  useEffect(() => {
    if (mesInicio && mesFim) {
      carregarDados();
    }
  }, [mesInicio, mesFim]);

  const carregarDados = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      
      // Vamos buscar mês a mês para compor o período (solução frontend para não mexer no backend agora)
      // O ideal seria ter uma rota /transacoes/periodo, mas vamos usar o loop para garantir
      
      const start = new Date(mesInicio + "-02"); // Dia 2 para evitar fuso horario caindo no mes anterior
      const end = new Date(mesFim + "-02");
      let todasTransacoes: Transacao[] = [];

      // Loop simples para pegar todos os meses do intervalo
      for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
        const ano = d.getFullYear();
        const mes = d.getMonth() + 1;
        
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/transacoes?ano=${ano}&mes=${mes}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.ok) {
          const dados = await response.json();
          todasTransacoes = [...todasTransacoes, ...dados];
        }
      }

      // Remover duplicadas se houver e garantir tipagem
      setTransacoes(todasTransacoes);

    } catch (error) {
      console.error("Erro ao carregar dados", error);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // --- CÁLCULOS E PROCESSAMENTO DE DADOS (BI) ---

  const kpis = useMemo(() => {
    const receitas = transacoes.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + Number(t.valor), 0);
    const despesas = transacoes.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + Number(t.valor), 0);
    const saldo = receitas - despesas;
    const economia = receitas > 0 ? ((receitas - despesas) / receitas) * 100 : 0;

    // Fechamento (Efetivado vs Previsto)
    const despesasEfetivadas = transacoes
      .filter(t => t.tipo === 'despesa' && t.status === 'efetivado')
      .reduce((acc, t) => acc + Number(t.valor), 0);
    
    const progressoFechamento = despesas > 0 ? (despesasEfetivadas / despesas) * 100 : 0;

    return { receitas, despesas, saldo, economia, despesasEfetivadas, progressoFechamento };
  }, [transacoes]);

  const dadosCategorias = useMemo(() => {
    const map = new Map();
    transacoes.filter(t => t.tipo === 'despesa').forEach(t => {
      const cat = t.nome_categoria || 'Outros';
      const val = Number(t.valor);
      map.set(cat, (map.get(cat) || 0) + val);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // Ordenar maior para menor
  }, [transacoes]);

  const maioresGastos = useMemo(() => {
    return transacoes
      .filter(t => t.tipo === 'despesa')
      .sort((a, b) => Number(b.valor) - Number(a.valor))
      .slice(0, 5); // Top 5
  }, [transacoes]);

  const dadosEvolucao = useMemo(() => {
    const map = new Map(); // Chave: "YYYY-MM"
    transacoes.forEach(t => {
      const mesAno = t.data.substring(0, 7); // Pega YYYY-MM
      if (!map.has(mesAno)) map.set(mesAno, { mes: mesAno, receitas: 0, despesas: 0 });
      const atual = map.get(mesAno);
      if (t.tipo === 'receita') atual.receitas += Number(t.valor);
      else atual.despesas += Number(t.valor);
    });
    return Array.from(map.values()).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [transacoes]);

  const dreData = useMemo(() => {
    // Agrupar por categoria para o DRE
    const receitasMap = new Map();
    const despesasMap = new Map();

    transacoes.forEach(t => {
        const cat = t.nome_categoria || 'Sem Categoria';
        const val = Number(t.valor);
        if(t.tipo === 'receita') receitasMap.set(cat, (receitasMap.get(cat) || 0) + val);
        else despesasMap.set(cat, (despesasMap.get(cat) || 0) + val);
    });

    return {
        receitas: Array.from(receitasMap.entries()).map(([nome, valor]) => ({ nome, valor })),
        despesas: Array.from(despesasMap.entries()).map(([nome, valor]) => ({ nome, valor })),
    };
  }, [transacoes]);

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header showBack={true} backPath="/menu" />

      <main className="container mx-auto px-4 md:px-6 py-8 animate-fade-in">
        
        {/* Header da Página com Filtros */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Inteligência Financeira</h2>
            <p className="text-slate-500 text-sm">Analise seus resultados e tome decisões melhores.</p>
          </div>
          <div className="flex gap-4 items-center w-full md:w-auto">
            <div className="w-full md:w-auto">
              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Início</label>
              <Input type="month" value={mesInicio} onChange={(e) => setMesInicio(e.target.value)} className="bg-slate-50 border-slate-200" />
            </div>
            <div className="w-full md:w-auto">
              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Fim</label>
              <Input type="month" value={mesFim} onChange={(e) => setMesFim(e.target.value)} className="bg-slate-50 border-slate-200" />
            </div>
          </div>
        </div>

        {/* KPIs - Indicadores Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-green-500" /> Receitas
              </span>
              <span className="text-2xl font-bold text-slate-800">{formatarMoeda(kpis.receitas)}</span>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-red-500" /> Despesas
              </span>
              <span className="text-2xl font-bold text-slate-800">{formatarMoeda(kpis.despesas)}</span>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-blue-600 to-blue-700 text-white">
            <CardContent className="p-6 flex flex-col gap-1">
              <span className="text-sm font-medium text-blue-100 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Saldo Líquido
              </span>
              <span className="text-2xl font-bold">{formatarMoeda(kpis.saldo)}</span>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex flex-col gap-4">
              <div className="flex justify-between items-end">
                <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                   <TrendingUp className="w-4 h-4 text-purple-500" /> Taxa de Poupança
                </span>
                <span className={`text-xl font-bold ${kpis.economia > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {kpis.economia.toFixed(1)}%
                </span>
              </div>
              <Progress value={Math.max(0, kpis.economia)} className="h-2 bg-slate-100" />
            </CardContent>
          </Card>
        </div>

        {/* Status do Fechamento e Evolução */}
        <div className="grid lg:grid-cols-3 gap-8 mb-8">
          
          {/* Gráfico de Evolução (Área) */}
          <Card className="lg:col-span-2 border-none shadow-md">
            <CardHeader>
              <CardTitle>Evolução Patrimonial</CardTitle>
              <CardDescription>Histórico de entradas e saídas no período selecionado.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dadosEvolucao} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="mes" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `R$ ${val/1000}k`} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <RechartsTooltip 
                    formatter={(value: number) => formatarMoeda(value)}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                  />
                  <Legend />
                  <Area type="monotone" dataKey="receitas" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorReceitas)" name="Receitas" />
                  <Area type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorDespesas)" name="Despesas" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Card de Status do Fechamento (Novo) */}
          <div className="flex flex-col gap-4">
            <Card className="border-none shadow-md flex-1">
              <CardHeader>
                <CardTitle className="text-lg">Status do Fechamento</CardTitle>
                <CardDescription>Comprometimento efetivado vs. previsto.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                   <div className="flex justify-between text-sm mb-2">
                     <span className="text-slate-500">Despesas Pagas</span>
                     <span className="font-bold text-slate-700">{kpis.progressoFechamento.toFixed(1)}%</span>
                   </div>
                   <Progress value={kpis.progressoFechamento} className="h-3 bg-slate-100" />
                   <p className="text-xs text-muted-foreground mt-2 text-right">
                     {formatarMoeda(kpis.despesasEfetivadas)} de {formatarMoeda(kpis.despesas)}
                   </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" /> Maiores Gastos
                  </h4>
                  <div className="space-y-3">
                    {maioresGastos.map((t) => (
                      <div key={t.id} className="flex justify-between items-center text-sm">
                         <span className="truncate w-32 text-slate-600" title={t.descricao}>{t.descricao}</span>
                         <span className="font-medium text-slate-800">{formatarMoeda(Number(t.valor))}</span>
                      </div>
                    ))}
                    {maioresGastos.length === 0 && <p className="text-xs text-slate-400 text-center">Sem dados</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Abas para DRE e Categorias */}
        <Tabs defaultValue="categorias" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-4">
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="dre">DRE Gerencial</TabsTrigger>
          </TabsList>
          
          <TabsContent value="categorias">
            <Card className="border-none shadow-md">
              <CardHeader><CardTitle>Detalhamento por Categoria</CardTitle></CardHeader>
              <CardContent className="h-[350px] flex flex-col md:flex-row items-center">
                <div className="w-full md:w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dadosCategorias}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {dadosCategorias.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value: number) => formatarMoeda(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/2 grid grid-cols-2 gap-2 text-sm pl-4 max-h-[300px] overflow-y-auto">
                    {dadosCategorias.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="text-slate-600 truncate">{entry.name}</span>
                        <span className="font-semibold ml-auto">{formatarMoeda(entry.value)}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dre">
            <Card className="border-none shadow-md">
              <CardHeader><CardTitle>Demonstrativo (DRE)</CardTitle></CardHeader>
              <CardContent>
                 <div className="space-y-6">
                    {/* Bloco Receitas */}
                    <div>
                       <h3 className="text-green-600 font-bold text-lg mb-2 border-b border-green-100 pb-1">Receitas</h3>
                       <div className="space-y-2">
                         {dreData.receitas.map((r, i) => (
                            <div key={i} className="flex justify-between text-slate-600 text-sm hover:bg-slate-50 p-1 rounded">
                               <span>{r.nome}</span>
                               <span>{formatarMoeda(r.valor)}</span>
                            </div>
                         ))}
                         <div className="flex justify-between font-bold text-slate-800 pt-2 mt-2 border-t">
                            <span>Total Receitas</span>
                            <span>{formatarMoeda(kpis.receitas)}</span>
                         </div>
                       </div>
                    </div>

                    {/* Bloco Despesas */}
                    <div>
                       <h3 className="text-red-600 font-bold text-lg mb-2 border-b border-red-100 pb-1">Despesas</h3>
                       <div className="space-y-2">
                         {dreData.despesas.map((r, i) => (
                            <div key={i} className="flex justify-between text-slate-600 text-sm hover:bg-slate-50 p-1 rounded">
                               <span>{r.nome}</span>
                               <span>{formatarMoeda(r.valor)}</span>
                            </div>
                         ))}
                         <div className="flex justify-between font-bold text-slate-800 pt-2 mt-2 border-t">
                            <span>Total Despesas</span>
                            <span>{formatarMoeda(kpis.despesas)}</span>
                         </div>
                       </div>
                    </div>

                    {/* Resultado */}
                    <div className={`flex justify-between font-bold text-xl p-4 rounded-lg ${kpis.saldo >= 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                        <span>Resultado do Período</span>
                        <span>{formatarMoeda(kpis.saldo)}</span>
                    </div>
                 </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </main>
    </div>
  );
};

export default Graficos;
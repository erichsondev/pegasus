import { useState, useEffect, useMemo } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { ArrowUpCircle, ArrowDownCircle, DollarSign, TrendingUp, AlertCircle, PieChart as PieChartIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { obterTransacoes, type Transacao } from "@/lib/storage";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

const Graficos = () => {
  const [mesInicio, setMesInicio] = useState("");
  const [mesFim, setMesFim] = useState("");
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Inteligência Financeira | Pegasus Finance";
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

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
    try {
      const start = new Date(mesInicio + "-02");
      const end = new Date(mesFim + "-02");
      let todasTransacoes: Transacao[] = [];

      for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
        const ano = d.getFullYear();
        const mes = d.getMonth() + 1;
        const dados = await obterTransacoes(ano, mes);
        todasTransacoes = [...todasTransacoes, ...dados];
      }
      setTransacoes(todasTransacoes);
    } catch (error) {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    }
  };

  const kpis = useMemo(() => {
    const receitas = transacoes.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + Number(t.valor), 0);
    const despesas = transacoes.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + Number(t.valor), 0);
    const saldo = receitas - despesas;
    const economia = receitas > 0 ? ((receitas - despesas) / receitas) * 100 : 0;

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
      .sort((a, b) => b.value - a.value);
  }, [transacoes]);

  const maioresGastos = useMemo(() => {
    const gastosMap = new Map<string, number>();

    transacoes
      .filter(t => t.tipo === 'despesa')
      .forEach(t => {
        const currentTotal = gastosMap.get(t.descricao) || 0;
        gastosMap.set(t.descricao, currentTotal + Number(t.valor));
      });

    return Array.from(gastosMap.entries())
      .map(([descricao, valor]) => ({ descricao, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  }, [transacoes]);

  const dadosEvolucao = useMemo(() => {
    const map = new Map();
    transacoes.forEach(t => {
      const mesAno = t.data.substring(0, 7);
      if (!map.has(mesAno)) map.set(mesAno, { mes: mesAno, receitas: 0, despesas: 0 });
      const atual = map.get(mesAno);
      if (t.tipo === 'receita') atual.receitas += Number(t.valor);
      else atual.despesas += Number(t.valor);
    });

    const ordenados = Array.from(map.values()).sort((a, b) => a.mes.localeCompare(b.mes));

    let saldoAcumulado = 0;
    return ordenados.map(item => {
      const resultadoMes = item.receitas - item.despesas;
      saldoAcumulado += resultadoMes;
      return {
        ...item,
        acumulado: saldoAcumulado
      };
    });
  }, [transacoes]);

  const dreData = useMemo(() => {
    const receitasMap = new Map();
    const despesasMap = new Map();

    transacoes.forEach(t => {
      const cat = t.nome_categoria || 'Sem Categoria';
      const val = Number(t.valor);
      if (t.tipo === 'receita') receitasMap.set(cat, (receitasMap.get(cat) || 0) + val);
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
    <div className="min-h-screen pb-20">
      <Navigation title="Inteligência" />
      <div className="max-w-7xl mx-auto pt-24 p-6 space-y-8 animate-fade-in">
        {/* Cabeçalho Hero no Padrão Benefícios 360 */}
        <div className="text-white bg-black/50 p-8 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-primary/20 rounded-full shrink-0">
              <PieChartIcon className="h-12 w-12 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">Inteligência Financeira</h1>
              <p className="text-base md:text-lg text-gray-200">
                Evolução patrimonial, análise de categorias e DRE gerencial.
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-center bg-background text-foreground p-3 rounded-xl border shadow-md">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block">Início</label>
              <Input type="month" value={mesInicio} onChange={(e) => setMesInicio(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block">Fim</label>
              <Input type="month" value={mesFim} onChange={(e) => setMesFim(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card">
            <CardContent className="p-6 flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-green-500" /> Receitas
              </span>
              <span className="text-2xl font-bold">{formatarMoeda(kpis.receitas)}</span>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-6 flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-red-500" /> Despesas
              </span>
              <span className="text-2xl font-bold">{formatarMoeda(kpis.despesas)}</span>
            </CardContent>
          </Card>
            <Card className="glass-card border-l-4 border-l-primary">
            <CardContent className="p-6 flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" /> Saldo Líquido
              </span>
              <span className={`text-2xl font-bold ${kpis.saldo >= 0 ? 'text-primary' : 'text-red-600 dark:text-red-400'}`}>
                {formatarMoeda(kpis.saldo)}
              </span>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-6 flex flex-col gap-4">
              <div className="flex justify-between items-end">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Economia
                </span>
                <span className={`text-xl font-bold ${kpis.economia > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                  {kpis.economia.toFixed(1)}%
                </span>
              </div>
              <Progress value={Math.max(0, kpis.economia)} className="h-2" />
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 glass-card">
            <CardHeader>
              <CardTitle>Evolução Patrimonial</CardTitle>
              <CardDescription>Entradas, saídas e acúmulo de capital no período.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dadosEvolucao} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="mes" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `R$ ${val / 1000}k`} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                  <RechartsTooltip formatter={(value: any) => formatarMoeda(Number(value))} />
                  <Legend />
                  <Area type="monotone" dataKey="receitas" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorReceitas)" name="Receitas" />
                  <Area type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorDespesas)" name="Despesas" />
                  <Line type="monotone" dataKey="acumulado" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Patrimônio Acumulado" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Fechamento</CardTitle>
              <CardDescription>Percentual efetivado e top gastos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Despesas Pagas</span>
                  <span className="font-bold">{kpis.progressoFechamento.toFixed(1)}%</span>
                </div>
                <Progress value={kpis.progressoFechamento} className="h-3" />
              </div>

              <div className="bg-muted/40 p-4 rounded-lg border">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" /> Top Gastos
                </h4>
                <div className="space-y-3">
                  {maioresGastos.map((t, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <span className="truncate w-36 text-muted-foreground" title={t.descricao}>{t.descricao}</span>
                      <span className="font-medium">{formatarMoeda(Number(t.valor))}</span>
                    </div>
                  ))}
                  {maioresGastos.length === 0 && <p className="text-xs text-muted-foreground text-center">Sem dados</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card shadow-md">
          <Tabs defaultValue="categorias" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-none border-b bg-transparent h-auto p-0">
              <TabsTrigger value="categorias" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5 rounded-none py-4">
                Despesas por Categoria
              </TabsTrigger>
              <TabsTrigger value="dre" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5 rounded-none py-4">
                DRE Gerencial
              </TabsTrigger>
            </TabsList>

            <TabsContent value="categorias" className="p-6 md:p-8">
              <div className="h-[350px] flex flex-col md:flex-row items-center">
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
                        {dadosCategorias.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value: number) => formatarMoeda(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/2 grid grid-cols-2 gap-3 text-sm pl-4 max-h-[300px] overflow-y-auto">
                  {dadosCategorias.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span className="truncate">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="dre" className="p-6 md:p-8">
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-green-600 dark:text-green-400 border-b pb-1 mb-2">Receitas</h4>
                  {dreData.receitas.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm text-muted-foreground py-0.5">
                      <span>{r.nome}</span><span>{formatarMoeda(r.valor)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold mt-2 pt-2 border-t">
                    <span>Total Receitas</span><span>{formatarMoeda(kpis.receitas)}</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-red-600 dark:text-red-400 border-b pb-1 mb-2">Despesas</h4>
                  {dreData.despesas.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm text-muted-foreground py-0.5">
                      <span>{r.nome}</span><span>{formatarMoeda(r.valor)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold mt-2 pt-2 border-t">
                    <span>Total Despesas</span><span>{formatarMoeda(kpis.despesas)}</span>
                  </div>
                </div>
                <div className={`flex justify-between font-bold text-lg p-4 rounded-xl ${kpis.saldo >= 0 ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'}`}>
                  <span>Resultado Líquido</span><span>{formatarMoeda(kpis.saldo)}</span>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default Graficos;
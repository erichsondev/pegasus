import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
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
  valor: number;
  tipo: 'receita' | 'despesa';
  status: string;
  data: string;
  nome_categoria: string;
}

const Graficos = () => {
  const [mesInicio, setMesInicio] = useState("");
  const [mesFim, setMesFim] = useState("");
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const { toast } = useToast();

  useEffect(() => {
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
      const token = localStorage.getItem("token");
      const start = new Date(mesInicio + "-02");
      const end = new Date(mesFim + "-02");
      let todasTransacoes: Transacao[] = [];

      // Loop para buscar todos os meses do intervalo
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
    return transacoes
      .filter(t => t.tipo === 'despesa')
      .sort((a, b) => Number(b.valor) - Number(a.valor))
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
    return Array.from(map.values()).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [transacoes]);

  const dreData = useMemo(() => {
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
    // REMOVIDO bg-slate-50 para o fundo azulzinho aparecer
    <div className="min-h-screen pb-20">
      <Header showBack={true} backPath="/menu" />

      <main className="container mx-auto px-4 md:px-6 py-8 animate-fade-in">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8 bg-white/70 p-4 rounded-xl shadow-sm border border-white/50 backdrop-blur-md">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Inteligência Financeira</h2>
            <p className="text-slate-600 text-sm">Analise seus resultados.</p>
          </div>
          <div className="flex gap-4 items-center w-full md:w-auto">
            <div className="w-full md:w-auto">
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Início</label>
              <Input type="month" value={mesInicio} onChange={(e) => setMesInicio(e.target.value)} className="bg-white border-slate-200" />
            </div>
            <div className="w-full md:w-auto">
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fim</label>
              <Input type="month" value={mesFim} onChange={(e) => setMesFim(e.target.value)} className="bg-white border-slate-200" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-none shadow-sm glass-card">
            <CardContent className="p-6 flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-green-500" /> Receitas
              </span>
              <span className="text-2xl font-bold text-slate-800">{formatarMoeda(kpis.receitas)}</span>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm glass-card">
            <CardContent className="p-6 flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-red-500" /> Despesas
              </span>
              <span className="text-2xl font-bold text-slate-800">{formatarMoeda(kpis.despesas)}</span>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-blue-600 text-white">
            <CardContent className="p-6 flex flex-col gap-1">
              <span className="text-sm font-medium text-blue-100 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Saldo Líquido
              </span>
              <span className="text-2xl font-bold">{formatarMoeda(kpis.saldo)}</span>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm glass-card">
            <CardContent className="p-6 flex flex-col gap-4">
              <div className="flex justify-between items-end">
                <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                   <TrendingUp className="w-4 h-4 text-purple-500" /> Economia
                </span>
                <span className={`text-xl font-bold ${kpis.economia > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {kpis.economia.toFixed(1)}%
                </span>
              </div>
              <Progress value={Math.max(0, kpis.economia)} className="h-2 bg-slate-200" />
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-8">
          <Card className="lg:col-span-2 border-none shadow-md glass-card">
            <CardHeader>
              <CardTitle>Evolução Patrimonial</CardTitle>
              <CardDescription>Entradas e saídas por mês.</CardDescription>
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
                  <RechartsTooltip formatter={(value: number) => formatarMoeda(value)} />
                  <Legend />
                  <Area type="monotone" dataKey="receitas" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorReceitas)" name="Receitas" />
                  <Area type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorDespesas)" name="Despesas" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="border-none shadow-md flex-1 glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Fechamento</CardTitle>
                <CardDescription>Meta de gastos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                   <div className="flex justify-between text-sm mb-2">
                     <span className="text-slate-500">Comprometido</span>
                     <span className="font-bold text-slate-700">{kpis.progressoFechamento.toFixed(1)}%</span>
                   </div>
                   <Progress value={kpis.progressoFechamento} className="h-3 bg-slate-200" />
                </div>

                <div className="bg-white/50 p-4 rounded-lg border border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" /> Top Gastos
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

        <Tabs defaultValue="categorias" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-4 bg-white/50">
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="dre">DRE</TabsTrigger>
          </TabsList>
          
          <TabsContent value="categorias">
            <Card className="border-none shadow-md glass-card">
              <CardHeader><CardTitle>Por Categoria</CardTitle></CardHeader>
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
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="dre">
             <Card className="border-none shadow-md glass-card">
               <CardHeader><CardTitle>DRE Gerencial</CardTitle></CardHeader>
               <CardContent>
                 <div className="space-y-4">
                    <div>
                       <h4 className="font-bold text-green-600 border-b pb-1 mb-2">Receitas</h4>
                       {dreData.receitas.map((r, i) => (
                         <div key={i} className="flex justify-between text-sm text-slate-600">
                           <span>{r.nome}</span><span>{formatarMoeda(r.valor)}</span>
                         </div>
                       ))}
                       <div className="flex justify-between font-bold mt-2 pt-2 border-t">
                         <span>Total</span><span>{formatarMoeda(kpis.receitas)}</span>
                       </div>
                    </div>
                    <div>
                       <h4 className="font-bold text-red-600 border-b pb-1 mb-2">Despesas</h4>
                       {dreData.despesas.map((r, i) => (
                         <div key={i} className="flex justify-between text-sm text-slate-600">
                           <span>{r.nome}</span><span>{formatarMoeda(r.valor)}</span>
                         </div>
                       ))}
                       <div className="flex justify-between font-bold mt-2 pt-2 border-t">
                         <span>Total</span><span>{formatarMoeda(kpis.despesas)}</span>
                       </div>
                    </div>
                    <div className={`flex justify-between font-bold text-lg p-3 rounded ${kpis.saldo >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                       <span>Resultado</span><span>{formatarMoeda(kpis.saldo)}</span>
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
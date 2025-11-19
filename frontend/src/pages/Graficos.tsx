import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, Legend } from "recharts";
import api from "@/lib/api";

const COLORS = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6c757d', '#fd7e14', '#6f42c1'];

const Graficos = () => {
  const [mesInicio, setMesInicio] = useState("");
  const [mesFim, setMesFim] = useState("");
  const [dadosEvolucao, setDadosEvolucao] = useState<any[]>([]);
  const [dadosCategorias, setDadosCategorias] = useState<any[]>([]);
  const [dadosCartoes, setDadosCartoes] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const anoPassado = new Date(hoje);
    anoPassado.setFullYear(hoje.getFullYear() - 1);
    const mesPassado = `${anoPassado.getFullYear()}-${String(anoPassado.getMonth() + 1).padStart(2, '0')}`;
    
    setMesInicio(mesPassado);
    setMesFim(mesAtual);
  }, []);

  useEffect(() => {
    if (mesInicio && mesFim) {
      carregarGraficos();
    }
  }, [mesInicio, mesFim]);

  const carregarGraficos = async () => {
    try {
      const inicio = `${mesInicio}-01`;
      const [ano, mes] = mesFim.split('-');
      const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
      const fim = `${mesFim}-${ultimoDia}`;

      const [evolucao, categorias, cartoes] = await Promise.all([
        api.obterEvolucaoPatrimonial(inicio, fim),
        api.obterDespesasPorCategoria(inicio, fim),
        api.obterGastosPorCartao(inicio, fim)
      ]);

      setDadosEvolucao(evolucao);
      setDadosCategorias(categorias);
      setDadosCartoes(cartoes);
    } catch (error) {
      console.error("Erro ao carregar gráficos:", error);
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <h2 className="text-2xl font-bold">Análise Gráfica</h2>
          <div className="flex gap-4 items-center flex-wrap">
            <div>
              <label className="text-sm font-medium mb-1 block">Período Início</label>
              <Input
                type="month"
                value={mesInicio}
                onChange={(e) => setMesInicio(e.target.value)}
                className="w-48"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Período Fim</label>
              <Input
                type="month"
                value={mesFim}
                onChange={(e) => setMesFim(e.target.value)}
                className="w-48"
              />
            </div>
            <Button variant="outline" onClick={() => navigate("/menu")} className="mt-auto">
              ← Voltar
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Gráfico de Pizza - Despesas por Categoria */}
          <Card>
            <CardHeader>
              <CardTitle>Despesas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {dadosCategorias.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={dadosCategorias}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.categoria}: ${formatarMoeda(parseFloat(entry.total))}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="total"
                    >
                      {dadosCategorias.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatarMoeda(value)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-20">Nenhum dado disponível</p>
              )}
            </CardContent>
          </Card>

          {/* Gráfico de Pizza - Gastos por Cartão */}
          <Card>
            <CardHeader>
              <CardTitle>Gastos por Cartão de Crédito</CardTitle>
            </CardHeader>
            <CardContent>
              {dadosCartoes.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={dadosCartoes}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.cartao}: ${formatarMoeda(parseFloat(entry.total))}`}
                      outerRadius={80}
                      dataKey="total"
                    >
                      {dadosCartoes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatarMoeda(value)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-20">Nenhum dado disponível</p>
              )}
            </CardContent>
          </Card>

          {/* Gráfico de Barras - Evolução Patrimonial */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Evolução Patrimonial</CardTitle>
            </CardHeader>
            <CardContent>
              {dadosEvolucao.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dadosEvolucao}>
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatarMoeda(value)} />
                    <Legend />
                    <Bar dataKey="receitas" fill="#28a745" name="Receitas" />
                    <Bar dataKey="despesas" fill="#dc3545" name="Despesas" />
                    <Bar dataKey="saldo_acumulado" fill="#007bff" name="Saldo Acumulado" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-20">Nenhum dado disponível</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Graficos;

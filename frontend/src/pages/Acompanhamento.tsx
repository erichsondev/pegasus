import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  obterTransacoes,
  adicionarTransacao,
  editarTransacao,
  removerTransacao,
  obterCategorias,
  obterCartoes,
  obterResumo,
  type Transacao,
  type Categoria,
  type Cartao,
  type Resumo
} from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Check, X, Calendar, TrendingUp, TrendingDown, Wallet, AlertCircle } from "lucide-react";

const Acompanhamento = () => {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [mesSelecionado, setMesSelecionado] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    descricao: "",
    valor: "",
    tipo: "receita" as "receita" | "despesa" | "investimento",
    categoria_id: "",
    cartao_id: "",
    efetivado: false
  });

  useEffect(() => {
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    setMesSelecionado(mesAtual);
  }, []);

  useEffect(() => {
    if (mesSelecionado) {
      carregarDados();
    }
  }, [mesSelecionado]);

  const carregarDados = async () => {
    const [ano, mes] = mesSelecionado.split('-').map(Number);
    
    try {
      const [transacoesData, categoriasData, cartoesData, resumoData] = await Promise.all([
        obterTransacoes(ano, mes),
        obterCategorias(),
        obterCartoes(),
        obterResumo(ano, mes)
      ]);
      
      setTransacoes(transacoesData);
      setCategorias(categoriasData);
      setCartoes(cartoesData);
      setResumo(resumoData);
    } catch (error) {
      toast({
        title: "Erro ao carregar dados",
        description: "Verifique sua conexão",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const [ano, mes] = mesSelecionado.split('-');
    const dia = new Date().getDate();
    const dataFormatada = `${ano}-${mes}-${String(dia).padStart(2, '0')}`;
    
    const transacao = {
      descricao: formData.descricao,
      valor: parseFloat(formData.valor),
      data: dataFormatada,
      status: formData.efetivado ? 'efetivado' as const : 'previsto' as const,
      tipo: formData.tipo,
      categoria_id: formData.categoria_id ? parseInt(formData.categoria_id) : undefined,
      cartao_id: formData.cartao_id ? parseInt(formData.cartao_id) : undefined,
    };

    try {
      if (editandoId) {
        await editarTransacao(editandoId, transacao);
        setEditandoId(null);
        toast({ title: "Transação editada com sucesso!" });
      } else {
        await adicionarTransacao(transacao);
        toast({ title: "Transação adicionada com sucesso!" });
      }

      setFormData({
        descricao: "",
        valor: "",
        tipo: "receita",
        categoria_id: "",
        cartao_id: "",
        efetivado: false
      });
      
      carregarDados();
    } catch (error) {
      toast({
        title: "Erro ao salvar transação",
        variant: "destructive",
      });
    }
  };

  const handleEditar = (transacao: Transacao) => {
    setEditandoId(transacao.id);
    setFormData({
      descricao: transacao.descricao,
      valor: transacao.valor.toString(),
      tipo: transacao.tipo,
      categoria_id: transacao.categoria_id?.toString() || "",
      cartao_id: transacao.cartao_id?.toString() || "",
      efetivado: transacao.status === 'efetivado'
    });
    // Rolar para o formulário em telas pequenas
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRemover = async (id: number) => {
    try {
      await removerTransacao(id);
      carregarDados();
      toast({ title: "Transação removida!" });
    } catch (error) {
      toast({
        title: "Erro ao remover",
        variant: "destructive",
      });
    }
  };

  const handleLimparMes = async () => {
    try {
      await Promise.all(transacoes.map(t => removerTransacao(t.id)));
      carregarDados();
      toast({ title: "Mês limpo com sucesso!" });
    } catch (error) {
      toast({ title: "Erro ao limpar mês", variant: "destructive" });
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* 1. Header com Botão de Voltar Ativado */}
      <Header showBack={true} backPath="/menu" />

      <main className="container mx-auto px-4 md:px-6 py-8 animate-fade-in">
        
        {/* 2. Controle de Mês e Título */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Acompanhamento</h2>
            <p className="text-slate-500 text-sm">Controle detalhado de entradas e saídas.</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <Calendar className="w-5 h-5 text-slate-500 ml-2" />
            <Input
              type="month"
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
              className="border-none bg-transparent shadow-none focus-visible:ring-0 w-40 font-medium text-slate-700"
            />
          </div>
        </div>

        {/* 3. Layout Principal com Abas para Mobile/Desktop */}
        <Tabs defaultValue="geral" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:w-[400px] md:mx-auto">
            <TabsTrigger value="geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          </TabsList>

          {/* CONTEÚDO DA ABA 1: VISÃO GERAL (RESUMO) */}
          <TabsContent value="geral">
            {resumo && (
              <div className="space-y-6">
                {/* Grupo 1: Realidade (Fluxo de Caixa) */}
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1 flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> Fluxo de Caixa (Efetivado)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-l-4 border-l-green-500 shadow-sm">
                      <CardContent className="pt-6">
                        <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Receitas Reais</p>
                        <p className="text-2xl font-bold text-green-600">{formatarMoeda(resumo.totalReceitasEfetivadas)}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-red-500 shadow-sm">
                      <CardContent className="pt-6">
                        <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Despesas Pagas</p>
                        <p className="text-2xl font-bold text-red-600">{formatarMoeda(resumo.totalDespesasEfetivadas)}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-blue-600 shadow-sm bg-blue-50/50">
                      <CardContent className="pt-6">
                        <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Saldo em Conta</p>
                        <p className="text-2xl font-bold text-blue-700">{formatarMoeda(resumo.saldoAtualAcumulado)}</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Grupo 2: Previsão (Orçamento) */}
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Previsão (Agendado)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-dashed border-2 border-slate-200 shadow-none bg-transparent opacity-80">
                      <CardContent className="pt-6">
                        <p className="text-xs text-slate-400 font-semibold uppercase mb-1">Receitas Previstas</p>
                        <p className="text-xl font-bold text-slate-600">{formatarMoeda(resumo.totalReceitasPrevistas)}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-dashed border-2 border-slate-200 shadow-none bg-transparent opacity-80">
                      <CardContent className="pt-6">
                        <p className="text-xs text-slate-400 font-semibold uppercase mb-1">Despesas Previstas</p>
                        <p className="text-xl font-bold text-slate-600">{formatarMoeda(resumo.totalDespesasPrevistas)}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-dashed border-2 border-slate-200 shadow-none bg-transparent opacity-80">
                      <CardContent className="pt-6">
                        <p className="text-xs text-slate-400 font-semibold uppercase mb-1">Projeção Final</p>
                        <p className="text-xl font-bold text-slate-700">{formatarMoeda(resumo.saldoFinalProjetado)}</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* CONTEÚDO DA ABA 2: LANÇAMENTOS (FORM + LISTA) */}
          <TabsContent value="lancamentos">
            <div className="grid lg:grid-cols-[350px_1fr] gap-8">
              
              {/* Coluna 1: Formulário */}
              <div className="order-2 lg:order-1">
                <Card className={`sticky top-24 transition-all ${editandoId ? 'border-blue-500 ring-2 ring-blue-100' : ''}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {editandoId ? <Pencil className="w-4 h-4 text-blue-600" /> : <Wallet className="w-4 h-4 text-slate-500" />}
                      {editandoId ? "Editando Transação" : "Novo Lançamento"}
                    </CardTitle>
                    <CardDescription>Adicione receitas ou despesas pontuais.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label className="text-xs">Descrição</Label>
                        <Input
                          value={formData.descricao}
                          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                          required
                          placeholder="Ex: Supermercado"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Valor (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.valor}
                          onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                          required
                          className="mt-1"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Tipo</Label>
                          <Select value={formData.tipo} onValueChange={(v: any) => setFormData({ ...formData, tipo: v })}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="receita">Receita</SelectItem>
                              <SelectItem value="despesa">Despesa</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Categoria</Label>
                          <Select value={formData.categoria_id} onValueChange={(v) => setFormData({ ...formData, categoria_id: v })}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {categorias.map(cat => (
                                <SelectItem key={cat.id} value={cat.id.toString()}>{cat.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {formData.tipo === "despesa" && (
                        <div>
                          <Label className="text-xs">Cartão (Opcional)</Label>
                          <Select value={formData.cartao_id} onValueChange={(v) => setFormData({ ...formData, cartao_id: v })}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                            <SelectContent>
                              {cartoes.map(cartao => (
                                <SelectItem key={cartao.id} value={cartao.id.toString()}>{cartao.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="flex items-center gap-2 py-2">
                        <input
                          type="checkbox"
                          id="efetivado"
                          checked={formData.efetivado}
                          onChange={(e) => setFormData({ ...formData, efetivado: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Label htmlFor="efetivado" className="cursor-pointer font-normal text-slate-700">
                          Já foi pago/recebido? (Efetivado)
                        </Label>
                      </div>

                      <div className="flex gap-2 pt-2">
                        {editandoId && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setEditandoId(null);
                              setFormData({ descricao: "", valor: "", tipo: "receita", categoria_id: "", cartao_id: "", efetivado: false });
                            }}
                            className="flex-1"
                          >
                            <X className="w-4 h-4 mr-2" /> Cancelar
                          </Button>
                        )}
                        <Button type="submit" className={`flex-1 ${editandoId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
                          {editandoId ? <Check className="w-4 h-4 mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                          {editandoId ? "Salvar" : "Adicionar"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Coluna 2: Lista de Transações */}
              <div className="order-1 lg:order-2 space-y-4">
                <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-700">Extrato do Mês</h3>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="w-4 h-4 mr-2" /> Limpar Mês
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cuidado Absoluto!</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso apagará <b>todas</b> as transações deste mês. Não é possível desfazer. Tem certeza?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleLimparMes} className="bg-red-600 hover:bg-red-700">Confirmar Exclusão</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {/* Lista Scrollável */}
                <div className="space-y-3">
                  {transacoes.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-lg border border-dashed border-slate-200">
                      <p className="text-slate-400 mb-2">Nenhuma transação encontrada.</p>
                      <p className="text-xs text-slate-300">Use o formulário para começar.</p>
                    </div>
                  ) : (
                    transacoes.map(transacao => (
                      <div 
                        key={transacao.id} 
                        className={`group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-all ${transacao.status === 'previsto' ? 'opacity-75 bg-slate-50/50' : ''}`}
                      >
                        <div className="flex items-center gap-4 overflow-hidden">
                          <div className={`p-2 rounded-full ${transacao.tipo === 'receita' ? 'bg-green-100' : 'bg-red-100'}`}>
                            {transacao.tipo === 'receita' 
                              ? <TrendingUp className="w-5 h-5 text-green-600" /> 
                              : <TrendingDown className="w-5 h-5 text-red-600" />
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{transacao.descricao}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                              <Badge variant="secondary" className="font-normal bg-slate-100 text-slate-600 hover:bg-slate-200">
                                {transacao.nome_categoria}
                              </Badge>
                              {transacao.status === 'previsto' && (
                                <span className="text-orange-500 font-medium flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> Previsto
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right pl-4">
                          <p className={`font-bold ${transacao.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                            {transacao.tipo === 'despesa' ? '-' : '+'}{formatarMoeda(transacao.valor)}
                          </p>
                          <div className="flex justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditar(transacao)}>
                              <Pencil className="w-3.5 h-3.5 text-slate-400 hover:text-blue-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRemover(transacao.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-600" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

      </main>
    </div>
  );
};

export default Acompanhamento;
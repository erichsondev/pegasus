import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Pencil, Trash2, Check, X } from "lucide-react";

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
  };

  const handleRemover = async (id: number) => {
    try {
      await removerTransacao(id);
      carregarDados();
      toast({ title: "Transação removida!" });
    } catch (error) {
      toast({
        title: "Erro ao remover transação",
        variant: "destructive",
      });
    }
  };

  const handleLimparMes = async () => {
    try {
      await Promise.all(transacoes.map(t => removerTransacao(t.id)));
      carregarDados();
      toast({ title: "Todos os movimentos do mês foram removidos!" });
    } catch (error) {
      toast({
        title: "Erro ao limpar mês",
        variant: "destructive",
      });
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
        {/* Resumo */}
        {resumo && (
          <div className="mb-8 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Acompanhamento Financeiro</h2>
              <Input
                type="month"
                value={mesSelecionado}
                onChange={(e) => setMesSelecionado(e.target.value)}
                className="w-48"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-primary">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground font-semibold uppercase mb-2">Receitas Efetivadas</p>
                  <p className="text-2xl font-bold text-success">{formatarMoeda(resumo.totalReceitasEfetivadas)}</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-primary">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground font-semibold uppercase mb-2">Despesas Efetivadas</p>
                  <p className="text-2xl font-bold text-destructive">{formatarMoeda(resumo.totalDespesasEfetivadas)}</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-primary">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground font-semibold uppercase mb-2">Saldo Atual</p>
                  <p className="text-2xl font-bold text-primary">{formatarMoeda(resumo.saldoAtualAcumulado)}</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-warning">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground font-semibold uppercase mb-2">Receitas Previstas</p>
                  <p className="text-2xl font-bold text-success">{formatarMoeda(resumo.totalReceitasPrevistas)}</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-warning">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground font-semibold uppercase mb-2">Despesas Previstas</p>
                  <p className="text-2xl font-bold text-destructive">{formatarMoeda(resumo.totalDespesasPrevistas)}</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-info">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground font-semibold uppercase mb-2">Saldo Final</p>
                  <p className="text-2xl font-bold text-info">{formatarMoeda(resumo.saldoFinalProjetado)}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-[400px_1fr] gap-8">
          {/* Formulário */}
          <Card>
            <CardHeader>
              <CardTitle>{editandoId ? "Editar" : "Nova"} Transação</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Tipo</Label>
                  <Select value={formData.tipo} onValueChange={(v: any) => setFormData({ ...formData, tipo: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                      <SelectItem value="investimento">Investimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Categoria</Label>
                  <Select value={formData.categoria_id} onValueChange={(v) => setFormData({ ...formData, categoria_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map(cat => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>{cat.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.tipo === "despesa" && (
                  <div>
                    <Label>Cartão (opcional)</Label>
                    <Select value={formData.cartao_id} onValueChange={(v) => setFormData({ ...formData, cartao_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {cartoes.map(cartao => (
                          <SelectItem key={cartao.id} value={cartao.id.toString()}>{cartao.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="efetivado"
                    checked={formData.efetivado}
                    onChange={(e) => setFormData({ ...formData, efetivado: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="efetivado" className="cursor-pointer">Efetivado</Label>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editandoId ? <Check className="w-4 h-4 mr-2" /> : null}
                    {editandoId ? "Salvar" : "Adicionar"}
                  </Button>
                  {editandoId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditandoId(null);
                        setFormData({
                          descricao: "",
                          valor: "",
                          tipo: "receita",
                          categoria_id: "",
                          cartao_id: "",
                          efetivado: false
                        });
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Lista de transações */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Transações do Mês</CardTitle>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Limpar Mês
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Todas as transações do mês selecionado serão removidas permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleLimparMes} className="bg-destructive hover:bg-destructive/90">
                        Confirmar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {transacoes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma transação registrada neste mês</p>
                ) : (
                  transacoes.map(transacao => (
                    <div key={transacao.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex-1">
                        <p className="font-semibold">{transacao.descricao}</p>
                        <p className="text-sm text-muted-foreground">
                          {transacao.nome_categoria}
                          {transacao.status === 'efetivado' && <span className="ml-2 text-success">✓ Efetivado</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className={`font-bold ${transacao.tipo === 'receita' ? 'text-success' : 'text-destructive'}`}>
                          {formatarMoeda(transacao.valor)}
                        </p>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleEditar(transacao)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleRemover(transacao.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Acompanhamento;

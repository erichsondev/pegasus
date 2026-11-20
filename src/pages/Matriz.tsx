import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  obterCategorias,
  adicionarCategoria,
  removerCategoria,
  obterCartoes,
  adicionarCartao,
  removerCartao,
  obterLancamentosFixos,
  adicionarLancamentoFixo,
  removerLancamentoFixo,
  gerarProjecoesLancamentoFixo,
  type Categoria,
  type Cartao,
  type LancamentoFixo
} from "@/lib/storage";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Pencil, Save, X, Plus, RefreshCw, Loader2, Settings } from "lucide-react";

const Matriz = () => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [lancamentosFixos, setLancamentosFixos] = useState<LancamentoFixo[]>([]);

  const { toast } = useToast();
  const { user } = useAuth();

  const [novaCategoria, setNovaCategoria] = useState("");
  const [novoCartao, setNovoCartao] = useState("");

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [novoLancamento, setNovoLancamento] = useState({
    descricao: "",
    valor: "",
    tipo: "despesa" as "receita" | "despesa",
    categoria_id: "",
    dia_do_mes: "",
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: ""
  });

  useEffect(() => {
    document.title = "Configurações | Pegasus Finance";
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const [categoriasData, cartoesData, lancamentosData] = await Promise.all([
        obterCategorias(),
        obterCartoes(),
        obterLancamentosFixos()
      ]);

      setCategorias(categoriasData);
      setCartoes(cartoesData);
      setLancamentosFixos(lancamentosData);
    } catch (error) {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    }
  };

  const handleSincronizar = async () => {
    if (!user) return;
    if (!confirm("ATENÇÃO: Isso apagará todas as previsões futuras e recriará a agenda baseada apenas nas regras configuradas hoje.\n\nTransações já pagas/efetivadas NÃO serão afetadas.\n\nDeseja continuar?")) return;

    setSyncing(true);
    try {
      const hoje = new Date();
      const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

      const { data: apagadas, error: errDelete } = await supabase
        .from('transacoes')
        .delete()
        .eq('user_id', user.id)
        .eq('status', 'previsto')
        .gte('data', hojeStr)
        .select('id');

      if (errDelete) throw errDelete;

      const fixos = await obterLancamentosFixos();
      let totalCriados = 0;

      for (const item of fixos) {
        const qtd = await gerarProjecoesLancamentoFixo(user.id, item, true);
        totalCriados += qtd;
      }

      toast({
        title: "Agenda Sincronizada!",
        description: `${apagadas?.length || 0} previsões antigas removidas e ${totalCriados} novas geradas.`
      });
      carregarDados();
    } catch (error) {
      toast({ title: "Erro ao sincronizar agenda", variant: "destructive" });
      console.error(error);
    } finally {
      setSyncing(false);
    }
  };

  const handleAdicionarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaCategoria.trim()) {
      try {
        await adicionarCategoria(novaCategoria);
        setNovaCategoria("");
        carregarDados();
        toast({ title: "Categoria adicionada!" });
      } catch (error) {
        toast({ title: "Erro ao adicionar", variant: "destructive" });
      }
    }
  };

  const handleAdicionarCartao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novoCartao.trim()) {
      try {
        await adicionarCartao(novoCartao);
        setNovoCartao("");
        carregarDados();
        toast({ title: "Cartão adicionado!" });
      } catch (error) {
        toast({ title: "Erro ao adicionar", variant: "destructive" });
      }
    }
  };

  const prepararEdicao = (item: LancamentoFixo) => {
    setEditandoId(item.id);
    setNovoLancamento({
      descricao: item.descricao,
      valor: String(item.valor),
      tipo: item.tipo,
      categoria_id: item.categoria_id || "",
      dia_do_mes: String(item.dia_do_mes),
      data_inicio: item.data_inicio ? String(item.data_inicio).split('T')[0] : "",
      data_fim: item.data_fim ? String(item.data_fim).split('T')[0] : ""
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setNovoLancamento({
      descricao: "",
      valor: "",
      tipo: "despesa",
      categoria_id: "",
      dia_do_mes: "",
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: ""
    });
  };

  const handleSalvarLancamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editandoId) {
        const payloadAtualizado = {
          descricao: novoLancamento.descricao.trim(),
          valor: parseFloat(novoLancamento.valor),
          tipo: novoLancamento.tipo,
          dia_do_mes: parseInt(novoLancamento.dia_do_mes),
          categoria_id: novoLancamento.categoria_id || null,
          data_inicio: novoLancamento.data_inicio,
          data_fim: novoLancamento.data_fim || null
        };

        const { error } = await supabase
          .from('lancamentos_fixos')
          .update(payloadAtualizado)
          .eq('id', editandoId)
          .eq('user_id', user.id);

        if (error) throw error;

        const hoje = new Date();
        const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

        await supabase
          .from('transacoes')
          .delete()
          .eq('user_id', user.id)
          .eq('status', 'previsto')
          .gte('data', hojeStr)
          .eq('lancamento_fixo_id', editandoId);

        const qtdNovas = await gerarProjecoesLancamentoFixo(
          user.id,
          { ...payloadAtualizado, id: editandoId },
          true
        );

        toast({
          title: "Lançamento atualizado!",
          description: `Agenda futura recalculada automaticamente (${qtdNovas} parcelas previstas).`
        });
      } else {
        const qtdGerada = await adicionarLancamentoFixo({
          descricao: novoLancamento.descricao,
          valor: parseFloat(novoLancamento.valor),
          tipo: novoLancamento.tipo,
          dia_do_mes: parseInt(novoLancamento.dia_do_mes),
          categoria_id: novoLancamento.categoria_id || undefined,
          data_inicio: novoLancamento.data_inicio,
          data_fim: novoLancamento.data_fim || undefined
        });

        toast({
          title: "Lançamento fixo adicionado!",
          description: `${qtdGerada} parcelas previstas foram geradas automaticamente nos lançamentos.`
        });
      }

      cancelarEdicao();
      carregarDados();
    } catch (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleRemoverLancamento = async (id: string) => {
    if (!user) return;
    if (!confirm("Isso removerá a regra recorrente e suas previsões futuras ainda não pagas. Deseja continuar?")) return;
    try {
      const hoje = new Date();
      const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

      await supabase
        .from('transacoes')
        .delete()
        .eq('user_id', user.id)
        .eq('status', 'previsto')
        .gte('data', hojeStr)
        .eq('lancamento_fixo_id', id);

      await removerLancamentoFixo(id);
      carregarDados();
      toast({ title: "Lançamento fixo e previsões futuras removidos!" });
    } catch (error) {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  return (
    <div className="min-h-screen pb-20">
      <Navigation title="Configurações" />

      <div className="max-w-7xl mx-auto pt-24 p-6 space-y-8 animate-fade-in">
        {/* Cabeçalho Hero no Padrão Benefícios 360 */}
        <div className="text-white bg-black/50 p-8 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-primary/20 rounded-full shrink-0">
              <Settings className="h-12 w-12 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">Configurações e Recorrências</h1>
              <p className="text-base md:text-lg text-gray-200">
                Gerencie categorias, cartões de crédito e vigência de receitas/despesas fixas.
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={handleSincronizar}
            disabled={syncing}
            className="gap-2 shrink-0"
            title="Limpar previsões futuras e recalcular agenda"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Sincronizando..." : "Sincronizar Agenda"}
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <Card className="glass-card">
            <CardHeader><CardTitle>Categorias</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAdicionarCategoria} className="flex gap-2">
                <Input placeholder="Nova categoria" value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)} required />
                <Button type="submit">Adicionar</Button>
              </form>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {categorias.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center p-3 border rounded-lg bg-background/60">
                    <span className="font-medium">{cat.nome}</span>
                    <Button size="icon" variant="ghost" onClick={async () => {
                      try {
                        await removerCategoria(cat.id);
                        carregarDados();
                        toast({ title: "Categoria removida!" });
                      } catch (error) {
                        toast({ title: "Erro ao remover", variant: "destructive" });
                      }
                    }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle>Cartões de Crédito</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAdicionarCartao} className="flex gap-2">
                <Input placeholder="Nome do cartão" value={novoCartao} onChange={(e) => setNovoCartao(e.target.value)} required />
                <Button type="submit">Adicionar</Button>
              </form>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {cartoes.map(cartao => (
                  <div key={cartao.id} className="flex justify-between items-center p-3 border rounded-lg bg-background/60">
                    <span className="font-medium">{cartao.nome}</span>
                    <Button size="icon" variant="ghost" onClick={async () => {
                      try {
                        await removerCartao(cartao.id);
                        carregarDados();
                        toast({ title: "Cartão removido!" });
                      } catch (error) {
                        toast({ title: "Erro ao remover", variant: "destructive" });
                      }
                    }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className={`lg:col-span-2 transition-colors glass-card ${editandoId ? 'border-primary ring-2 ring-primary/20' : ''}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {editandoId ? <Pencil className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5" />}
                {editandoId ? "Editando Lançamento Fixo" : "Novo Lançamento Fixo"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSalvarLancamento} className="grid md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
                <div className="md:col-span-2">
                  <Label>Descrição</Label>
                  <Input placeholder="Ex: Salário, Aluguel..." value={novoLancamento.descricao} onChange={(e) => setNovoLancamento({ ...novoLancamento, descricao: e.target.value })} required />
                </div>
                <div>
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" value={novoLancamento.valor} onChange={(e) => setNovoLancamento({ ...novoLancamento, valor: e.target.value })} required />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={novoLancamento.tipo} onValueChange={(v: any) => setNovoLancamento({ ...novoLancamento, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={novoLancamento.categoria_id} onValueChange={(v) => setNovoLancamento({ ...novoLancamento, categoria_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categorias.map(cat => (<SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Dia do Mês</Label>
                  <Input type="number" min="1" max="31" value={novoLancamento.dia_do_mes} onChange={(e) => setNovoLancamento({ ...novoLancamento, dia_do_mes: e.target.value })} required />
                </div>

                <div className="md:col-span-2">
                  <Label>Início Vigência</Label>
                  <Input type="date" value={novoLancamento.data_inicio} onChange={(e) => setNovoLancamento({ ...novoLancamento, data_inicio: e.target.value })} required />
                </div>
                <div className="md:col-span-2">
                  <Label>Fim Vigência (Opcional)</Label>
                  <Input type="date" value={novoLancamento.data_fim} onChange={(e) => setNovoLancamento({ ...novoLancamento, data_fim: e.target.value })} />
                </div>

                <div className="md:col-span-2 flex gap-2">
                  {editandoId && (
                    <Button type="button" variant="outline" onClick={cancelarEdicao} className="flex-1">
                      <X className="w-4 h-4 mr-2" /> Cancelar
                    </Button>
                  )}
                  <Button type="submit" className="flex-1">
                    {editandoId ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    {editandoId ? "Salvar" : "Adicionar"}
                  </Button>
                </div>
              </form>

              <div className="space-y-2 pt-4 border-t">
                <h3 className="font-semibold mb-2">Lista de Itens Recorrentes</h3>
                {lancamentosFixos.map(lanc => (
                  <div key={lanc.id} className={`flex flex-col md:flex-row items-start md:items-center justify-between p-3 border rounded-lg bg-background/60 ${lanc.tipo === 'receita' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`}>
                    <div className="flex-1 grid md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                      <div>
                        <p className="font-semibold">{lanc.descricao}</p>
                        <p className="text-xs text-muted-foreground">{lanc.nome_categoria || 'Sem categoria'}</p>
                      </div>
                      <div>
                        <p className={lanc.tipo === 'receita' ? 'text-green-600 dark:text-green-400 font-bold' : 'text-red-600 dark:text-red-400 font-bold'}>
                          {formatarMoeda(lanc.valor)}
                        </p>
                        <p className="text-sm text-muted-foreground">Dia {lanc.dia_do_mes}</p>
                      </div>
                      <div className="lg:col-span-2">
                        <p className="text-xs text-muted-foreground">
                          Vigência: <b>{new Date(lanc.data_inicio).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</b>
                          {lanc.data_fim ? ` até ${new Date(lanc.data_fim).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : ' (Indeterminado)'}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-2 md:mt-0">
                      <Button size="icon" variant="ghost" onClick={() => prepararEdicao(lanc)} title="Editar Item">
                        <Pencil className="w-4 h-4 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleRemoverLancamento(lanc.id)} title="Remover Item">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}

                {lancamentosFixos.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">Nenhum lançamento fixo cadastrado.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Matriz;
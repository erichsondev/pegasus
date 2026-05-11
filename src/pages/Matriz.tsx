import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
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
  removerLancamentoFixo,
  type Categoria,
  type Cartao,
  type LancamentoFixo
} from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Pencil, Save, X, Plus, RefreshCw } from "lucide-react"; // Adicionado RefreshCw
import { useNavigate } from "react-router-dom";

const Matriz = () => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [lancamentosFixos, setLancamentosFixos] = useState<LancamentoFixo[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Estados originais mantidos
  const [novaCategoria, setNovaCategoria] = useState("");
  const [novoCartao, setNovoCartao] = useState("");
  
  // Estado para controle de Edição
  const [editandoId, setEditandoId] = useState<number | null>(null);

  // Estado do formulário (Expandido para suportar edição)
  const [novoLancamento, setNovoLancamento] = useState({
    descricao: "",
    valor: "",
    tipo: "despesa" as "receita" | "despesa",
    categoria_id: "",
    dia_do_mes: "",
    data_inicio: new Date().toISOString().split('T')[0], // Padrão: Hoje
    data_fim: "" // Vazio = Indeterminado
  });

  useEffect(() => {
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
      toast({
        title: "Erro ao carregar dados",
        variant: "destructive",
      });
    }
  };

  // --- NOVA FUNÇÃO: SINCRONIZAR AGENDA (LIMPEZA DE FANTASMAS) ---
  const handleSincronizar = async () => {
    if (!confirm("ATENÇÃO: Isso apagará todas as previsões futuras automáticas e recriará a agenda baseada apenas no que está configurado hoje. \n\nTransações manuais ou já pagas NÃO serão afetadas.\n\nDeseja continuar?")) return;
    
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/manutencao/sincronizar-agenda`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        toast({ 
          title: "Agenda Sincronizada!", 
          description: "Lixos removidos e futuro recalculado com sucesso.",
          className: "bg-green-600 text-white border-none"
        });
        carregarDados();
      } else {
        throw new Error();
      }
    } catch (error) {
      toast({ title: "Erro ao sincronizar", variant: "destructive" });
    }
  };

  // --- Funções de Categorias e Cartões (MANTIDAS IGUAIS AO ORIGINAL) ---
  const handleAdicionarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaCategoria.trim()) {
      try {
        await adicionarCategoria(novaCategoria);
        setNovaCategoria("");
        carregarDados();
        toast({ title: "Categoria adicionada!" });
      } catch (error) {
        toast({
          title: "Erro ao adicionar categoria",
          variant: "destructive",
        });
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
        toast({
          title: "Erro ao adicionar cartão",
          variant: "destructive",
        });
      }
    }
  };

  // --- Funções de Lançamentos Fixos (ATUALIZADAS PARA SUPORTAR EDIÇÃO) ---

  const prepararEdicao = (item: LancamentoFixo) => {
    setEditandoId(item.id);
    setNovoLancamento({
      descricao: item.descricao,
      valor: String(item.valor),
      tipo: item.tipo,
      categoria_id: item.categoria_id ? String(item.categoria_id) : "",
      dia_do_mes: String(item.dia_do_mes),
      // Formata data para o input (YYYY-MM-DD)
      data_inicio: item.data_inicio ? String(item.data_inicio).split('T')[0] : "",
      data_fim: item.data_fim ? String(item.data_fim).split('T')[0] : ""
    });
    // Rola para o topo para editar
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
    
    const corpo = {
      descricao: novoLancamento.descricao,
      valor: parseFloat(novoLancamento.valor),
      tipo: novoLancamento.tipo,
      dia_do_mes: parseInt(novoLancamento.dia_do_mes),
      categoria_id: novoLancamento.categoria_id ? parseInt(novoLancamento.categoria_id) : null,
      data_inicio: novoLancamento.data_inicio,
      data_fim: novoLancamento.data_fim || null
    };
    
    try {
      const token = localStorage.getItem("token");
      const headers = { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      };

      // Se tiver ID, é Edição (PUT), senão é Criação (POST)
      const url = editandoId 
        ? `${import.meta.env.VITE_API_URL}/api/lancamentos-fixos/${editandoId}`
        : `${import.meta.env.VITE_API_URL}/api/lancamentos-fixos`;
      
      const method = editandoId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(corpo)
      });

      if (response.ok) {
        toast({ title: editandoId ? "Lançamento atualizado!" : "Lançamento fixo adicionado!" });
        cancelarEdicao(); // Limpa e sai do modo edição
        carregarDados();
      } else {
        throw new Error("Falha na requisição");
      }
    } catch (error) {
      toast({
        title: "Erro ao salvar lançamento fixo",
        variant: "destructive",
      });
    }
  };

  // Mantive o estilo inline que você usava para deletar, mas adicionei confirmação para segurança
  const handleRemoverLancamento = async (id: number) => {
    if(!confirm("Isso afetará lançamentos futuros. Deseja continuar?")) return;
    
    try {
      await removerLancamentoFixo(id);
      carregarDados();
      toast({ title: "Lançamento fixo removido!" });
    } catch (error) {
      toast({
        title: "Erro ao remover lançamento fixo",
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
    <div className="min-h-screen bg-background pb-20">
      {/* Header atualizado com botão de voltar */}
      <Header showBack={true} backPath="/menu" />

      <main className="container mx-auto px-6 py-8">
        {/* CABEÇALHO ATUALIZADO COM BOTÃO DE SINCRONIZAR */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
             <h2 className="text-2xl font-bold">Configurações</h2>
             <p className="text-muted-foreground">Gerencie categorias e vigência de contas.</p>
          </div>
          
          <Button 
            variant="outline" 
            onClick={handleSincronizar}
            className="gap-2 text-slate-600 border-slate-300 hover:bg-slate-100 hover:text-blue-600 shadow-sm"
            title="Limpar lixo e recalcular futuro"
          >
            <RefreshCw className="w-4 h-4" />
            Sincronizar Agenda
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Categorias (MANTIDO IGUAL) */}
          <Card>
            <CardHeader>
              <CardTitle>Categorias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAdicionarCategoria} className="flex gap-2">
                <Input
                  placeholder="Nova categoria"
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value)}
                  required
                />
                <Button type="submit">Adicionar</Button>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {categorias.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <span>{cat.nome}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await removerCategoria(cat.id);
                          carregarDados();
                          toast({ title: "Categoria removida!" });
                        } catch (error) {
                          toast({
                            title: "Erro ao remover categoria",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Cartões (MANTIDO IGUAL) */}
          <Card>
            <CardHeader>
              <CardTitle>Cartões de Crédito</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAdicionarCartao} className="flex gap-2">
                <Input
                  placeholder="Nome do cartão"
                  value={novoCartao}
                  onChange={(e) => setNovoCartao(e.target.value)}
                  required
                />
                <Button type="submit">Adicionar</Button>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {cartoes.map(cartao => (
                  <div key={cartao.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <span>{cartao.nome}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await removerCartao(cartao.id);
                          carregarDados();
                          toast({ title: "Cartão removido!" });
                        } catch (error) {
                          toast({
                            title: "Erro ao remover cartão",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Lançamentos Fixos (ATUALIZADO COM EDIÇÃO E VIGÊNCIA) */}
          <Card className={`lg:col-span-2 transition-colors ${editandoId ? 'border-blue-500 bg-blue-50/30' : ''}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {editandoId ? <Pencil className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5" />}
                {editandoId ? "Editando Lançamento Fixo" : "Novo Lançamento Fixo"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSalvarLancamento} className="grid md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
                <div className="md:col-span-2">
                  <Label>Descrição</Label>
                  <Input
                    value={novoLancamento.descricao}
                    onChange={(e) => setNovoLancamento({ ...novoLancamento, descricao: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoLancamento.valor}
                    onChange={(e) => setNovoLancamento({ ...novoLancamento, valor: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={novoLancamento.tipo}
                    onValueChange={(v: any) => setNovoLancamento({ ...novoLancamento, tipo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={novoLancamento.categoria_id}
                    onValueChange={(v) => setNovoLancamento({ ...novoLancamento, categoria_id: v })}
                  >
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

                <div>
                  <Label>Dia do Mês</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={novoLancamento.dia_do_mes}
                    onChange={(e) => setNovoLancamento({ ...novoLancamento, dia_do_mes: e.target.value })}
                    required
                  />
                </div>

                {/* NOVOS CAMPOS DE VIGÊNCIA */}
                <div className="md:col-span-2">
                   <Label>Início Vigência</Label>
                   <Input 
                     type="date" 
                     value={novoLancamento.data_inicio}
                     onChange={(e) => setNovoLancamento({ ...novoLancamento, data_inicio: e.target.value })}
                     required
                   />
                </div>

                <div className="md:col-span-2">
                   <Label>Fim Vigência (Opcional)</Label>
                   <Input 
                     type="date" 
                     value={novoLancamento.data_fim}
                     onChange={(e) => setNovoLancamento({ ...novoLancamento, data_fim: e.target.value })}
                   />
                </div>

                <div className="md:col-span-2 flex gap-2">
                  {editandoId && (
                    <Button type="button" variant="outline" onClick={cancelarEdicao} className="flex-1">
                      <X className="w-4 h-4 mr-2" /> Cancelar
                    </Button>
                  )}
                  <Button type="submit" className={`flex-1 ${editandoId ? 'bg-blue-600 hover:bg-blue-700' : ''}`}>
                    {editandoId ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    {editandoId ? "Salvar" : "Adicionar"}
                  </Button>
                </div>
              </form>

              <div className="space-y-2 pt-4 border-t">
                <h3 className="font-semibold mb-2">Lista de Itens Recorrentes</h3>
                {lancamentosFixos.map(lanc => (
                  <div key={lanc.id} className={`flex flex-col md:flex-row items-start md:items-center justify-between p-3 border rounded-lg ${lanc.tipo === 'receita' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`}>
                    <div className="flex-1 grid md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                      <div>
                        <p className="font-semibold">{lanc.descricao}</p>
                        <p className="text-xs text-muted-foreground">{lanc.nome_categoria || 'Sem categoria'}</p>
                      </div>
                      <div>
                         <p className={lanc.tipo === 'receita' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                           {formatarMoeda(lanc.valor)}
                         </p>
                         <p className="text-sm text-muted-foreground">Dia {lanc.dia_do_mes}</p>
                      </div>
                      <div className="lg:col-span-2">
                        <p className="text-xs text-muted-foreground">
                           Vigência: <b>{new Date(lanc.data_inicio).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</b>
                           {lanc.data_fim ? ` até ${new Date(lanc.data_fim).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}` : ' (Indeterminado)'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-2 md:mt-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => prepararEdicao(lanc)}
                        title="Editar Item"
                      >
                        <Pencil className="w-4 h-4 text-blue-500" />
                      </Button>
                      
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoverLancamento(lanc.id)}
                        title="Remover Item"
                      >
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
      </main>
    </div>
  );
};

export default Matriz;
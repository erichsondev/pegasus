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
  obterLancamentosFixos, // Mantemos para leitura
  removerLancamentoFixo,
  type Categoria,
  type Cartao,
  type LancamentoFixo
} from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Pencil, X, Save, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Matriz = () => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [lancamentosFixos, setLancamentosFixos] = useState<LancamentoFixo[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Estados para Categorias e Cartões
  const [novaCategoria, setNovaCategoria] = useState("");
  const [novoCartao, setNovoCartao] = useState("");

  // Estado de Edição para Lançamentos Fixos
  const [editandoId, setEditandoId] = useState<number | null>(null);

  // Estado do Formulário de Lançamentos
  const [formLancamento, setFormLancamento] = useState({
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

  // --- Lógica de Categorias e Cartões (Mantida igual) ---
  const handleAdicionarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaCategoria.trim()) {
      try {
        await adicionarCategoria(novaCategoria);
        setNovaCategoria("");
        carregarDados();
        toast({ title: "Categoria adicionada!" });
      } catch (error) {
        toast({ title: "Erro ao adicionar categoria", variant: "destructive" });
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
        toast({ title: "Erro ao adicionar cartão", variant: "destructive" });
      }
    }
  };

  const handleRemoverCategoria = async (id: number) => {
    try {
      await removerCategoria(id);
      carregarDados();
      toast({ title: "Categoria removida!" });
    } catch (error) {
      toast({ title: "Erro ao remover categoria", variant: "destructive" });
    }
  };

  const handleRemoverCartao = async (id: number) => {
    try {
      await removerCartao(id);
      carregarDados();
      toast({ title: "Cartão removido!" });
    } catch (error) {
      toast({ title: "Erro ao remover cartão", variant: "destructive" });
    }
  };

  // --- NOVA LÓGICA DE LANÇAMENTOS FIXOS (CRIAR E EDITAR) ---

  const prepararEdicao = (item: LancamentoFixo) => {
    setEditandoId(item.id);
    setFormLancamento({
      descricao: item.descricao,
      valor: String(item.valor),
      tipo: item.tipo,
      categoria_id: item.categoria_id ? String(item.categoria_id) : "",
      dia_do_mes: String(item.dia_do_mes),
      // Formata para o input date (YYYY-MM-DD)
      data_inicio: item.data_inicio ? String(item.data_inicio).split('T')[0] : "",
      data_fim: item.data_fim ? String(item.data_fim).split('T')[0] : ""
    });
    
    // Rola suavemente até o formulário
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setFormLancamento({
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
      descricao: formLancamento.descricao,
      valor: parseFloat(formLancamento.valor),
      tipo: formLancamento.tipo,
      dia_do_mes: parseInt(formLancamento.dia_do_mes),
      categoria_id: formLancamento.categoria_id ? parseInt(formLancamento.categoria_id) : null,
      data_inicio: formLancamento.data_inicio,
      data_fim: formLancamento.data_fim || null
    };
    
    try {
      // Pegamos o token do localStorage (ajuste a chave se for diferente)
      const token = localStorage.getItem("token") || localStorage.getItem("auth_token"); 
      const headers = { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      };

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
        toast({ title: editandoId ? "Lançamento atualizado!" : "Lançamento criado!" });
        cancelarEdicao(); // Limpa o form e sai do modo edição
        carregarDados();  // Atualiza a lista
      } else {
        throw new Error("Falha ao salvar");
      }
    } catch (error) {
      toast({
        title: "Erro ao salvar lançamento fixo",
        variant: "destructive",
      });
    }
  };

  const handleRemoverLancamento = async (id: number) => {
    if(!confirm("Tem certeza? Isso vai parar os lançamentos futuros.")) return;
    try {
      await removerLancamentoFixo(id);
      carregarDados();
      toast({ title: "Lançamento fixo removido!" });
    } catch (error) {
      toast({ title: "Erro ao remover", variant: "destructive" });
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
      <Header />

      <main className="container mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold">Configurações (Matriz)</h2>
            <p className="text-muted-foreground">Gerencie categorias e suas contas recorrentes.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>
            ← Voltar ao Dashboard
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Categorias */}
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

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {categorias.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <span>{cat.nome}</span>
                    <Button size="icon" variant="ghost" onClick={() => handleRemoverCategoria(cat.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Cartões */}
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

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {cartoes.map(cartao => (
                  <div key={cartao.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <span>{cartao.nome}</span>
                    <Button size="icon" variant="ghost" onClick={() => handleRemoverCartao(cartao.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Lançamentos Fixos - AGORA COM EDIÇÃO E VIGÊNCIA */}
          <Card className={`lg:col-span-2 transition-colors ${editandoId ? 'border-blue-500 bg-blue-50/30' : ''}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {editandoId ? <Pencil className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5" />}
                {editandoId ? "Editando Lançamento Fixo" : "Novo Lançamento Fixo"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Formulário */}
              <form onSubmit={handleSalvarLancamento} className="grid md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
                <div className="md:col-span-2">
                  <Label>Descrição</Label>
                  <Input
                    value={formLancamento.descricao}
                    onChange={(e) => setFormLancamento({ ...formLancamento, descricao: e.target.value })}
                    required
                    placeholder="Ex: Aluguel"
                  />
                </div>

                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formLancamento.valor}
                    onChange={(e) => setFormLancamento({ ...formLancamento, valor: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Dia do Mês</Label>
                  <Input
                    type="number"
                    min="1" max="31"
                    value={formLancamento.dia_do_mes}
                    onChange={(e) => setFormLancamento({ ...formLancamento, dia_do_mes: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={formLancamento.tipo}
                    onValueChange={(v: any) => setFormLancamento({ ...formLancamento, tipo: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={formLancamento.categoria_id}
                    onValueChange={(v) => setFormLancamento({ ...formLancamento, categoria_id: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categorias.map(cat => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>{cat.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* NOVOS CAMPOS DE DATA */}
                <div className="md:col-span-2">
                  <Label>Início Vigência</Label>
                  <Input 
                    type="date" 
                    value={formLancamento.data_inicio}
                    onChange={(e) => setFormLancamento({ ...formLancamento, data_inicio: e.target.value })}
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <Label>Fim Vigência (Opcional)</Label>
                  <Input 
                    type="date" 
                    value={formLancamento.data_fim}
                    onChange={(e) => setFormLancamento({ ...formLancamento, data_fim: e.target.value })}
                  />
                  <span className="text-[10px] text-muted-foreground">Deixe vazio se for permanente</span>
                </div>

                {/* Botões de Ação */}
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

              <div className="border-t pt-4">
                 <h3 className="font-semibold mb-4">Lançamentos Cadastrados</h3>
                 <div className="space-y-2">
                  {lancamentosFixos.map(lanc => (
                    <div key={lanc.id} className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-lg hover:shadow-sm transition-shadow ${lanc.tipo === 'receita' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`}>
                      
                      <div className="flex-1 grid md:grid-cols-2 lg:grid-cols-4 gap-2 w-full">
                        <div>
                          <p className="font-bold">{lanc.descricao}</p>
                          <p className="text-xs text-muted-foreground">{lanc.nome_categoria || "Sem categoria"}</p>
                        </div>
                        
                        <div>
                          <p className={`font-bold ${lanc.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                            {formatarMoeda(lanc.valor)}
                          </p>
                          <p className="text-xs text-muted-foreground">Dia {lanc.dia_do_mes}</p>
                        </div>

                        <div className="lg:col-span-2">
                           <p className="text-xs text-muted-foreground">
                             Vigência: <b>{new Date(lanc.data_inicio).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</b>
                             {lanc.data_fim ? ` até ${new Date(lanc.data_fim).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}` : " (Permanente)"}
                           </p>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3 md:mt-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => prepararEdicao(lanc)}
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoverLancamento(lanc.id)}
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {lancamentosFixos.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">Nenhum lançamento fixo cadastrado.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Matriz;
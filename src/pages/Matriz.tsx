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
  adicionarLancamentoFixo,
  removerLancamentoFixo,
  type Categoria,
  type Cartao,
  type LancamentoFixo
} from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Matriz = () => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [lancamentosFixos, setLancamentosFixos] = useState<LancamentoFixo[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [novaCategoria, setNovaCategoria] = useState("");
  const [novoCartao, setNovoCartao] = useState("");
  const [novoLancamento, setNovoLancamento] = useState({
    descricao: "",
    valor: "",
    tipo: "receita" as "receita" | "despesa",
    categoria_id: "",
    dia_do_mes: "",
    data_inicio: "",
    data_fim: ""
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

  const handleAdicionarLancamento = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const lancamento = {
      descricao: novoLancamento.descricao,
      valor: parseFloat(novoLancamento.valor),
      tipo: novoLancamento.tipo,
      dia_do_mes: parseInt(novoLancamento.dia_do_mes),
      categoria_id: parseInt(novoLancamento.categoria_id),
      data_inicio: novoLancamento.data_inicio,
      data_fim: novoLancamento.data_fim || undefined
    };
    
    try {
      await adicionarLancamentoFixo(lancamento);
      setNovoLancamento({
        descricao: "",
        valor: "",
        tipo: "receita",
        categoria_id: "",
        dia_do_mes: "",
        data_inicio: "",
        data_fim: ""
      });
      carregarDados();
      toast({ title: "Lançamento fixo adicionado!" });
    } catch (error) {
      toast({
        title: "Erro ao adicionar lançamento fixo",
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
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold">Configurações</h2>
          <Button variant="outline" onClick={() => navigate("/menu")}>
            ← Voltar ao Menu
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

              <div className="space-y-2">
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
                      <Trash2 className="w-4 h-4" />
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

              <div className="space-y-2">
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
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Lançamentos Fixos */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Lançamentos Fixos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAdicionarLancamento} className="grid md:grid-cols-5 gap-4">
                <div>
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

                <div>
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={novoLancamento.data_inicio}
                    onChange={(e) => setNovoLancamento({ ...novoLancamento, data_inicio: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Data Fim (opcional)</Label>
                  <Input
                    type="date"
                    value={novoLancamento.data_fim}
                    onChange={(e) => setNovoLancamento({ ...novoLancamento, data_fim: e.target.value })}
                  />
                </div>

                <Button type="submit" className="md:col-span-5">Adicionar Lançamento Fixo</Button>
              </form>

              <div className="space-y-2">
                {lancamentosFixos.map(lanc => (
                  <div key={lanc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1 grid md:grid-cols-5 gap-4">
                      <p className="font-semibold">{lanc.descricao}</p>
                      <p className={lanc.tipo === 'receita' ? 'text-success' : 'text-destructive'}>
                        {formatarMoeda(lanc.valor)}
                      </p>
                      <p className="text-sm text-muted-foreground">{lanc.tipo}</p>
                      <p className="text-sm text-muted-foreground">{lanc.nome_categoria}</p>
                      <p className="text-sm text-muted-foreground">Dia {lanc.dia_do_mes}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await removerLancamentoFixo(lanc.id);
                          carregarDados();
                          toast({ title: "Lançamento fixo removido!" });
                        } catch (error) {
                          toast({
                            title: "Erro ao remover lançamento fixo",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Matriz;

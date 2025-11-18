// Sistema de armazenamento - agora com integração com a API do backend
import api from './api';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
}

export interface Transacao {
  id: number;
  descricao: string;
  valor: number;
  data: string;
  status: 'efetivado' | 'previsto';
  tipo: 'receita' | 'despesa' | 'investimento';
  categoria_id?: number;
  cartao_id?: number;
  nome_categoria?: string;
  gerado_automaticamente?: boolean;
}

export interface LancamentoFixo {
  id: number;
  descricao: string;
  valor: number;
  tipo: 'receita' | 'despesa';
  dia_do_mes: number;
  categoria_id: number;
  nome_categoria?: string;
  data_inicio: string;
  data_fim?: string;
}

export interface Categoria {
  id: number;
  nome: string;
  analitico: boolean;
}

export interface Cartao {
  id: number;
  nome: string;
}

export interface Resumo {
  saldoInicial: number;
  totalReceitasEfetivadas: number;
  totalDespesasEfetivadas: number;
  totalReceitasPrevistas: number;
  totalDespesasPrevistas: number;
  saldoAtualAcumulado: number;
  saldoFinalProjetado: number;
}

// ===== AUTENTICAÇÃO =====
export const fazerLogin = async (email: string, senha: string): Promise<boolean> => {
  try {
    const resposta = await api.login(email, senha);
    localStorage.setItem('token', resposta.token);
    localStorage.setItem('usuarioLogado', resposta.usuario.email);
    localStorage.setItem('nomeUsuario', resposta.usuario.nome);
    return true;
  } catch (error) {
    console.error('Erro no login:', error);
    return false;
  }
};

export const fazerCadastro = async (nome: string, email: string, senha: string): Promise<boolean> => {
  try {
    await api.cadastrar(nome, email, senha);
    return true;
  } catch (error) {
    console.error('Erro no cadastro:', error);
    return false;
  }
};

export const fazerLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('usuarioLogado');
  localStorage.removeItem('nomeUsuario');
};

export const estaLogado = (): boolean => {
  return !!localStorage.getItem('token');
};

export const obterNomeUsuario = (): string => {
  return localStorage.getItem('nomeUsuario') || 'Usuário';
};

// ===== RESUMO =====
export const obterResumo = async (ano: number, mes: number): Promise<Resumo> => {
  try {
    return await api.obterResumo(ano, mes);
  } catch (error) {
    console.error('Erro ao obter resumo:', error);
    throw error;
  }
};

// ===== TRANSAÇÕES =====
export const obterTransacoes = async (ano: number, mes: number): Promise<Transacao[]> => {
  try {
    return await api.obterTransacoes(ano, mes);
  } catch (error) {
    console.error('Erro ao obter transações:', error);
    return [];
  }
};

export const adicionarTransacao = async (transacao: {
  descricao: string;
  valor: number;
  data: string;
  status: 'efetivado' | 'previsto';
  tipo: 'receita' | 'despesa' | 'investimento';
  categoria_id?: number;
  cartao_id?: number;
}): Promise<void> => {
  try {
    await api.criarTransacao(transacao);
  } catch (error) {
    console.error('Erro ao adicionar transação:', error);
    throw error;
  }
};

export const editarTransacao = async (id: number, transacao: {
  descricao: string;
  valor: number;
  data: string;
  status: 'efetivado' | 'previsto';
  categoria_id?: number;
  cartao_id?: number;
}): Promise<void> => {
  try {
    await api.atualizarTransacao(id, transacao);
  } catch (error) {
    console.error('Erro ao editar transação:', error);
    throw error;
  }
};

export const removerTransacao = async (id: number): Promise<void> => {
  try {
    await api.removerTransacao(id);
  } catch (error) {
    console.error('Erro ao remover transação:', error);
    throw error;
  }
};

export const efetivarTransacao = async (id: number): Promise<void> => {
  try {
    await api.efetivarTransacao(id);
  } catch (error) {
    console.error('Erro ao efetivar transação:', error);
    throw error;
  }
};

export const preverTransacao = async (id: number): Promise<void> => {
  try {
    await api.preverTransacao(id);
  } catch (error) {
    console.error('Erro ao prever transação:', error);
    throw error;
  }
};

// ===== CATEGORIAS =====
export const obterCategorias = async (): Promise<Categoria[]> => {
  try {
    return await api.obterCategorias();
  } catch (error) {
    console.error('Erro ao obter categorias:', error);
    return [];
  }
};

export const adicionarCategoria = async (nome: string): Promise<void> => {
  try {
    await api.criarCategoria(nome);
  } catch (error) {
    console.error('Erro ao adicionar categoria:', error);
    throw error;
  }
};

export const removerCategoria = async (id: number): Promise<void> => {
  try {
    await api.removerCategoria(id);
  } catch (error) {
    console.error('Erro ao remover categoria:', error);
    throw error;
  }
};

// ===== CARTÕES =====
export const obterCartoes = async (): Promise<Cartao[]> => {
  try {
    return await api.obterCartoes();
  } catch (error) {
    console.error('Erro ao obter cartões:', error);
    return [];
  }
};

export const adicionarCartao = async (nome: string): Promise<void> => {
  try {
    await api.criarCartao(nome);
  } catch (error) {
    console.error('Erro ao adicionar cartão:', error);
    throw error;
  }
};

export const removerCartao = async (id: number): Promise<void> => {
  try {
    await api.removerCartao(id);
  } catch (error) {
    console.error('Erro ao remover cartão:', error);
    throw error;
  }
};

// ===== LANÇAMENTOS FIXOS =====
export const obterLancamentosFixos = async (): Promise<LancamentoFixo[]> => {
  try {
    return await api.obterLancamentosFixos();
  } catch (error) {
    console.error('Erro ao obter lançamentos fixos:', error);
    return [];
  }
};

export const adicionarLancamentoFixo = async (lancamento: {
  descricao: string;
  valor: number;
  tipo: 'receita' | 'despesa';
  dia_do_mes: number;
  categoria_id: number;
  data_inicio: string;
  data_fim?: string;
}): Promise<void> => {
  try {
    await api.criarLancamentoFixo(lancamento);
  } catch (error) {
    console.error('Erro ao adicionar lançamento fixo:', error);
    throw error;
  }
};

export const removerLancamentoFixo = async (id: number): Promise<void> => {
  try {
    await api.removerLancamentoFixo(id);
  } catch (error) {
    console.error('Erro ao remover lançamento fixo:', error);
    throw error;
  }
};

import { supabase } from './supabaseClient';

export interface Transacao {
  id: string; // Supabase usa UUID
  descricao: string;
  valor: number;
  data: string;
  status: 'efetivado' | 'previsto';
  tipo: 'receita' | 'despesa' | 'investimento';
  categoria_id?: string;
  cartao_id?: string;
  nome_categoria?: string;
}

export interface LancamentoFixo {
  id: string;
  descricao: string;
  valor: number;
  tipo: 'receita' | 'despesa';
  dia_do_mes: number;
  categoria_id?: string;
  nome_categoria?: string;
  data_inicio: string;
  data_fim?: string;
}

export interface Categoria {
  id: string;
  nome: string;
  analitico: boolean;
}

export interface Cartao {
  id: string;
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

// ===== HELPER PARA OBTER USUÁRIO ATUAL =====
const getCurrentUserId = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Usuário não autenticado");
  return session.user.id;
};

// ===== AUTENTICAÇÃO (Legado, mantido para compatibilidade) =====
export const fazerLogout = async () => {
  await supabase.auth.signOut();
  window.location.href = '/';
};

export const estaLogado = (): boolean => {
  // A verificação real agora é feita pelo AuthContext, isso é apenas um fallback
  return !!localStorage.getItem('sb-' + import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.substring(0, 10) + '-auth-token');
};

// ===== RESUMO =====
export const obterResumo = async (ano: number, mes: number): Promise<Resumo> => {
  try {
    const transacoes = await obterTransacoes(ano, mes);
    
    let totalReceitasEfetivadas = 0;
    let totalDespesasEfetivadas = 0;
    let totalReceitasPrevistas = 0;
    let totalDespesasPrevistas = 0;

    transacoes.forEach(t => {
      const valor = Number(t.valor) || 0;
      if (t.tipo === 'receita') {
        if (t.status === 'efetivado') totalReceitasEfetivadas += valor;
        else totalReceitasPrevistas += valor;
      } else if (t.tipo === 'despesa') {
        if (t.status === 'efetivado') totalDespesasEfetivadas += valor;
        else totalDespesasPrevistas += valor;
      }
    });

    const saldoAtualAcumulado = totalReceitasEfetivadas - totalDespesasEfetivadas;
    const saldoFinalProjetado = saldoAtualAcumulado + (totalReceitasPrevistas - totalDespesasPrevistas);

    return {
      saldoInicial: 0,
      totalReceitasEfetivadas,
      totalDespesasEfetivadas,
      totalReceitasPrevistas,
      totalDespesasPrevistas,
      saldoAtualAcumulado,
      saldoFinalProjetado
    };
  } catch (error) {
    console.error('Erro ao obter resumo:', error);
    throw error;
  }
};

// ===== TRANSAÇÕES =====
export const obterTransacoes = async (ano: number, mes: number): Promise<Transacao[]> => {
  try {
    const userId = await getCurrentUserId();
    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const dataFim = new Date(ano, mes, 0).toISOString().split('T')[0];

    let todosDados: any[] = [];
    let temMais = true;
    let pagina = 0;
    const tamanhoPagina = 1000;

    while (temMais) {
      const { data, error } = await supabase
        .from('transacoes')
        .select(`*, categorias(nome)`)
        .eq('user_id', userId)
        .gte('data', dataInicio)
        .lte('data', dataFim)
        .range(pagina * tamanhoPagina, (pagina + 1) * tamanhoPagina - 1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        todosDados = [...todosDados, ...data];
      }

      if (!data || data.length < tamanhoPagina) {
        temMais = false;
      } else {
        pagina++;
      }
    }

    return todosDados.map(t => ({
      ...t,
      nome_categoria: t.categorias?.nome || 'Sem Categoria'
    }));
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
  categoria_id?: string;
  cartao_id?: string;
}): Promise<void> => {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase.from('transacoes').insert([{
      ...transacao,
      user_id: userId,
      valor: Number(transacao.valor) || 0,
      categoria_id: transacao.categoria_id || null,
      cartao_id: transacao.cartao_id || null
    }]);
    
    if (error) throw error;
  } catch (error) {
    console.error('Erro ao adicionar transação:', error);
    throw error;
  }
};

export const editarTransacao = async (id: string, transacao: {
  descricao: string;
  valor: number;
  data: string;
  status: 'efetivado' | 'previsto';
  categoria_id?: string;
  cartao_id?: string;
}): Promise<void> => {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('transacoes')
      .update({
        ...transacao,
        valor: Number(transacao.valor) || 0,
        categoria_id: transacao.categoria_id || null,
        cartao_id: transacao.cartao_id || null
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao editar transação:', error);
    throw error;
  }
};

export const removerTransacao = async (id: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase.from('transacoes').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
  } catch (error) {
    console.error('Erro ao remover transação:', error);
    throw error;
  }
};

export const efetivarTransacao = async (id: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase.from('transacoes').update({ status: 'efetivado' }).eq('id', id).eq('user_id', userId);
    if (error) throw error;
  } catch (error) {
    console.error('Erro ao efetivar transação:', error);
    throw error;
  }
};

export const preverTransacao = async (id: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase.from('transacoes').update({ status: 'previsto' }).eq('id', id).eq('user_id', userId);
    if (error) throw error;
  } catch (error) {
    console.error('Erro ao prever transação:', error);
    throw error;
  }
};

// ===== CATEGORIAS =====
export const obterCategorias = async (): Promise<Categoria[]> => {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase.from('categorias').select('*').eq('user_id', userId).order('nome');
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erro ao obter categorias:', error);
    return [];
  }
};

export const adicionarCategoria = async (nome: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase.from('categorias').insert([{ nome, user_id: userId }]);
    if (error) throw error;
  } catch (error) {
    console.error('Erro ao adicionar categoria:', error);
    throw error;
  }
};

export const removerCategoria = async (id: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase.from('categorias').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
  } catch (error) {
    console.error('Erro ao remover categoria:', error);
    throw error;
  }
};

// ===== CARTÕES =====
export const obterCartoes = async (): Promise<Cartao[]> => {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase.from('cartoes').select('*').eq('user_id', userId).order('nome');
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erro ao obter cartões:', error);
    return [];
  }
};

export const adicionarCartao = async (nome: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase.from('cartoes').insert([{ nome, user_id: userId }]);
    if (error) throw error;
  } catch (error) {
    console.error('Erro ao adicionar cartão:', error);
    throw error;
  }
};

export const removerCartao = async (id: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase.from('cartoes').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
  } catch (error) {
    console.error('Erro ao remover cartão:', error);
    throw error;
  }
};

// ===== LANÇAMENTOS FIXOS =====
export const obterLancamentosFixos = async (): Promise<LancamentoFixo[]> => {
  try {
    const userId = await getCurrentUserId();
    
    let todosDados: any[] = [];
    let temMais = true;
    let pagina = 0;
    const tamanhoPagina = 1000;

    while (temMais) {
      const { data, error } = await supabase
        .from('lancamentos_fixos')
        .select(`*, categorias(nome)`)
        .eq('user_id', userId)
        .order('dia_do_mes')
        .range(pagina * tamanhoPagina, (pagina + 1) * tamanhoPagina - 1);

      if (error) throw error;
      if (data && data.length > 0) todosDados = [...todosDados, ...data];
      if (!data || data.length < tamanhoPagina) temMais = false;
      else pagina++;
    }

    return todosDados.map(l => ({
      ...l,
      nome_categoria: l.categorias?.nome || 'Sem categoria'
    }));
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
  categoria_id?: string;
  data_inicio: string;
  data_fim?: string;
}): Promise<void> => {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase.from('lancamentos_fixos').insert([{
      ...lancamento,
      user_id: userId,
      valor: Number(lancamento.valor) || 0,
      categoria_id: lancamento.categoria_id || null,
      data_fim: lancamento.data_fim || null
    }]);
    if (error) throw error;
  } catch (error) {
    console.error('Erro ao adicionar lançamento fixo:', error);
    throw error;
  }
};

export const removerLancamentoFixo = async (id: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase.from('lancamentos_fixos').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
  } catch (error) {
    console.error('Erro ao remover lançamento fixo:', error);
    throw error;
  }
};
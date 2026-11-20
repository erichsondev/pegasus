import { supabase } from './supabaseClient';

export interface Transacao {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  status: 'efetivado' | 'previsto';
  tipo: 'receita' | 'despesa' | 'investimento';
  categoria_id?: string;
  cartao_id?: string;
  lancamento_fixo_id?: string;
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

const getCurrentUserId = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Usuário não autenticado");
  return session.user.id;
};

// Helper para calcular data segura no mês (evita 31/02 virar data inválida)
const montarDataSegura = (ano: number, mesIndex: number, diaDesejado: number): string => {
  const ultimoDiaDoMes = new Date(ano, mesIndex + 1, 0).getDate();
  const diaFinal = Math.min(diaDesejado, ultimoDiaDoMes);
  return `${ano}-${String(mesIndex + 1).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`;
};

// Helper para projetar parcelas de um lançamento fixo
export const gerarProjecoesLancamentoFixo = async (
  userId: string,
  lancamento: {
    id?: string;
    descricao: string;
    valor: number;
    tipo: 'receita' | 'despesa';
    dia_do_mes: number;
    categoria_id?: string | null;
    data_inicio: string;
    data_fim?: string | null;
  },
  apenasFuturoAPartirDeHoje: boolean = false
) => {
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

  const [anoIni, mesIni] = lancamento.data_inicio.split('T')[0].split('-').map(Number);
  const inicioVig = new Date(anoIni, mesIni - 1, 1);

  let fimVig: Date;
  if (lancamento.data_fim) {
    const [anoFim, mesFim] = lancamento.data_fim.split('T')[0].split('-').map(Number);
    fimVig = new Date(anoFim, mesFim - 1, 1);
  } else {
    fimVig = new Date(hoje.getFullYear() + 5, 11, 1);
  }

  const absInicio = inicioVig.getFullYear() * 12 + inicioVig.getMonth();
  const absFim = fimVig.getFullYear() * 12 + fimVig.getMonth();

  let pointer = new Date(inicioVig.getFullYear(), inicioVig.getMonth(), 1);
  if (apenasFuturoAPartirDeHoje) {
    const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    if (pointer < mesAtual) pointer = mesAtual;
  }

  const novasTransacoes: any[] = [];

  while (pointer <= fimVig) {
    const ano = pointer.getFullYear();
    const mes = pointer.getMonth();
    const absAlvo = ano * 12 + mes;

    if (absAlvo >= absInicio && absAlvo <= absFim) {
      const dataStr = montarDataSegura(ano, mes, Number(lancamento.dia_do_mes));
      if (!apenasFuturoAPartirDeHoje || dataStr >= hojeStr) {
        novasTransacoes.push({
          user_id: userId,
          lancamento_fixo_id: lancamento.id || null,
          categoria_id: lancamento.categoria_id || null,
          descricao: lancamento.descricao,
          valor: Number(lancamento.valor) || 0,
          tipo: lancamento.tipo,
          status: 'previsto',
          data: dataStr,
        });
      }
    }
    pointer.setMonth(pointer.getMonth() + 1);
  }

  const chunkSize = 500;
  for (let i = 0; i < novasTransacoes.length; i += chunkSize) {
    const chunk = novasTransacoes.slice(i, i + chunkSize);
    const { error } = await supabase.from('transacoes').insert(chunk);
    if (error) throw error;
  }

  return novasTransacoes.length;
};

// ===== AUTENTICAÇÃO =====
export const fazerLogout = async () => {
  await supabase.auth.signOut();
  window.location.href = '/';
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
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

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
      if (data && data.length > 0) todosDados = [...todosDados, ...data];
      if (!data || data.length < tamanhoPagina) temMais = false;
      else pagina++;
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
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('transacoes').insert([{
    ...transacao,
    user_id: userId,
    valor: Number(transacao.valor) || 0,
    categoria_id: transacao.categoria_id || null,
    cartao_id: transacao.cartao_id || null
  }]);
  if (error) throw error;
};

export const editarTransacao = async (id: string, transacao: {
  descricao: string;
  valor: number;
  data: string;
  status: 'efetivado' | 'previsto';
  tipo?: 'receita' | 'despesa' | 'investimento';
  categoria_id?: string;
  cartao_id?: string;
}): Promise<void> => {
  const userId = await getCurrentUserId();
  const payload: any = {
    descricao: transacao.descricao,
    valor: Number(transacao.valor) || 0,
    data: transacao.data,
    status: transacao.status,
    categoria_id: transacao.categoria_id || null,
    cartao_id: transacao.cartao_id || null,
  };

  if (transacao.tipo) {
    payload.tipo = transacao.tipo;
  }

  const { error } = await supabase
    .from('transacoes')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
};

export const removerTransacao = async (id: string): Promise<void> => {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('transacoes').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
};

export const efetivarTransacao = async (id: string): Promise<void> => {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('transacoes').update({ status: 'efetivado' }).eq('id', id).eq('user_id', userId);
  if (error) throw error;
};

export const preverTransacao = async (id: string): Promise<void> => {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('transacoes').update({ status: 'previsto' }).eq('id', id).eq('user_id', userId);
  if (error) throw error;
};

// ===== CATEGORIAS =====
export const obterCategorias = async (): Promise<Categoria[]> => {
  try {
    const userId = await getCurrentUserId();
    let todosDados: any[] = [];
    let temMais = true;
    let pagina = 0;
    const tamanhoPagina = 1000;

    while (temMais) {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('user_id', userId)
        .order('nome')
        .range(pagina * tamanhoPagina, (pagina + 1) * tamanhoPagina - 1);

      if (error) throw error;
      if (data && data.length > 0) todosDados = [...todosDados, ...data];
      if (!data || data.length < tamanhoPagina) temMais = false;
      else pagina++;
    }
    return todosDados;
  } catch (error) {
    console.error('Erro ao obter categorias:', error);
    return [];
  }
};

export const adicionarCategoria = async (nome: string): Promise<void> => {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('categorias').insert([{ nome: nome.trim(), user_id: userId }]);
  if (error) throw error;
};

export const removerCategoria = async (id: string): Promise<void> => {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('categorias').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
};

// ===== CARTÕES =====
export const obterCartoes = async (): Promise<Cartao[]> => {
  try {
    const userId = await getCurrentUserId();
    let todosDados: any[] = [];
    let temMais = true;
    let pagina = 0;
    const tamanhoPagina = 1000;

    while (temMais) {
      const { data, error } = await supabase
        .from('cartoes')
        .select('*')
        .eq('user_id', userId)
        .order('nome')
        .range(pagina * tamanhoPagina, (pagina + 1) * tamanhoPagina - 1);

      if (error) throw error;
      if (data && data.length > 0) todosDados = [...todosDados, ...data];
      if (!data || data.length < tamanhoPagina) temMais = false;
      else pagina++;
    }
    return todosDados;
  } catch (error) {
    console.error('Erro ao obter cartões:', error);
    return [];
  }
};

export const adicionarCartao = async (nome: string): Promise<void> => {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('cartoes').insert([{ nome: nome.trim(), user_id: userId }]);
  if (error) throw error;
};

export const removerCartao = async (id: string): Promise<void> => {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('cartoes').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
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

    return todosDados
      .map(l => ({
        ...l,
        nome_categoria: l.categorias?.nome || 'Sem categoria'
      }))
      .sort((a, b) => {
        if (a.tipo === 'receita' && b.tipo !== 'receita') return -1;
        if (b.tipo === 'receita' && a.tipo !== 'receita') return 1;
        if (a.dia_do_mes !== b.dia_do_mes) return a.dia_do_mes - b.dia_do_mes;
        return a.descricao.localeCompare(b.descricao);
      });
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
}): Promise<number> => {
  const userId = await getCurrentUserId();
  const payload = {
    descricao: lancamento.descricao.trim(),
    valor: Number(lancamento.valor) || 0,
    tipo: lancamento.tipo,
    dia_do_mes: Number(lancamento.dia_do_mes),
    categoria_id: lancamento.categoria_id || null,
    data_inicio: lancamento.data_inicio,
    data_fim: lancamento.data_fim || null,
    user_id: userId,
  };

  const { data, error } = await supabase
    .from('lancamentos_fixos')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;

  const qtdGerada = await gerarProjecoesLancamentoFixo(
    userId,
    { ...payload, id: data.id },
    false
  );
  return qtdGerada;
};

export const removerLancamentoFixo = async (id: string): Promise<void> => {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('lancamentos_fixos').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
};
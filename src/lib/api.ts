// Configuração da API do Pegasus Finance
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Função auxiliar para obter o token
const getToken = (): string | null => {
  return localStorage.getItem('token');
};

// Função auxiliar para fazer requisições autenticadas
const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/api${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token inválido ou expirado
    localStorage.removeItem('token');
    localStorage.removeItem('usuarioLogado');
    localStorage.removeItem('nomeUsuario');
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }

  if (!response.ok && response.status !== 404 && response.status !== 204) {
    const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
    throw new Error(errorData.message || 'Erro na requisição');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

// ===== AUTENTICAÇÃO =====
export const api = {
  // Cadastro
  cadastrar: async (nome: string, email: string, senha: string) => {
    return fetchWithAuth('/usuarios/cadastro', {
      method: 'POST',
      body: JSON.stringify({ nome, email, senha }),
    });
  },

  // Login
  login: async (email: string, senha: string) => {
    return fetchWithAuth('/usuarios/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    });
  },

  // ===== RESUMO =====
  obterResumo: async (ano: number, mes: number) => {
    return fetchWithAuth(`/resumo?ano=${ano}&mes=${mes}`);
  },

  // ===== TRANSAÇÕES =====
  obterTransacoes: async (ano: number, mes: number) => {
    return fetchWithAuth(`/transacoes?ano=${ano}&mes=${mes}`);
  },

  criarTransacao: async (transacao: {
    descricao: string;
    valor: number;
    data: string;
    status: string;
    tipo: string;
    categoria_id?: number;
    cartao_id?: number;
  }) => {
    return fetchWithAuth('/transacoes', {
      method: 'POST',
      body: JSON.stringify(transacao),
    });
  },

  atualizarTransacao: async (id: number, transacao: {
    descricao: string;
    valor: number;
    data: string;
    status: string;
    categoria_id?: number;
    cartao_id?: number;
  }) => {
    return fetchWithAuth(`/transacoes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(transacao),
    });
  },

  removerTransacao: async (id: number) => {
    return fetchWithAuth(`/transacoes/${id}`, {
      method: 'DELETE',
    });
  },

  efetivarTransacao: async (id: number) => {
    return fetchWithAuth(`/transacoes/${id}/efetivar`, {
      method: 'PUT',
    });
  },

  preverTransacao: async (id: number) => {
    return fetchWithAuth(`/transacoes/${id}/prever`, {
      method: 'PUT',
    });
  },

  // ===== CATEGORIAS =====
  obterCategorias: async () => {
    return fetchWithAuth('/categorias');
  },

  criarCategoria: async (nome: string, analitico: boolean = true) => {
    return fetchWithAuth('/categorias', {
      method: 'POST',
      body: JSON.stringify({ nome, analitico }),
    });
  },

  removerCategoria: async (id: number) => {
    return fetchWithAuth(`/categorias/${id}`, {
      method: 'DELETE',
    });
  },

  // ===== CARTÕES =====
  obterCartoes: async () => {
    return fetchWithAuth('/cartoes');
  },

  criarCartao: async (nome: string) => {
    return fetchWithAuth('/cartoes', {
      method: 'POST',
      body: JSON.stringify({ nome }),
    });
  },

  removerCartao: async (id: number) => {
    return fetchWithAuth(`/cartoes/${id}`, {
      method: 'DELETE',
    });
  },

  // ===== LANÇAMENTOS FIXOS =====
  obterLancamentosFixos: async () => {
    return fetchWithAuth('/lancamentos-fixos');
  },

  criarLancamentoFixo: async (lancamento: {
    descricao: string;
    valor: number;
    tipo: string;
    dia_do_mes: number;
    categoria_id: number;
    data_inicio: string;
    data_fim?: string;
  }) => {
    return fetchWithAuth('/lancamentos-fixos', {
      method: 'POST',
      body: JSON.stringify(lancamento),
    });
  },

  removerLancamentoFixo: async (id: number) => {
    return fetchWithAuth(`/lancamentos-fixos/${id}`, {
      method: 'DELETE',
    });
  },

  // ===== GRÁFICOS =====
  obterEvolucaoPatrimonial: async (inicio: string, fim: string) => {
    return fetchWithAuth(`/grafico/evolucao-patrimonial?inicio=${inicio}&fim=${fim}`);
  },

  obterDespesasPorCategoria: async (inicio: string, fim: string) => {
    return fetchWithAuth(`/grafico/despesas-por-categoria?inicio=${inicio}&fim=${fim}`);
  },

  obterGastosPorCartao: async (inicio: string, fim: string) => {
    return fetchWithAuth(`/grafico/gastos-por-cartao?inicio=${inicio}&fim=${fim}`);
  },
};

export default api;

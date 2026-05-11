const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Conexão com o PostgreSQL (Supabase)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'chave_super_secreta_padrao_123';

// --- MIDDLEWARE DE AUTENTICAÇÃO ---
const autenticar = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Acesso negado. Token ausente.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ message: 'Sessão expirada ou token inválido.' });
    req.user = user;
    next();
  });
};

// ==========================================
// ROTAS DE USUÁRIOS
// ==========================================

app.post('/api/usuarios/cadastro', async (req, res) => {
  const { nome, email, senha } = req.body;
  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const result = await pool.query(
      'INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3) RETURNING id, nome, email',
      [nome, email, senhaHash]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ message: 'Erro ao cadastrar usuário. E-mail pode já estar em uso.' });
  }
});

app.post('/api/usuarios/login', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ message: 'E-mail ou senha incorretos.' });

    const usuario = result.rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) return res.status(401).json({ message: 'E-mail ou senha incorretos.' });

    const token = jwt.sign({ id: usuario.id, nome: usuario.nome }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
  } catch (err) {
    res.status(500).json({ message: 'Erro no servidor.' });
  }
});

// ==========================================
// ROTAS DE TRANSAÇÕES
// ==========================================

app.get('/api/transacoes', autenticar, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, c.nome as nome_categoria 
       FROM transacoes t 
       LEFT JOIN categorias c ON t.categoria_id = c.id 
       WHERE t.usuario_id = $1 
       ORDER BY t.data DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar transações.' });
  }
});

app.post('/api/transacoes', autenticar, async (req, res) => {
  const { descricao, valor, tipo, status, data, categoria_id, cartao_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO transacoes (usuario_id, descricao, valor, tipo, status, data, categoria_id, cartao_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [req.user.id, descricao, valor, tipo, status, data, categoria_id, cartao_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao criar transação.' });
  }
});

app.delete('/api/transacoes/:id', autenticar, async (req, res) => {
  try {
    await pool.query('DELETE FROM transacoes WHERE id = $1 AND usuario_id = $2', [req.params.id, req.user.id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Erro ao excluir transação.' });
  }
});

// ==========================================
// ROTAS DE LANÇAMENTOS FIXOS (MOTOR DE PROJEÇÃO)
// ==========================================

app.get('/api/lancamentos-fixos', autenticar, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT lf.*, c.nome as nome_categoria FROM lancamentos_fixos lf LEFT JOIN categorias c ON lf.categoria_id = c.id WHERE lf.usuario_id = $1',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar lançamentos fixos.' });
  }
});

app.post('/api/lancamentos-fixos', autenticar, async (req, res) => {
  const { descricao, valor, tipo, dia_do_mes, categoria_id, data_inicio, data_fim } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Salva o Lançamento Fixo
    const result = await client.query(
      'INSERT INTO lancamentos_fixos (usuario_id, descricao, valor, tipo, dia_do_mes, categoria_id, data_inicio, data_fim) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [req.user.id, descricao, valor, tipo, dia_do_mes, categoria_id, data_inicio, data_fim]
    );
    
    const novoFixo = result.rows[0];

    // 2. Projeta transações para o mês atual e o próximo
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    const mesesAlvo = [mesAtual, mesAtual + 1];

    for (const mesOffset of mesesAlvo) {
      const ano = mesOffset > 11 ? anoAtual + 1 : anoAtual;
      const mes = mesOffset > 11 ? 0 : mesOffset;
      
      const dataAlvoStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia_do_mes).padStart(2, '0')}`;
      
      // Ajuste de Vigência Dinâmica:
      // Se estamos projetando para o mês atual, ignoramos o dia específico da vigência
      // para garantir que o plano financeiro do mês fique completo.
      const inicioVigencia = new Date(data_inicio);
      const dataAlvoObj = new Date(`${dataAlvoStr}T00:00:00`);
      
      // Regra: Se o mês/ano da transação for igual ao mês/ano de início, permitimos a criação.
      const mesmoMesInicio = (ano === inicioVigencia.getFullYear() && mes === inicioVigencia.getMonth());

      if (mesmoMesInicio || dataAlvoObj >= inicioVigencia) {
        if (!data_fim || dataAlvoObj <= new Date(data_fim)) {
          await client.query(
            "INSERT INTO transacoes (usuario_id, categoria_id, descricao, valor, tipo, status, data) VALUES ($1, $2, $3, $4, $5, 'previsto', $6)",
            [req.user.id, categoria_id, descricao, valor, tipo, dataAlvoStr]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json(novoFixo);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Erro ao criar lançamento fixo.' });
  } finally {
    client.release();
  }
});

app.delete('/api/lancamentos-fixos/:id', autenticar, async (req, res) => {
  try {
    await pool.query('DELETE FROM lancamentos_fixos WHERE id = $1 AND usuario_id = $2', [req.params.id, req.user.id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Erro ao excluir lançamento fixo.' });
  }
});

// ==========================================
// ROTAS DE MANUTENÇÃO (SINCRONIZAÇÃO)
// ==========================================

app.post('/api/manutencao/sincronizar-agenda', autenticar, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Limpa transações previstas futuras para evitar duplicidade
    await client.query(
      "DELETE FROM transacoes WHERE usuario_id = $1 AND status = 'previsto' AND data >= CURRENT_DATE",
      [req.user.id]
    );

    // 2. Busca todos os lançamentos fixos ativos
    const fixos = await client.query('SELECT * FROM lancamentos_fixos WHERE usuario_id = $1', [req.user.id]);

    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    const mesesAlvo = [mesAtual, mesAtual + 1, mesAtual + 2]; // Sincroniza 3 meses pra frente

    for (const fixo of fixos.rows) {
      for (const mesOffset of mesesAlvo) {
        const ano = mesOffset > 11 ? (mesOffset > 23 ? anoAtual + 2 : anoAtual + 1) : anoAtual;
        const mes = mesOffset % 12;
        
        const dataAlvoStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(fixo.dia_do_mes).padStart(2, '0')}`;
        const dataAlvoObj = new Date(`${dataAlvoStr}T00:00:00`);
        const inicioVigencia = new Date(fixo.data_inicio);

        if (dataAlvoObj >= inicioVigencia && (!fixo.data_fim || dataAlvoObj <= new Date(fixo.data_fim))) {
          await client.query(
            "INSERT INTO transacoes (usuario_id, categoria_id, descricao, valor, tipo, status, data) VALUES ($1, $2, $3, $4, $5, 'previsto', $6)",
            [req.user.id, fixo.categoria_id, fixo.descricao, fixo.valor, fixo.tipo, dataAlvoStr]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Agenda sincronizada com sucesso!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Erro ao sincronizar agenda.' });
  } finally {
    client.release();
  }
});

// ==========================================
// ROTAS DE CATEGORIAS E CARTÕES
// ==========================================

app.get('/api/categorias', autenticar, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categorias WHERE usuario_id = $1 OR usuario_id IS NULL ORDER BY nome', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar categorias.' });
  }
});

app.get('/api/cartoes', autenticar, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cartoes WHERE usuario_id = $1 ORDER BY nome', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar cartões.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

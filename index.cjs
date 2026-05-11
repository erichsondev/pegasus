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
    console.log(` Tentando cadastrar usuário: ${email}`);
    const hashSenha = await bcrypt.hash(senha, 10);
    const result = await pool.query(
      'INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3) RETURNING id, nome, email',
      [nome, email, hashSenha]
    );
    console.log(" Cadastro com sucesso no Supabase!");
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("🚨 ERRO REAL DO BANCO DE DADOS:", err);
    res.status(400).json({ message: `Falha no banco: ${err.message}` });
  }
});

app.post('/api/usuarios/login', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const user = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (user.rows.length === 0) return res.status(401).json({ message: 'E-mail ou senha incorretos.' });

    const senhaValida = await bcrypt.compare(senha, user.rows[0].senha);
    if (!senhaValida) return res.status(401).json({ message: 'E-mail ou senha incorretos.' });

    const token = jwt.sign({ id: user.rows[0].id, email: user.rows[0].email, nome: user.rows[0].nome }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, usuario: { id: user.rows[0].id, nome: user.rows[0].nome, email: user.rows[0].email } });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno no servidor.' });
  }
});

// ==========================================
// ROTAS DE RESUMO (Home Dashboard Restaurada!)
// ==========================================

app.get('/api/resumo', autenticar, async (req, res) => {
  const { ano, mes } = req.query;
  const usuario_id = req.user.id;
  
  try {
    const receitasEfetivadas = await pool.query(
      "SELECT COALESCE(SUM(valor), 0) AS total FROM transacoes WHERE usuario_id = $1 AND tipo = 'receita' AND status = 'efetivado' AND EXTRACT(YEAR FROM data) = $2 AND EXTRACT(MONTH FROM data) = $3",
      [usuario_id, ano, mes]
    );
    const despesasEfetivadas = await pool.query(
      "SELECT COALESCE(SUM(valor), 0) AS total FROM transacoes WHERE usuario_id = $1 AND tipo = 'despesa' AND status = 'efetivado' AND EXTRACT(YEAR FROM data) = $2 AND EXTRACT(MONTH FROM data) = $3",
      [usuario_id, ano, mes]
    );
    const receitasPrevistas = await pool.query(
      "SELECT COALESCE(SUM(valor), 0) AS total FROM transacoes WHERE usuario_id = $1 AND tipo = 'receita' AND status = 'previsto' AND EXTRACT(YEAR FROM data) = $2 AND EXTRACT(MONTH FROM data) = $3",
      [usuario_id, ano, mes]
    );
    const despesasPrevistas = await pool.query(
      "SELECT COALESCE(SUM(valor), 0) AS total FROM transacoes WHERE usuario_id = $1 AND tipo = 'despesa' AND status = 'previsto' AND EXTRACT(YEAR FROM data) = $2 AND EXTRACT(MONTH FROM data) = $3",
      [usuario_id, ano, mes]
    );

    const rEfet = parseFloat(receitasEfetivadas.rows[0].total);
    const dEfet = parseFloat(despesasEfetivadas.rows[0].total);
    const rPrev = parseFloat(receitasPrevistas.rows[0].total);
    const dPrev = parseFloat(despesasPrevistas.rows[0].total);

    const saldoAtualAcumulado = rEfet - dEfet;
    const saldoFinalProjetado = saldoAtualAcumulado + (rPrev - dPrev);

    res.json({
      saldoInicial: 0,
      totalReceitasEfetivadas: rEfet,
      totalDespesasEfetivadas: dEfet,
      totalReceitasPrevistas: rPrev,
      totalDespesasPrevistas: dPrev,
      saldoAtualAcumulado,
      saldoFinalProjetado
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// ROTAS DE TRANSAÇÕES (Com Filtro de Mês/Ano Corrigido!)
// ==========================================

app.get('/api/transacoes', autenticar, async (req, res) => {
  const { ano, mes } = req.query;
  const usuario_id = req.user.id;
  try {
    const result = await pool.query(
      `SELECT t.*, c.nome AS nome_categoria 
       FROM transacoes t 
       LEFT JOIN categorias c ON t.categoria_id = c.id 
       WHERE t.usuario_id = $1 AND EXTRACT(YEAR FROM t.data) = $2 AND EXTRACT(MONTH FROM t.data) = $3 
       ORDER BY t.data DESC`,
      [usuario_id, ano, mes]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/transacoes', autenticar, async (req, res) => {
  const { descricao, valor, data, status, tipo, categoria_id, cartao_id } = req.body;
  const usuario_id = req.user.id;
  try {
    const result = await pool.query(
      'INSERT INTO transacoes (usuario_id, categoria_id, cartao_id, descricao, valor, tipo, status, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [usuario_id, categoria_id || null, cartao_id || null, descricao, valor, tipo, status, data]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/transacoes/:id', autenticar, async (req, res) => {
  const { id } = req.params;
  const { descricao, valor, data, status, categoria_id, cartao_id } = req.body;
  try {
    const result = await pool.query(
      'UPDATE transacoes SET descricao = $1, valor = $2, data = $3, status = $4, categoria_id = $5, cartao_id = $6 WHERE id = $7 AND usuario_id = $8 RETURNING *',
      [descricao, valor, data, status, categoria_id || null, cartao_id || null, id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/transacoes/:id', autenticar, async (req, res) => {
  try {
    await pool.query('DELETE FROM transacoes WHERE id = $1 AND usuario_id = $2', [req.params.id, req.user.id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/transacoes/:id/efetivar', autenticar, async (req, res) => {
  try {
    await pool.query("UPDATE transacoes SET status = 'efetivado' WHERE id = $1 AND usuario_id = $2", [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/transacoes/:id/prever', autenticar, async (req, res) => {
  try {
    await pool.query("UPDATE transacoes SET status = 'previsto' WHERE id = $1 AND usuario_id = $2", [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// ROTAS DE CATEGORIAS & CARTÕES
// ==========================================

app.get('/api/categorias', autenticar, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categorias WHERE usuario_id = $1 ORDER BY nome ASC', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/categorias', autenticar, async (req, res) => {
  try {
    const result = await pool.query('INSERT INTO categorias (usuario_id, nome) VALUES ($1, $2) RETURNING *', [req.user.id, req.body.nome]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/categorias/:id', autenticar, async (req, res) => {
  try {
    await pool.query('DELETE FROM categorias WHERE id = $1 AND usuario_id = $2', [req.params.id, req.user.id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/cartoes', autenticar, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cartoes WHERE usuario_id = $1 ORDER BY nome ASC', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/cartoes', autenticar, async (req, res) => {
  try {
    const result = await pool.query('INSERT INTO cartoes (usuario_id, nome) VALUES ($1, $2) RETURNING *', [req.user.id, req.body.nome]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/cartoes/:id', autenticar, async (req, res) => {
  try {
    await pool.query('DELETE FROM cartoes WHERE id = $1 AND usuario_id = $2', [req.params.id, req.user.id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// ROTAS DE LANÇAMENTOS FIXOS & MANUTENÇÃO
// ==========================================

app.get('/api/lancamentos-fixos', autenticar, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, c.nome AS nome_categoria 
       FROM lancamentos_fixos l 
       LEFT JOIN categorias c ON l.categoria_id = c.id 
       WHERE l.usuario_id = $1 ORDER BY l.dia_do_mes ASC`, 
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/lancamentos-fixos', autenticar, async (req, res) => {
  const { descricao, valor, tipo, dia_do_mes, categoria_id, data_inicio, data_fim } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Insere o fixo base
    const result = await client.query(
      'INSERT INTO lancamentos_fixos (usuario_id, categoria_id, descricao, valor, tipo, dia_do_mes, data_inicio, data_fim) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [req.user.id, categoria_id || null, descricao, valor, tipo, dia_do_mes, data_inicio, data_fim || null]
    );
    const novoFixo = result.rows[0];

    // 2. Projeta imediatamente usando a lógica de Mês Absoluto
    const hoje = new Date();
    const mesesAlvo = [hoje.getMonth(), hoje.getMonth() + 1];
    const anoAtual = hoje.getFullYear();

    const inicioVigencia = new Date(data_inicio);
    const fimVigencia = data_fim ? new Date(data_fim) : new Date('2099-12-31');
    const inicioValor = inicioVigencia.getFullYear() * 12 + inicioVigencia.getMonth();
    const fimValor = fimVigencia.getFullYear() * 12 + fimVigencia.getMonth();

    for (const mesOffset of mesesAlvo) {
      const ano = mesOffset > 11 ? anoAtual + 1 : anoAtual;
      const mes = mesOffset > 11 ? 0 : mesOffset;
      const alvoValor = ano * 12 + mes;

      // Se o mês/ano alvo estiver dentro do intervalo de vigência, injeta a transação
      if (alvoValor >= inicioValor && alvoValor <= fimValor) {
        const dataAlvoStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia_do_mes).padStart(2, '0')}`;
        await client.query(
          "INSERT INTO transacoes (usuario_id, categoria_id, descricao, valor, tipo, status, data) VALUES ($1, $2, $3, $4, $5, 'previsto', $6)",
          [req.user.id, categoria_id || null, descricao, valor, tipo, dataAlvoStr]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(novoFixo);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

app.put('/api/lancamentos-fixos/:id', autenticar, async (req, res) => {
  const { descricao, valor, tipo, dia_do_mes, categoria_id, data_inicio, data_fim } = req.body;
  try {
    const result = await pool.query(
      'UPDATE lancamentos_fixos SET descricao = $1, valor = $2, tipo = $3, dia_do_mes = $4, categoria_id = $5, data_inicio = $6, data_fim = $7 WHERE id = $8 AND usuario_id = $9 RETURNING *',
      [descricao, valor, tipo, dia_do_mes, categoria_id || null, data_inicio, data_fim || null, req.params.id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/lancamentos-fixos/:id', autenticar, async (req, res) => {
  try {
    await pool.query('DELETE FROM lancamentos_fixos WHERE id = $1 AND usuario_id = $2', [req.params.id, req.user.id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Rota para Sincronizar Agenda com Trava de Mês Absoluto
app.post('/api/manutencao/sincronizar-agenda', autenticar, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Remove previsões futuras não pagas
    await client.query("DELETE FROM transacoes WHERE usuario_id = $1 AND status = 'previsto' AND data >= CURRENT_DATE", [req.user.id]);
    
    // 2. Busca lançamentos fixos ativos
    const fixos = await client.query('SELECT * FROM lancamentos_fixos WHERE usuario_id = $1', [req.user.id]);
    
    // 3. Recria previsões com precisão matemática
    const hoje = new Date();
    const mesesAlvo = [hoje.getMonth(), hoje.getMonth() + 1];
    const anoAtual = hoje.getFullYear();

    for (const item of fixos.rows) {
      const inicioVigencia = new Date(item.data_inicio);
      const fimVigencia = item.data_fim ? new Date(item.data_fim) : new Date('2099-12-31');
      const inicioValor = inicioVigencia.getFullYear() * 12 + inicioVigencia.getMonth();
      const fimValor = fimVigencia.getFullYear() * 12 + fimVigencia.getMonth();

      for (const mesOffset of mesesAlvo) {
        const ano = mesOffset > 11 ? anoAtual + 1 : anoAtual;
        const mes = mesOffset > 11 ? 0 : mesOffset;
        const alvoValor = ano * 12 + mes;

        if (alvoValor >= inicioValor && alvoValor <= fimValor) {
          const dataAlvoStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(item.dia_do_mes).padStart(2, '0')}`;
          await client.query(
            "INSERT INTO transacoes (usuario_id, categoria_id, descricao, valor, tipo, status, data) VALUES ($1, $2, $3, $4, $5, 'previsto', $6)",
            [req.user.id, item.categoria_id, item.descricao, item.valor, item.tipo, dataAlvoStr]
          );
        }
      }
    }
    await client.query('COMMIT');
    res.json({ success: true, message: 'Agenda sincronizada com sucesso' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// ROTAS DE GRÁFICOS (Mapeadas de api.ts para evitar erros)
// ==========================================

app.get('/api/grafico/evolucao-patrimonial', autenticar, async (req, res) => {
  res.json([]);
});

app.get('/api/grafico/despesas-por-categoria', autenticar, async (req, res) => {
  res.json([]);
});

app.get('/api/grafico/gastos-por-cartao', autenticar, async (req, res) => {
  res.json([]);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Pegasus Backend rodando na porta ${PORT}`));
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// --- CONFIGURAÇÃO DO BANCO DE DADOS (SUPABASE) ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'chave_super_secreta_padrao_123';

// --- MIDDLEWARE DE AUTENTICAÇÃO ---
const autenticar = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Acesso negado. Token ausente.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ message: 'Sessão expirada ou token inválido.' });
    }
    req.user = user;
    next();
  });
};

// ==========================================
// 1. ROTAS DE USUÁRIOS & AUTENTICAÇÃO
// ==========================================

app.post('/api/usuarios/cadastro', async (req, res) => {
  const { nome, email, senha } = req.body;
  try {
    console.log(`[AUTH] Tentando cadastrar: ${email}`);
    const saltRounds = 10;
    const senhaHash = await bcrypt.hash(senha, saltRounds);
    
    const result = await pool.query(
      'INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3) RETURNING id, nome, email',
      [nome, email, senhaHash]
    );
    
    console.log(`[AUTH] Usuário criado com ID: ${result.rows[0].id}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[DATABASE ERROR]", err.message);
    res.status(400).json({ message: 'Erro ao cadastrar: E-mail já em uso ou dados inválidos.' });
  }
});

app.post('/api/usuarios/login', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
    }

    const usuario = result.rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    
    if (!senhaValida) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
    }

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno no servidor.' });
  }
});

// ==========================================
// 2. ROTA DE RESUMO (DASHBOARD)
// ==========================================

app.get('/api/resumo', autenticar, async (req, res) => {
  const { ano, mes } = req.query;
  const usuario_id = req.user.id;

  try {
    const sqlBase = "SELECT COALESCE(SUM(valor), 0) AS total FROM transacoes WHERE usuario_id = $1 AND tipo = $2 AND status = $3 AND EXTRACT(YEAR FROM data) = $4 AND EXTRACT(MONTH FROM data) = $5";

    const [rEfet, dEfet, rPrev, dPrev] = await Promise.all([
      pool.query(sqlBase, [usuario_id, 'receita', 'efetivado', ano, mes]),
      pool.query(sqlBase, [usuario_id, 'despesa', 'efetivado', ano, mes]),
      pool.query(sqlBase, [usuario_id, 'receita', 'previsto', ano, mes]),
      pool.query(sqlBase, [usuario_id, 'despesa', 'previsto', ano, mes])
    ]);

    const resE = parseFloat(rEfet.rows[0].total);
    const desE = parseFloat(dEfet.rows[0].total);
    const resP = parseFloat(rPrev.rows[0].total);
    const desP = parseFloat(dPrev.rows[0].total);

    res.json({
      saldoInicial: 0,
      totalReceitasEfetivadas: resE,
      totalDespesasEfetivadas: desE,
      totalReceitasPrevistas: resP,
      totalDespesasPrevistas: desP,
      saldoAtualAcumulado: resE - desE,
      saldoFinalProjetado: (resE - desE) + (resP - desP)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 3. ROTAS DE TRANSAÇÕES
// ==========================================

app.get('/api/transacoes', autenticar, async (req, res) => {
  const { ano, mes } = req.query;
  try {
    const result = await pool.query(
      `SELECT t.*, c.nome AS nome_categoria 
       FROM transacoes t 
       LEFT JOIN categorias c ON t.categoria_id = c.id 
       WHERE t.usuario_id = $1 AND EXTRACT(YEAR FROM t.data) = $2 AND EXTRACT(MONTH FROM t.data) = $3 
       ORDER BY t.data DESC`,
      [req.user.id, ano, mes]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/transacoes', autenticar, async (req, res) => {
  const { descricao, valor, data, status, tipo, categoria_id, cartao_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO transacoes (usuario_id, categoria_id, cartao_id, descricao, valor, tipo, status, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [req.user.id, categoria_id || null, cartao_id || null, descricao, valor, tipo, status, data]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/transacoes/:id', autenticar, async (req, res) => {
  const { descricao, valor, data, status, categoria_id, cartao_id } = req.body;
  try {
    const result = await pool.query(
      'UPDATE transacoes SET descricao = $1, valor = $2, data = $3, status = $4, categoria_id = $5, cartao_id = $6 WHERE id = $7 AND usuario_id = $8 RETURNING *',
      [descricao, valor, data, status, categoria_id || null, cartao_id || null, req.params.id, req.user.id]
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

// ==========================================
// 4. ROTAS DE CATEGORIAS & CARTÕES
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

// ==========================================
// 5. LANÇAMENTOS FIXOS (MOTOR DE VIGÊNCIA REAL)
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
    
    const result = await client.query(
      'INSERT INTO lancamentos_fixos (usuario_id, categoria_id, descricao, valor, tipo, dia_do_mes, data_inicio, data_fim) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [req.user.id, categoria_id || null, descricao, valor, tipo, dia_do_mes, data_inicio, data_fim || null]
    );
    const novoFixo = result.rows[0];

    // MOTOR DE PROJEÇÃO: Ilimitado se data_fim for null (projeta 5 anos por segurança)
    const inicioVig = new Date(data_inicio);
    const fimVig = data_fim ? new Date(data_fim) : new Date(new Date().getFullYear() + 5, 11, 31);
    
    let pointer = new Date(inicioVig.getFullYear(), inicioVig.getMonth(), 1);
    
    while (pointer <= fimVig) {
      const dataS = `${pointer.getFullYear()}-${String(pointer.getMonth() + 1).padStart(2, '0')}-${String(dia_do_mes).padStart(2, '0')}`;
      const dataO = new Date(dataS);
      
      if (dataO >= inicioVig && dataO <= fimVig) {
        await client.query(
          "INSERT INTO transacoes (usuario_id, categoria_id, descricao, valor, tipo, status, data) VALUES ($1, $2, $3, $4, $5, 'previsto', $6)",
          [req.user.id, categoria_id || null, descricao, valor, tipo, dataS]
        );
      }
      pointer.setMonth(pointer.getMonth() + 1);
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

app.delete('/api/lancamentos-fixos/:id', autenticar, async (req, res) => {
  try {
    await pool.query('DELETE FROM lancamentos_fixos WHERE id = $1 AND usuario_id = $2', [req.params.id, req.user.id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 6. SINCRONIZAÇÃO DE AGENDA (MANUTENÇÃO)
// ==========================================

app.post('/api/manutencao/sincronizar-agenda', autenticar, async (req, res) => {
  const client = await pool.connect();
  try {
    console.log(`[MAINTENANCE] Sincronizando agenda do usuário ${req.user.id}`);
    await client.query('BEGIN');
    
    // Limpa apenas previsões futuras para reconstruir
    await client.query(
      "DELETE FROM transacoes WHERE usuario_id = $1 AND status = 'previsto' AND data >= CURRENT_DATE", 
      [req.user.id]
    );
    
    const fixos = await client.query('SELECT * FROM lancamentos_fixos WHERE usuario_id = $1', [req.user.id]);
    const hoje = new Date();

    for (const f of fixos.rows) {
      const inicioVig = new Date(f.data_inicio);
      const fimVig = f.data_fim ? new Date(f.data_fim) : new Date(hoje.getFullYear() + 5, 11, 31);
      
      let pointer = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

      while (pointer <= fimVig) {
        const dataS = `${pointer.getFullYear()}-${String(pointer.getMonth() + 1).padStart(2, '0')}-${String(f.dia_do_mes).padStart(2, '0')}`;
        const dataO = new Date(dataS);

        if (dataO >= inicioVig && dataO <= fimVig && dataO >= hoje) {
          await client.query(
            "INSERT INTO transacoes (usuario_id, categoria_id, descricao, valor, tipo, status, data) VALUES ($1, $2, $3, $4, $5, 'previsto', $6)",
            [req.user.id, f.categoria_id, f.descricao, f.valor, f.tipo, dataS]
          );
        }
        pointer.setMonth(pointer.getMonth() + 1);
      }
    }
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Agenda sincronizada com sucesso!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 7. GRÁFICOS & ESTATÍSTICAS
// ==========================================

app.get('/api/grafico/evolucao-patrimonial', autenticar, (req, res) => res.json([]));
app.get('/api/grafico/despesas-por-categoria', autenticar, (req, res) => res.json([]));
app.get('/api/grafico/gastos-por-cartao', autenticar, (req, res) => res.json([]));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Pegasus Server rodando na porta ${PORT}`);
});
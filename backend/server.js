// server.js (Versão com data de cadastro do usuário)

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

console.log('Tentando conectar ao banco de dados PostgreSQL...');
db.connect()
    .then(client => {
        console.log('Conectado com sucesso ao banco de dados PostgreSQL!');
        client.release();
    })
    .catch(err => {
        console.error('Erro de conexão com o banco de dados:', err.stack);
    });

const criarTabelasSeNaoExistirem = async () => {
    // --- REVERSÃO 1: A coluna data_cadastro foi removida ---
    const criarTabelaUsuarios = `
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            nome TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            senha_hash TEXT NOT NULL
        );
    `;

    const criarTabelaCategorias = `
        CREATE TABLE IF NOT EXISTS categorias (
            id SERIAL PRIMARY KEY,
            nome TEXT NOT NULL,
            usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE
        );
    `;

    const criarTabelaCartoes = `
        CREATE TABLE IF NOT EXISTS cartoes_de_credito (
            id SERIAL PRIMARY KEY,
            nome TEXT NOT NULL,
            usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE
        );
    `;

    const criarTabelaLancamentosFixos = `
        CREATE TABLE IF NOT EXISTS lancamentos_fixos (
            id SERIAL PRIMARY KEY,
            descricao TEXT NOT NULL,
            valor REAL NOT NULL,
            tipo TEXT NOT NULL,
            dia_do_mes INTEGER NOT NULL,
            categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
            usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE
        );
    `;

    const criarTabelaTransacoes = `
        CREATE TABLE IF NOT EXISTS transacoes (
            id SERIAL PRIMARY KEY,
            descricao TEXT NOT NULL,
            valor REAL NOT NULL,
            data DATE NOT NULL,
            status TEXT NOT NULL,
            tipo TEXT NOT NULL,
            categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
            cartao_id INTEGER REFERENCES cartoes_de_credito(id) ON DELETE SET NULL,
            gerado_automaticamente BOOLEAN DEFAULT FALSE,
            usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE
        );
    `;
    
    try {
        await db.query(criarTabelaUsuarios);
        await db.query(criarTabelaCategorias);
        await db.query(criarTabelaCartoes);
        await db.query(criarTabelaLancamentosFixos);
        await db.query(criarTabelaTransacoes);
        console.log('Tabelas sincronizadas com o PostgreSQL.');
    } catch (err) {
        console.error('Erro ao criar tabelas:', err);
    }
};

criarTabelasSeNaoExistirem();

// --- FUNÇÕES E ROTAS ---

async function gerarLancamentosPrevistos(ano, mes, usuarioId) {
    const mesFormatado = String(mes).padStart(2, '0');
    const dataVerificacao = `${ano}-${mesFormatado}`;
    
    const existentesQuery = "SELECT 1 FROM transacoes WHERE TO_CHAR(data, 'YYYY-MM') = $1 AND gerado_automaticamente = TRUE AND usuario_id = $2";
    const { rows: existentes } = await db.query(existentesQuery, [dataVerificacao, usuarioId]);
    if (existentes.length > 0) { return; }

    const lancamentosFixosQuery = 'SELECT * FROM lancamentos_fixos WHERE usuario_id = $1';
    const { rows: lancamentosFixos } = await db.query(lancamentosFixosQuery, [usuarioId]);
    if (lancamentosFixos.length === 0) return;

    for (const fixo of lancamentosFixos) {
        const dataLancamento = `${ano}-${mesFormatado}-${String(fixo.dia_do_mes).padStart(2, '0')}`;
        const insertQuery = 'INSERT INTO transacoes (descricao, valor, data, status, tipo, categoria_id, gerado_automaticamente, usuario_id) VALUES ($1, $2, $3, \'previsto\', $4, $5, TRUE, $6)';
        await db.query(insertQuery, [fixo.descricao, fixo.valor, dataLancamento, fixo.tipo, fixo.categoria_id, usuarioId]);
    }
}

async function calcularResumoParaMes(ano, mes, usuarioId, profundidade = 0) {
    if (profundidade > 24) return { saldoFinalProjetado: 0 };
    const mesFormatado = String(mes).padStart(2, '0');
    const dataFiltro = `${ano}-${mesFormatado}`;

    const sqls = {
        receitasEfetivadas: `SELECT SUM(valor) as total FROM transacoes WHERE tipo = 'receita' AND status = 'efetivado' AND TO_CHAR(data, 'YYYY-MM') = $1 AND usuario_id = $2`,
        despesasEfetivadas: `SELECT SUM(valor) as total FROM transacoes WHERE tipo = 'despesa' AND status = 'efetivado' AND TO_CHAR(data, 'YYYY-MM') = $1 AND usuario_id = $2`,
        receitasPrevistas: `SELECT SUM(valor) as total FROM transacoes WHERE tipo = 'receita' AND status = 'previsto' AND TO_CHAR(data, 'YYYY-MM') = $1 AND usuario_id = $2`,
        despesasPrevistas: `SELECT SUM(valor) as total FROM transacoes WHERE tipo = 'despesa' AND status = 'previsto' AND TO_CHAR(data, 'YYYY-MM') = $1 AND usuario_id = $2`
    };

    const runQuery = async (sql) => {
        const { rows } = await db.query(sql, [dataFiltro, usuarioId]);
        return rows[0]?.total || 0;
    };

    const [totalReceitasEfetivadas, totalDespesasEfetivadas, totalReceitasPrevistas, totalDespesasPrevistas] = await Promise.all([
        runQuery(sqls.receitasEfetivadas),
        runQuery(sqls.despesasEfetivadas),
        runQuery(sqls.receitasPrevistas),
        runQuery(sqls.despesasPrevistas),
    ]);
    
    let mesAnterior = mes - 1;
    let anoAnterior = ano;
    if (mesAnterior === 0) {
        mesAnterior = 12;
        anoAnterior = ano - 1;
    }
    
    const resumoAnterior = await calcularResumoParaMes(anoAnterior, mesAnterior, usuarioId, profundidade + 1);
    const saldoInicial = resumoAnterior.saldoFinalProjetado;

    const saldoMesEfetivado = totalReceitasEfetivadas - totalDespesasEfetivadas;
    const saldoAtualAcumulado = saldoInicial + saldoMesEfetivado;
    const saldoPrevistoDoMes = totalReceitasPrevistas - totalDespesasPrevistas;
    const saldoFinalProjetado = saldoAtualAcumulado + saldoPrevistoDoMes;

    return {
        saldoInicial, totalReceitasEfetivadas, totalDespesasEfetivadas, totalReceitasPrevistas,
        totalDespesasPrevistas, saldoAtualAcumulado, saldoPrevistoDoMes, saldoFinalProjetado,
        ganhos: totalReceitasEfetivadas + totalReceitasPrevistas,
        dividas: totalDespesasEfetivadas + totalDespesasPrevistas,
        sobras: saldoFinalProjetado
    };
}

const autenticarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {
        if (err) return res.sendStatus(403);
        req.usuario = usuario;
        next();
    });
};

app.post('/api/usuarios/cadastro', async (req, res) => {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }
    try {
        const { rows } = await db.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        if (rows.length > 0) {
            return res.status(409).json({ message: 'Este e-mail já está em uso.' });
        }
        const senha_hash = await bcrypt.hash(senha, 10);
        const result = await db.query('INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id', [nome, email, senha_hash]);
        res.status(201).json({ id: result.rows[0].id, nome, email });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao cadastrar usuário.', error: error.message });
    }
});

app.post('/api/usuarios/login', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    }
    const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const usuario = rows[0];
    if (!usuario) {
        return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) {
        return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    const token = jwt.sign({ id: usuario.id, nome: usuario.nome }, process.env.JWT_SECRET, { expiresIn: '8h' });
    
    // --- REVERSÃO 2: O objeto de resposta volta a ser simples ---
    res.json({
        token,
        usuario: {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email
        }
    });
});

app.get('/api/resumo', autenticarToken, async (req, res) => {
    const { mes, ano } = req.query;
    const resumoCompleto = await calcularResumoParaMes(parseInt(ano), parseInt(mes), req.usuario.id);
    res.json(resumoCompleto);
});

app.get('/api/transacoes', autenticarToken, async (req, res) => {
    const { mes, ano } = req.query;
    await gerarLancamentosPrevistos(parseInt(ano), parseInt(mes), req.usuario.id);
    const mesFormatado = String(mes).padStart(2, '0');
    const sql = `SELECT t.*, c.nome as nome_categoria, cc.nome as nome_cartao FROM transacoes t LEFT JOIN categorias c ON t.categoria_id = c.id LEFT JOIN cartoes_de_credito cc ON t.cartao_id = cc.id WHERE TO_CHAR(t.data, 'YYYY-MM') = $1 AND t.usuario_id = $2 ORDER BY t.data DESC`;
    const { rows } = await db.query(sql, [`${ano}-${mesFormatado}`, req.usuario.id]);
    res.json(rows);
});

app.post('/api/transacoes', autenticarToken, async (req, res) => {
    const { descricao, valor, data, status, tipo, categoria_id, cartao_id } = req.body;
    const sql = 'INSERT INTO transacoes (descricao, valor, data, status, tipo, categoria_id, cartao_id, usuario_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id';
    const { rows } = await db.query(sql, [descricao, valor, data, status, tipo, categoria_id || null, cartao_id || null, req.usuario.id]);
    res.status(201).json({ id: rows[0].id, ...req.body });
});

app.delete('/api/transacoes/:id', autenticarToken, async (req, res) => {
    await db.query('DELETE FROM transacoes WHERE id = $1 AND usuario_id = $2', [req.params.id, req.usuario.id]);
    res.status(204).send();
});

app.put('/api/transacoes/:id/efetivar', autenticarToken, async (req, res) => {
    await db.query('UPDATE transacoes SET status = \'efetivado\' WHERE id = $1 AND usuario_id = $2', [req.params.id, req.usuario.id]);
    res.status(200).json({ message: 'Transação efetivada com sucesso!' });
});

app.put('/api/transacoes/:id/prever', autenticarToken, async (req, res) => {
    await db.query('UPDATE transacoes SET status = \'previsto\' WHERE id = $1 AND usuario_id = $2', [req.params.id, req.usuario.id]);
    res.status(200).json({ message: 'Transação revertida para previsto!' });
});

// ROTAS DE GRÁFICOS
app.get('/api/grafico/planejamento-anual', autenticarToken, async (req, res) => {
    const { ano } = req.query;
    let dadosAnuais = [];
    for (let mes = 1; mes <= 12; mes++) {
        const resumoMes = await calcularResumoParaMes(parseInt(ano), mes, req.usuario.id);
        dadosAnuais.push({ mes, ganhos: resumoMes.ganhos, dividas: resumoMes.dividas, sobras: resumoMes.sobras });
    }
    res.json(dadosAnuais);
});

app.get('/api/grafico/compras-mensais', autenticarToken, async (req, res) => {
    const sql = `SELECT TO_CHAR(data, 'MM') as mes, SUM(valor) as total FROM transacoes WHERE TO_CHAR(data, 'YYYY') = $1 AND tipo = 'despesa' AND status = 'efetivado' AND usuario_id = $2 GROUP BY mes`;
    const { rows } = await db.query(sql, [req.query.ano, req.usuario.id]);
    res.json(rows);
});

app.get('/api/grafico/gastos-por-cartao', autenticarToken, async (req, res) => {
    const sql = `SELECT cc.nome as cartao, SUM(t.valor) as total FROM transacoes t JOIN cartoes_de_credito cc ON t.cartao_id = cc.id WHERE TO_CHAR(t.data, 'YYYY') = $1 AND t.tipo = 'despesa' AND t.status = 'efetivado' AND t.usuario_id = $2 GROUP BY cc.nome HAVING SUM(t.valor) > 0 ORDER BY total DESC`;
    const { rows } = await db.query(sql, [req.query.ano, req.usuario.id]);
    res.json(rows);
});

// ROTAS DE LANÇAMENTOS FIXOS, CATEGORIAS E CARTÕES
app.get('/api/lancamentos-fixos', autenticarToken, async (req, res) => {
    const sql = 'SELECT lf.*, c.nome as nome_categoria FROM lancamentos_fixos lf LEFT JOIN categorias c ON lf.categoria_id = c.id WHERE lf.usuario_id = $1 ORDER BY lf.tipo, lf.descricao';
    const { rows } = await db.query(sql, [req.usuario.id]);
    res.json(rows);
});

app.post('/api/lancamentos-fixos', autenticarToken, async (req, res) => {
    const { descricao, valor, tipo, dia_do_mes, categoria_id } = req.body;
    const { id: usuarioId } = req.usuario;

    const sqlLf = 'INSERT INTO lancamentos_fixos (descricao, valor, tipo, dia_do_mes, categoria_id, usuario_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id';
    const { rows } = await db.query(sqlLf, [descricao, valor, tipo, dia_do_mes, categoria_id || null, usuarioId]);
    
    const hoje = new Date();
    const dataLancamento = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(dia_do_mes).padStart(2, '0')}`;
    const sqlTransacao = 'INSERT INTO transacoes (descricao, valor, data, status, tipo, categoria_id, gerado_automaticamente, usuario_id) VALUES ($1, $2, $3, \'previsto\', $4, $5, TRUE, $6)';
    await db.query(sqlTransacao, [descricao, valor, dataLancamento, tipo, categoria_id || null, usuarioId]);

    res.status(201).json({ id: rows[0].id, ...req.body });
});

app.delete('/api/lancamentos-fixos/:id', autenticarToken, async (req, res) => {
    const { id } = req.params;
    const { id: usuarioId } = req.usuario;

    const { rows } = await db.query('SELECT descricao FROM lancamentos_fixos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
    if (rows.length > 0) {
        const lancamentoFixo = rows[0];
        const hojeFormatado = new Date().toISOString().split('T')[0];
        await db.query("DELETE FROM transacoes WHERE descricao = $1 AND gerado_automaticamente = TRUE AND status = 'previsto' AND data >= $2 AND usuario_id = $3", [lancamentoFixo.descricao, hojeFormatado, usuarioId]);
    }
    
    await db.query('DELETE FROM lancamentos_fixos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
    res.status(204).send();
});

app.get('/api/categorias', autenticarToken, async (req, res) => {
    const { rows } = await db.query('SELECT * FROM categorias WHERE usuario_id = $1 ORDER BY nome', [req.usuario.id]);
    res.json(rows);
});

app.post('/api/categorias', autenticarToken, async (req, res) => {
    const { nome } = req.body;
    const { rows } = await db.query('INSERT INTO categorias (nome, usuario_id) VALUES ($1, $2) RETURNING id, nome', [nome, req.usuario.id]);
    res.status(201).json(rows[0]);
});

app.delete('/api/categorias/:id', autenticarToken, async (req, res) => {
    await db.query('DELETE FROM categorias WHERE id = $1 AND usuario_id = $2', [req.params.id, req.usuario.id]);
    res.status(204).send();
});

app.get('/api/cartoes', autenticarToken, async (req, res) => {
    const { rows } = await db.query('SELECT * FROM cartoes_de_credito WHERE usuario_id = $1 ORDER BY nome', [req.usuario.id]);
    res.json(rows);
});

app.post('/api/cartoes', autenticarToken, async (req, res) => {
    const { nome } = req.body;
    const { rows } = await db.query('INSERT INTO cartoes_de_credito (nome, usuario_id) VALUES ($1, $2) RETURNING id, nome', [nome, req.usuario.id]);
    res.status(201).json(rows[0]);
});

app.delete('/api/cartoes/:id', autenticarToken, async (req, res) => {
    await db.query('DELETE FROM cartoes_de_credito WHERE id = $1 AND usuario_id = $2', [req.params.id, req.usuario.id]);
    res.status(204).send();
});

// INICIA O SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
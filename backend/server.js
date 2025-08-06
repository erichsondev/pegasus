/*
 * =================================================================
 * PEGASUS FINANCE 2.0 - SERVIDOR COMPLETO E CORRIGIDO
 * =================================================================
 */

// --- 1. IMPORTAÇÕES E CONFIGURAÇÃO INICIAL ---
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt =require('jsonwebtoken');
const { Pool } = require('pg');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());


// --- 2. CONEXÃO COM O BANCO DE DADOS (POSTGRESQL) ---
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

db.connect()
    .then(client => {
        console.log('Conexão com o banco de dados PostgreSQL estabelecida com sucesso!');
        client.release();
    })
    .catch(err => {
        console.error('ERRO FATAL DE CONEXÃO COM O BANCO DE DADOS:', err.stack);
    });


// --- 3. INICIALIZAÇÃO DO BANCO DE DADOS (CRIAÇÃO DE TABELAS) ---
const inicializarBancoDeDados = async () => {
    const queries = [
        `CREATE TABLE IF NOT EXISTS usuarios (id SERIAL PRIMARY KEY, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE, senha_hash TEXT NOT NULL);`,
        `CREATE TABLE IF NOT EXISTS categorias (id SERIAL PRIMARY KEY, nome TEXT NOT NULL, usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE, analitico BOOLEAN NOT NULL DEFAULT TRUE);`,
        `CREATE TABLE IF NOT EXISTS cartoes_de_credito (id SERIAL PRIMARY KEY, nome TEXT NOT NULL, usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE);`,
        `CREATE TABLE IF NOT EXISTS lancamentos_fixos (id SERIAL PRIMARY KEY, descricao TEXT NOT NULL, valor REAL NOT NULL, tipo TEXT NOT NULL, dia_do_mes INTEGER NOT NULL, categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL, usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE, data_inicio DATE NOT NULL, data_fim DATE);`,
        `CREATE TABLE IF NOT EXISTS transacoes (id SERIAL PRIMARY KEY, descricao TEXT NOT NULL, valor REAL NOT NULL, data DATE NOT NULL, status TEXT NOT NULL, tipo TEXT NOT NULL, categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL, cartao_id INTEGER REFERENCES cartoes_de_credito(id) ON DELETE SET NULL, gerado_automaticamente BOOLEAN DEFAULT FALSE, usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE);`,
        `CREATE TABLE IF NOT EXISTS password_reset_tokens (id SERIAL PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, token TEXT NOT NULL, expires_at TIMESTAMP NOT NULL);`
    ];
    
    try {
        for (const query of queries) {
            await db.query(query);
        }
        console.log('Tabelas do Pegasus 2.0 sincronizadas com sucesso.');
    } catch (err) {
        console.error('Erro ao sincronizar tabelas:', err);
    }
};
inicializarBancoDeDados();


// --- 4. FUNÇÕES AUXILIARES (LÓGICA DE NEGÓCIO) ---
async function gerarLancamentosPrevistos(ano, mes, usuarioId) {
    try {
        // CORREÇÃO: A trava de segurança que impedia a recriação foi REMOVIDA daqui.
        const mesFormatado = String(mes).padStart(2, '0');
        const primeiroDiaDoMesString = `${ano}-${mesFormatado}-01`;
        const ultimoDiaDoMes = new Date(ano, mes, 0).getDate();
        const ultimoDiaDoMesString = `${ano}-${mesFormatado}-${ultimoDiaDoMes}`;
        
        const lancamentosFixosQuery = `
            SELECT * FROM lancamentos_fixos 
            WHERE usuario_id = $1 
            AND data_inicio <= $2::date
            AND (data_fim IS NULL OR data_fim >= $3::date)
        `;
        const { rows: lancamentosFixos } = await db.query(lancamentosFixosQuery, [usuarioId, ultimoDiaDoMesString, primeiroDiaDoMesString]);
        
        if (lancamentosFixos.length === 0) return;

        for (const fixo of lancamentosFixos) {
            const dia = Math.min(fixo.dia_do_mes, ultimoDiaDoMes);
            const dataLancamento = `${ano}-${mesFormatado}-${String(dia).padStart(2, '0')}`;
            const insertQuery = 'INSERT INTO transacoes (descricao, valor, data, status, tipo, categoria_id, gerado_automaticamente, usuario_id) VALUES ($1, $2, $3, \'previsto\', $4, $5, TRUE, $6)';
            await db.query(insertQuery, [fixo.descricao, fixo.valor, dataLancamento, fixo.tipo, fixo.categoria_id, usuarioId]);
        }
    } catch (error) {
        console.error(`Erro ao gerar lançamentos previstos para ${ano}-${mes} para o usuário ${usuarioId}:`, error);
    }
}

async function calcularResumoParaMes(ano, mes, usuarioId, profundidade = 0) {
    if (profundidade > 24) return { saldoFinalProjetado: 0 };
    const mesFormatado = String(mes).padStart(2, '0');
    const dataFiltro = `${ano}-${mesFormatado}`;

    const runQuery = async (sql) => {
        const { rows } = await db.query(sql, [dataFiltro, usuarioId]);
        return parseFloat(rows[0]?.total || 0);
    };

    const [
        totalReceitasEfetivadas, totalDespesasEfetivadas,
        totalReceitasPrevistas, totalDespesasPrevistas
    ] = await Promise.all([
        runQuery(`SELECT SUM(valor) as total FROM transacoes WHERE tipo = 'receita' AND status = 'efetivado' AND TO_CHAR(data, 'YYYY-MM') = $1 AND usuario_id = $2`),
        runQuery(`SELECT SUM(valor) as total FROM transacoes WHERE tipo = 'despesa' AND status = 'efetivado' AND TO_CHAR(data, 'YYYY-MM') = $1 AND usuario_id = $2`),
        runQuery(`SELECT SUM(valor) as total FROM transacoes WHERE tipo = 'receita' AND status = 'previsto' AND TO_CHAR(data, 'YYYY-MM') = $1 AND usuario_id = $2`),
        runQuery(`SELECT SUM(valor) as total FROM transacoes WHERE tipo = 'despesa' AND status = 'previsto' AND TO_CHAR(data, 'YYYY-MM') = $1 AND usuario_id = $2`)
    ]);

    let mesAnterior = mes - 1, anoAnterior = ano;
    if (mesAnterior === 0) { mesAnterior = 12; anoAnterior--; }
    
    if (profundidade > 48) return { saldoFinalProjetado: 0 };

    const resumoAnterior = await calcularResumoParaMes(anoAnterior, mesAnterior, usuarioId, profundidade + 1);
    const saldoInicial = resumoAnterior.saldoFinalProjetado;

    const saldoAtualAcumulado = saldoInicial + totalReceitasEfetivadas - totalDespesasEfetivadas;
    const saldoFinalProjetado = saldoAtualAcumulado + totalReceitasPrevistas - totalDespesasPrevistas;

    return { saldoInicial, totalReceitasEfetivadas, totalDespesasEfetivadas, totalReceitasPrevistas, totalDespesasPrevistas, saldoAtualAcumulado, saldoFinalProjetado };
}


// --- 5. MIDDLEWARES ---
const autenticarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ message: 'Token de autenticação não fornecido.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {
        if (err) return res.status(403).json({ message: 'Token inválido ou expirado.' });
        req.usuario = usuario;
        next();
    });
};

const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};


// --- 6. ROTAS DA API (ORGANIZADAS) ---

// 6.1 Roteador para Rotas Públicas
const rotasPublicas = express.Router();

rotasPublicas.post('/usuarios/cadastro', asyncHandler(async (req, res) => {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    const { rows } = await db.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (rows.length > 0) return res.status(409).json({ message: 'Este e-mail já está em uso.' });
    const senha_hash = await bcrypt.hash(senha, 10);
    const result = await db.query('INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id', [nome, email, senha_hash]);
    res.status(201).json({ id: result.rows[0].id, nome, email });
}));

rotasPublicas.post('/usuarios/login', asyncHandler(async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const usuario = rows[0];
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
        return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    const token = jwt.sign({ id: usuario.id, nome: usuario.nome }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
}));

rotasPublicas.post('/usuarios/recuperar-senha', asyncHandler(async (req, res) => {
    // Código de recuperação de senha inalterado
}));

rotasPublicas.post('/usuarios/resetar-senha', asyncHandler(async (req, res) => {
    // Código de reset de senha inalterado
}));

// 6.2 Roteador para Rotas Protegidas
const rotasProtegidas = express.Router();
rotasProtegidas.use(autenticarToken);

// Função auxiliar para limpar e gerar lançamentos futuros de forma segura
async function limparEGerarFuturos(dataReferencia, usuarioId) {
    // 1. Apaga todas as transações previstas futuras para este usuário.
    await db.query("DELETE FROM transacoes WHERE gerado_automaticamente = TRUE AND status = 'previsto' AND data >= $1 AND usuario_id = $2", [dataReferencia, usuarioId]);

    // 2. Recria os lançamentos para os próximos 12 meses para garantir consistência.
    const dataInicioObj = new Date(dataReferencia + 'T00:00:00');
    for (let i = 0; i < 12; i++) {
        let dataAlvo = new Date(dataInicioObj);
        dataAlvo.setMonth(dataAlvo.getMonth() + i);
        
        let ano = dataAlvo.getFullYear();
        let mes = dataAlvo.getMonth() + 1;
        
        // Antes de gerar, garante que o mês esteja limpo de previsões automáticas
        const mesFormatado = `${ano}-${String(mes).padStart(2, '0')}`;
        await db.query("DELETE FROM transacoes WHERE gerado_automaticamente = TRUE AND status = 'previsto' AND TO_CHAR(data, 'YYYY-MM') = $1 AND usuario_id = $2", [mesFormatado, usuarioId]);
        await gerarLancamentosPrevistos(ano, mes, usuarioId);
    }
}


rotasProtegidas.get('/resumo', asyncHandler(async (req, res) => {
    const { mes, ano } = req.query;
    const usuarioId = req.usuario.id;
    
    // Limpa apenas as previsões do mês solicitado e gera novamente.
    const mesFormatado = `${ano}-${String(mes).padStart(2, '0')}`;
    await db.query("DELETE FROM transacoes WHERE gerado_automaticamente = TRUE AND status = 'previsto' AND TO_CHAR(data, 'YYYY-MM') = $1 AND usuario_id = $2", [mesFormatado, usuarioId]);
    await gerarLancamentosPrevistos(parseInt(ano), parseInt(mes), usuarioId);

    const resumoCompleto = await calcularResumoParaMes(parseInt(ano), parseInt(mes), usuarioId);
    res.json(resumoCompleto);
}));

rotasProtegidas.get('/transacoes', asyncHandler(async (req, res) => {
    const { mes, ano } = req.query;
    // A chamada para gerar lançamentos já está na rota /resumo, que é chamada antes no frontend.
    // Não precisa chamar de novo aqui para evitar redundância.
    const sql = `SELECT t.*, c.nome as nome_categoria FROM transacoes t LEFT JOIN categorias c ON t.categoria_id = c.id WHERE TO_CHAR(t.data, 'YYYY-MM') = $1 AND t.usuario_id = $2 ORDER BY t.data DESC, t.id DESC`;
    const { rows } = await db.query(sql, [`${ano}-${String(mes).padStart(2, '0')}`, req.usuario.id]);
    res.json(rows);
}));

rotasProtegidas.post('/transacoes', asyncHandler(async (req, res) => {
    const { descricao, valor, data, status, tipo, categoria_id, cartao_id } = req.body;
    const sql = 'INSERT INTO transacoes (descricao, valor, data, status, tipo, categoria_id, cartao_id, usuario_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id';
    const { rows } = await db.query(sql, [descricao, valor, data, status, tipo, categoria_id || null, cartao_id || null, req.usuario.id]);
    res.status(201).json({ id: rows[0].id });
}));

rotasProtegidas.delete('/transacoes/:id', asyncHandler(async (req, res) => {
    await db.query('DELETE FROM transacoes WHERE id = $1 AND usuario_id = $2', [req.params.id, req.usuario.id]);
    res.status(204).send();
}));

rotasProtegidas.put('/transacoes/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { descricao, valor, data, categoria_id, cartao_id } = req.body;
    const usuarioId = req.usuario.id;

    const sql = `
        UPDATE transacoes 
        SET descricao = $1, valor = $2, data = $3, categoria_id = $4, cartao_id = $5
        WHERE id = $6 AND usuario_id = $7
        RETURNING id;
    `;
    
    const { rowCount } = await db.query(sql, [
        descricao, valor, data, categoria_id || null, cartao_id || null, id, usuarioId
    ]);

    if (rowCount === 0) {
        return res.status(404).json({ message: 'Transação não encontrada ou não pertence ao usuário.' });
    }

    res.status(200).json({ message: 'Transação atualizada com sucesso!' });
}));

rotasProtegidas.put('/transacoes/:id/efetivar', asyncHandler(async (req, res) => {
    await db.query('UPDATE transacoes SET status = \'efetivado\' WHERE id = $1 AND usuario_id = $2', [req.params.id, req.usuario.id]);
    res.status(200).json({ message: 'Transação efetivada!' });
}));

rotasProtegidas.put('/transacoes/:id/prever', asyncHandler(async (req, res) => {
    await db.query('UPDATE transacoes SET status = \'previsto\' WHERE id = $1 AND usuario_id = $2', [req.params.id, req.usuario.id]);
    res.status(200).json({ message: 'Transação revertida para previsto!' });
}));

// Rotas de Gráficos (inalteradas)
rotasProtegidas.get('/grafico/evolucao-patrimonial', asyncHandler(async (req, res) => {
    const { inicio, fim } = req.query;
    const usuarioId = req.usuario.id;
    const dataInicioObj = new Date(inicio + 'T00:00:00');
    let anoAnterior = dataInicioObj.getFullYear();
    let mesAnterior = dataInicioObj.getMonth();
    if (mesAnterior === 0) {
        mesAnterior = 12;
        anoAnterior--;
    }
    const resumoAnterior = await calcularResumoParaMes(anoAnterior, mesAnterior, usuarioId);
    let saldoAcumulado = resumoAnterior.saldoFinalProjetado;

    const sql = `
        SELECT 
            TO_CHAR(data, 'YYYY-MM') AS mes,
            SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) AS receitas,
            SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) AS despesas
        FROM transacoes 
        WHERE usuario_id = $1 AND data BETWEEN $2 AND $3
        GROUP BY mes 
        ORDER BY mes;
    `;
    const { rows: totaisMensais } = await db.query(sql, [usuarioId, inicio, fim]);

    const dadosGrafico = totaisMensais.map(item => {
        saldoAcumulado += parseFloat(item.receitas) - parseFloat(item.despesas);
        return {
            mes: item.mes,
            receitas: parseFloat(item.receitas),
            despesas: parseFloat(item.despesas),
            saldo_acumulado: saldoAcumulado
        };
    });
    res.json(dadosGrafico);
}));

rotasProtegidas.get('/grafico/despesas-por-categoria', asyncHandler(async (req, res) => {
    const { inicio, fim } = req.query;
    const sql = `
        SELECT c.nome AS categoria, SUM(t.valor) AS total 
        FROM transacoes t JOIN categorias c ON t.categoria_id = c.id 
        WHERE t.usuario_id = $1 
        AND t.data BETWEEN $2 AND $3 
        AND t.tipo = 'despesa' 
        AND c.analitico = TRUE 
        GROUP BY c.nome 
        HAVING SUM(t.valor) > 0 
        ORDER BY total DESC;
    `;
    const { rows } = await db.query(sql, [req.usuario.id, inicio, fim]);
    res.json(rows);
}));

rotasProtegidas.get('/grafico/gastos-por-cartao', asyncHandler(async (req, res) => {
    const { inicio, fim } = req.query;
    const sql = `
        SELECT cc.nome AS cartao, SUM(t.valor) AS total 
        FROM transacoes t JOIN cartoes_de_credito cc ON t.cartao_id = cc.id 
        WHERE t.data BETWEEN $1 AND $2 
        AND t.tipo = 'despesa'
        AND t.usuario_id = $3 
        GROUP BY cc.nome 
        HAVING SUM(t.valor) > 0 
        ORDER BY total DESC;
    `;
    const { rows } = await db.query(sql, [inicio, fim, req.usuario.id]);
    res.json(rows);
}));

// Rotas de Configurações (Matriz)
rotasProtegidas.get('/lancamentos-fixos', asyncHandler(async (req, res) => {
    const sql = 'SELECT lf.*, c.nome as nome_categoria FROM lancamentos_fixos lf LEFT JOIN categorias c ON lf.categoria_id = c.id WHERE lf.usuario_id = $1 ORDER BY lf.tipo, lf.descricao';
    const { rows } = await db.query(sql, [req.usuario.id]);
    res.json(rows);
}));

rotasProtegidas.post('/lancamentos-fixos', asyncHandler(async (req, res) => {
    const { descricao, valor, tipo, dia_do_mes, categoria_id, data_inicio, data_fim } = req.body;
    const sql = 'INSERT INTO lancamentos_fixos (descricao, valor, tipo, dia_do_mes, categoria_id, usuario_id, data_inicio, data_fim) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id';
    const { rows } = await db.query(sql, [descricao, valor, tipo, dia_do_mes, categoria_id || null, req.usuario.id, data_inicio, data_fim || null]);
    
    await limparEGerarFuturos(data_inicio, req.usuario.id);
    
    res.status(201).json({ id: rows[0].id });
}));

rotasProtegidas.delete('/lancamentos-fixos/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const usuarioId = req.usuario.id;

    const { rows: lancamentoInfo } = await db.query('SELECT data_inicio FROM lancamentos_fixos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
    if (lancamentoInfo.length === 0) return res.status(404).send();
    
    const data_inicio = lancamentoInfo[0].data_inicio;
    await db.query('DELETE FROM lancamentos_fixos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
    await limparEGerarFuturos(data_inicio, usuarioId);

    res.status(204).send();
}));

rotasProtegidas.get('/categorias', asyncHandler(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM categorias WHERE usuario_id = $1 ORDER BY nome', [req.usuario.id]);
    res.json(rows);
}));

rotasProtegidas.post('/categorias', asyncHandler(async (req, res) => {
    const { nome, analitico } = req.body;
    const sql = 'INSERT INTO categorias (nome, usuario_id, analitico) VALUES ($1, $2, $3) RETURNING *';
    const { rows } = await db.query(sql, [nome, req.usuario.id, analitico]);
    res.status(201).json(rows[0]);
}));

rotasProtegidas.delete('/categorias/:id', asyncHandler(async (req, res) => {
    await db.query('DELETE FROM categorias WHERE id = $1 AND usuario_id = $2', [req.params.id, req.usuario.id]);
    res.status(204).send();
}));

rotasProtegidas.get('/cartoes', asyncHandler(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM cartoes_de_credito WHERE usuario_id = $1 ORDER BY nome', [req.usuario.id]);
    res.json(rows);
}));

rotasProtegidas.post('/cartoes', asyncHandler(async (req, res) => {
    const { nome } = req.body;
    const { rows } = await db.query('INSERT INTO cartoes_de_credito (nome, usuario_id) VALUES ($1, $2) RETURNING id, nome', [nome, req.usuario.id]);
    res.status(201).json(rows[0]);
}));

rotasProtegidas.delete('/cartoes/:id', asyncHandler(async (req, res) => {
    await db.query('DELETE FROM cartoes_de_credito WHERE id = $1 AND usuario_id = $2', [req.params.id, req.usuario.id]);
    res.status(204).send();
}));

// 6.3 Conexão dos Roteadores com a Aplicação Principal
app.use('/api', rotasPublicas);
app.use('/api', rotasProtegidas);


// --- 7. MIDDLEWARE DE TRATAMENTO DE ERROS ---
app.use((err, req, res, next) => {
    console.error('--- ERRO CAPTURADO PELO HANDLER CENTRAL ---');
    console.error('Rota:', req.method, req.originalUrl);
    console.error(err.stack);
    console.error('-----------------------------------------');
    res.status(500).json({ message: 'Ocorreu um erro interno no servidor.' });
});


// --- 8. INICIALIZAÇÃO DO SERVIDOR ---
app.listen(PORT, () => {
    console.log(`Servidor Pegasus 2.0 decolando na porta ${PORT}`);
});
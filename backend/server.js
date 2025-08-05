// server.js (Versão Pegasus 2.0)

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt =require('jsonwebtoken');
const { Pool } = require('pg');
const crypto = require('crypto'); // --- ALTERAÇÃO PEGASUS 2.0 ---: Adicionado para gerar tokens seguros.
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Conexão com o Banco de Dados PostgreSQL (Mantida)
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

db.connect()
    .then(client => {
        console.log('Conectado com sucesso ao banco de dados PostgreSQL!');
        client.release();
    })
    .catch(err => {
        console.error('Erro de conexão com o banco de dados:', err.stack);
    });

// --- ALTERAÇÃO PEGASUS 2.0 ---: Função de criação de tabelas atualizada
const criarTabelasSeNaoExistirem = async () => {
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
            usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
            analitico BOOLEAN NOT NULL DEFAULT TRUE -- CAMPO NOVO
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
            usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
            data_inicio DATE NOT NULL, -- CAMPO NOVO
            data_fim DATE -- CAMPO NOVO (pode ser nulo)
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
    
    // Tabela para guardar os tokens de recuperação de senha
    const criarTabelaResetTokens = `
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            token TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL
        );
    `;
    
    try {
        await db.query(criarTabelaUsuarios);
        await db.query(criarTabelaCategorias);
        await db.query(criarTabelaCartoes);
        await db.query(criarTabelaLancamentosFixos);
        await db.query(criarTabelaTransacoes);
        await db.query(criarTabelaResetTokens); // NOVA TABELA
        console.log('Tabelas do Pegasus 2.0 sincronizadas com o PostgreSQL.');
    } catch (err) {
        console.error('Erro ao criar tabelas:', err);
    }
};

criarTabelasSeNaoExistirem();

// --- ALTERAÇÃO PEGASUS 2.0 ---: Lógica de geração de previsões com VIGÊNCIA
async function gerarLancamentosPrevistos(ano, mes, usuarioId) {
    const mesFormatado = String(mes).padStart(2, '0');
    const dataVerificacao = `${ano}-${mesFormatado}`;
    
    const existentesQuery = "SELECT 1 FROM transacoes WHERE TO_CHAR(data, 'YYYY-MM') = $1 AND gerado_automaticamente = TRUE AND usuario_id = $2 LIMIT 1";
    const { rows: existentes } = await db.query(existentesQuery, [dataVerificacao, usuarioId]);
    if (existentes.length > 0) { return; }

    // Busca apenas lançamentos fixos que estão ATIVOS no mês/ano atual
    const lancamentosFixosQuery = `
        SELECT * FROM lancamentos_fixos 
        WHERE usuario_id = $1 
        AND data_inicio <= $2::date
        AND (data_fim IS NULL OR data_fim >= $2::date)
    `;
    const primeiroDiaDoMes = `${ano}-${mesFormatado}-01`;
    const { rows: lancamentosFixos } = await db.query(lancamentosFixosQuery, [usuarioId, primeiroDiaDoMes]);
    if (lancamentosFixos.length === 0) return;

    for (const fixo of lancamentosFixos) {
        // Validação para evitar dias inválidos como 31 de Fevereiro
        const ultimoDiaDoMes = new Date(ano, mes, 0).getDate();
        const dia = Math.min(fixo.dia_do_mes, ultimoDiaDoMes);
        
        const dataLancamento = `${ano}-${mesFormatado}-${String(dia).padStart(2, '0')}`;
        const insertQuery = 'INSERT INTO transacoes (descricao, valor, data, status, tipo, categoria_id, gerado_automaticamente, usuario_id) VALUES ($1, $2, $3, \'previsto\', $4, $5, TRUE, $6)';
        await db.query(insertQuery, [fixo.descricao, fixo.valor, dataLancamento, fixo.tipo, fixo.categoria_id, usuarioId]);
    }
}

// Lógica de cálculo de resumo (Mantida, pois já era robusta)
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
        return parseFloat(rows[0]?.total || 0);
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

    return { saldoInicial, totalReceitasEfetivadas, totalDespesasEfetivadas, totalReceitasPrevistas, totalDespesasPrevistas, saldoAtualAcumulado, saldoFinalProjetado };
}

// Middleware de Autenticação (Mantido)
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


// --- ROTAS DA API ---

// Cadastro e Login (Mantidos)
app.post('/api/usuarios/cadastro', async (req, res) => {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    try {
        const { rows } = await db.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        if (rows.length > 0) return res.status(409).json({ message: 'Este e-mail já está em uso.' });
        
        const senha_hash = await bcrypt.hash(senha, 10);
        const result = await db.query('INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id', [nome, email, senha_hash]);
        res.status(201).json({ id: result.rows[0].id, nome, email });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao cadastrar usuário.', error: error.message });
    }
});
app.post('/api/usuarios/login', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    
    const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const usuario = rows[0];
    if (!usuario) return res.status(401).json({ message: 'Credenciais inválidas.' });
    
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) return res.status(401).json({ message: 'Credenciais inválidas.' });
    
    const token = jwt.sign({ id: usuario.id, nome: usuario.nome }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
});

// --- ALTERAÇÃO PEGASUS 2.0 ---: NOVAS ROTAS DE RECUPERAÇÃO DE SENHA
app.post('/api/usuarios/recuperar-senha', async (req, res) => {
    const { email } = req.body;
    try {
        const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        const usuario = rows[0];
        if (!usuario) {
            // Não informe se o email existe ou não, por segurança
            return res.status(200).json({ message: 'Se um usuário com este email existir, um link de recuperação foi enviado.' });
        }

        // Gera um token seguro
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = await bcrypt.hash(resetToken, 10);
        
        // Define tempo de expiração (ex: 1 hora)
        const expires_at = new Date(Date.now() + 3600000); 

        // Salva o token hash no banco
        await db.query('DELETE FROM password_reset_tokens WHERE usuario_id = $1', [usuario.id]); // Invalida tokens antigos
        await db.query('INSERT INTO password_reset_tokens (usuario_id, token, expires_at) VALUES ($1, $2, $3)', [usuario.id, tokenHash, expires_at]);

        // ATENÇÃO: LÓGICA DE ENVIO DE E-MAIL
        // Aqui você deve usar um serviço como Nodemailer, SendGrid, etc.
        // O e-mail deve conter um link para o seu frontend, ex:
        // `https://seusite.com/resetar-senha.html?token=${resetToken}&id=${usuario.id}`
        console.log(`--- SIMULAÇÃO DE ENVIO DE E-MAIL ---`);
        console.log(`Para: ${email}`);
        console.log(`Token de Reset (apenas para teste, envie o link completo): ${resetToken}`);
        console.log(`-----------------------------------`);

        res.status(200).json({ message: 'Se um usuário com este email existir, um link de recuperação foi enviado.' });
    } catch (error) {
        console.error("Erro na recuperação de senha: ", error);
        res.status(500).json({ message: "Erro interno no servidor." });
    }
});

app.post('/api/usuarios/resetar-senha', async (req, res) => {
    const { userId, token, novaSenha } = req.body;
    if (!userId || !token || !novaSenha) {
        return res.status(400).json({ message: 'Dados inválidos.' });
    }

    try {
        const { rows } = await db.query('SELECT * FROM password_reset_tokens WHERE usuario_id = $1 AND expires_at > NOW()', [userId]);
        if (rows.length === 0) {
            return res.status(400).json({ message: 'Token inválido ou expirado.' });
        }
        
        let tokenValido = false;
        let tokenEntry;

        for (const row of rows) {
            const isMatch = await bcrypt.compare(token, row.token);
            if (isMatch) {
                tokenValido = true;
                tokenEntry = row;
                break;
            }
        }
        
        if (!tokenValido) {
             return res.status(400).json({ message: 'Token inválido ou expirado.' });
        }

        const senha_hash = await bcrypt.hash(novaSenha, 10);
        await db.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [senha_hash, userId]);

        // Invalida o token após o uso
        await db.query('DELETE FROM password_reset_tokens WHERE id = $1', [tokenEntry.id]);
        
        res.status(200).json({ message: 'Senha redefinida com sucesso!' });

    } catch (error) {
        console.error("Erro ao resetar senha: ", error);
        res.status(500).json({ message: "Erro interno no servidor." });
    }
});


// Rotas Protegidas (Mantidas)
app.get('/api/resumo', autenticarToken, async (req, res) => {
    const { mes, ano } = req.query;
    await gerarLancamentosPrevistos(parseInt(ano), parseInt(mes), req.usuario.id);
    const resumoCompleto = await calcularResumoParaMes(parseInt(ano), parseInt(mes), req.usuario.id);
    res.json(resumoCompleto);
});

app.get('/api/transacoes', autenticarToken, async (req, res) => {
    const { mes, ano } = req.query;
    await gerarLancamentosPrevistos(parseInt(ano), parseInt(mes), req.usuario.id);
    const mesFormatado = String(mes).padStart(2, '0');
    const sql = `SELECT t.*, c.nome as nome_categoria FROM transacoes t LEFT JOIN categorias c ON t.categoria_id = c.id WHERE TO_CHAR(t.data, 'YYYY-MM') = $1 AND t.usuario_id = $2 ORDER BY t.data DESC, t.id DESC`;
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


// --- ALTERAÇÃO PEGASUS 2.0 ---: NOVAS ROTAS DE GRÁFICOS
app.get('/api/grafico/receita-vs-despesa', autenticarToken, async (req, res) => {
    const { inicio, fim } = req.query;
    const sql = `
        SELECT 
            TO_CHAR(data, 'YYYY-MM') AS mes,
            SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) AS receitas,
            SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) AS despesas
        FROM transacoes
        WHERE 
            usuario_id = $1 AND 
            data BETWEEN $2 AND $3 AND
            status = 'efetivado'
        GROUP BY mes
        ORDER BY mes;
    `;
    const { rows } = await db.query(sql, [req.usuario.id, inicio, fim]);
    res.json(rows);
});

app.get('/api/grafico/despesas-por-categoria', autenticarToken, async (req, res) => {
    const { inicio, fim } = req.query;
    const sql = `
        SELECT 
            c.nome AS categoria,
            SUM(t.valor) AS total
        FROM transacoes t
        JOIN categorias c ON t.categoria_id = c.id
        WHERE
            t.usuario_id = $1 AND
            t.data BETWEEN $2 AND $3 AND
            t.tipo = 'despesa' AND
            t.status = 'efetivado' AND
            c.analitico = TRUE
        GROUP BY c.nome
        HAVING SUM(t.valor) > 0
        ORDER BY total DESC;
    `;
    const { rows } = await db.query(sql, [req.usuario.id, inicio, fim]);
    res.json(rows);
});

app.get('/api/grafico/gastos-por-cartao', autenticarToken, async (req, res) => {
    const { inicio, fim } = req.query;
    const sql = `
        SELECT 
            cc.nome AS cartao, 
            SUM(t.valor) AS total 
        FROM transacoes t 
        JOIN cartoes_de_credito cc ON t.cartao_id = cc.id 
        WHERE 
            t.data BETWEEN $1 AND $2 AND
            t.tipo = 'despesa' AND 
            t.status = 'efetivado' AND 
            t.usuario_id = $3 
        GROUP BY cc.nome 
        HAVING SUM(t.valor) > 0 
        ORDER BY total DESC;
    `;
    const { rows } = await db.query(sql, [inicio, fim, req.usuario.id]);
    res.json(rows);
});


// --- ROTAS DE MATRIZ ATUALIZADAS ---
app.get('/api/lancamentos-fixos', autenticarToken, async (req, res) => {
    const sql = 'SELECT lf.*, c.nome as nome_categoria FROM lancamentos_fixos lf LEFT JOIN categorias c ON lf.categoria_id = c.id WHERE lf.usuario_id = $1 ORDER BY lf.tipo, lf.descricao';
    const { rows } = await db.query(sql, [req.usuario.id]);
    res.json(rows);
});

app.post('/api/lancamentos-fixos', autenticarToken, async (req, res) => {
    // --- ALTERAÇÃO PEGASUS 2.0 ---: Captura dos novos campos
    const { descricao, valor, tipo, dia_do_mes, categoria_id, data_inicio, data_fim } = req.body;
    const { id: usuarioId } = req.usuario;

    const sql = 'INSERT INTO lancamentos_fixos (descricao, valor, tipo, dia_do_mes, categoria_id, usuario_id, data_inicio, data_fim) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id';
    const { rows } = await db.query(sql, [descricao, valor, tipo, dia_do_mes, categoria_id || null, usuarioId, data_inicio, data_fim || null]);
    
    // Opcional: Gerar previsão para o mês corrente imediatamente
    const hoje = new Date();
    await gerarLancamentosPrevistos(hoje.getFullYear(), hoje.getMonth() + 1, usuarioId);

    res.status(201).json({ id: rows[0].id, ...req.body });
});

app.delete('/api/lancamentos-fixos/:id', autenticarToken, async (req, res) => {
    // A lógica de exclusão pode ser mantida, mas idealmente deveria se ajustar
    // para não apagar transações já efetivadas de meses anteriores.
    // Esta versão mais simples apaga previsões futuras, o que é seguro.
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
    // --- ALTERAÇÃO PEGASUS 2.0 ---: Captura do novo campo
    const { nome, analitico } = req.body;
    const sql = 'INSERT INTO categorias (nome, usuario_id, analitico) VALUES ($1, $2, $3) RETURNING *';
    const { rows } = await db.query(sql, [nome, req.usuario.id, analitico]);
    res.status(201).json(rows[0]);
});

app.delete('/api/categorias/:id', autenticarToken, async (req, res) => {
    await db.query('DELETE FROM categorias WHERE id = $1 AND usuario_id = $2', [req.params.id, req.usuario.id]);
    res.status(204).send();
});

// Rotas de cartões mantidas
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
    console.log(`Servidor Pegasus 2.0 rodando na porta ${PORT}`);
});
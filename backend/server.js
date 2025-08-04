// server.js (Versão Corrigida e Automatizada)

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const cors = require('cors');

// ADIÇÃO: Importando as novas ferramentas
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();


const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

let db;

// Conexão com o banco e criação/sincronização de tabelas
(async () => {
    db = await open({ filename: './database.db', driver: sqlite3.Database });
    console.log('Conectado ao banco de dados SQLite.');

    // ADIÇÃO: Tabela de usuários
    await db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            senha_hash TEXT NOT NULL
        );
    `);
    
    // ADIÇÃO: Colunas 'usuario_id' para criar o "condomínio"
    try { await db.exec(`ALTER TABLE lancamentos_fixos ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id)`); } catch (e) { /* ignora se já existe */ }
    try { await db.exec(`ALTER TABLE categorias ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id)`); } catch (e) { /* ignora se já existe */ }
    try { await db.exec(`ALTER TABLE cartoes_de_credito ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id)`); } catch (e) { /* ignora se já existe */ }
    try { await db.exec(`ALTER TABLE transacoes ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id)`); } catch (e) { /* ignora se já existe */ }

    await db.exec(`CREATE TABLE IF NOT EXISTS lancamentos_fixos (id INTEGER PRIMARY KEY AUTOINCREMENT, descricao TEXT NOT NULL, valor REAL NOT NULL, tipo TEXT NOT NULL, dia_do_mes INTEGER NOT NULL, categoria_id INTEGER, usuario_id INTEGER, FOREIGN KEY (categoria_id) REFERENCES categorias (id), FOREIGN KEY (usuario_id) REFERENCES usuarios(id));`);
    
    // AJUSTE ESSENCIAL: Removido 'UNIQUE' do nome para permitir que usuários diferentes tenham categorias/cartões com mesmo nome
    await db.exec(`CREATE TABLE IF NOT EXISTS categorias (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, usuario_id INTEGER, FOREIGN KEY (usuario_id) REFERENCES usuarios(id));`);
    await db.exec(`CREATE TABLE IF NOT EXISTS cartoes_de_credito (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, usuario_id INTEGER, FOREIGN KEY (usuario_id) REFERENCES usuarios(id));`);
    
    try {
        await db.exec(`ALTER TABLE transacoes ADD COLUMN gerado_automaticamente BOOLEAN DEFAULT 0`);
    } catch (e) { /* ignora erro se coluna já existe */ }

    await db.exec(`CREATE TABLE IF NOT EXISTS transacoes (id INTEGER PRIMARY KEY AUTOINCREMENT, descricao TEXT NOT NULL, valor REAL NOT NULL, data DATE NOT NULL, status TEXT NOT NULL, tipo TEXT NOT NULL, categoria_id INTEGER, cartao_id INTEGER, gerado_automaticamente BOOLEAN DEFAULT 0, usuario_id INTEGER, FOREIGN KEY (categoria_id) REFERENCES categorias (id), FOREIGN KEY (cartao_id) REFERENCES cartoes_de_credito (id), FOREIGN KEY (usuario_id) REFERENCES usuarios(id));`);
    
    console.log('Tabelas sincronizadas.');
})();

// Lógica de Geração de Previsões (AGORA FILTRADA POR USUÁRIO)
async function gerarLancamentosPrevistos(ano, mes, usuarioId) {
    const mesFormatado = String(mes).padStart(2, '0');
    const dataVerificacao = `${ano}-${mesFormatado}`;
    const existentes = await db.get("SELECT 1 FROM transacoes WHERE strftime('%Y-%m', data) = ? AND gerado_automaticamente = 1 AND usuario_id = ?", [dataVerificacao, usuarioId]);
    if (existentes) { return; }
    const lancamentosFixos = await db.all('SELECT * FROM lancamentos_fixos WHERE usuario_id = ?', [usuarioId]);
    if (lancamentosFixos.length === 0) return;

    for (const fixo of lancamentosFixos) {
        const dataLancamento = `${ano}-${mesFormatado}-${String(fixo.dia_do_mes).padStart(2, '0')}`;
        await db.run('INSERT INTO transacoes (descricao, valor, data, status, tipo, categoria_id, gerado_automaticamente, usuario_id) VALUES (?, ?, ?, "previsto", ?, ?, 1, ?)', [fixo.descricao, fixo.valor, dataLancamento, fixo.tipo, fixo.categoria_id, usuarioId]);
    }
}


// --- FUNÇÃO AUXILIAR RECURSIVA PARA CÁLCULO DE SALDO --- (AGORA FILTRADA POR USUÁRIO)
async function calcularResumoParaMes(ano, mes, usuarioId, profundidade = 0) {
    if (profundidade > 24) return { saldoFinalProjetado: 0 };
    const mesFormatado = String(mes).padStart(2, '0');
    const dataFiltro = `${ano}-${mesFormatado}`;

    const sqls = {
        receitasEfetivadas: `SELECT SUM(valor) as total FROM transacoes WHERE tipo = 'receita' AND status = 'efetivado' AND strftime('%Y-%m', data) = ? AND usuario_id = ?`,
        despesasEfetivadas: `SELECT SUM(valor) as total FROM transacoes WHERE tipo = 'despesa' AND status = 'efetivado' AND strftime('%Y-%m', data) = ? AND usuario_id = ?`,
        receitasPrevistas: `SELECT SUM(valor) as total FROM transacoes WHERE tipo = 'receita' AND status = 'previsto' AND strftime('%Y-%m', data) = ? AND usuario_id = ?`,
        despesasPrevistas: `SELECT SUM(valor) as total FROM transacoes WHERE tipo = 'despesa' AND status = 'previsto' AND strftime('%Y-%m', data) = ? AND usuario_id = ?`
    };

    const [totalReceitasEfetivadas, totalDespesasEfetivadas, totalReceitasPrevistas, totalDespesasPrevistas] = await Promise.all([
        db.get(sqls.receitasEfetivadas, [dataFiltro, usuarioId]).then(r => r?.total || 0),
        db.get(sqls.despesasEfetivadas, [dataFiltro, usuarioId]).then(r => r?.total || 0),
        db.get(sqls.receitasPrevistas, [dataFiltro, usuarioId]).then(r => r?.total || 0),
        db.get(sqls.despesasPrevistas, [dataFiltro, usuarioId]).then(r => r?.total || 0),
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
        saldoInicial,
        totalReceitasEfetivadas,
        totalDespesasEfetivadas,
        totalReceitasPrevistas,
        totalDespesasPrevistas,
        saldoAtualAcumulado,
        saldoPrevistoDoMes,
        saldoFinalProjetado,
        ganhos: totalReceitasEfetivadas + totalReceitasPrevistas,
        dividas: totalDespesasEfetivadas + totalDespesasPrevistas,
        sobras: saldoFinalProjetado
    };
}


// ADIÇÃO: O "Segurança" da API (Middleware de Autenticação)
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

// ROTAS PÚBLICAS: Cadastro e Login
app.post('/api/usuarios/cadastro', async (req, res) => {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }
    try {
        const emailExistente = await db.get('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (emailExistente) {
            return res.status(409).json({ message: 'Este e-mail já está em uso.' });
        }
        const senha_hash = await bcrypt.hash(senha, 10);
        const result = await db.run('INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)', [nome, email, senha_hash]);
        res.status(201).json({ id: result.lastID, nome, email });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao cadastrar usuário.', error: error.message });
    }
});
app.post('/api/usuarios/login', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    }
    const usuario = await db.get('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (!usuario) {
        return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) {
        return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    const token = jwt.sign({ id: usuario.id, nome: usuario.nome }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
});


// --- ROTAS PROTEGIDAS (A PARTIR DAQUI, TUDO EXIGE LOGIN) ---

// API DE RESUMO FINANCEIRO (BLINDADA)
app.get('/api/resumo', autenticarToken, async (req, res) => {
    const { mes, ano } = req.query;
    const resumoCompleto = await calcularResumoParaMes(parseInt(ano), parseInt(mes), req.usuario.id);
    res.json(resumoCompleto);
});

// API DE TRANSAÇÕES (BLINDADA)
app.get('/api/transacoes', autenticarToken, async (req, res) => {
    const { mes, ano } = req.query;
    await gerarLancamentosPrevistos(parseInt(ano), parseInt(mes), req.usuario.id);
    const mesFormatado = String(mes).padStart(2, '0');
    const transacoes = await db.all(`SELECT t.*, c.nome as nome_categoria, cc.nome as nome_cartao FROM transacoes t LEFT JOIN categorias c ON t.categoria_id = c.id LEFT JOIN cartoes_de_credito cc ON t.cartao_id = cc.id WHERE strftime('%Y-%m', t.data) = ? AND t.usuario_id = ? ORDER BY t.data DESC`, [`${ano}-${mesFormatado}`, req.usuario.id]);
    res.json(transacoes);
});

app.post('/api/transacoes', autenticarToken, async (req, res) => {
    const { descricao, valor, data, status, tipo, categoria_id, cartao_id } = req.body;
    const result = await db.run('INSERT INTO transacoes (descricao, valor, data, status, tipo, categoria_id, cartao_id, usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [descricao, valor, data, status, tipo, categoria_id || null, cartao_id || null, req.usuario.id]);
    res.status(201).json({ id: result.lastID, ...req.body });
});

app.delete('/api/transacoes/:id', autenticarToken, async (req, res) => {
    const { id } = req.params;
    await db.run('DELETE FROM transacoes WHERE id = ? AND usuario_id = ?', [id, req.usuario.id]);
    res.status(204).send();
});

app.put('/api/transacoes/:id/efetivar', autenticarToken, async (req, res) => {
    const { id } = req.params;
    await db.run('UPDATE transacoes SET status = "efetivado" WHERE id = ? AND usuario_id = ?', [id, req.usuario.id]);
    res.status(200).json({ message: 'Transação efetivada com sucesso!' });
});

app.put('/api/transacoes/:id/prever', autenticarToken, async (req, res) => {
    const { id } = req.params;
    await db.run('UPDATE transacoes SET status = "previsto" WHERE id = ? AND usuario_id = ?', [id, req.usuario.id]);
    res.status(200).json({ message: 'Transação revertida para previsto!' });
});


// SEÇÃO DE ROTAS PARA GRÁFICOS (BLINDADA)
app.get('/api/grafico/planejamento-anual', autenticarToken, async (req, res) => {
    const { ano } = req.query;
    let dadosAnuais = [];
    for (let mes = 1; mes <= 12; mes++) {
        const resumoMes = await calcularResumoParaMes(parseInt(ano), mes, req.usuario.id);
        dadosAnuais.push({
            mes: mes,
            ganhos: resumoMes.ganhos,
            dividas: resumoMes.dividas,
            sobras: resumoMes.sobras
        });
    }
    res.json(dadosAnuais);
});

app.get('/api/grafico/compras-mensais', autenticarToken, async (req, res) => {
    const { ano } = req.query;
    const dadosAnuais = await db.all(`
        SELECT strftime('%m', data) as mes, SUM(valor) as total
        FROM transacoes
        WHERE strftime('%Y', data) = ? AND tipo = 'despesa' AND status = 'efetivado' AND usuario_id = ?
        GROUP BY mes
    `, [ano, req.usuario.id]);
    res.json(dadosAnuais);
});

app.get('/api/grafico/gastos-por-cartao', autenticarToken, async (req, res) => {
    const { ano } = req.query;
    const dadosCartoes = await db.all(`
        SELECT cc.nome as cartao, SUM(t.valor) as total
        FROM transacoes t
        JOIN cartoes_de_credito cc ON t.cartao_id = cc.id
        WHERE strftime('%Y', t.data) = ? AND t.tipo = 'despesa' AND t.status = 'efetivado' AND t.usuario_id = ?
        GROUP BY cc.nome
        HAVING SUM(t.valor) > 0
        ORDER BY total DESC
    `, [ano, req.usuario.id]);
    res.json(dadosCartoes);
});


// API DE LANÇAMENTOS FIXOS (BLINDADA)
app.get('/api/lancamentos-fixos', autenticarToken, async (req, res) => {
    const lancamentos = await db.all('SELECT lf.*, c.nome as nome_categoria FROM lancamentos_fixos lf LEFT JOIN categorias c ON lf.categoria_id = c.id WHERE lf.usuario_id = ? ORDER BY lf.tipo, lf.descricao', [req.usuario.id]);
    res.json(lancamentos);
});

// ############# INÍCIO DA ALTERAÇÃO 1 #############
app.post('/api/lancamentos-fixos', autenticarToken, async (req, res) => {
    const { descricao, valor, tipo, dia_do_mes, categoria_id } = req.body;
    const usuarioId = req.usuario.id;

    // 1. Insere o lançamento fixo (a "regra")
    const result = await db.run('INSERT INTO lancamentos_fixos (descricao, valor, tipo, dia_do_mes, categoria_id, usuario_id) VALUES (?, ?, ?, ?, ?, ?)', [descricao, valor, tipo, dia_do_mes, categoria_id || null, usuarioId]);
    
    // --- ADIÇÃO INTELIGENTE ---
    // 2. Cria a transação PREVISTA para o mês atual imediatamente
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
    const diaFormatado = String(dia_do_mes).padStart(2, '0');
    const dataLancamento = `${anoAtual}-${mesAtual}-${diaFormatado}`;

    await db.run(
        'INSERT INTO transacoes (descricao, valor, data, status, tipo, categoria_id, gerado_automaticamente, usuario_id) VALUES (?, ?, ?, "previsto", ?, ?, 1, ?)',
        [descricao, valor, dataLancamento, tipo, categoria_id || null, usuarioId]
    );
    // --- FIM DA ADIÇÃO ---

    res.status(201).json({ id: result.lastID, ...req.body });
});
// ############# FIM DA ALTERAÇÃO 1 #############


// ############# INÍCIO DA ALTERAÇÃO 2 #############
app.delete('/api/lancamentos-fixos/:id', autenticarToken, async (req, res) => {
    const { id } = req.params;
    const usuarioId = req.usuario.id;

    // --- ADIÇÃO INTELIGENTE ---
    // 1. Pega a descrição do lançamento fixo antes de deletar
    const lancamentoFixo = await db.get('SELECT descricao FROM lancamentos_fixos WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
    
    // 2. Se encontrou, deleta as transações futuras baseadas nele
    if (lancamentoFixo) {
        const hojeFormatado = new Date().toISOString().split('T')[0];
        await db.run(
            "DELETE FROM transacoes WHERE descricao = ? AND gerado_automaticamente = 1 AND status = 'previsto' AND data >= ? AND usuario_id = ?",
            [lancamentoFixo.descricao, hojeFormatado, usuarioId]
        );
    }
    // --- FIM DA ADIÇÃO ---

    // 3. Deleta o lançamento fixo (a "regra")
    await db.run('DELETE FROM lancamentos_fixos WHERE id = ? AND usuario_id = ?', [id, usuarioId]);

    res.status(204).send();
});
// ############# FIM DA ALTERAÇÃO 2 #############


// API DE CATEGORIAS (BLINDADA)
app.get('/api/categorias', autenticarToken, async (req, res) => {
    const categorias = await db.all('SELECT * FROM categorias WHERE usuario_id = ? ORDER BY nome', [req.usuario.id]);
    res.json(categorias);
});

app.post('/api/categorias', autenticarToken, async (req, res) => {
    const { nome } = req.body;
    const result = await db.run('INSERT INTO categorias (nome, usuario_id) VALUES (?, ?)', [nome, req.usuario.id]);
    res.status(201).json({ id: result.lastID, nome });
});

app.delete('/api/categorias/:id', autenticarToken, async (req, res) => {
    const { id } = req.params;
    await db.run('DELETE FROM categorias WHERE id = ? AND usuario_id = ?', [id, req.usuario.id]);
    res.status(204).send();
});


// API DE CARTÕES DE CRÉDITO (BLINDADA)
app.get('/api/cartoes', autenticarToken, async (req, res) => {
    const cartoes = await db.all('SELECT * FROM cartoes_de_credito WHERE usuario_id = ? ORDER BY nome', [req.usuario.id]);
    res.json(cartoes);
});

app.post('/api/cartoes', autenticarToken, async (req, res) => {
    const { nome } = req.body;
    const result = await db.run('INSERT INTO cartoes_de_credito (nome, usuario_id) VALUES (?, ?)', [nome, req.usuario.id]);
    res.status(201).json({ id: result.lastID, nome });
});

app.delete('/api/cartoes/:id', autenticarToken, async (req, res) => {
    const { id } = req.params;
    await db.run('DELETE FROM cartoes_de_credito WHERE id = ? AND usuario_id = ?', [id, req.usuario.id]);
    res.status(204).send();
});


// INICIA O SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor rodando`);
});
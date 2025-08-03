// server.js (Sua Versão, com as 3 Novas Rotas de Gráfico)

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

let db;

// Conexão com o banco e criação/sincronização de tabelas
(async () => {
    db = await open({ filename: './database.db', driver: sqlite3.Database });
    console.log('Conectado ao banco de dados SQLite.');

    await db.exec(`CREATE TABLE IF NOT EXISTS lancamentos_fixos (id INTEGER PRIMARY KEY AUTOINCREMENT, descricao TEXT NOT NULL, valor REAL NOT NULL, tipo TEXT NOT NULL, dia_do_mes INTEGER NOT NULL, categoria_id INTEGER, FOREIGN KEY (categoria_id) REFERENCES categorias (id));`);
    await db.exec(`CREATE TABLE IF NOT EXISTS categorias (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL UNIQUE);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS cartoes_de_credito (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL UNIQUE);`);
    
    try {
        await db.exec(`ALTER TABLE transacoes ADD COLUMN gerado_automaticamente BOOLEAN DEFAULT 0`);
    } catch (e) { /* ignora erro se coluna já existe */ }

    await db.exec(`CREATE TABLE IF NOT EXISTS transacoes (id INTEGER PRIMARY KEY AUTOINCREMENT, descricao TEXT NOT NULL, valor REAL NOT NULL, data DATE NOT NULL, status TEXT NOT NULL, tipo TEXT NOT NULL, categoria_id INTEGER, cartao_id INTEGER, gerado_automaticamente BOOLEAN DEFAULT 0, FOREIGN KEY (categoria_id) REFERENCES categorias (id), FOREIGN KEY (cartao_id) REFERENCES cartoes_de_credito (id));`);
    
    console.log('Tabelas sincronizadas.');
})();

// Lógica de Geração de Previsões
async function gerarLancamentosPrevistos(ano, mes) {
    const mesFormatado = String(mes).padStart(2, '0');
    const dataVerificacao = `${ano}-${mesFormatado}`;
    const existentes = await db.get("SELECT 1 FROM transacoes WHERE strftime('%Y-%m', data) = ? AND gerado_automaticamente = 1", [dataVerificacao]);
    if (existentes) { return; }
    const lancamentosFixos = await db.all('SELECT * FROM lancamentos_fixos');
    if (lancamentosFixos.length === 0) return;

    for (const fixo of lancamentosFixos) {
        const dataLancamento = `${ano}-${mesFormatado}-${String(fixo.dia_do_mes).padStart(2, '0')}`;
        await db.run('INSERT INTO transacoes (descricao, valor, data, status, tipo, categoria_id, gerado_automaticamente) VALUES (?, ?, ?, "previsto", ?, ?, 1)', [fixo.descricao, fixo.valor, dataLancamento, fixo.tipo, fixo.categoria_id]);
    }
}


// --- FUNÇÃO AUXILIAR RECURSIVA PARA CÁLCULO DE SALDO ---
async function calcularResumoParaMes(ano, mes, profundidade = 0) {
    if (profundidade > 24) return { saldoFinalProjetado: 0 }; // Aumentado para 2 anos de recursão
    const mesFormatado = String(mes).padStart(2, '0');
    const dataFiltro = `${ano}-${mesFormatado}`;

    const sqls = {
        receitasEfetivadas: `SELECT SUM(valor) as total FROM transacoes WHERE tipo = 'receita' AND status = 'efetivado' AND strftime('%Y-%m', data) = ?`,
        despesasEfetivadas: `SELECT SUM(valor) as total FROM transacoes WHERE tipo = 'despesa' AND status = 'efetivado' AND strftime('%Y-%m', data) = ?`,
        receitasPrevistas: `SELECT SUM(valor) as total FROM transacoes WHERE tipo = 'receita' AND status = 'previsto' AND strftime('%Y-%m', data) = ?`,
        despesasPrevistas: `SELECT SUM(valor) as total FROM transacoes WHERE tipo = 'despesa' AND status = 'previsto' AND strftime('%Y-%m', data) = ?`
    };

    const [totalReceitasEfetivadas, totalDespesasEfetivadas, totalReceitasPrevistas, totalDespesasPrevistas] = await Promise.all([
        db.get(sqls.receitasEfetivadas, [dataFiltro]).then(r => r?.total || 0),
        db.get(sqls.despesasEfetivadas, [dataFiltro]).then(r => r?.total || 0),
        db.get(sqls.receitasPrevistas, [dataFiltro]).then(r => r?.total || 0),
        db.get(sqls.despesasPrevistas, [dataFiltro]).then(r => r?.total || 0),
    ]);
    
    let mesAnterior = mes - 1;
    let anoAnterior = ano;
    if (mesAnterior === 0) {
        mesAnterior = 12;
        anoAnterior = ano - 1;
    }
    
    const resumoAnterior = await calcularResumoParaMes(anoAnterior, mesAnterior, profundidade + 1);
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
        // Adicionado para o gráfico GPA
        ganhos: totalReceitasEfetivadas + totalReceitasPrevistas,
        dividas: totalDespesasEfetivadas + totalDespesasPrevistas,
        sobras: saldoFinalProjetado
    };
}


// --- ROTAS DA API ---

// API DE RESUMO FINANCEIRO (ATUALIZADA)
app.get('/api/resumo', async (req, res) => {
    const { mes, ano } = req.query;
    // Chama a nova função de cálculo recursivo
    const resumoCompleto = await calcularResumoParaMes(parseInt(ano), parseInt(mes));
    res.json(resumoCompleto);
});

// API DE TRANSAÇÕES
app.get('/api/transacoes', async (req, res) => {
    const { mes, ano } = req.query;
    await gerarLancamentosPrevistos(parseInt(ano), parseInt(mes));
    const mesFormatado = String(mes).padStart(2, '0');
    const transacoes = await db.all(`SELECT t.*, c.nome as nome_categoria, cc.nome as nome_cartao FROM transacoes t LEFT JOIN categorias c ON t.categoria_id = c.id LEFT JOIN cartoes_de_credito cc ON t.cartao_id = cc.id WHERE strftime('%Y-%m', data) = ? ORDER BY t.data DESC`, [`${ano}-${mesFormatado}`]);
    res.json(transacoes);
});

app.post('/api/transacoes', async (req, res) => {
    const { descricao, valor, data, status, tipo, categoria_id, cartao_id } = req.body;
    const result = await db.run('INSERT INTO transacoes (descricao, valor, data, status, tipo, categoria_id, cartao_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [descricao, valor, data, status, tipo, categoria_id || null, cartao_id || null]);
    res.status(201).json({ id: result.lastID, ...req.body });
});

app.delete('/api/transacoes/:id', async (req, res) => {
    const { id } = req.params;
    await db.run('DELETE FROM transacoes WHERE id = ?', [id]);
    res.status(204).send();
});

app.put('/api/transacoes/:id/efetivar', async (req, res) => {
    const { id } = req.params;
    await db.run('UPDATE transacoes SET status = "efetivado" WHERE id = ?', [id]);
    res.status(200).json({ message: 'Transação efetivada com sucesso!' });
});

app.put('/api/transacoes/:id/prever', async (req, res) => {
    const { id } = req.params;
    await db.run('UPDATE transacoes SET status = "previsto" WHERE id = ?', [id]);
    res.status(200).json({ message: 'Transação revertida para previsto!' });
});


// ***** SEÇÃO DE ROTAS PARA GRÁFICOS (ADICIONADA) *****
app.get('/api/grafico/planejamento-anual', async (req, res) => {
    const { ano } = req.query;
    let dadosAnuais = [];
    for (let mes = 1; mes <= 12; mes++) {
        const resumoMes = await calcularResumoParaMes(parseInt(ano), mes);
        dadosAnuais.push({
            mes: mes,
            ganhos: resumoMes.ganhos,
            dividas: resumoMes.dividas,
            sobras: resumoMes.sobras
        });
    }
    res.json(dadosAnuais);
});

app.get('/api/grafico/compras-mensais', async (req, res) => {
    const { ano } = req.query;
    const dadosAnuais = await db.all(`
        SELECT strftime('%m', data) as mes, SUM(valor) as total
        FROM transacoes
        WHERE strftime('%Y', data) = ? AND tipo = 'despesa' AND status = 'efetivado'
        GROUP BY mes
    `, [ano]);
    res.json(dadosAnuais);
});

app.get('/api/grafico/gastos-por-cartao', async (req, res) => {
    const { ano } = req.query;
    const dadosCartoes = await db.all(`
        SELECT cc.nome as cartao, SUM(t.valor) as total
        FROM transacoes t
        JOIN cartoes_de_credito cc ON t.cartao_id = cc.id
        WHERE strftime('%Y', t.data) = ? AND t.tipo = 'despesa' AND t.status = 'efetivado'
        GROUP BY cc.nome
        HAVING SUM(t.valor) > 0
        ORDER BY total DESC
    `, [ano]);
    res.json(dadosCartoes);
});


// API DE LANÇAMENTOS FIXOS
app.get('/api/lancamentos-fixos', async (req, res) => {
    const lancamentos = await db.all('SELECT lf.*, c.nome as nome_categoria FROM lancamentos_fixos lf LEFT JOIN categorias c ON lf.categoria_id = c.id ORDER BY lf.tipo, lf.descricao');
    res.json(lancamentos);
});

app.post('/api/lancamentos-fixos', async (req, res) => {
    const { descricao, valor, tipo, dia_do_mes, categoria_id } = req.body;
    const result = await db.run('INSERT INTO lancamentos_fixos (descricao, valor, tipo, dia_do_mes, categoria_id) VALUES (?, ?, ?, ?, ?)', [descricao, valor, tipo, dia_do_mes, categoria_id || null]);
    res.status(201).json({ id: result.lastID, ...req.body });
});

app.delete('/api/lancamentos-fixos/:id', async (req, res) => {
    const { id } = req.params;
    await db.run('DELETE FROM lancamentos_fixos WHERE id = ?', [id]);
    res.status(204).send();
});


// API DE CATEGORIAS
app.get('/api/categorias', async (req, res) => {
    const categorias = await db.all('SELECT * FROM categorias ORDER BY nome');
    res.json(categorias);
});

app.post('/api/categorias', async (req, res) => {
    const { nome } = req.body;
    const result = await db.run('INSERT INTO categorias (nome) VALUES (?)', [nome]);
    res.status(201).json({ id: result.lastID, nome });
});

app.delete('/api/categorias/:id', async (req, res) => {
    const { id } = req.params;
    await db.run('DELETE FROM categorias WHERE id = ?', [id]);
    res.status(204).send();
});


// API DE CARTÕES DE CRÉDITO
app.get('/api/cartoes', async (req, res) => {
    const cartoes = await db.all('SELECT * FROM cartoes_de_credito ORDER BY nome');
    res.json(cartoes);
});

app.post('/api/cartoes', async (req, res) => {
    const { nome } = req.body;
    const result = await db.run('INSERT INTO cartoes_de_credito (nome) VALUES (?)', [nome]);
    res.status(201).json({ id: result.lastID, nome });
});

app.delete('/api/cartoes/:id', async (req, res) => {
    const { id } = req.params;
    await db.run('DELETE FROM cartoes_de_credito WHERE id = ?', [id]);
    res.status(204).send();
});


// INICIA O SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
/*
 * =================================================================
 * PEGASUS FINANCE 2.0 (VERSÃO TURBO & CORRIGIDA)
 * =================================================================
 */

// --- 1. IMPORTAÇÕES E CONFIGURAÇÃO INICIAL ---
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
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

// --- 3. INICIALIZAÇÃO DO BANCO DE DADOS ---
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
        // Migração para corrigir bug de edições manuais
        await db.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes' AND column_name='lancamento_fixo_id') THEN 
                    ALTER TABLE transacoes ADD COLUMN lancamento_fixo_id INTEGER REFERENCES lancamentos_fixos(id) ON DELETE SET NULL; 
                END IF; 
            END $$;
        `);
        console.log('Tabelas sincronizadas.');
    } catch (err) {
        console.error('Erro ao sincronizar tabelas:', err);
    }
};
inicializarBancoDeDados();

// --- 4. FUNÇÕES AUXILIARES (LÓGICA DE NEGÓCIO) ---

// Geração de lançamentos (Suporta ID específico para atualização cirúrgica)
async function gerarLancamentosPrevistos(ano, mes, usuarioId, lancamentoFixoIdEspecifico = null) {
    try {
        const mesFormatado = String(mes).padStart(2, '0');
        const primeiroDiaDoMesString = `${ano}-${mesFormatado}-01`;
        const ultimoDiaDoMes = new Date(ano, mes, 0).getDate();
        const ultimoDiaDoMesString = `${ano}-${mesFormatado}-${ultimoDiaDoMes}`;
        
        let queryBase = `
            SELECT * FROM lancamentos_fixos 
            WHERE usuario_id = $1 
            AND data_inicio <= $2::date
            AND (data_fim IS NULL OR data_fim >= $3::date)
        `;
        
        const params = [usuarioId, ultimoDiaDoMesString, primeiroDiaDoMesString];

        if (lancamentoFixoIdEspecifico) {
            queryBase += ` AND id = $4`;
            params.push(lancamentoFixoIdEspecifico);
        }

        const { rows: lancamentosFixos } = await db.query(queryBase, params);
        
        if (lancamentosFixos.length === 0) return;

        for (const fixo of lancamentosFixos) {
            const existeTransacaoQuery = `
                SELECT 1 FROM transacoes 
                WHERE (lancamento_fixo_id = $1 OR (lancamento_fixo_id IS NULL AND descricao = $2))
                AND usuario_id = $3 
                AND TO_CHAR(data, 'YYYY-MM') = $4
                LIMIT 1;
            `;
            const { rows: transacaoExistente } = await db.query(existeTransacaoQuery, [fixo.id, fixo.descricao, usuarioId, `${ano}-${mesFormatado}`]);

            if (transacaoExistente.length === 0) {
                const dia = Math.min(fixo.dia_do_mes, ultimoDiaDoMes);
                const dataLancamento = `${ano}-${mesFormatado}-${String(dia).padStart(2, '0')}`;
                
                const insertQuery = `
                    INSERT INTO transacoes 
                    (descricao, valor, data, status, tipo, categoria_id, gerado_automaticamente, usuario_id, lancamento_fixo_id) 
                    VALUES ($1, $2, $3, 'previsto', $4, $5, TRUE, $6, $7)
                `;
                await db.query(insertQuery, [fixo.descricao, fixo.valor, dataLancamento, fixo.tipo, fixo.categoria_id, usuarioId, fixo.id]);
            }
        }
    } catch (error) {
        console.error(`Erro ao gerar lançamentos:`, error);
    }
}

// --- VERSÃO OTIMIZADA: CÁLCULO DIRETO NO BANCO (INSTANTÂNEO) ---
async function calcularResumoParaMes(ano, mes, usuarioId) {
    try {
        const mesFormatado = String(mes).padStart(2, '0');
        const primeiroDiaDoMes = `${ano}-${mesFormatado}-01`;

        // 1. Saldo Inicial: Soma tudo antes deste mês de uma vez só
        const saldoInicialQuery = `
            SELECT COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE -valor END), 0) as total
            FROM transacoes
            WHERE usuario_id = $1
            AND status = 'efetivado'
            AND data < $2
        `;
        const { rows: saldoRows } = await db.query(saldoInicialQuery, [usuarioId, primeiroDiaDoMes]);
        const saldoInicial = parseFloat(saldoRows[0].total);

        // 2. Busca totais do mês atual
        const totaisMesQuery = `
            SELECT 
                SUM(CASE WHEN tipo = 'receita' AND status = 'efetivado' THEN valor ELSE 0 END) as receitas_efetivadas,
                SUM(CASE WHEN tipo = 'despesa' AND status = 'efetivado' THEN valor ELSE 0 END) as despesas_efetivadas,
                SUM(CASE WHEN tipo = 'receita' AND status = 'previsto' THEN valor ELSE 0 END) as receitas_previstas,
                SUM(CASE WHEN tipo = 'despesa' AND status = 'previsto' THEN valor ELSE 0 END) as despesas_previstas
            FROM transacoes
            WHERE usuario_id = $1
            AND TO_CHAR(data, 'YYYY-MM') = $2
        `;
        
        const { rows: totaisRows } = await db.query(totaisMesQuery, [usuarioId, `${ano}-${mesFormatado}`]);
        const totais = totaisRows[0];

        const totalReceitasEfetivadas = parseFloat(totais.receitas_efetivadas || 0);
        const totalDespesasEfetivadas = parseFloat(totais.despesas_efetivadas || 0);
        const totalReceitasPrevistas = parseFloat(totais.receitas_previstas || 0);
        const totalDespesasPrevistas = parseFloat(totais.despesas_previstas || 0);

        // 3. Matemática simples
        const saldoAtualAcumulado = saldoInicial + totalReceitasEfetivadas - totalDespesasEfetivadas;
        const saldoFinalProjetado = saldoAtualAcumulado + totalReceitasPrevistas - totalDespesasPrevistas;

        return { 
            saldoInicial, 
            totalReceitasEfetivadas, 
            totalDespesasEfetivadas, 
            totalReceitasPrevistas, 
            totalDespesasPrevistas, 
            saldoAtualAcumulado, 
            saldoFinalProjetado 
        };
    } catch (error) {
        console.error("Erro ao calcular resumo otimizado:", error);
        return { saldoFinalProjetado: 0 };
    }
}

// --- 5. MIDDLEWARES ---
const autenticarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ message: 'Token necessário.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {
        if (err) return res.status(403).json({ message: 'Token inválido.' });
        req.usuario = usuario;
        next();
    });
};

const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// --- 6. ROTAS DA API ---
app.get('/api/status', (req, res) => res.json({ status: 'ok' }));

const rotasPublicas = express.Router();

rotasPublicas.post('/usuarios/cadastro', asyncHandler(async (req, res) => {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ message: 'Campos obrigatórios.' });
    const { rows } = await db.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (rows.length > 0) return res.status(409).json({ message: 'Email em uso.' });
    const senha_hash = await bcrypt.hash(senha, 10);
    const result = await db.query('INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id', [nome, email, senha_hash]);
    res.status(201).json({ id: result.rows[0].id, nome, email });
}));

rotasPublicas.post('/usuarios/login', asyncHandler(async (req, res) => {
    const { email, senha } = req.body;
    const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const usuario = rows[0];
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) return res.status(401).json({ message: 'Credenciais inválidas.' });
    const token = jwt.sign({ id: usuario.id, nome: usuario.nome }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
}));

const rotasProtegidas = express.Router();
rotasProtegidas.use(autenticarToken);

// Função HÍBRIDA para Atualizar/Remover (Corrige Legados e Edição)
async function atualizarAgendaFuturaEspecifica(dataReferencia, usuarioId, lancamentoFixoId, descricaoOriginal = null) {
    // 1. Remove futuros: Busca pelo ID (novo) OU Descrição (velho)
    let queryDelete = `
        DELETE FROM transacoes 
        WHERE gerado_automaticamente = TRUE 
        AND status = 'previsto' 
        AND data >= $1 
        AND usuario_id = $2
        AND (lancamento_fixo_id = $3 ${descricaoOriginal ? 'OR (lancamento_fixo_id IS NULL AND descricao = $4)' : ''})
    `;
    const paramsDelete = [dataReferencia, usuarioId, lancamentoFixoId];
    if (descricaoOriginal) paramsDelete.push(descricaoOriginal);
    await db.query(queryDelete, paramsDelete);

    // 2. Regenera agenda apenas para este ID (12 meses)
    const dataInicioObj = new Date(dataReferencia + 'T00:00:00');
    for (let i = 0; i < 12; i++) {
        let dataAlvo = new Date(dataInicioObj);
        dataAlvo.setMonth(dataAlvo.getMonth() + i);
        let ano = dataAlvo.getFullYear();
        let mes = dataAlvo.getMonth() + 1;
        await gerarLancamentosPrevistos(ano, mes, usuarioId, lancamentoFixoId);
    }
}

// Rotas Transações
rotasProtegidas.get('/resumo', asyncHandler(async (req, res) => {
    const { mes, ano } = req.query;
    res.json(await calcularResumoParaMes(parseInt(ano), parseInt(mes), req.usuario.id));
}));

rotasProtegidas.get('/transacoes', asyncHandler(async (req, res) => {
    const { mes, ano } = req.query;
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
    const { descricao, valor, data, status, categoria_id, cartao_id } = req.body;
    const sql = `UPDATE transacoes SET descricao = $1, valor = $2, data = $3, categoria_id = $4, cartao_id = $5, status = $6 WHERE id = $7 AND usuario_id = $8 RETURNING id`;
    const { rowCount } = await db.query(sql, [descricao, valor, data, categoria_id || null, cartao_id || null, status, id, req.usuario.id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Não encontrado.' });
    res.status(200).json({ message: 'Atualizado.' });
}));

rotasProtegidas.put('/transacoes/:id/efetivar', asyncHandler(async (req, res) => {
    await db.query('UPDATE transacoes SET status = \'efetivado\' WHERE id = $1 AND usuario_id = $2', [req.params.id, req.usuario.id]);
    res.status(200).json({ message: 'Efetivada.' });
}));

rotasProtegidas.put('/transacoes/:id/prever', asyncHandler(async (req, res) => {
    await db.query('UPDATE transacoes SET status = \'previsto\' WHERE id = $1 AND usuario_id = $2', [req.params.id, req.usuario.id]);
    res.status(200).json({ message: 'Revertida.' });
}));

// Rotas Gráficos
rotasProtegidas.get('/grafico/evolucao-patrimonial', asyncHandler(async (req, res) => {
    const { inicio, fim } = req.query;
    const usuarioId = req.usuario.id;
    const dataInicioObj = new Date(inicio + 'T00:00:00');
    let anoAnterior = dataInicioObj.getFullYear(), mesAnterior = dataInicioObj.getMonth();
    if (mesAnterior === 0) { mesAnterior = 12; anoAnterior--; }
    
    // Usa a função otimizada para pegar o saldo inicial
    const resumoAnterior = await calcularResumoParaMes(anoAnterior, mesAnterior, usuarioId);
    let saldoAcumulado = resumoAnterior.saldoFinalProjetado;

    const sql = `SELECT TO_CHAR(data, 'YYYY-MM') AS mes, SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) AS receitas, SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) AS despesas FROM transacoes WHERE usuario_id = $1 AND data BETWEEN $2 AND $3 GROUP BY mes ORDER BY mes`;
    const { rows } = await db.query(sql, [usuarioId, inicio, fim]);
    res.json(rows.map(item => {
        saldoAcumulado += parseFloat(item.receitas) - parseFloat(item.despesas);
        return { mes: item.mes, receitas: parseFloat(item.receitas), despesas: parseFloat(item.despesas), saldo_acumulado: saldoAcumulado };
    }));
}));

rotasProtegidas.get('/grafico/despesas-por-categoria', asyncHandler(async (req, res) => {
    const { inicio, fim } = req.query;
    const sql = `SELECT c.nome AS categoria, SUM(t.valor) AS total FROM transacoes t JOIN categorias c ON t.categoria_id = c.id WHERE t.usuario_id = $1 AND t.data BETWEEN $2 AND $3 AND t.tipo = 'despesa' AND c.analitico = TRUE GROUP BY c.nome HAVING SUM(t.valor) > 0 ORDER BY total DESC`;
    const { rows } = await db.query(sql, [req.usuario.id, inicio, fim]);
    res.json(rows);
}));

rotasProtegidas.get('/grafico/gastos-por-cartao', asyncHandler(async (req, res) => {
    const { inicio, fim } = req.query;
    const sql = `SELECT cc.nome AS cartao, SUM(t.valor) AS total FROM transacoes t JOIN cartoes_de_credito cc ON t.cartao_id = cc.id WHERE t.data BETWEEN $1 AND $2 AND t.tipo = 'despesa' AND t.usuario_id = $3 GROUP BY cc.nome HAVING SUM(t.valor) > 0 ORDER BY total DESC`;
    const { rows } = await db.query(sql, [inicio, fim, req.usuario.id]);
    res.json(rows);
}));

// --- ROTAS CONFIGURAÇÕES (MATRIZ) ---

rotasProtegidas.get('/lancamentos-fixos', asyncHandler(async (req, res) => {
    const sql = 'SELECT lf.*, c.nome as nome_categoria FROM lancamentos_fixos lf LEFT JOIN categorias c ON lf.categoria_id = c.id WHERE lf.usuario_id = $1 ORDER BY lf.tipo, lf.descricao';
    const { rows } = await db.query(sql, [req.usuario.id]);
    res.json(rows);
}));

rotasProtegidas.post('/lancamentos-fixos', asyncHandler(async (req, res) => {
    const { descricao, valor, tipo, dia_do_mes, categoria_id, data_inicio, data_fim } = req.body;
    const sql = 'INSERT INTO lancamentos_fixos (descricao, valor, tipo, dia_do_mes, categoria_id, usuario_id, data_inicio, data_fim) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id';
    const { rows } = await db.query(sql, [descricao, valor, tipo, dia_do_mes, categoria_id || null, req.usuario.id, data_inicio, data_fim || null]);
    
    // Atualiza apenas este ID novo
    await atualizarAgendaFuturaEspecifica(data_inicio, req.usuario.id, rows[0].id);
    res.status(201).json({ id: rows[0].id });
}));

rotasProtegidas.put('/lancamentos-fixos/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { descricao, valor, tipo, dia_do_mes, categoria_id, data_inicio, data_fim } = req.body;
    const usuarioId = req.usuario.id;

    // Busca descrição antiga para limpar legados
    const { rows: oldData } = await db.query('SELECT descricao FROM lancamentos_fixos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
    if (oldData.length === 0) return res.status(404).json({ message: 'Não encontrado.' });
    const descricaoAntiga = oldData[0].descricao;

    const sql = `UPDATE lancamentos_fixos SET descricao = $1, valor = $2, tipo = $3, dia_do_mes = $4, categoria_id = $5, data_inicio = $6, data_fim = $7 WHERE id = $8 AND usuario_id = $9`;
    await db.query(sql, [descricao, valor, tipo, dia_do_mes, categoria_id || null, data_inicio, data_fim || null, id, usuarioId]);

    // Regenera (com suporte a limpar órfãos pela descrição antiga)
    await atualizarAgendaFuturaEspecifica(data_inicio, usuarioId, id, descricaoAntiga);
    res.status(200).json({ message: 'Atualizado!' });
}));

rotasProtegidas.delete('/lancamentos-fixos/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const usuarioId = req.usuario.id;

    const { rows: lancamentoInfo } = await db.query('SELECT descricao FROM lancamentos_fixos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
    if (lancamentoInfo.length === 0) return res.status(404).send();
    
    const descricao = lancamentoInfo[0].descricao;
    const hoje = new Date().toISOString().split('T')[0];

    // Delete Híbrido: Apaga pelo ID ou pela Descrição (para os antigos)
    await db.query(`
        DELETE FROM transacoes 
        WHERE gerado_automaticamente = TRUE 
        AND status = 'previsto' 
        AND data >= $1 
        AND usuario_id = $2
        AND (lancamento_fixo_id = $3 OR (lancamento_fixo_id IS NULL AND descricao = $4))
    `, [hoje, usuarioId, id, descricao]);

    await db.query('DELETE FROM lancamentos_fixos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
    res.status(204).send();
}));

// Categorias e Cartões
rotasProtegidas.get('/categorias', asyncHandler(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM categorias WHERE usuario_id = $1 ORDER BY nome', [req.usuario.id]);
    res.json(rows);
}));
rotasProtegidas.post('/categorias', asyncHandler(async (req, res) => {
    const { rows } = await db.query('INSERT INTO categorias (nome, usuario_id, analitico) VALUES ($1, $2, $3) RETURNING *', [req.body.nome, req.usuario.id, req.body.analitico]);
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
    const { rows } = await db.query('INSERT INTO cartoes_de_credito (nome, usuario_id) VALUES ($1, $2) RETURNING id, nome', [req.body.nome, req.usuario.id]);
    res.status(201).json(rows[0]);
}));
rotasProtegidas.delete('/cartoes/:id', asyncHandler(async (req, res) => {
    await db.query('DELETE FROM cartoes_de_credito WHERE id = $1 AND usuario_id = $2', [req.params.id, req.usuario.id]);
    res.status(204).send();
}));

app.use('/api', rotasPublicas);
app.use('/api', rotasProtegidas);

// --- 7. HANDLER DE ERROS ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Erro interno.' });
});

// --- 8. INICIALIZAÇÃO ---
app.listen(PORT, () => {
    console.log(`Servidor Pegasus 2.0 Turbo rodando na porta ${PORT}`);
});
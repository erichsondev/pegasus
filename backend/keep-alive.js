// Arquivo: keep-alive.js
require('dotenv').config();
const { Pool } = require('pg');

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function pingDatabase() {
    console.log('Iniciando ping no banco de dados para mantê-lo ativo...');
    const client = await db.connect();
    try {
        // Uma consulta simples que não faz nada, apenas "usa" o banco.
        const result = await client.query('SELECT 1;');
        console.log('Ping bem-sucedido! Resultado:', result.rows[0]);
        console.log('O banco de dados permanecerá ativo. Contador de 90 dias resetado.');
    } catch (err) {
        console.error('ERRO ao pingar o banco de dados:', err.stack);
    } finally {
        await client.release();
        await db.end();
    }
}

pingDatabase();
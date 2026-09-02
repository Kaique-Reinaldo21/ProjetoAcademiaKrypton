// db/seed.js — seed atualizado com data_nascimento e unidade_id
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, inicializarBanco } = require('./database');

async function seed() {
  console.log('🌱 Populando banco de dados...\n');
  await inicializarBanco();

  const conn = await pool.getConnection();
  try {
    const [[u1]] = await conn.query('SELECT id FROM unidades WHERE nome LIKE "%Centro%" LIMIT 1');

    const usuarios = [
      { nome: 'João Silva',  email: 'joao@exemplo.com',  senha: '123456', nasc: '2000-03-15', plano: { tipo: 'pro',    ativo: 1, vencimento: '2025-12-31', unidade_id: null } },
      { nome: 'Maria Souza', email: 'maria@exemplo.com', senha: '123456', nasc: '1995-07-22', plano: { tipo: 'elite',  ativo: 1, vencimento: null,         unidade_id: null } },
      { nome: 'Carlos Lima', email: 'carlos@exemplo.com',senha: '123456', nasc: '2008-01-10', plano: { tipo: 'basico', ativo: 0, vencimento: '2024-01-01', unidade_id: u1?.id || 1 } },
    ];

    for (const u of usuarios) {
      const hash = await bcrypt.hash(u.senha, 10);
      const [r] = await conn.query(
        'INSERT IGNORE INTO usuarios (nome, email, senha_hash, data_nascimento) VALUES (?, ?, ?, ?)',
        [u.nome, u.email, hash, u.nasc]
      );

      let uid = r.insertId;
      if (!uid) {
        const [[ex]] = await conn.query('SELECT id FROM usuarios WHERE email = ?', [u.email]);
        uid = ex.id;
      }

      const [[pExiste]] = await conn.query('SELECT id FROM planos WHERE usuario_id = ? LIMIT 1', [uid]);
      if (!pExiste) {
        await conn.query(
          'INSERT INTO planos (usuario_id, tipo, ativo, vencimento, unidade_id) VALUES (?, ?, ?, ?, ?)',
          [uid, u.plano.tipo, u.plano.ativo, u.plano.vencimento, u.plano.unidade_id]
        );
      }
      console.log(`  ✅ ${u.nome} — plano ${u.plano.tipo} | nascimento: ${u.nasc}`);
    }

    console.log('\n🎉 Seed concluído! Senha de todos: 123456');
  } finally {
    conn.release();
    await pool.end();
  }
  process.exit(0);
}

seed().catch(err => { console.error('❌ Erro:', err.message); process.exit(1); });

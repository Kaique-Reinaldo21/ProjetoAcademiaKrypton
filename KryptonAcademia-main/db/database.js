// db/database.js — conexão MySQL + schema atualizado conforme RN e RF

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  port:             process.env.DB_PORT     || 3306,
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'academia_kripton',
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0,
  timezone:         '-03:00',
});

async function inicializarBanco() {
  const conn = await pool.getConnection();
  try {

    // ── Usuários 
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id               INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
        nome             VARCHAR(120)  NOT NULL,
        email            VARCHAR(180)  NOT NULL UNIQUE,
        senha_hash       VARCHAR(255)  NOT NULL,
        data_nascimento  DATE          NOT NULL,
        created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ── Planos
    await conn.query(`
      CREATE TABLE IF NOT EXISTS planos (
        id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
        usuario_id  INT UNSIGNED  NOT NULL,
        tipo        ENUM('basico','pro','elite') NOT NULL,
        ativo       TINYINT(1)    NOT NULL DEFAULT 1,
        unidade_id  INT UNSIGNED  NULL,
        inicio      DATE          NOT NULL DEFAULT (CURDATE()),
        vencimento  DATE          NULL,
        updated_at  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        INDEX idx_usuario (usuario_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ── Unidades
    await conn.query(`
      CREATE TABLE IF NOT EXISTS unidades (
        id        INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
        nome      VARCHAR(120)  NOT NULL,
        endereco  VARCHAR(255)  NOT NULL,
        cidade    VARCHAR(80)   NOT NULL,
        telefone  VARCHAR(20),
        horario   VARCHAR(80)   DEFAULT 'Seg–Sex 06h–22h | Sáb 08h–18h'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ── Agendamentos 
    await conn.query(`
      CREATE TABLE IF NOT EXISTS agendamentos (
        id           INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
        usuario_id   INT UNSIGNED  NOT NULL,
        tipo         ENUM('nutricionista','personal') NOT NULL,
        data_hora    DATETIME      NOT NULL,
        observacao   TEXT,
        created_at   DATETIME      DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        INDEX idx_usuario_ag (usuario_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ── Seed de unidades
    const [[count]] = await conn.query('SELECT COUNT(*) as total FROM unidades');
    if (count.total === 0) {
      await conn.query(`
        INSERT INTO unidades (nome, endereco, cidade, telefone) VALUES
        ('Unidade Centro',       'Av. Paulista, 1000 — Centro',       'São Paulo', '(11) 3000-0001'),
        ('Unidade Zona Leste',   'Rua do Tatuapé, 450 — Tatuapé',     'São Paulo', '(11) 3000-0002'),
        ('Unidade Vila Madalena','Rua Harmonia, 200 — Vila Madalena',  'São Paulo', '(11) 3000-0003')
      `);
    }

    console.log('✅ Banco de dados MySQL conectado.');
  } finally {
    conn.release();
  }
}

module.exports = { pool, inicializarBanco };

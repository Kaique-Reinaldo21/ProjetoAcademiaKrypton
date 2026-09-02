// routes/admin.js

const express = require('express');
const { pool } = require('../db/database');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

const router = express.Router();

// Todas as rotas deste arquivo exigem login + admin
router.use(authMiddleware);
router.use(adminMiddleware);


// Preços atuais dos planos
const PRECOS = {
  basico: 89,
  pro: 149,
  elite: 249
};


// ─────────────────────────────────────────────
// GET /api/admin/resumo
// ─────────────────────────────────────────────

router.get('/resumo', async (req, res) => {
  const conn = await pool.getConnection();

  try {

    // Total de alunos
    const [[totalAlunos]] = await conn.query(`
      SELECT COUNT(*) AS total
      FROM usuarios
      WHERE role = 'aluno'
    `);


    // Planos ativos por tipo
    const [planos] = await conn.query(`
      SELECT
        p.tipo,
        COUNT(*) AS quantidade
      FROM planos p
      INNER JOIN usuarios u
        ON u.id = p.usuario_id
      WHERE
        u.role = 'aluno'
        AND p.ativo = 1
        AND (
          p.vencimento IS NULL
          OR p.vencimento >= CURDATE()
        )
      GROUP BY p.tipo
    `);


    let planosAtivos = 0;
    let receitaEstimada = 0;

    const planosPorTipo = planos.map(plano => {

      const quantidade = Number(plano.quantidade);

      const valorEstimado =
        quantidade * PRECOS[plano.tipo];

      planosAtivos += quantidade;
      receitaEstimada += valorEstimado;

      return {
        tipo: plano.tipo,
        quantidade,
        valor_estimado: valorEstimado
      };
    });


    // Logins realizados hoje
    const [[loginsHoje]] = await conn.query(`
      SELECT COUNT(*) AS total
      FROM historico_logins
      WHERE DATE(data_login) = CURDATE()
    `);


    return res.json({

      total_alunos: Number(totalAlunos.total),

      planos_ativos: planosAtivos,

      logins_hoje: Number(loginsHoje.total),

      receita_estimada: receitaEstimada,

      planos_por_tipo: planosPorTipo,

      precos: PRECOS

    });


  } catch (err) {

    console.error(
      'Erro ao carregar resumo administrativo:',
      err
    );

    return res.status(500).json({
      erro: 'Erro ao carregar dados administrativos.'
    });

  } finally {

    conn.release();

  }
});


// ─────────────────────────────────────────────
// GET /api/admin/alunos
// ─────────────────────────────────────────────

router.get('/alunos', async (req, res) => {

  const conn = await pool.getConnection();

  try {

    const [alunos] = await conn.query(`
      SELECT
        u.id,
        u.nome,
        u.email,
        u.created_at,

        p.tipo AS plano,
        p.ativo,
        p.vencimento

      FROM usuarios u

      LEFT JOIN planos p
        ON p.usuario_id = u.id

      WHERE u.role = 'aluno'

      ORDER BY u.created_at DESC

      LIMIT 10
    `);

    return res.json({
      alunos
    });

  } catch (err) {

    console.error(
      'Erro ao listar alunos:',
      err
    );

    return res.status(500).json({
      erro: 'Erro ao carregar alunos.'
    });

  } finally {

    conn.release();

  }

});


// ─────────────────────────────────────────────
// GET /api/admin/logins
// ─────────────────────────────────────────────

router.get('/logins', async (req, res) => {

  const conn = await pool.getConnection();

  try {

    const [logins] = await conn.query(`
      SELECT
        h.id,
        h.data_login,
        h.ip,
        h.user_agent,

        u.nome,
        u.email,
        u.role

      FROM historico_logins h

      INNER JOIN usuarios u
        ON u.id = h.usuario_id

      ORDER BY h.data_login DESC

      LIMIT 15
    `);

    return res.json({
      logins
    });

  } catch (err) {

    console.error(
      'Erro ao buscar histórico de login:',
      err
    );

    return res.status(500).json({
      erro: 'Erro ao carregar histórico de login.'
    });

  } finally {

    conn.release();

  }

});

router.get('/agendamentos-proximos', async (req, res) => {

  const conn = await pool.getConnection();

  try {

    const [agendamentos] = await conn.query(`
      SELECT
        a.id,
        a.tipo,
        a.data_hora,
        a.observacao,
        u.nome,
        u.email

      FROM agendamentos a

      INNER JOIN usuarios u
        ON u.id = a.usuario_id

      WHERE a.data_hora >= NOW()

      ORDER BY a.data_hora ASC

      LIMIT 6
    `);

    return res.json({
      agendamentos
    });

  } catch (err) {

    console.error(
      'Erro ao carregar agendamentos:',
      err
    );

    return res.status(500).json({
      erro: 'Erro ao carregar agendamentos.'
    });

  } finally {
    conn.release();
  }

});

router.get('/vencimentos', async (req, res) => {

  const conn = await pool.getConnection();

  try {

    const [vencimentos] = await conn.query(`
      SELECT
        u.nome,
        u.email,
        p.tipo,
        p.vencimento

      FROM planos p

      INNER JOIN usuarios u
        ON u.id = p.usuario_id

      WHERE
        u.role = 'aluno'
        AND p.ativo = 1
        AND p.vencimento IS NOT NULL
        AND p.vencimento BETWEEN
          CURDATE()
          AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)

      ORDER BY p.vencimento ASC

      LIMIT 6
    `);

    return res.json({
      vencimentos
    });

  } catch (err) {

    console.error(
      'Erro ao carregar vencimentos:',
      err
    );

    return res.status(500).json({
      erro: 'Erro ao carregar vencimentos.'
    });

  } finally {
    conn.release();
  }

});

router.get('/cadastros-semana', async (req, res) => {

  const conn = await pool.getConnection();

  try {

    const [cadastros] = await conn.query(`
      SELECT
        DATE(created_at) AS data,
        COUNT(*) AS quantidade

      FROM usuarios

      WHERE
        role = 'aluno'
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)

      GROUP BY DATE(created_at)

      ORDER BY data ASC
    `);

    return res.json({
      cadastros
    });

  } catch (err) {

    console.error(
      'Erro ao carregar cadastros:',
      err
    );

    return res.status(500).json({
      erro: 'Erro ao carregar cadastros.'
    });

  } finally {
    conn.release();
  }

});


module.exports = router;
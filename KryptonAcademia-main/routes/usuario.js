// routes/usuario.js

const express = require('express');
const { pool } = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ─── Dados por plano 

const PLANOS_INFO = {
  basico: {
    nome: 'Básico',
    beneficios: ['Acesso a 1 unidade exclusiva', 'Musculação completa', 'Área de cardio'],
    mostra_unidade: true,
    mostra_todas_unidades: false,
    mostra_agendamento: false,
  },
  pro: {
    nome: 'Pro',
    beneficios: ['Acesso a todas as unidades', 'Musculação e cardio ilimitados', 'Lutas e artes marciais', 'Quadras esportivas'],
    mostra_unidade: false,
    mostra_todas_unidades: true,
    mostra_agendamento: false,
  },
  elite: {
    nome: 'Elite',
    beneficios: ['Acesso a todas as unidades', 'Musculação, cardio e lutas', 'Quadras esportivas', 'Consultas com Nutricionista', 'Treinos com Personal Trainer'],
    mostra_unidade: false,
    mostra_todas_unidades: true,
    mostra_agendamento: true,
  },
};

// GET /api/usuario/perfil

router.get('/perfil', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [[usuario]] = await conn.query(
      'SELECT id, nome, email, data_nascimento, created_at FROM usuarios WHERE id = ?',
      [req.usuario.id]
    );
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    return res.json({ usuario });
  } finally { conn.release(); }
});

// GET /api/usuario/unidades 

router.get('/unidades', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [unidades] = await conn.query(
      'SELECT id, nome, endereco, cidade, telefone, horario FROM unidades ORDER BY id'
    );
    return res.json({ unidades });
  } finally { conn.release(); }
});

// POST /api/usuario/assinar-plano 
// Chamado após o cadastro, na tela de escolha de plano

router.post('/assinar-plano', async (req, res) => {
  const { tipo, unidade_id } = req.body;
  const tiposValidos = ['basico', 'pro', 'elite'];

  if (!tipo || !tiposValidos.includes(tipo))
    return res.status(400).json({ erro: 'Tipo de plano inválido.' });

  // Basic exige unidade
  if (tipo === 'basico' && !unidade_id)
    return res.status(400).json({ erro: 'Selecione uma unidade para o plano Básico.' });

  const conn = await pool.getConnection();
  try {
    // Verifica se já tem plano ativo (RN02)
    const [[planoAtivo]] = await conn.query(
      'SELECT id FROM planos WHERE usuario_id = ? AND ativo = 1 LIMIT 1',
      [req.usuario.id]
    );
    if (planoAtivo)
      return res.status(409).json({ erro: 'Você já possui um plano ativo.' });

    // Define vencimento: 30 dias a partir de hoje
    const vencimento = new Date();
    vencimento.setDate(vencimento.getDate() + 30);
    const vencStr = vencimento.toISOString().slice(0, 10);

    // Atualiza o plano existente (criado no cadastro com ativo=0)
    await conn.query(`
      UPDATE planos
      SET tipo = ?, ativo = 1, unidade_id = ?, vencimento = ?, inicio = CURDATE()
      WHERE usuario_id = ?
      ORDER BY id DESC LIMIT 1
    `, [tipo, tipo === 'basico' ? unidade_id : null, vencStr, req.usuario.id]);

    return res.json({ mensagem: 'Plano ativado com sucesso!', vencimento: vencStr });
  } finally { conn.release(); }
});

// GET /api/usuario/plano 

router.get('/plano', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [[plano]] = await conn.query(`
      SELECT p.id, p.tipo, p.ativo, p.inicio, p.vencimento, p.unidade_id,
             u.nome AS unidade_nome, u.endereco AS unidade_endereco,
             u.cidade AS unidade_cidade, u.telefone AS unidade_telefone,
             u.horario AS unidade_horario
      FROM planos p
      LEFT JOIN unidades u ON u.id = p.unidade_id
      WHERE p.usuario_id = ?
      ORDER BY p.id DESC LIMIT 1
    `, [req.usuario.id]);

    if (!plano) return res.status(404).json({ erro: 'Nenhum plano encontrado.' });

    // Checa vencimento
    let status = 'ativo';
    if (!plano.ativo) {
      status = 'inativo';
    } else if (plano.vencimento && new Date(plano.vencimento) < new Date()) {
      status = 'vencido';
      await conn.query('UPDATE planos SET ativo = 0 WHERE id = ?', [plano.id]);
    }

    const info = PLANOS_INFO[plano.tipo];
    const fmt  = d => d ? new Date(d).toISOString().slice(0, 10) : null;

    // Pro e Elite: busca todas as unidades
    let todasUnidades = [];
    if (info.mostra_todas_unidades) {
      const [rows] = await conn.query(
        'SELECT id, nome, endereco, cidade, telefone, horario FROM unidades ORDER BY id'
      );
      todasUnidades = rows;
    }

    return res.json({
      plano: {
        tipo:                 plano.tipo,
        nome:                 info.nome,
        status,
        inicio:               fmt(plano.inicio),
        vencimento:           fmt(plano.vencimento),
        beneficios:           info.beneficios,
        mostra_agendamento:   info.mostra_agendamento,
        mostra_todas_unidades: info.mostra_todas_unidades,
        // Basic: unidade vinculada
        unidade: info.mostra_unidade && plano.unidade_id ? {
          nome:     plano.unidade_nome,
          endereco: plano.unidade_endereco,
          cidade:   plano.unidade_cidade,
          telefone: plano.unidade_telefone,
          horario:  plano.unidade_horario,
        } : null,
        // Pro / Elite: todas as unidades
        todas_unidades: todasUnidades,
      },
    });
  } finally { conn.release(); }
});

// ─── POST /api/usuario/agendamento (Elite) ────────────────────────────────────

router.post('/agendamento', async (req, res) => {
  const { tipo, data_hora, observacao } = req.body;
  if (!tipo || !data_hora)
    return res.status(400).json({ erro: 'Tipo e data/hora são obrigatórios.' });
  if (!['nutricionista', 'personal'].includes(tipo))
    return res.status(400).json({ erro: 'Tipo inválido.' });

  const conn = await pool.getConnection();
  try {
    const [[plano]] = await conn.query(
      'SELECT tipo, ativo, vencimento FROM planos WHERE usuario_id = ? ORDER BY id DESC LIMIT 1',
      [req.usuario.id]
    );
    if (!plano || plano.tipo !== 'elite' || !plano.ativo)
      return res.status(403).json({ erro: 'Agendamentos são exclusivos para alunos com plano Elite ativo.' });

    await conn.query(
      'INSERT INTO agendamentos (usuario_id, tipo, data_hora, observacao) VALUES (?, ?, ?, ?)',
      [req.usuario.id, tipo, data_hora, observacao || null]
    );
    return res.status(201).json({ mensagem: `Agendamento de ${tipo} realizado com sucesso!` });
  } finally { conn.release(); }
});

// GET /api/usuario/agendamentos

router.get('/agendamentos', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [agendamentos] = await conn.query(
      'SELECT id, tipo, data_hora, observacao FROM agendamentos WHERE usuario_id = ? ORDER BY data_hora ASC',
      [req.usuario.id]
    );
    return res.json({ agendamentos });
  } finally { conn.release(); }
});

// PUT /api/usuario/:id/plano (admin) 

router.put('/:id/plano', async (req, res) => {
  const { tipo, ativo, vencimento, unidade_id } = req.body;
  const tiposValidos = ['basico', 'pro', 'elite'];
  if (tipo && !tiposValidos.includes(tipo))
    return res.status(400).json({ erro: 'Tipo de plano inválido.' });

  const conn = await pool.getConnection();
  try {
    const [[planoAtual]] = await conn.query(
      'SELECT id FROM planos WHERE usuario_id = ? ORDER BY id DESC LIMIT 1',
      [req.params.id]
    );
    if (!planoAtual) return res.status(404).json({ erro: 'Plano não encontrado.' });

    await conn.query(`
      UPDATE planos
      SET tipo = COALESCE(?, tipo), ativo = COALESCE(?, ativo),
          vencimento = COALESCE(?, vencimento), unidade_id = COALESCE(?, unidade_id)
      WHERE id = ?
    `, [tipo ?? null, ativo ?? null, vencimento ?? null, unidade_id ?? null, planoAtual.id]);

    return res.json({ mensagem: 'Plano atualizado com sucesso.' });
  } finally { conn.release(); }
});

module.exports = router;

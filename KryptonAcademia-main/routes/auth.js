// routes/auth.js — cadastro e login com validações RN01, RN02, RN03

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { pool } = require('../db/database');

const router      = express.Router();
const SALT_ROUNDS = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function setCookieToken(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });
}

// calcula idade a partir da data de nascimento
function calcularIdade(dataNasc) {
  const hoje  = new Date();
  const nasc  = new Date(dataNasc);
  let idade   = hoje.getFullYear() - nasc.getFullYear();
  const mes   = hoje.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

// POST /api/auth/cadastro

router.post('/cadastro', async (req, res) => {
  const { nome, email, senha, data_nascimento } = req.body;

  // Validação de campos obrigatórios
  if (!nome || !email || !senha || !data_nascimento)
    return res.status(400).json({ erro: 'Nome, e-mail, senha e data de nascimento são obrigatórios.' });

  if (senha.length < 6)
    return res.status(400).json({ erro: 'A senha deve ter no mínimo 6 caracteres.' });

  // Idade mínima de 14 anos
  const idade = calcularIdade(data_nascimento);
  if (isNaN(idade) || idade < 14)
    return res.status(400).json({ erro: 'É necessário ter pelo menos 14 anos para criar uma conta.' });

  const conn = await pool.getConnection();
  try {
    // Verifica e-mail duplicado
    const [[existe]] = await conn.query(
      'SELECT id FROM usuarios WHERE email = ?', [email]
    );
    if (existe)
      return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });

    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

    const [result] = await conn.query(
      'INSERT INTO usuarios (nome, email, senha_hash, data_nascimento) VALUES (?, ?, ?, ?)',
      [nome, email, senhaHash, data_nascimento]
    );

    
    // Registra plano com ativo=0 para indicar que é visitante/sem plano
    await conn.query(
      "INSERT INTO planos (usuario_id, tipo, ativo) VALUES (?, 'basico', 0)",
      [result.insertId]
    );

    const novoUsuario = { id: result.insertId, nome, email };
    const token = gerarToken(novoUsuario);
    setCookieToken(res, token);

    return res.status(201).json({
      mensagem: 'Conta criada com sucesso!',
      token,
      usuario: novoUsuario,
    });
  } catch (err) {
    console.error('Erro no cadastro:', err);
    return res.status(500).json({ erro: 'Erro interno. Tente novamente.' });
  } finally {
    conn.release();
  }
});

// POST /api/auth/login 

router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha)
    return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });

  const conn = await pool.getConnection();
  try {
    const [[usuario]] = await conn.query(
      'SELECT id, nome, email, senha_hash FROM usuarios WHERE email = ?',
      [email]
    );

    if (!usuario)
      return res.status(401).json({ erro: 'Credenciais inválidas.' });

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta)
      return res.status(401).json({ erro: 'Credenciais inválidas.' });

    const token = gerarToken(usuario);
    setCookieToken(res, token);

    return res.json({
      mensagem: 'Login realizado com sucesso!',
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
    });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ erro: 'Erro interno. Tente novamente.' });
  } finally {
    conn.release();
  }
});

// POST /api/auth/logout

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ mensagem: 'Logout realizado.' });
});

module.exports = router;

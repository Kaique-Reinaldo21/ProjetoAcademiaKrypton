import prisma from '../lib/prisma.js';
import { diagnosticarInicializacao } from '../lib/diagnostico-inicializacao.js';
import * as authService from '../services/auth.service.js';

// Duração padrão da sessão: 7 dias em milissegundos
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────
// Login tradicional
// ─────────────────────────────────────────
export async function login(req, res) {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({
        erro: 'E-mail e senha são obrigatórios',
      });
    }

    const resultado = await authService.login(
      email,
      senha
    );

    await authService.registrarLogin(
      resultado.usuario.id,
      req.ip,
      req.get('user-agent')
    );

    res.cookie('token', resultado.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SETE_DIAS_MS,
    });

    return res.status(200).json({
      mensagem: 'Login realizado com sucesso',
      token: resultado.token,
      usuario: resultado.usuario,
    });

  } catch (error) {
    const mensagens = ['E-mail ou senha inválidos', 'Esta conta foi cadastrada com o Google. Use o botão "Entrar com o Google".', 'Redefina sua senha pelo e-mail para voltar a entrar.'];
    return res.status(401).json({
      erro: mensagens.includes(error.message) ? error.message : 'E-mail ou senha inválidos',
    });
  }
}

// ─────────────────────────────────────────
// Cadastro
// ─────────────────────────────────────────
export async function cadastrar(req, res) {
  try {
    const {
      nome,
      email,
      senha,
      data_nascimento,
    } = req.body;

    if (!nome || !email || !senha || !data_nascimento) {
      return res.status(400).json({
        erro: 'Preencha todos os campos obrigatórios',
      });
    }

    const resultado = await authService.cadastrar({
      nome,
      email,
      senha,
      data_nascimento,
    });

    res.cookie('token', resultado.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SETE_DIAS_MS,
    });

    return res.status(201).json({
      mensagem: 'Usuário cadastrado com sucesso',
      token: resultado.token,
      usuario: resultado.usuario,
    });

  } catch (error) {
    const validacao = ['E-mail já cadastrado', 'Use pelo menos 6 caracteres.', 'A senha pode ter até 72 bytes em UTF-8.'];
    return res.status(400).json({
      erro: validacao.includes(error.message) ? error.message : 'Não foi possível concluir o cadastro.',
    });
  }
}


// ─────────────────────────────────────────
// Logout
// ─────────────────────────────────────────
export function logout(req, res) {
  res.clearCookie('token');
  res.clearCookie('connect.sid');
  return res.json({ mensagem: 'Logout realizado com sucesso' });
}

// ─────────────────────────────────────────
// Callback do Google OAuth
// ─────────────────────────────────────────
export async function googleCallback(req, res, vinculo = false) {
  try {
    const usuario = req.user;
    if (usuario?.role !== 'aluno' || !usuario.google_sub) throw new Error('Identidade Google inválida.');
    const token = authService.gerarToken(usuario);
    const userId = usuario.id;
    await authService.registrarLogin(userId, req.ip, req.get('user-agent'));

    let destino = '/configuracoes-conta.html?google=vinculado';
    if (!vinculo) {
      const plano = await prisma.planos.findFirst({ where: { usuario_id: userId, ativo: true } });
      destino = plano ? '/dashboard.html' : '/escolher-plano.html';
    }

    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    res.cookie('token', token, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: SETE_DIAS_MS,
    });
    const usuarioFront = { id: userId, nome: usuario.nome, email: usuario.email, role: usuario.role };

    return res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Autenticando...</title>
  <link rel="icon" href="/logo.png">
</head>
<body style="background:#0a0a0a;color:#2dff7a;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
  <p>Autenticando com Google...</p>
  <script>
    try {
      localStorage.setItem('token', ${JSON.stringify(token)});
      localStorage.setItem('usuario', JSON.stringify(${JSON.stringify(usuarioFront).replaceAll('<', '\\u003c')}));
    } catch {}
    window.location.href = ${JSON.stringify(destino)};
  </script>
</body>
</html>`);

  } catch (error) {
    console.error('Falha ao concluir login com Google:', diagnosticarInicializacao(error));
    const mensagem = req.user?.senha_redefinicao_obrigatoria
      ? 'Redefina sua senha pelo e-mail para voltar a entrar.'
      : 'Não foi possível concluir o login com Google.';
    return res.redirect('/login.html?tab=cadastro&erro=' + encodeURIComponent(mensagem));
  }
}

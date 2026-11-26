import prisma from '../lib/prisma.js';
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
    const validacao = ['E-mail já cadastrado', 'Use pelo menos 12 caracteres.', 'A senha pode ter até 72 bytes em UTF-8.'];
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
export async function googleCallback(req, res) {
  try {
    if (!req.user) {
      return res.redirect('/login.html?tab=cadastro&erro=' + encodeURIComponent('Falha ao autenticar com o Google.'));
    }

    const userId = Number(req.user.id);

    try {
      await authService.registrarLogin(
        userId,
        req.ip,
        req.get('user-agent')
      );
    } catch (logErr) {
      console.warn('Aviso: falha ao registrar login:', logErr.message);
    }

    const token = authService.gerarToken(req.user);

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SETE_DIAS_MS,
    });

    const usuarioFront = {
      id: userId,
      nome: req.user.nome,
      email: req.user.email,
      role: req.user.role || 'aluno',
    };

    let destino = '/dashboard.html';
    if (req.user.role === 'admin') {
      destino = '/admin.html';
    } else {
      try {
        const planoAtivo = await prisma.planos.findFirst({
          where: {
            usuario_id: userId,
            ativo: true,
          },
        });

        if (!planoAtivo) {
          destino = '/escolher-plano.html';
        }
      } catch (planoErr) {
        console.warn('Aviso ao consultar plano:', planoErr.message);
      }
    }

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
    } catch (e) {
      console.error('Erro ao salvar dados de autenticação:', e);
    }
    window.location.href = ${JSON.stringify(destino)};
  </script>
</body>
</html>`);

  } catch (error) {
    console.error('Falha ao concluir login com Google.');
    const mensagem = req.user?.senha_redefinicao_obrigatoria
      ? 'Redefina sua senha pelo e-mail para voltar a entrar.'
      : 'Não foi possível concluir o login com Google.';
    return res.redirect('/login.html?tab=cadastro&erro=' + encodeURIComponent(mensagem));
  }
}

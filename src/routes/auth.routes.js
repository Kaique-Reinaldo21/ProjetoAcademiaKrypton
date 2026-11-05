import express from 'express';
import passport from 'passport';
import prisma from '../lib/prisma.js';
import authMiddleware from '../middleware/auth.js';

import {
  login,
  cadastrar,
  logout,
  googleCallback,
} from '../controllers/auth.controller.js';


const router = express.Router();


// Login tradicional
router.post(
  '/login',
  login
);


// Cadastro
router.post(
  '/cadastro',
  cadastrar
);


// Logout
router.post(
  '/logout',
  logout
);

// Obter dados da sessão atual
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const usuario = await prisma.usuarios.findUnique({
      where: { id: Number(req.usuario.id) },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    return res.json({ usuario });
  } catch (error) {
    return res.status(500).json({ erro: 'Erro ao validar sessão.' });
  }
});


// ─────────────────────────────
// Google OAuth
// ─────────────────────────────

router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(
      '/login.html?tab=cadastro&erro=' +
        encodeURIComponent('Google OAuth ainda não foi configurado no servidor (.env).')
    );
  }

  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })(req, res, next);
});


router.get(
  ['/google/callback', '/callback/google'],
  (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.redirect(
        '/login.html?tab=cadastro&erro=' +
          encodeURIComponent('Google OAuth não configurado.')
      );
    }

    passport.authenticate('google', {
      session: true,
      failureRedirect:
        '/login.html?tab=cadastro&erro=' +
        encodeURIComponent('Falha na autenticação com Google.'),
    })(req, res, next);
  },
  googleCallback
);


export default router;

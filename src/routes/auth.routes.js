import express from 'express';
import { criarRotasGoogle } from './google-oauth.routes.js';
import { googleConfigurado } from '../config/passport.js';
import prisma from '../lib/prisma.js';
import { criarRotasContas } from './contas.routes.js';
import authMiddleware from '../middleware/auth.js';

import {
  login,
  cadastrar,
  logout,
} from '../controllers/auth.controller.js';


const router = express.Router();
router.use(criarRotasContas());
router.use(criarRotasGoogle());


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
        senha_hash: true,
        google_sub: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    const { senha_hash, google_sub, ...dados } = usuario;
    return res.json({ usuario: {
      ...dados, possuiSenhaLocal: Boolean(senha_hash),
      podeVincularGoogle: googleConfigurado && dados.role === 'aluno' && Boolean(senha_hash) && !google_sub,
    } });
  } catch (error) {
    return res.status(500).json({ erro: 'Erro ao validar sessão.' });
  }
});


export default router;

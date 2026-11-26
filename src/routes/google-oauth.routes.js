import express from 'express';
import passport from 'passport';
import { googleConfigurado } from '../config/passport.js';
import { googleCallback } from '../controllers/auth.controller.js';
import { diagnosticarInicializacao } from '../lib/diagnostico-inicializacao.js';
import authMiddleware from '../middleware/auth.js';
import { criarServicoContas, ErroConta } from '../services/contas.service.js';
import { criarServicoGoogle, validadeEstadoGoogle } from '../services/google-oauth.service.js';

export function criarRotasGoogle({
  autenticador = passport, habilitado = googleConfigurado, servico = criarServicoGoogle(),
  limitar = criarServicoContas().limitar,
} = {}) {
  const router = express.Router();
  const seguro = process.env.NODE_ENV === 'production';
  const cookie = seguro ? '__Host-krypton-google' : 'krypton-google';
  const opcoes = { path: '/', sameSite: 'lax', httpOnly: true, secure: seguro };
  const login = '/login.html?erro=';

  router.use(['/google', '/callback/google'], (_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    if (!habilitado) return res.redirect(login + encodeURIComponent('Google OAuth indisponível.'));
    next();
  });

  function falhar(res, erro, vinculo = false) {
    if (erro && !(erro instanceof ErroConta)) {
      console.error('Falha no Google OAuth:', diagnosticarInicializacao(erro));
    }
    const destino = vinculo ? '/configuracoes-conta.html?google=falha' :
      login + encodeURIComponent('Use seu login habitual. Para vincular o Google, acesse as configurações da conta.');
    return res.redirect(303, destino);
  }

  async function iniciar(req, res, vinculo) {
    try {
      const { state, navegador } = await servico.emitirEstado(vinculo);
      res.cookie(cookie, navegador, { ...opcoes, maxAge: validadeEstadoGoogle });
      return autenticador.authenticate('google', {
        session: false, state, scope: ['openid', 'email', 'profile'],
      })(req, res, erro => falhar(res, erro, Boolean(vinculo)));
    } catch (erro) {
      return falhar(res, erro, Boolean(vinculo));
    }
  }

  router.get('/google', async (req, res) => {
    if (req.query.code !== undefined || req.query.error !== undefined) return falhar(res);
    try {
      await limitar('google-iniciar-ip', req.ip, 30);
      return iniciar(req, res);
    } catch (erro) {
      return falhar(res, erro);
    }
  });

  router.post('/google/vincular', authMiddleware, async (req, res) => {
    try {
      if (req.get('Origin') !== `${req.protocol}://${req.get('host')}` ||
          !req.is('application/x-www-form-urlencoded')) return falhar(res, null, true);
      await limitar('google-vincular-conta', req.usuario.id, 8);
      const vinculo = await servico.prepararVinculo(req.usuario, req.body?.senhaGoogle);
      return iniciar(req, res, vinculo);
    } catch (erro) {
      return falhar(res, erro, true);
    }
  });

  router.get(['/google/callback', '/callback/google'], async (req, res) => {
    let vinculo = false;
    try {
      const estado = await servico.consumirEstado(req.query.state, req.cookies?.[cookie]);
      if (!estado) return falhar(res);
      res.clearCookie(cookie, opcoes);
      vinculo = estado.usuario_id !== null;
      if (typeof req.query.code !== 'string' || !req.query.code || req.query.error !== undefined) {
        return falhar(res, null, vinculo);
      }
      return autenticador.authenticate('google', { session: false }, async (erro, perfil) => {
        if (erro || !perfil) return falhar(res, erro, vinculo);
        try {
          req.user = await servico.autenticar(perfil, estado);
          return googleCallback(req, res, vinculo);
        } catch (falha) {
          return falhar(res, falha, vinculo);
        }
      })(req, res, erro => falhar(res, erro, vinculo));
    } catch (erro) {
      return falhar(res, erro, vinculo);
    }
  });

  return router;
}

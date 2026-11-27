import express from 'express';
import QRCode from 'qrcode';
import prisma from '../lib/prisma.js';
import { emTesteMercadoPago, validarBancoTesteMercadoPago, validarPagadorTeste } from '../config/mercadopago-teste.js';
import { validarConfiguracaoCheckout } from '../gatewary/mercadopago.js';
import { checkoutMetodos } from '../services/checkout-metodos.service.js';
import { fileURLToPath } from 'node:url';
import authMiddleware from '../middleware/auth.js';
import { servicoDemo, validarSimuladorCheckout } from '../services/checkout-demo.service.js';
import { ErroGatewayCheckout } from '../gatewary/erros-checkout.js';
import {
  iniciarCheckout,
  consultarCheckout,
  ErroCheckout,
} from '../services/checkout.service.js';

const router = express.Router();

function erroCheckout(res, error) {
  if (error instanceof ErroCheckout) {
    console.error('Falha no checkout:', 'validacao', error.status);
    return res.status(error.status).json({ erro: error.message });
  }
  if (error instanceof ErroGatewayCheckout) {
    console.error('Falha no checkout:', error.codigo);
    return res.status(503).json({ erro: error.message });
  }
  console.error('Falha no checkout: erro interno ou banco indisponível');
  return res.status(502).json({ erro: 'Não foi possível processar o checkout. Se uma tentativa foi iniciada, entre em contato com o suporte antes de tentar novamente.' });
}

export function criarRotasQrDemo(servico = servicoDemo, validar = validarSimuladorCheckout) {
  const qr = express.Router();
  qr.use((req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Content-Security-Policy': "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    });
    next();
  });
  qr.get('/', (req, res) => {
    try {
      validar();
      if (/prefetch|prerender|preview/i.test([req.get('Sec-Purpose'), req.get('Purpose')].join(' '))) {
        return res.sendStatus(204);
      }
      return res.sendFile(fileURLToPath(new URL('../views/checkout-qr.html', import.meta.url)));
    } catch (error) { return erroCheckout(res, error); }
  });
  qr.post('/', async (req, res) => {
    try {
      validar();
      if (!req.is('application/json') || req.get('Origin') !== `${req.protocol}://${req.get('host')}`) {
        return res.status(403).json({ erro: 'Abra o código no navegador do celular.' });
      }
      return res.json(await servico.confirmarQr(req.body?.tentativa, req.body?.token));
    } catch (error) { return erroCheckout(res, error); }
  });
  return qr;
}

router.use(authMiddleware);
router.post('/', async (req, res) => {
  try {
    const { tipoPlano, unidade_id, escolherMetodo, metodo } = req.body || {};
    const teste = emTesteMercadoPago();
    if (teste) validarBancoTesteMercadoPago();
    const demo = process.env.PAYMENT_MODE === 'demo' || teste;
    if (teste && metodo === 'mercadopago_teste') {
      if (!req.is('application/json') || req.get('Origin') !== `${req.protocol}://${req.get('host')}`) {
        throw new ErroCheckout('Origem do checkout inválida.', 403);
      }
      return res.status(201).json(await iniciarCheckout(req.usuario.id, tipoPlano, unidade_id));
    }
    if (!demo && metodo !== undefined) throw new ErroCheckout('Método disponível apenas em demonstração.', 403);
    if (demo && escolherMetodo === true && metodo === undefined) {
      return res.json(await checkoutMetodos.abrir(req.usuario.id, tipoPlano, unidade_id));
    }
    const resultado = demo
      ? await checkoutMetodos.iniciar(req.usuario.id, tipoPlano, unidade_id, metodo)
      : await iniciarCheckout(req.usuario.id, tipoPlano, unidade_id);
    return res.status(201).json(resultado);
  } catch (error) {
    return erroCheckout(res, error);
  }
});

router.get('/status/:tentativaId', async (req, res) => {
  try {
    let resultado;
    if (emTesteMercadoPago()) {
      const externo = await consultarTentativaExterna(req.usuario.id, req.params.tentativaId);
      if (externo) return res.json({ status: externo.status, origem: 'mercadopago_test', metodo: 'mercadopago' });
    }
    if (process.env.PAYMENT_MODE === 'demo' || emTesteMercadoPago()) {
      const demo = await checkoutMetodos.consultar(req.usuario.id, req.params.tentativaId);
      resultado = { status: demo.status === 'approved' ? 'confirmado' : demo.status === 'pending' ? 'pendente' : 'recusado', origem: demo.origem, metodo: demo.metodo };
    } else resultado = await consultarCheckout(req.usuario.id, req.params.tentativaId);
    return res.json(resultado);
  } catch (error) {
    return erroCheckout(res, error);
  }
});

router.get('/demo/historico', async (req, res) => {
  try { return res.json(await servicoDemo.historico(req.usuario.id)); }
  catch (error) { return erroCheckout(res, error); }
});
router.get('/demo/planos/:tipo', (req, res) => {
  try {
    const resumo = checkoutMetodos.resumo(req.params.tipo);
    let mercadoPagoExterno = false;
    if (emTesteMercadoPago()) {
      try {
        validarConfiguracaoCheckout();
        validarPagadorTeste(req.usuario.email);
        mercadoPagoExterno = true;
      } catch (erro) {
        if (!(erro instanceof ErroGatewayCheckout)) throw erro;
      }
    }
    return res.json({ ...resumo, mercadoPagoExterno });
  } catch (error) { return erroCheckout(res, error); }
});
router.post('/demo/:id/mercadopago', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    if (!req.is('application/json') || req.get('Origin') !== `${req.protocol}://${req.get('host')}`) {
      throw new ErroCheckout('Origem do checkout inválida.', 403);
    }
    return res.json(await checkoutMetodos.simularResposta(req.usuario.id, req.params.id, req.body?.acao));
  } catch (error) { return erroCheckout(res, error); }
});
async function consultarTentativaExterna(usuarioId, id) {
  validarBancoTesteMercadoPago();
  const tentativa = await prisma.checkout_tentativas.findFirst({
    where: { id, usuario_id: usuarioId, metodo: 'mercadopago' }, select: { tipo: true },
  });
  if (!tentativa) return null;
  const { status } = await consultarCheckout(usuarioId, id);
  return { tipo: tentativa.tipo, status };
}

router.get('/demo/:id', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    if (emTesteMercadoPago()) {
      const externo = await consultarTentativaExterna(req.usuario.id, req.params.id);
      if (externo) return res.json({ ...checkoutMetodos.resumo(externo.tipo), metodo: 'mercadopago',
        origem: 'mercadopago_test',
        status: externo.status === 'confirmado' ? 'approved' : externo.status === 'recusado' ? 'rejected' : 'pending',
      });
    }
    return res.json(await checkoutMetodos.consultar(req.usuario.id, req.params.id));
  } catch (error) { return erroCheckout(res, error); }
});
router.post('/demo/:id/qr', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const origem = `${req.protocol}://${req.get('host')}`;
    if (req.get('Origin') !== origem) return res.status(403).json({ erro: 'Origem do checkout inválida.' });
    const { token, expiraEm } = await servicoDemo.gerarQr(req.usuario.id, req.params.id);
    const link = new URL('/checkout-qr', origem);
    link.hash = new URLSearchParams({ tentativa: req.params.id, token }).toString();
    const imagem = await QRCode.toDataURL(link.href, { width: 320, margin: 4, errorCorrectionLevel: 'M' });
    return res.status(201).json({ link: link.href, imagem, expiraEm });
  } catch (error) { return erroCheckout(res, error); }
});
router.post('/demo/:id', async (req, res) => {
  try { validarSimuladorCheckout(); return res.json(await servicoDemo.decidir(req.usuario.id, req.params.id, req.body?.acao)); }
  catch (error) { return erroCheckout(res, error); }
});

export default router;

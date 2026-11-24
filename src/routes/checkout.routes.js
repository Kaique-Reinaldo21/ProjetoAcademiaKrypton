import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { servicoDemo, validarModoDemo } from '../services/checkout-demo.service.js';
import { ErroGatewayCheckout } from '../gatewary/erros-checkout.js';
import {
  iniciarCheckout,
  consultarCheckout,
  ErroCheckout,
} from '../services/checkout.service.js';

const router = express.Router();
router.use(authMiddleware);

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

router.post('/', async (req, res) => {
  try {
    const { tipoPlano, unidade_id } = req.body || {};
    const resultado = process.env.PAYMENT_MODE === 'demo'
      ? await servicoDemo.iniciar(req.usuario.id, tipoPlano, unidade_id)
      : await iniciarCheckout(req.usuario.id, tipoPlano, unidade_id);
    return res.status(201).json(resultado);
  } catch (error) {
    return erroCheckout(res, error);
  }
});

router.get('/status/:tentativaId', async (req, res) => {
  try {
    let resultado;
    if (process.env.PAYMENT_MODE === 'demo') {
      const demo = await servicoDemo.consultar(req.usuario.id, req.params.tentativaId);
      resultado = { status: demo.status === 'approved' ? 'confirmado' : demo.status === 'pending' ? 'pendente' : 'recusado', origem: 'demo' };
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
router.get('/demo/:id', async (req, res) => {
  try { return res.json(await servicoDemo.consultar(req.usuario.id, req.params.id)); }
  catch (error) { return erroCheckout(res, error); }
});
router.post('/demo/:id', async (req, res) => {
  try { validarModoDemo(); return res.json(await servicoDemo.decidir(req.usuario.id, req.params.id, req.body?.acao)); }
  catch (error) { return erroCheckout(res, error); }
});

export default router;

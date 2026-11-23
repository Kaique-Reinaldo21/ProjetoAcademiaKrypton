import express from 'express';
import authMiddleware from '../middleware/auth.js';
import {
  iniciarCheckout,
  consultarCheckout,
  ErroCheckout,
} from '../services/checkout.service.js';

const router = express.Router();
router.use(authMiddleware);

function erroCheckout(res, error) {
  console.error('Falha no checkout:', error);
  const status = error instanceof ErroCheckout ? error.status : 502;
  return res.status(status).json({
    erro: error instanceof ErroCheckout
      ? error.message
      : 'Não foi possível processar o checkout. Tente novamente mais tarde.',
  });
}

router.post('/', async (req, res) => {
  try {
    const { tipoPlano, unidade_id } = req.body || {};
    const resultado = await iniciarCheckout(req.usuario.id, tipoPlano, unidade_id);
    return res.status(201).json(resultado);
  } catch (error) {
    return erroCheckout(res, error);
  }
});

router.get('/status/:tentativaId', async (req, res) => {
  try {
    const resultado = await consultarCheckout(req.usuario.id, req.params.tentativaId);
    return res.json(resultado);
  } catch (error) {
    return erroCheckout(res, error);
  }
});

export default router;

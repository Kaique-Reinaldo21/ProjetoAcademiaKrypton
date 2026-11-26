import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { criarServicoContas, ErroConta, mensagemRecuperacao } from '../services/contas.service.js';

export function criarRotasContas(servico = criarServicoContas()) {
  const router = express.Router();

  function post(caminho, autenticado, executar) {
    const acessar = async (req, res) => {
      res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
      try {
        const origem = `${req.protocol}://${req.get('host')}`;
        if (!req.is('application/json') || req.get('Origin') !== origem) {
          throw new ErroConta('Solicitação inválida.', 403);
        }
        return await executar(req, res);
      } catch (erro) {
        if (erro instanceof ErroConta) return res.status(erro.status).json({ erro: erro.message });
        console.error('Falha interna na operação de conta.');
        return res.status(503).json({ erro: 'Serviço de contas indisponível.' });
      }
    };
    if (autenticado) router.post(caminho, authMiddleware, acessar);
    else router.post(caminho, acessar);
  }

  post('/recuperacao', false, async (req, res) => {
    await servico.limitar('recuperacao-ip', req.ip, 12);
    const email = req.body?.email;
    res.status(202).json({ mensagem: mensagemRecuperacao });
    setImmediate(() => {
      servico.solicitar(email).catch(() => console.error('Solicitação de recuperação não entregue.'));
    });
  });

  post('/redefinir', false, async (req, res) => {
    await servico.limitar('redefinicao-ip', req.ip, 20);
    const { token, novaSenha, confirmacao } = req.body || {};
    await servico.redefinir(token, novaSenha, confirmacao);
    res.clearCookie('token');
    return res.json({ mensagem: 'Senha redefinida. Entre novamente.' });
  });

  post('/senha', true, async (req, res) => {
    await servico.limitar('alteracao-conta', req.usuario.id, 8);
    const { senhaAtual, novaSenha, confirmacao } = req.body || {};
    await servico.alterar(req.usuario, senhaAtual, novaSenha, confirmacao);
    res.clearCookie('token');
    return res.json({ mensagem: 'Senha alterada. Entre novamente.' });
  });

  post('/admin/recuperacao', true, async (req, res) => {
    if (req.usuario.role !== 'admin') throw new ErroConta('Operação exclusiva da administração.', 403);
    await servico.limitar('recuperacao-admin', req.usuario.id, 8);
    await servico.recuperarComoAdmin(req.usuario, req.body?.email, req.body?.senhaAdmin);
    return res.json({ mensagem: 'Sessões revogadas. Link de recuperação enviado.' });
  });

  return router;
}

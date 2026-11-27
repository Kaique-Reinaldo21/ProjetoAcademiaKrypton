import { Router } from 'express';
import express from 'express';
import { diagnosticarInicializacao } from '../lib/diagnostico-inicializacao.js';
import { permitirPapeis } from '../middleware/papeis-profissionais.js';
import { responder } from '../controllers/perfis-profissionais.controller.js';
import { ErroProfissional } from '../services/perfis-profissionais.service.js';
import { criarServicoDocumentos } from '../services/documentos-profissionais.service.js';

const limite = 5 * 1024 * 1024;
const profissionais = ['personal', 'nutricionista'];
const todos = ['aluno', ...profissionais];

function mesmaOrigem(req, res, next) {
  if (req.get('Origin') !== `${req.protocol}://${req.get('host')}`) return res.sendStatus(403);
  next();
}

function exigirPdf(req, res, next) {
  if (!req.is('application/pdf')) return res.sendStatus(415);
  next();
}

function responderUpload(operacao, sucesso = 200) {
  return async (req, res) => {
    try { return res.status(sucesso).json(await operacao(req)); }
    catch (erro) {
      if (erro instanceof ErroProfissional) return res.status(erro.status).json({ erro: erro.message });
      if (erro.code === 'P2002' || erro.code === 'P2034') return res.status(409).json({ erro: 'Documento duplicado ou registro atualizado. Recarregue e tente novamente.' });
      console.error('Operação de documento indisponível:', diagnosticarInicializacao(erro));
      return res.status(500).json({ erro: 'Não foi possível concluir a operação.' });
    }
  };
}

export function criarRotasDocumentos({ servico = criarServicoDocumentos() } = {}) {
  const router = Router();
  router.get('/', permitirPapeis(...todos), responder(usuario => servico.listar(usuario)));
  router.post('/gerar', permitirPapeis(...profissionais), mesmaOrigem,
    responder((usuario, body) => {
      if (!body || Object.keys(body).some(chave => chave !== 'ficha_id')) throw new ErroProfissional(400, 'Informe somente o identificador da ficha.');
      return servico.solicitarGeracao(usuario, body.ficha_id);
    }, 202));
  router.post('/', permitirPapeis(...profissionais), mesmaOrigem, exigirPdf,
    express.raw({ type: 'application/pdf', limit: limite, inflate: false }),
    responderUpload(req => {
      let titulo;
      try { titulo = decodeURIComponent(req.get('X-Documento-Titulo') || ''); }
      catch { throw new ErroProfissional(400, 'Título inválido.'); }
      return servico.anexar(req.usuario, req.get('X-Aluno-Id'), titulo, req.body);
    }, 201));
  router.put('/:id', permitirPapeis(...profissionais), mesmaOrigem, exigirPdf,
    express.raw({ type: 'application/pdf', limit: limite, inflate: false }),
    responder((usuario, arquivo, params) => servico.substituir(usuario, params.id, arquivo)));
  router.delete('/:id', permitirPapeis(...profissionais), mesmaOrigem,
    responder((usuario, _body, params) => servico.remover(usuario, params.id)));
  router.get('/:id/arquivo', permitirPapeis(...todos), async (req, res) => {
    try {
      const documento = await servico.baixar(req.usuario, req.params.id);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="krypton-documento-${documento.id}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Length': String(documento.bytes.length),
      });
      return res.send(documento.bytes);
    } catch (erro) {
      if (erro instanceof ErroProfissional) return res.status(erro.status).json({ erro: erro.message });
      console.error('Download de documento indisponível:', diagnosticarInicializacao(erro));
      return res.status(500).json({ erro: 'Não foi possível disponibilizar o documento.' });
    }
  });
  return router;
}

export default criarRotasDocumentos;

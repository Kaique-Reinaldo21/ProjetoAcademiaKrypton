import express from 'express';
import { PNG } from 'pngjs';
import prisma from '../lib/prisma.js';

export const limiteFoto = 512 * 1024;
export const papeisPerfilPessoal = Object.freeze(['admin', 'aluno', 'recepcao', 'personal', 'nutricionista']);
const assinaturaPng = Buffer.from('89504e470d0a1a0a', 'hex');

export function prepararFoto(dados) {
  if (!Buffer.isBuffer(dados) || dados.length < 33 || dados.length > limiteFoto ||
      !dados.subarray(0, 8).equals(assinaturaPng) || dados.readUInt32BE(8) !== 13 ||
      dados.toString('ascii', 12, 16) !== 'IHDR' || dados[24] !== 8 || dados[28] !== 0) return null;
  const dimensoes = [dados.readUInt32BE(16), dados.readUInt32BE(20)];
  if (dimensoes.some(valor => valor < 1 || valor > 320)) return null;

  try {
    const { width, height, data } = PNG.sync.read(dados, { checkCRC: true });
    const png = PNG.sync.write({ width, height, data });
    return png.length <= limiteFoto ? png : null;
  } catch {
    return null;
  }
}

function somenteContaAtiva(req, res, next) {
  if (!papeisPerfilPessoal.includes(req.usuario?.role)) return res.sendStatus(403);
  next();
}

function mesmaOrigem(req, res, next) {
  if (req.get('Origin') !== `${req.protocol}://${req.get('host')}`) return res.sendStatus(403);
  next();
}

export function criarRotasPerfil(db = prisma) {
  const router = express.Router();

  router.put('/perfil', somenteContaAtiva, mesmaOrigem, async (req, res) => {
    if (!req.is('application/json')) return res.sendStatus(415);
    const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
    if (!nome || [...nome].length > 120 || /[\u0000-\u001f\u007f]/.test(nome) ||
        Object.keys(req.body || {}).some(campo => campo !== 'nome')) {
      return res.status(400).json({ erro: 'Informe um nome válido com até 120 caracteres.' });
    }

    try {
      const usuario = await db.usuarios.update({
        where: { id: req.usuario.id },
        data: { nome },
        select: { id: true, nome: true },
      });
      return res.json({ usuario });
    } catch {
      return res.status(500).json({ erro: 'Não foi possível salvar o nome.' });
    }
  });

  router.get('/perfil/foto', somenteContaAtiva, async (req, res) => {
    res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    try {
      const foto = await db.fotos_perfil.findUnique({ where: { usuario_id: req.usuario.id } });
      if (!foto) return res.sendStatus(404);
      return res.type('image/png').send(Buffer.from(foto.imagem));
    } catch {
      return res.status(500).json({ erro: 'Não foi possível buscar a foto.' });
    }
  });

  router.put('/perfil/foto', somenteContaAtiva, mesmaOrigem, express.raw({ type: 'image/png', limit: limiteFoto, inflate: false }), async (req, res) => {
    if (!req.is('image/png')) return res.sendStatus(415);
    const imagem = prepararFoto(req.body);
    if (!imagem) return res.status(400).json({ erro: 'Envie uma imagem PNG válida de até 320 × 320 pixels e 512 KB.' });

    try {
      await db.fotos_perfil.upsert({
        where: { usuario_id: req.usuario.id },
        create: { usuario_id: req.usuario.id, imagem },
        update: { imagem },
      });
      return res.sendStatus(204);
    } catch {
      return res.status(500).json({ erro: 'Não foi possível salvar a foto.' });
    }
  });

  router.delete('/perfil/foto', somenteContaAtiva, mesmaOrigem, async (req, res) => {
    try {
      await db.fotos_perfil.deleteMany({ where: { usuario_id: req.usuario.id } });
      return res.sendStatus(204);
    } catch {
      return res.status(500).json({ erro: 'Não foi possível remover a foto.' });
    }
  });

  return router;
}

export default criarRotasPerfil();

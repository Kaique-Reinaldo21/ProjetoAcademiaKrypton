import express from 'express';
import prisma from '../lib/prisma.js';

const formatoDia = new Intl.DateTimeFormat('en', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function diaDoTreino(agora) {
  const partes = Object.fromEntries(formatoDia.formatToParts(agora).map(({ type, value }) => [type, value]));
  return new Date(Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day)));
}

const somarDias = (data, dias) => new Date(data.getTime() + dias * 86400000);
const isoDia = data => data.toISOString().slice(0, 10);
const router = express.Router();
router.use('/treinos', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (req.usuario.role !== 'aluno') return res.status(403).json({ erro: 'Área exclusiva de alunos.' });
  if (req.method !== 'GET' && req.get('Origin') !== `${req.protocol}://${req.get('host')}`) {
    return res.status(403).json({ erro: 'Solicitação inválida.' });
  }
  next();
});

router.get('/treinos', async (req, res) => {
  const semanas = req.query.semanas ?? '0';
  if (typeof semanas !== 'string' || !/^\d{1,3}$/.test(semanas) || Number(semanas) > 520) {
    return res.status(400).json({ erro: 'Semana inválida.' });
  }
  const hoje = diaDoTreino(new Date());
  const segunda = somarDias(hoje, -((hoje.getUTCDay() + 6) % 7) - Number(semanas) * 7);
  try {
    const registros = await prisma.treinos_concluidos.findMany({
      where: { usuario_id: req.usuario.id, dia: { gte: somarDias(segunda, -49), lt: somarDias(segunda, 7) } },
      orderBy: { dia: 'desc' },
      select: { dia: true, registrado_em: true },
    });
    return res.json({
      hoje: isoDia(hoje), segunda: isoDia(segunda),
      registros: registros.map(item => ({ ...item, dia: isoDia(item.dia) })),
    });
  } catch {
    console.error('Falha ao consultar treinos concluídos.');
    return res.status(503).json({ erro: 'Não foi possível consultar os treinos. Tente novamente.' });
  }
});

const atualizar = concluir => async (req, res) => {
  const agora = new Date();
  const dia = diaDoTreino(agora);
  const usuario_id = req.usuario.id;
  try {
    if (concluir) {
      // A chave composta também protege requisições concorrentes.
      await prisma.treinos_concluidos.create({ data: { usuario_id, dia, registrado_em: agora } })
        .catch(erro => { if (erro.code !== 'P2002') throw erro; });
    } else {
      await prisma.treinos_concluidos.deleteMany({ where: { usuario_id, dia } });
    }
    return res.sendStatus(204);
  } catch {
    console.error('Falha ao salvar conclusão de treino.');
    return res.status(503).json({ erro: 'Não foi possível salvar o treino. Tente novamente.' });
  }
};
router.put('/treinos/hoje', atualizar(true));
router.delete('/treinos/hoje', atualizar(false));

export default router;

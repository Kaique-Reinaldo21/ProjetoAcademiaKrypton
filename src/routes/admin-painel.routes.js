import express from 'express';
import prisma from '../lib/prisma.js';
import { consultarCamposAdmin } from '../lib/consultas-admin.js';

const router = express.Router();
const dias = (data, total) => new Date(data.getTime() + total * 86400000);
const selecionados = ['recuperacao_administrativa'];

router.get('/indicadores', async (_req, res) => {
  const agora = new Date();
  const hoje = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
  const aluno = { role: 'aluno' };
  const plano = { ativo: true, OR: [{ vencimento: null }, { vencimento: { gte: hoje } }] };
  const dados = await consultarCamposAdmin('indicadores', {
    ativos: () => prisma.usuarios.count({ where: { ...aluno, planos: { some: plano } } }),
    novos: () => prisma.usuarios.count({ where: { ...aluno, created_at: { gte: dias(hoje, -6), lt: dias(hoje, 1) } } }),
    pendentes: () => prisma.transacoes_pagamento.count({ where: { status: 'pending' } }),
    vencimentos: () => prisma.planos.count({ where: { ativo: true, usuarios: aluno, vencimento: { gte: hoje, lte: dias(hoje, 7) } } }),
    agendamentos: () => prisma.agendamentos.count({ where: { usuarios: aluno, data_hora: { gte: agora, lt: dias(agora, 7) } } }),
    valores: async () => {
      const valores = await prisma.transacoes_pagamento.groupBy({
        by: ['origem', 'moeda'], where: { status: 'approved' }, _sum: { valor_centavos: true },
      });
      return valores.map(({ origem, moeda, _sum }) => ({
        origem, moeda, valor_centavos: _sum.valor_centavos,
      }));
    },
  });
  if (Object.values(dados).every(valor => valor === null)) {
    return res.status(503).json({ erro: 'Indicadores indisponíveis. Tente novamente.' });
  }
  return res.json(dados);
});

router.get('/auditoria', async (_req, res) => {
  try {
    const atividades = await prisma.auditoria_contas.findMany({
      where: { evento: { in: selecionados }, autor_id: { not: null } },
      orderBy: [{ criado_em: 'desc' }, { id: 'desc' }], take: 30,
      select: { autor_id: true, usuario_id: true, evento: true, criado_em: true },
    });
    return res.json({ atividades });
  } catch {
    console.error('Falha ao consultar auditoria administrativa.');
    return res.status(503).json({ erro: 'Auditoria indisponível. Tente novamente.' });
  }
});

router.get('/unidades', async (_req, res) => {
  try {
    const unidades = await prisma.unidades.findMany({
      orderBy: [{ cidade: 'asc' }, { nome: 'asc' }],
      select: { nome: true, cidade: true, endereco: true, horario: true, telefone: true },
    });
    return res.json({ unidades });
  } catch {
    console.error('Falha ao consultar unidades para a administração.');
    return res.status(503).json({ erro: 'Unidades indisponíveis. Tente novamente.' });
  }
});

export default router;

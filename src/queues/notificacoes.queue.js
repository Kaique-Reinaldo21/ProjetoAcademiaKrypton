import { randomUUID } from 'node:crypto';

export function enfileirar(tx, tipo, idempotencia, destinatarios) {
  return tx.jobs.createMany({
    data: [{ idempotencia, tipo, payload: { destinatarios: [...new Set(destinatarios)] } }],
    skipDuplicates: true,
  });
}

export async function adquirir(db, prazoMs) {
  const agora = new Date();
  const disponivel = { OR: [
    { situacao: 'pendente', programado_em: { lte: agora } },
    { situacao: 'processando', bloqueado_ate: { lte: agora } },
  ] };
  const job = await db.jobs.findFirst({ where: disponivel, orderBy: [{ programado_em: 'asc' }, { id: 'asc' }] });
  if (!job) return null;
  const where = { id: job.id, tentativas: job.tentativas, ...disponivel };
  if (job.tentativas >= job.limite) {
    await db.jobs.updateMany({ where, data: {
      situacao: 'falhou', concluido_em: agora, bloqueado_ate: null, bloqueio: null, erro: 'LIMITE_TENTATIVAS',
    } });
    return null;
  }
  const bloqueio = randomUUID();
  const alteracao = await db.jobs.updateMany({ where, data: {
    situacao: 'processando', tentativas: { increment: 1 }, bloqueio,
    bloqueado_ate: new Date(agora.getTime() + prazoMs), processado_em: agora,
  } });
  return alteracao.count ? { ...job, bloqueio, tentativas: job.tentativas + 1 } : null;
}

export function posse(job) {
  return { id: job.id, situacao: 'processando', bloqueio: job.bloqueio, bloqueado_ate: { gt: new Date() } };
}

export function registrarFalha(db, job) {
  const terminal = job.tentativas >= job.limite;
  return db.jobs.updateMany({ where: posse(job), data: {
    situacao: terminal ? 'falhou' : 'pendente',
    erro: 'FALHA_PROCESSAMENTO',
    concluido_em: terminal ? new Date() : null,
    programado_em: new Date(Date.now() + Math.min(300_000, 1000 * 2 ** job.tentativas)),
    bloqueio: null, bloqueado_ate: null,
  } });
}

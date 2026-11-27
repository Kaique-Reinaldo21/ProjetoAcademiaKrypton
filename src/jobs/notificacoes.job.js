import { posse } from '../queues/notificacoes.queue.js';

const titulos = Object.freeze({
  consulta_agendada: 'Consulta agendada',
  consulta_confirmada: 'Consulta confirmada',
  consulta_cancelada: 'Consulta cancelada',
  consulta_reagendada: 'Consulta reagendada',
  treino_publicado: 'Ficha de treino publicada',
  treino_atualizado: 'Ficha de treino atualizada',
  alimentacao_publicada: 'Plano alimentar publicado',
  alimentacao_atualizada: 'Plano alimentar atualizado',
  documento_disponivel: 'Documento profissional disponível',
});

function destino(role, tipo) {
  if (role === 'admin') return '/admin.html';
  if (role !== 'aluno') return '/profissional.html';
  if (tipo.startsWith('consulta')) return '/dashboard.html#agendamentos';
  if (tipo.startsWith('documento')) return '/dashboard.html#arquivos';
  return tipo.startsWith('treino') ? '/dashboard.html#treinos' : '/dashboard.html#nutricao';
}

export async function processarNotificacao(db, job) {
  if (!Object.hasOwn(titulos, job.tipo) || !Array.isArray(job.payload?.destinatarios)) throw new Error('JOB_INVALIDO');
  const titulo = titulos[job.tipo];
  await db.$transaction(async tx => {
    // Finalização e entrega compartilham a mesma transação. Um worker que perdeu a posse não entrega.
    const reserva = await tx.jobs.updateMany({ where: posse(job), data: {
      situacao: 'concluido', concluido_em: new Date(), bloqueado_ate: null, bloqueio: null, erro: null,
    } });
    if (!reserva.count) return;
    const destinatarios = await tx.usuarios.findMany({
      where: { id: { in: job.payload.destinatarios }, profissional_ativo: true },
      select: { id: true, role: true },
    });
    if (!destinatarios.length) return;
    await tx.notificacoes.createMany({ skipDuplicates: true, data: destinatarios.map(usuario => ({
      job_id: job.id, destinatario_id: usuario.id, categoria: job.tipo, titulo,
      mensagem: 'Há uma atualização disponível no seu painel.',
      destino: destino(usuario.role, job.tipo),
    })) });
  });
}

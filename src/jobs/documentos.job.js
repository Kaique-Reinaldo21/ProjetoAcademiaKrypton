import { createHash } from 'node:crypto';
import { enfileirar, posse } from '../queues/notificacoes.queue.js';
import { gerarPdfProfissional } from '../lib/pdf-profissional.js';

export async function processarDocumentoPdf(db, job) {
  const documentoId = Number(job.payload?.documento_id);
  if (!Number.isSafeInteger(documentoId) || documentoId < 1) throw new Error('JOB_INVALIDO');
  const documento = await db.documentos_profissionais.findUnique({ where: { id: documentoId },
    include: { ficha: { include: { aluno: { select: { id: true, nome: true } }, profissional: { select: { id: true, nome: true } } } } } });
  if (!documento || documento.origem !== 'ficha' || documento.situacao !== 'processando' || !documento.ficha ||
      documento.ficha.aluno_id !== documento.aluno_id || documento.ficha.profissional_id !== documento.profissional_id ||
      documento.ficha.tipo !== documento.tipo) throw new Error('DOCUMENTO_INVALIDO');
  const pdf = gerarPdfProfissional(documento.ficha);

  await db.$transaction(async tx => {
    const posseConfirmada = await tx.jobs.updateMany({ where: posse(job), data: {
      situacao: 'concluido', concluido_em: new Date(), bloqueado_ate: null, bloqueio: null, erro: null,
    } });
    if (!posseConfirmada.count) return;
    const atualizado = await tx.documentos_profissionais.updateMany({ where: { id: documento.id, situacao: 'processando' }, data: {
      conteudo: pdf, sha256: createHash('sha256').update(pdf).digest('hex'),
      situacao: 'disponivel', disponibilizado_em: new Date(),
    } });
    if (!atualizado.count) throw new Error('DOCUMENTO_INDISPONIVEL');
    await enfileirar(tx, 'documento_disponivel', `documento_disponivel:${documento.id}`, [documento.aluno_id], { documento_tipo: documento.tipo });
  });
}

export async function falhaDocumentoPermanente(db, job) {
  if (job.tipo !== 'documento_pdf_gerar') return;
  const documentoId = Number(job.payload?.documento_id);
  if (!Number.isSafeInteger(documentoId) || documentoId < 1) return;
  await db.documentos_profissionais.updateMany({ where: { id: documentoId, situacao: 'processando' }, data: { situacao: 'falhou' } });
}

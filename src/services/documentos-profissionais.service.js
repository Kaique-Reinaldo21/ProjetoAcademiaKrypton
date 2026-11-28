import { createHash, randomUUID } from 'node:crypto';
import prisma from '../lib/prisma.js';
import { enfileirar } from '../queues/notificacoes.queue.js';
import { ErroProfissional, id } from './perfis-profissionais.service.js';
import { validarPdf } from '../lib/pdf-profissional.js';

const especiais = ['personal', 'nutricionista'];
const recusar = (status, mensagem) => { throw new ErroProfissional(status, mensagem); };
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const resultadoPublico = ({ conteudo, sha256, ficha_id, chave_origem, ...documento }) => documento;

export function criarServicoDocumentos(db = prisma) {
  async function planoElite(tx, alunoId) {
    const plano = await tx.planos.findFirst({ where: { usuario_id: alunoId, ativo: true }, orderBy: { id: 'desc' }, select: { tipo: true, ativo: true, vencimento: true } });
    const hoje = new Date(); hoje.setUTCHours(0, 0, 0, 0);
    if (plano?.tipo !== 'elite' || !plano.ativo || (plano.vencimento && plano.vencimento < hoje)) {
      recusar(403, 'Documentos profissionais estão disponíveis para alunos com plano Elite ativo.');
    }
  }

  async function exigirVinculo(tx, profissionalId, alunoId, tipo) {
    const vinculo = await tx.vinculos_profissionais.findFirst({ where: {
      aluno_id: alunoId, profissional_id: profissionalId,
      profissional: { role: tipo, profissional_ativo: true },
    }, select: { profissional_id: true } });
    if (!vinculo) recusar(404, 'Vínculo profissional não encontrado.');
  }

  async function exigirAluno(tx, alunoId) {
    const aluno = await tx.usuarios.findFirst({ where: { id: alunoId, role: 'aluno' }, select: { id: true } });
    if (!aluno) recusar(404, 'Aluno não encontrado.');
  }

  async function autorizado(tx, ator, documentoId, incluirConteudo = false) {
    if (!Number.isSafeInteger(documentoId) || documentoId < 1) recusar(400, 'Identificador inválido.');
    if (ator.role === 'aluno') {
      await planoElite(tx, ator.id);
      const documento = await tx.documentos_profissionais.findFirst({ where: { id: documentoId, aluno_id: ator.id },
        select: { id: true, titulo: true, nome_arquivo: true, tipo: true, situacao: true, criado_em: true,
          disponibilizado_em: true, ...(incluirConteudo && { conteudo: true, sha256: true }) } });
      return documento;
    }
    if (!especiais.includes(ator.role)) recusar(403, 'Acesso restrito ao aluno destinatário ou ao profissional responsável.');
    return tx.documentos_profissionais.findFirst({ where: { id: documentoId, profissional_id: ator.id, tipo: ator.role },
      select: { id: true, titulo: true, nome_arquivo: true, tipo: true, situacao: true, criado_em: true,
        disponibilizado_em: true, ...(incluirConteudo && { conteudo: true, sha256: true }) } });
  }

  return {
    async listar(ator) {
      if (ator.role === 'aluno') {
        await planoElite(db, ator.id);
        const itens = await db.documentos_profissionais.findMany({ where: { aluno_id: ator.id }, orderBy: [{ criado_em: 'desc' }, { id: 'desc' }],
          select: { id: true, titulo: true, nome_arquivo: true, tipo: true, origem: true, situacao: true, criado_em: true,
            disponibilizado_em: true, profissional: { select: { nome: true, role: true } } } });
        return itens.map(resultadoPublico);
      }
      if (!especiais.includes(ator.role)) recusar(403, 'Acesso restrito a profissionais e alunos autorizados.');
      const itens = await db.documentos_profissionais.findMany({ where: { profissional_id: ator.id, tipo: ator.role }, orderBy: [{ criado_em: 'desc' }, { id: 'desc' }],
        select: { id: true, aluno_id: true, titulo: true, nome_arquivo: true, tipo: true, origem: true, situacao: true, criado_em: true,
          disponibilizado_em: true, aluno: { select: { nome: true } } } });
      return itens.map(resultadoPublico);
    },

    async baixar(ator, documentoId) {
      const documento = await autorizado(db, ator, id(documentoId), true);
      if (!documento) recusar(404, 'Documento não encontrado.');
      if (documento.situacao !== 'disponivel' || !documento.conteudo) recusar(409, 'O documento ainda está sendo processado ou não está disponível.');
      return { bytes: Buffer.from(documento.conteudo), titulo: documento.titulo, id: documento.id };
    },

    async anexar(ator, alunoId, titulo, buffer) {
      if (!especiais.includes(ator.role)) recusar(403, 'Somente personal ou nutricionista podem anexar documentos.');
      alunoId = id(alunoId);
      if (!validarPdf(buffer)) recusar(400, 'Envie um PDF válido de até 5 MB.');
      if (typeof titulo !== 'string' || !titulo.trim() || [...titulo.trim()].length > 120 || /[\u0000-\u001f\u007f]/.test(titulo)) {
        recusar(400, 'Informe um título de até 120 caracteres.');
      }
      return db.$transaction(async tx => {
        await exigirAluno(tx, alunoId);
        await exigirVinculo(tx, ator.id, alunoId, ator.role);
        await planoElite(tx, alunoId);
        const documento = await tx.documentos_profissionais.create({ data: {
          aluno_id: alunoId, profissional_id: ator.id, tipo: ator.role, titulo: titulo.trim(),
          nome_arquivo: `documento-${Date.now()}.pdf`, origem: 'upload', situacao: 'disponivel',
          conteudo: buffer, sha256: hash(buffer), disponibilizado_em: new Date(),
        }, select: { id: true, titulo: true, tipo: true, situacao: true } });
        await enfileirar(tx, 'documento_disponivel', `documento_disponivel:${documento.id}`, [alunoId], { documento_tipo: ator.role });
        return documento;
      });
    },

    async solicitarGeracao(ator, fichaId) {
      if (!especiais.includes(ator.role)) recusar(403, 'Somente personal ou nutricionista podem gerar documentos profissionais.');
      fichaId = id(fichaId);
      return db.$transaction(async tx => {
        const ficha = await tx.fichas_profissionais.findFirst({ where: { id: fichaId, profissional_id: ator.id, tipo: ator.role },
          select: { id: true, aluno_id: true, tipo: true, titulo: true, atualizado_em: true } });
        if (!ficha) recusar(404, 'Ficha profissional não encontrada.');
        await exigirVinculo(tx, ator.id, ficha.aluno_id, ator.role);
        await planoElite(tx, ficha.aluno_id);
        const chave_origem = `ficha:${ficha.id}:${ficha.atualizado_em.getTime()}`;
        const existente = await tx.documentos_profissionais.findUnique({ where: { chave_origem },
          select: { id: true, titulo: true, tipo: true, situacao: true } });
        if (existente) return existente;
        const documento = await tx.documentos_profissionais.create({ data: {
          aluno_id: ficha.aluno_id, profissional_id: ator.id, ficha_id: ficha.id, tipo: ficha.tipo,
          titulo: ficha.titulo, nome_arquivo: `ficha-${ficha.id}.pdf`, origem: 'ficha', situacao: 'processando', chave_origem,
        }, select: { id: true, titulo: true, tipo: true, situacao: true } });
        await tx.jobs.create({ data: { tipo: 'documento_pdf_gerar', idempotencia: `documento_pdf:${documento.id}`,
          payload: { documento_id: documento.id } } });
        return documento;
      });
    },

    async substituir(ator, documentoId, buffer) {
      if (!especiais.includes(ator.role)) recusar(403, 'Somente o profissional responsável pode substituir o documento.');
      documentoId = id(documentoId);
      if (!validarPdf(buffer)) recusar(400, 'Envie um PDF válido de até 5 MB.');
      return db.$transaction(async tx => {
        const atual = await tx.documentos_profissionais.findFirst({ where: { id: documentoId, profissional_id: ator.id, tipo: ator.role },
          select: { id: true, aluno_id: true, situacao: true } });
        if (!atual) recusar(404, 'Documento não encontrado.');
        if (atual.situacao === 'processando') recusar(409, 'Aguarde o processamento antes de substituir.');
        await exigirVinculo(tx, ator.id, atual.aluno_id, ator.role);
        await planoElite(tx, atual.aluno_id);
        const atualizado = await tx.documentos_profissionais.update({ where: { id: documentoId }, data: {
          origem: 'upload', ficha_id: null, chave_origem: null, situacao: 'disponivel', conteudo: buffer,
          sha256: hash(buffer), disponibilizado_em: new Date(),
        }, select: { id: true, titulo: true, tipo: true, situacao: true } });
        await enfileirar(tx, 'documento_disponivel', `documento_disponivel:${atualizado.id}:${randomUUID()}`, [atual.aluno_id], { documento_tipo: ator.role });
        return atualizado;
      });
    },

    async remover(ator, documentoId) {
      if (!especiais.includes(ator.role)) recusar(403, 'Somente o profissional responsável pode remover o documento.');
      const identificador = id(documentoId);
      const filtro = { id: identificador, profissional_id: ator.id, tipo: ator.role };
      const documento = await db.documentos_profissionais.deleteMany({ where: { ...filtro, situacao: { not: 'processando' } } });
      if (!documento.count) {
        const pendente = await db.documentos_profissionais.findFirst({ where: filtro, select: { id: true, situacao: true } });
        if (pendente?.situacao === 'processando') recusar(409, 'Aguarde o processamento antes de remover.');
        recusar(404, 'Documento não encontrado.');
      }
      return { removido: true };
    },
  };
}

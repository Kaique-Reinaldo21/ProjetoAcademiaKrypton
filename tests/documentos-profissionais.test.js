import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarPdfProfissional, validarPdf } from '../src/lib/pdf-profissional.js';
import { criarServicoDocumentos } from '../src/services/documentos-profissionais.service.js';
import { processarDocumentoPdf } from '../src/jobs/documentos.job.js';
import { processarUmaVez } from '../src/workers/notificacoes.worker.js';

function ficha() {
  return { tipo: 'personal', titulo: 'Treino fictício', orientacoes: 'Treino de teste', aluno: { nome: 'Aluno Exemplo' },
    profissional: { nome: 'Profissional Exemplo' }, itens: [{ divisao: 'A', nome: 'Agachamento', series: 3, repeticoes: '10', carga: 'leve', descanso: '60 s' }] };
}

test('PDF gerado possui estrutura válida e arquivo enviado é validado além do MIME', () => {
  const pdf = gerarPdfProfissional(ficha());
  assert.equal(validarPdf(pdf), true);
  assert.equal(pdf.subarray(0, 8).toString('ascii').startsWith('%PDF-1.'), true);
  assert.match(pdf.toString('ascii'), /Treino ficticio/);
  assert.equal(validarPdf(Buffer.concat([pdf, Buffer.from('\n1 0 obj\n<< /OpenAction 2 0 R >>\nendobj\n')])), false);
  assert.equal(validarPdf(Buffer.concat([pdf, Buffer.from('\n% atualizacao incremental comprimida\n')])), false);
  assert.equal(validarPdf(Buffer.from('%PDF-1.4 fake %%EOF')), false);
  assert.equal(validarPdf(Buffer.alloc(5 * 1024 * 1024 + 1)), false);
});

test('documentos não podem ser consultados por recepção ou por outro aluno/profissional', async () => {
  const chamadas = [];
  const db = {
    planos: { async findFirst() { return { tipo: 'elite', ativo: true, vencimento: null }; } },
    documentos_profissionais: {
      async findFirst(args) { chamadas.push(args); return null; },
      async findMany() { chamadas.push('listar'); return []; },
    },
  };
  const service = criarServicoDocumentos(db);
  await assert.rejects(service.listar({ id: 9, role: 'recepcao' }), { status: 403 });
  await assert.rejects(service.baixar({ id: 88, role: 'aluno' }, 1), { status: 404 });
  await assert.rejects(service.baixar({ id: 77, role: 'personal' }, 1), { status: 404 });
  assert.ok(chamadas.every(item => typeof item === 'object'));
  assert.deepEqual(chamadas[0].where, { id: 1, aluno_id: 88 });
  assert.deepEqual(chamadas[1].where, { id: 1, profissional_id: 77, tipo: 'personal' });
});

test('somente o profissional proprietário pode substituir ou remover seu documento', async () => {
  const consultas = [];
  const db = { $transaction: callback => callback(db), documentos_profissionais: {
    async findFirst(args) { consultas.push(args); return null; },
    async deleteMany(args) { consultas.push(args); return { count: 0 }; },
  } };
  const service = criarServicoDocumentos(db);
  const pdf = gerarPdfProfissional(ficha());
  await assert.rejects(service.substituir({ id: 12, role: 'personal' }, 55, pdf), { status: 404 });
  await assert.rejects(service.remover({ id: 12, role: 'personal' }, 55), { status: 404 });
  await assert.rejects(service.substituir({ id: 8, role: 'aluno' }, 55, pdf), { status: 403 });
  assert.deepEqual(consultas[0].where, { id: 55, profissional_id: 12, tipo: 'personal' });
  assert.deepEqual(consultas[1].where, { id: 55, profissional_id: 12, tipo: 'personal', situacao: { not: 'processando' } });
});

test('solicitação de PDF grava conteúdo clínico fora do payload do job e é idempotente', async () => {
  let documento, job;
  const tx = {
    fichas_profissionais: { async findFirst() { return { id: 3, aluno_id: 8, tipo: 'personal', titulo: 'Treino', atualizado_em: new Date('2026-11-27T12:00:00Z') }; } },
    vinculos_profissionais: { async findFirst() { return { profissional_id: 7 }; } },
    planos: { async findFirst() { return { tipo: 'elite', ativo: true, vencimento: null }; } },
    documentos_profissionais: {
      async findUnique() { return documento || null; },
      async create({ data }) { documento = { id: 21, ...data }; return { id: 21, titulo: data.titulo, tipo: data.tipo, situacao: data.situacao }; },
    },
    jobs: { async create({ data }) { job = data; return data; } },
  };
  const db = { $transaction: callback => callback(tx) };
  const service = criarServicoDocumentos(db);
  const criada = await service.solicitarGeracao({ id: 7, role: 'personal' }, 3);
  assert.equal(criada.situacao, 'processando');
  assert.deepEqual(job.payload, { documento_id: 21 });
  assert.equal(JSON.stringify(job.payload).includes('Treino'), false);
  assert.equal((await service.solicitarGeracao({ id: 7, role: 'personal' }, 3)).id, 21);
  assert.equal(job.idempotencia, 'documento_pdf:21');
});

test('upload persiste PDF validado e enfileira notificação sem conteúdo no payload', async () => {
  const pdf = gerarPdfProfissional(ficha());
  let armazenado, job;
  const tx = {
    usuarios: { async findFirst() { return { id: 8 }; } },
    vinculos_profissionais: { async findFirst() { return { profissional_id: 7 }; } },
    planos: { async findFirst() { return { tipo: 'elite', ativo: true, vencimento: null }; } },
    documentos_profissionais: { async create({ data }) { armazenado = data; return { id: 12, titulo: data.titulo, tipo: data.tipo, situacao: data.situacao }; } },
    jobs: { async createMany({ data }) { job = data[0]; return { count: 1 }; } },
  };
  const service = criarServicoDocumentos({ $transaction: callback => callback(tx) });
  const retorno = await service.anexar({ id: 7, role: 'nutricionista' }, 8, 'Plano fictício', pdf);
  assert.equal(retorno.situacao, 'disponivel');
  assert.deepEqual(armazenado.conteudo, pdf);
  assert.equal(armazenado.tipo, 'nutricionista');
  assert.equal(armazenado.sha256.length, 64);
  assert.deepEqual(job.payload, { destinatarios: [8], documento_tipo: 'nutricionista' });
  await assert.rejects(service.anexar({ id: 7, role: 'nutricionista' }, 8, 'Inválido', Buffer.from('%PDF fake')), { status: 400 });
});

test('Worker só disponibiliza PDF e cria a notificação após confirmar posse do job', async () => {
  const pdfFicha = ficha();
  pdfFicha.id = 3; pdfFicha.aluno_id = 8; pdfFicha.profissional_id = 7;
  let jobConcluido = false;
  let documentoDisponivel = false;
  let notificacao = false;
  const job = { id: 'job-1', tipo: 'documento_pdf_gerar', tentativas: 1, limite: 5, bloqueio: 'lock-1', payload: { documento_id: 21 } };
  const tx = {
    jobs: { async updateMany() { if (jobConcluido) return { count: 0 }; jobConcluido = true; return { count: 1 }; },
      async createMany({ data }) { assert.deepEqual(data[0].payload, { destinatarios: [8], documento_tipo: 'personal' }); notificacao = true; return { count: 1 }; } },
    documentos_profissionais: { async updateMany({ data }) { assert.equal(validarPdf(data.conteudo), true); documentoDisponivel = data.situacao === 'disponivel'; return { count: 1 }; } },
  };
  const db = { documentos_profissionais: { async findUnique() { return { id: 21, origem: 'ficha', situacao: 'processando', aluno_id: 8, profissional_id: 7, tipo: 'personal', ficha: pdfFicha }; } },
    $transaction: callback => callback(tx) };
  await processarDocumentoPdf(db, job);
  assert.equal(documentoDisponivel, true);
  assert.equal(notificacao, true);
  jobConcluido = false; notificacao = false;
  tx.jobs.updateMany = async () => ({ count: 0 });
  await processarDocumentoPdf(db, job);
  assert.equal(notificacao, false, 'worker sem posse não cria notificação');
});

test('Worker aplica tentativas progressivas e encerra documento com erro sanitizado no limite', async () => {
  const job = { id: 'job-erro', tipo: 'documento_pdf_gerar', payload: { documento_id: 33 }, situacao: 'pendente',
    tentativas: 0, limite: 2, bloqueio: null, bloqueado_ate: null, programado_em: new Date() };
  let documentoSituacao = 'processando';
  const esperas = [];
  const db = {
    jobs: {
      async findFirst() { return job.situacao === 'concluido' || job.situacao === 'falhou' ? null : { ...job }; },
      async updateMany({ data }) {
        if (data.situacao === 'processando') {
          job.situacao = data.situacao; job.tentativas += data.tentativas.increment; job.bloqueio = data.bloqueio; job.bloqueado_ate = data.bloqueado_ate;
        } else {
          job.situacao = data.situacao; job.erro = data.erro; esperas.push(data.programado_em);
          job.bloqueio = null; job.bloqueado_ate = null;
        }
        return { count: 1 };
      },
    },
    documentos_profissionais: {
      async findUnique() { throw new Error('falha privada de origem'); },
      async updateMany({ data }) { documentoSituacao = data.situacao; return { count: 1 }; },
    },
  };
  await processarUmaVez(db);
  assert.equal(job.situacao, 'pendente');
  assert.equal(documentoSituacao, 'processando');
  assert.equal(job.erro, 'FALHA_PROCESSAMENTO');
  await processarUmaVez(db);
  assert.equal(job.situacao, 'falhou');
  assert.equal(documentoSituacao, 'falhou');
  assert.equal(job.erro, 'FALHA_PROCESSAMENTO');
  assert.equal(esperas.length, 2);
  assert.ok(esperas[1].getTime() - esperas[0].getTime() > 0);
});

test('Worker encerra documento quando bloqueio expira na última tentativa', async () => {
  const job = { id: 'job-expirado', tipo: 'documento_pdf_gerar', payload: { documento_id: 91 },
    situacao: 'processando', tentativas: 5, limite: 5, bloqueado_ate: new Date(0), bloqueio: 'lock-expirado' };
  let documentoSituacao = 'processando';
  let jobSituacao = 'processando';
  const tx = {
    jobs: {
      async findFirst() { return { ...job, situacao: jobSituacao }; },
      async updateMany({ data }) { jobSituacao = data.situacao; return { count: 1 }; },
    },
    documentos_profissionais: {
      async updateMany({ where, data }) {
        assert.deepEqual(where, { id: 91, situacao: 'processando' });
        documentoSituacao = data.situacao;
        return { count: 1 };
      },
    },
  };
  const db = { ...tx, async $transaction(callback) { return callback(tx); } };
  assert.equal(await processarUmaVez(db), false);
  assert.equal(jobSituacao, 'falhou');
  assert.equal(documentoSituacao, 'falhou');
});

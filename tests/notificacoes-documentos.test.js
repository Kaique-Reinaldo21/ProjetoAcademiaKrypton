import test from 'node:test';
import assert from 'node:assert/strict';
import { processarNotificacao } from '../src/jobs/notificacoes.job.js';

async function destinoDocumento(tipo) {
  let criadas;
  const tx = {
    jobs: { async updateMany() { return { count: 1 }; } },
    usuarios: { async findMany() { return [{ id: 12, role: 'aluno' }]; } },
    notificacoes: { async createMany({ data }) { criadas = data; return { count: data.length }; } },
  };
  const db = { async $transaction(callback) { return callback(tx); } };
  await processarNotificacao(db, { id: 'job-fixture', tipo: 'documento_disponivel', payload: { destinatarios: [12], documento_tipo: tipo }, bloqueio: 'lock', situacao: 'processando' });
  return criadas[0];
}

test('notificações de PDF encaminham treino e alimentação para as áreas correspondentes', async () => {
  assert.equal((await destinoDocumento('personal')).destino, '/dashboard.html#treinos-extras');
  assert.equal((await destinoDocumento('nutricionista')).destino, '/dashboard.html#nutricao');
});

test('notificações de ficha de treino abrem Treinos extras', async () => {
  for (const tipo of ['treino_publicado', 'treino_atualizado']) {
    let criadas;
    const tx = { jobs: { async updateMany() { return { count: 1 }; } },
      usuarios: { async findMany() { return [{ id: 12, role: 'aluno' }]; } },
      notificacoes: { async createMany({ data }) { criadas = data; return { count: data.length }; } } };
    await processarNotificacao({ async $transaction(callback) { return callback(tx); } },
      { id: `job-${tipo}`, tipo, payload: { destinatarios: [12] }, bloqueio: 'lock', situacao: 'processando' });
    assert.equal(criadas[0].destino, '/dashboard.html#treinos-extras');
  }
});

test('Jobs documentais legados sem categoria vão para Documentos; categorias inválidas falham', async () => {
  const db = { async $transaction() { throw new Error('não deve iniciar transação'); } };
  for (const tipo of ['admin']) {
    await assert.rejects(processarNotificacao(db, { tipo: 'documento_disponivel', payload: { destinatarios: [12], documento_tipo: tipo } }), /JOB_INVALIDO/);
  }
  const tx = { jobs: { async updateMany() { return { count: 1 }; } }, usuarios: { async findMany() { return [{ id: 12, role: 'aluno' }]; } },
    notificacoes: { async createMany({ data }) { assert.equal(data[0].destino, '/dashboard.html#arquivos'); return { count: 1 }; } } };
  await processarNotificacao({ async $transaction(callback) { return callback(tx); } },
    { id: 'legacy-doc-job', tipo: 'documento_disponivel', payload: { destinatarios: [12] }, bloqueio: 'lock', situacao: 'processando' });
});

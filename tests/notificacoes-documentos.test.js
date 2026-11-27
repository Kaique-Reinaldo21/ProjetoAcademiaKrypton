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

test('notificação documental rejeita categoria ausente ou inválida', async () => {
  const db = { async $transaction() { throw new Error('não deve iniciar transação'); } };
  for (const tipo of [undefined, 'admin']) {
    await assert.rejects(processarNotificacao(db, { tipo: 'documento_disponivel', payload: { destinatarios: [12], documento_tipo: tipo } }), /JOB_INVALIDO/);
  }
});

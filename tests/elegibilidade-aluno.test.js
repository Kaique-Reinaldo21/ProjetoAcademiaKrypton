import './setup-isolamento.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarServicoElegibilidadeAluno, exigirPlanoAtivo } from '../src/services/elegibilidade-aluno.service.js';

test('eligibilidade consulta somente plano ativo e vigente no banco', async () => {
  let consulta;
  const plano = { id: 12, tipo: 'pro', ativo: true, vencimento: null };
  const servico = criarServicoElegibilidadeAluno({ planos: { findFirst: async args => { consulta = args; return plano; } } });
  assert.equal(await servico.planoAtivo(8), plano);
  assert.equal(consulta.where.usuario_id, 8);
  assert.equal(consulta.where.ativo, true);
  assert.ok(consulta.where.inicio.lte instanceof Date);
  assert.ok(consulta.where.OR[1].vencimento.gte instanceof Date);
  assert.equal(consulta.orderBy.id, 'desc');
});

test('middleware nega aluno sem matrícula e permite plano vigente anterior', async () => {
  const atual = { id: 3, tipo: 'basico', ativo: true };
  const db = { planos: { findFirst: async () => atual } };
  const middleware = exigirPlanoAtivo({ db });
  let passou = false;
  let status;
  const res = { status(valor) { status = valor; return this; }, json() { return this; } };
  await middleware({ usuario: { id: 1, role: 'aluno' } }, res, () => { passou = true; });
  assert.equal(passou, true);
  assert.equal(status, undefined);

  const semPlano = exigirPlanoAtivo({ db: { planos: { findFirst: async () => null } } });
  passou = false;
  await semPlano({ usuario: { id: 2, role: 'aluno' } }, res, () => { passou = true; });
  assert.equal(passou, false);
  assert.equal(status, 403);
});

test('plano Básico não libera recursos exclusivos do Elite', async () => {
  const middleware = exigirPlanoAtivo({ elite: true, db: { planos: { findFirst: async () => ({ tipo: 'basico', ativo: true }) } } });
  let status;
  let passou = false;
  const res = { status(valor) { status = valor; return this; }, json() { return this; } };
  await middleware({ usuario: { id: 2, role: 'aluno' } }, res, () => { passou = true; });
  assert.equal(passou, false);
  assert.equal(status, 403);
});

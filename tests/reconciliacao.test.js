import './setup-isolamento.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarServicoCheckout } from '../src/services/checkout.service.js';
import { buscarAssinaturasPorPagador } from '../src/gatewary/mercadopago.js';

function fixture() {
  const t = { id: 'tentativa-1', usuario_id: 1, tipo: 'pro', status: 'pendente', mp_preapproval_id: null };
  const assinatura = { id: 'assinatura_123', external_reference: t.id, status: 'authorized', payer_email: 'a@example.com', reason: 'Academia Krypton - Plano Pro', auto_recurring: { frequency: 1, frequency_type: 'months', currency_id: 'BRL', transaction_amount: 149 } };
  let planos = 0;
  const prisma = {
    usuarios: { findUnique: async () => ({ id: 1, email: 'a@example.com' }) },
    checkout_tentativas: {
      findUnique: async () => ({ ...t }),
      updateMany: async ({ where, data }) => {
        if (t.status !== where.status || (Object.hasOwn(where, 'mp_preapproval_id') && t.mp_preapproval_id !== where.mp_preapproval_id)) return { count: 0 };
        Object.assign(t, data); return { count: 1 };
      },
    },
    planos: { findFirst: async () => null, updateMany: async () => {}, create: async () => { planos++; return { id: planos }; } },
    transacoes_pagamento: { create: async () => ({}) },
  };
  prisma.$transaction = async fn => fn(prisma);
  const mp = { obterPagamentoAprovado: async () => ({ id: '12345', valor_centavos: 14900, moeda: 'BRL', status: 'approved' }), buscarAssinaturasPorPagador: async () => [assinatura], consultarAssinatura: async () => assinatura, possuiPagamentoAprovado: async () => true };
  const service = () => criarServicoCheckout({ prisma, ...mp });
  return { t, assinatura, prisma, mp, service, planos: () => planos };
}

test('recupera assinatura e confirma apenas após pagamento comprovado', async () => {
  const c = fixture();
  c.mp.obterPagamentoAprovado = async () => null;
  assert.deepEqual(await c.service().reconciliarCheckout(c.t.id), { status: 'aguardando' });
  assert.equal(c.t.mp_preapproval_id, c.assinatura.id);
  assert.equal(c.planos(), 0);
  c.mp.obterPagamentoAprovado = async () => ({ id: '12345', valor_centavos: 14900, moeda: 'BRL', status: 'approved' });
  assert.deepEqual(await c.service().reconciliarCheckout(c.t.id), { status: 'confirmado' });
  assert.deepEqual(await c.service().reconciliarCheckout(c.t.id), { status: 'confirmado' });
  assert.equal(c.planos(), 1);
});

test('ausência, duplicidade e erro do provedor preservam reserva', async () => {
  for (const modo of ['ausente', 'duplicado', 'erro']) {
    const c = fixture();
    c.mp.buscarAssinaturasPorPagador = async () => { if (modo === 'erro') throw new Error('falha'); return modo === 'ausente' ? [] : [c.assinatura, c.assinatura]; };
    if (modo === 'erro') await assert.rejects(c.service().reconciliarCheckout(c.t.id), /falha/);
    else assert.equal((await c.service().reconciliarCheckout(c.t.id)).status, 'revisao_manual');
    assert.equal(c.t.status, 'pendente'); assert.equal(c.t.mp_preapproval_id, null); assert.equal(c.planos(), 0);
  }
});

test('rejeita dados incompletos ou incompatíveis sem associar', async () => {
  for (const alterar of [a => { a.external_reference = 'outra'; }, a => { a.payer_email = 'outro'; }, a => { a.reason = 'outro'; }, a => { a.auto_recurring.transaction_amount = 89; }, a => { a.auto_recurring.currency_id = 'USD'; }, a => { a.auto_recurring.frequency = 2; }, a => { a.status = 'cancelled'; }]) {
    const c = fixture(); alterar(c.assinatura);
    assert.equal((await c.service().reconciliarCheckout(c.t.id)).status, 'revisao_manual');
    assert.equal(c.t.mp_preapproval_id, null);
  }
});

test('reconciliações concorrentes mantêm uma associação e um plano', async () => {
  const c = fixture(); let count = 0, liberar;
  const espera = new Promise(resolve => { liberar = resolve; });
  c.mp.buscarAssinaturasPorPagador = async () => { if (++count === 2) liberar(); await espera; return [c.assinatura]; };
  const resultados = await Promise.all([c.service().reconciliarCheckout(c.t.id), c.service().reconciliarCheckout(c.t.id)]);
  assert.ok(resultados.every(r => r.status === 'confirmado'));
  assert.equal(c.planos(), 1);
});

test('busca percorre páginas e falha se paginação for inconsistente', async t => {
  const anterior = globalThis.fetch, token = process.env.mercado_pago_access_token;
  t.after(() => { globalThis.fetch = anterior; if (token === undefined) delete process.env.mercado_pago_access_token; else process.env.mercado_pago_access_token = token; });
  process.env.mercado_pago_access_token = 'ficticio';
  const offsets = [];
  globalThis.fetch = async url => { const offset = Number(new URL(url).searchParams.get('offset')); offsets.push(offset); return { ok: true, json: async () => ({ paging: { total: 2, offset, limit: 1 }, results: [{ id: String(offset) }] }) }; };
  assert.equal((await buscarAssinaturasPorPagador('a@example.com')).length, 2);
  assert.deepEqual(offsets, [0, 1]);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ paging: { total: 2, offset: 0, limit: 1 }, results: [] }) });
  await assert.rejects(buscarAssinaturasPorPagador('a@example.com'), /incompleta/);
});

test('dry-run consulta pagamento sem escrever ou abrir transação', async () => {
  const c = fixture();
  c.prisma.checkout_tentativas.updateMany = async () => { throw new Error('escrita indevida'); };
  c.prisma.$transaction = async () => { throw new Error('transação indevida'); };
  const original = { ...c.t };
  assert.deepEqual(await c.service().reconciliarCheckout(c.t.id, { dryRun: true }), {
    status: 'diagnostico', assinatura: 'authorized', pagamento_aprovado: true, plano_ativado: false,
  });
  assert.deepEqual(c.t, original);
  c.mp.possuiPagamentoAprovado = async () => false;
  assert.equal((await c.service().reconciliarCheckout(c.t.id, { dryRun: true })).pagamento_aprovado, false);
  assert.equal(c.planos(), 0);
});

test('dry-run com id conhecido, incompatibilidade e erro nunca escreve', async () => {
  const c = fixture();
  c.t.status = 'aguardando'; c.t.mp_preapproval_id = c.assinatura.id;
  c.prisma.checkout_tentativas.updateMany = async () => { throw new Error('escrita indevida'); };
  c.prisma.$transaction = async () => { throw new Error('transação indevida'); };
  assert.equal((await c.service().reconciliarCheckout(c.t.id, { dryRun: true })).status, 'diagnostico');
  c.assinatura.payer_email = 'outra@example.com';
  assert.equal((await c.service().reconciliarCheckout(c.t.id, { dryRun: true })).status, 'revisao_manual');
  c.mp.consultarAssinatura = async () => { throw new Error('falha de rede'); };
  await assert.rejects(c.service().reconciliarCheckout(c.t.id, { dryRun: true }), /falha de rede/);
  assert.equal(c.t.status, 'aguardando');
});

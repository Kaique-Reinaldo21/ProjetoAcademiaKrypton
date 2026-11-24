import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validarUrlTeste } from './mysql-guard.mjs';

// A validação ocorre antes de importar Prisma ou o serviço (que carrega dotenv).
const url = validarUrlTeste(process.env.DATABASE_URL);
// O gateway não recebe credenciais reais na suíte de integração.
process.env.mercado_pago_access_token = 'token-ficticio-de-teste';
globalThis.fetch = async () => { throw new Error('Rede externa bloqueada na integração'); };
const { PrismaClient } = await import('@prisma/client');
const { criarServicoCheckout } = await import('../src/services/checkout.service.js');
const clientes = [new PrismaClient({ datasources: { db: { url } } }), new PrismaClient({ datasources: { db: { url } } })];
const [a, b] = clientes;
const ids = [];
const limite = { timeout: 20000 };
function encontro(n) {
  let count = 0, release;
  const promise = new Promise(resolve => { release = resolve; });
  return async () => { if (++count === n) release(); await promise; };
}
async function aluno() {
  const usuario = await a.usuarios.create({ data: { nome: 'Teste checkout', email: `${randomUUID()}@example.invalid`, data_nascimento: new Date('1990-01-01'), role: 'aluno' } });
  ids.push(usuario.id);
  return usuario;
}
function servico(prisma, mp = {}) {
  return criarServicoCheckout({ prisma, criarCheckoutAssinatura: async () => ({ id: `mp_${randomUUID()}`, url: 'https://example.invalid' }), consultarAssinatura: async () => { throw new Error('consulta não simulada'); }, possuiPagamentoAprovado: async () => true, obterPagamentoAprovado: async () => ({ id: String(Date.now()), valor_centavos: 14900, moeda: 'BRL', status: 'approved' }), ...mp });
}
test.before(async () => {
  const rows = await a.$queryRaw`SELECT DATABASE() AS db, VERSION() AS versao`;
  assert.equal(rows[0].db, 'academia_kripton_checkout_test');
  assert.match(rows[0].versao, /^8\./, 'É necessário MySQL 8');
});
test.after(async () => {
  try { if (ids.length) await a.transacoes_pagamento.deleteMany({ where: { usuario_id: { in: ids } } }); if (ids.length) await a.usuarios.deleteMany({ where: { id: { in: ids } } }); }
  finally { await Promise.all(clientes.map(c => c.$disconnect())); }
});

test('reservas simultâneas usam conexões independentes e geram apenas uma tentativa', limite, async () => {
  const u = await aluno();
  const start = encontro(2);
  let chamadas = 0;
  const mp = { criarCheckoutAssinatura: async () => { chamadas++; return { id: `mp_${randomUUID()}`, url: 'https://example.invalid' }; } };
  const resultados = await Promise.allSettled(clientes.map(async c => { await start(); return servico(c, mp).iniciarCheckout(u.id, 'pro'); }));
  assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(resultados.find(r => r.status === 'rejected').reason.status, 409);
  assert.equal(chamadas, 1);
  assert.equal(await a.checkout_tentativas.count({ where: { usuario_id: u.id, status: { in: ['pendente', 'aguardando'] } } }), 1);
});

test('confirmações simultâneas criam somente um plano', limite, async () => {
  const u = await aluno();
  const id = `mp_${randomUUID()}`;
  const tentativa = await a.checkout_tentativas.create({ data: { id: randomUUID(), usuario_id: u.id, tipo: 'pro', status: 'aguardando', mp_preapproval_id: id } });
  const barreira = encontro(2);
  const mp = { consultarAssinatura: async () => ({ id, status: 'authorized', external_reference: tentativa.id, payer_email: u.email }), obterPagamentoAprovado: async () => { await barreira(); return { id: '1111111111', valor_centavos: 14900, moeda: 'BRL', status: 'approved' }; } };
  const r = await Promise.all(clientes.map(c => servico(c, mp).confirmarCheckoutPorAssinatura(id)));
  assert.deepEqual(r, [{ status: 'confirmado' }, { status: 'confirmado' }]);
  assert.equal(await a.planos.count({ where: { mp_preapproval_id: id } }), 1);
  assert.equal(await a.transacoes_pagamento.count({ where: { mp_preapproval_id: id } }), 1);
});

test('rollback desfaz confirmação quando já existe assinatura ativa', limite, async () => {
  const u = await aluno();
  const id = `mp_${randomUUID()}`;
  const t = await a.checkout_tentativas.create({ data: { id: randomUUID(), usuario_id: u.id, tipo: 'pro', status: 'aguardando', mp_preapproval_id: id } });
  await a.planos.create({ data: { usuario_id: u.id, tipo: 'pro', mp_preapproval_id: `mp_${randomUUID()}` } });
  const mp = { consultarAssinatura: async () => ({ id, status: 'authorized', external_reference: t.id, payer_email: u.email }) };
  await assert.rejects(servico(a, mp).confirmarCheckoutPorAssinatura(id), e => e.status === 409);
  assert.equal((await a.checkout_tentativas.findUnique({ where: { id: t.id } })).status, 'aguardando');
  assert.equal(await a.planos.count({ where: { mp_preapproval_id: id } }), 0);
});

test('falha ao gravar assinatura simulada mantém reserva', limite, async () => {
  const u = await aluno();
  const id = `mp_${randomUUID()}`;
  await a.checkout_tentativas.create({ data: { id: randomUUID(), usuario_id: u.id, tipo: 'pro', status: 'erro', mp_preapproval_id: id } });
  let chamadas = 0;
  const s = servico(a, { criarCheckoutAssinatura: async () => { chamadas++; return { id, url: 'https://example.invalid' }; } });
  await assert.rejects(s.iniciarCheckout(u.id, 'pro'));
  assert.equal(await a.checkout_tentativas.count({ where: { usuario_id: u.id, status: 'pendente' } }), 1);
  await assert.rejects(s.iniciarCheckout(u.id, 'pro'), e => e.status === 409);
  assert.equal(chamadas, 1);
});

test('unicidade e chaves estrangeiras impedem registros inválidos', limite, async () => {
  const u = await aluno();
  const id = `mp_${randomUUID()}`;
  await a.planos.create({ data: { usuario_id: u.id, tipo: 'pro', mp_preapproval_id: id } });
  await assert.rejects(a.planos.create({ data: { usuario_id: u.id, tipo: 'pro', mp_preapproval_id: id } }), e => e.code === 'P2002');
  await assert.rejects(a.checkout_tentativas.create({ data: { id: randomUUID(), usuario_id: 4294967295, tipo: 'pro' } }), e => e.code === 'P2003');
  await a.checkout_tentativas.create({ data: { id: randomUUID(), usuario_id: u.id, tipo: 'pro', mp_preapproval_id: id } });
  await assert.rejects(a.checkout_tentativas.create({ data: { id: randomUUID(), usuario_id: u.id, tipo: 'pro', mp_preapproval_id: id } }), e => e.code === 'P2002');
});

test('espera por bloqueio expira e não grava tentativa', limite, async () => {
  const u = await aluno();
  let liberar, bloqueado;
  const espera = new Promise(resolve => { liberar = resolve; });
  const pronto = new Promise(resolve => { bloqueado = resolve; });
  const lock = a.$transaction(async tx => { await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${u.id} FOR UPDATE`; bloqueado(); await espera; }, { timeout: 10000 });
  try {
    await pronto;
    await assert.rejects(b.$transaction(async tx => { await tx.$executeRaw`SET innodb_lock_wait_timeout = 1`; await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${u.id} FOR UPDATE`; }, { timeout: 5000 }));
  } finally { liberar(); await lock; }
  assert.equal(await a.checkout_tentativas.count({ where: { usuario_id: u.id } }), 0);
});

test('deadlock em duas conexões é detectado e uma transação é revertida', limite, async () => {
  const u = await aluno(), v = await aluno();
  const barreira = encontro(2);
  const executar = (c, primeiro, segundo) => c.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${primeiro} FOR UPDATE`;
    await barreira();
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${segundo} FOR UPDATE`;
  }, { timeout: 8000 });
  const r = await Promise.allSettled([executar(a, u.id, v.id), executar(b, v.id, u.id)]);
  assert.equal(r.filter(x => x.status === 'rejected').length, 1);
  assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
  assert.match(String(r.find(x => x.status === 'rejected').reason), /deadlock|1213|P2034/i);
  assert.equal(await a.checkout_tentativas.count({ where: { usuario_id: { in: [u.id, v.id] } } }), 0);
});

test('duplicidade do pagamento reverte plano e status na transação real', limite, async () => {
  const u = await aluno();
  const assinatura1 = `mp_${randomUUID()}`, assinatura2 = `mp_${randomUUID()}`;
  const t1 = await a.checkout_tentativas.create({ data: { id: randomUUID(), usuario_id: u.id, tipo: 'pro', status: 'confirmado', mp_preapproval_id: assinatura1 } });
  const plano = await a.planos.create({ data: { usuario_id: u.id, tipo: 'pro', ativo: false, mp_preapproval_id: assinatura1 } });
  const paymentId = `9${Date.now()}`;
  await a.transacoes_pagamento.create({ data: { mp_payment_id: paymentId, mp_preapproval_id: assinatura1, usuario_id: u.id, tentativa_id: t1.id, plano_id: plano.id, valor_centavos: 14900, moeda: 'BRL', status: 'approved' } });
  const t2 = await a.checkout_tentativas.create({ data: { id: randomUUID(), usuario_id: u.id, tipo: 'pro', status: 'aguardando', mp_preapproval_id: assinatura2 } });
  const mp = { consultarAssinatura: async () => ({ id: assinatura2, status: 'authorized', external_reference: t2.id, payer_email: u.email }), obterPagamentoAprovado: async () => ({ id: paymentId, valor_centavos: 14900, moeda: 'BRL', status: 'approved' }) };
  await assert.rejects(servico(a, mp).confirmarCheckoutPorAssinatura(assinatura2));
  assert.equal((await a.checkout_tentativas.findUnique({ where: { id: t2.id } })).status, 'aguardando');
  assert.equal(await a.planos.count({ where: { mp_preapproval_id: assinatura2 } }), 0);
  assert.equal(await a.transacoes_pagamento.count({ where: { mp_payment_id: paymentId } }), 1);
});

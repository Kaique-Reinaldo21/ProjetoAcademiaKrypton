import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { validarUrlTeste } from './mysql-guard.mjs';

validarUrlTeste(process.env.DATABASE_URL);
const localFetch = globalThis.fetch;
const comprador = randomUUID() + '@example.invalid';
Object.assign(process.env, {
  NODE_ENV: 'development', PAYMENT_MODE: 'mp_test', JWT_SECRET: randomBytes(32).toString('hex'),
  MP_TEST_PAGADOR_EMAIL: comprador, MP_TEST_ACCESS_TOKEN: 'credencial-ficticia',
  MP_TEST_CREDENCIAL_CONFIRMADA: 'ASSINATURAS_TESTE', mercado_pago_access_token: '',
  MP_BACK_URL: 'http://127.0.0.1:3000/checkout/success',
});

let tentativa, chamadas = 0, liveMode = true;
const assinatura = randomUUID();
const pagamentoId = '8675309';
globalThis.fetch = async (input, opts) => {
  chamadas++;
  const url = new URL(input);
  assert.equal(url.origin, 'https://api.mercadopago.com');
  assert.equal(new Headers(opts.headers).get('authorization'), 'Bearer credencial-ficticia');
  if (url.pathname === '/preapproval/') {
    const dados = JSON.parse(opts.body);
    tentativa = dados.external_reference;
    assert.equal(dados.payer_email, comprador);
    assert.equal(new Headers(opts.headers).get('x-idempotency-key'), tentativa);
    return Response.json({ id: assinatura, init_point: 'https://www.mercadopago.com.br/subscriptions/checkout?fixture=1' });
  }
  if (url.pathname === '/preapproval/' + assinatura) {
    return Response.json({ id: assinatura, status: 'authorized', external_reference: tentativa, payer_email: comprador });
  }
  if (url.pathname === '/authorized_payments/search') return Response.json({ results: [{
    preapproval_id: assinatura, payment: { id: pagamentoId, status: 'approved' }, currency_id: 'BRL', transaction_amount: 149,
  }] });
  assert.equal(url.pathname, '/v1/payments/' + pagamentoId);
  return Response.json({ id: pagamentoId, live_mode: liveMode, status: 'approved', currency_id: 'BRL', transaction_amount: 149 });
};

const { default: express } = await import('express');
const { default: jwt } = await import('jsonwebtoken');
const { default: prisma } = await import('../src/lib/prisma.js');
const { default: checkout } = await import('../src/routes/checkout.routes.js');

test('checkout externo local integra APIs com provedor mock e exige pagamento de teste', async t => {
  const app = express();
  app.use(express.json());
  app.use('/api/checkout', checkout);
  const servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  const origem = 'http://127.0.0.1:' + servidor.address().port;
  const ids = [];
  t.after(async () => {
    await new Promise(resolve => servidor.close(resolve));
    try {
      await prisma.transacoes_pagamento.deleteMany({ where: { usuario_id: { in: ids } } });
      await prisma.usuarios.deleteMany({ where: { id: { in: ids } } });
    } finally { await prisma.$disconnect(); }
  });
  async function criarConta(email) {
    const conta = await prisma.usuarios.create({ data: { nome: 'Comprador fictício', email } });
    ids.push(conta.id);
    return conta;
  }
  async function chamar(u, rota, dados, esperado) {
    const resposta = await localFetch(origem + '/api/checkout' + rota, {
      method: dados ? 'POST' : 'GET',
      headers: { Origin: origem, 'Content-Type': 'application/json',
        Authorization: 'Bearer ' + jwt.sign({ id: u.id, versao_sessao: 0 }, process.env.JWT_SECRET) },
      body: dados ? JSON.stringify(dados) : undefined,
    });
    const json = await resposta.json();
    assert.equal(resposta.status, esperado, JSON.stringify(json));
    return json;
  }
  const dono = await criarConta(comprador);
  const outro = await criarConta(randomUUID() + '@example.invalid');
  assert.equal((await chamar(dono, '/demo/planos/pro', null, 200)).mercadoPagoExterno, true);
  assert.equal((await chamar(outro, '/demo/planos/pro', null, 200)).mercadoPagoExterno, false);
  const iniciar = { tipoPlano: 'pro', metodo: 'mercadopago_teste' };
  await chamar(outro, '', iniciar, 503);
  assert.equal(chamadas, 0);
  const aberta = await chamar(dono, '', iniciar, 201);
  assert.equal(aberta.tentativaId, tentativa);
  await chamar(dono, '', iniciar, 409);
  await chamar(outro, '/status/' + tentativa, null, 404);
  await chamar(dono, '/demo/' + tentativa + '/mercadopago', { acao: 'aprovar' }, 404);
  await chamar(dono, '/demo/' + tentativa, { acao: 'aprovar' }, 404);
  assert.equal((await chamar(dono, '/status/' + tentativa, null, 200)).status, 'aguardando');
  assert.equal(await prisma.planos.count({ where: { usuario_id: dono.id } }), 0);
  liveMode = false;
  assert.deepEqual(await chamar(dono, '/status/' + tentativa, null, 200),
    { status: 'confirmado', origem: 'mercadopago_test', metodo: 'mercadopago' });
  assert.equal((await chamar(dono, '/status/' + tentativa, null, 200)).status, 'confirmado');
  assert.equal(await prisma.planos.count({ where: { usuario_id: dono.id, ativo: true } }), 1);
  assert.deepEqual(await prisma.transacoes_pagamento.findMany({
    where: { usuario_id: dono.id }, select: { origem: true, status: true, moeda: true, valor_centavos: true },
  }), [{ origem: 'mercadopago_test', status: 'approved', moeda: 'BRL', valor_centavos: 14900 }]);
});

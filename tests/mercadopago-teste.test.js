import assert from 'node:assert/strict';
import test from 'node:test';
import { validarCredencialTesteMercadoPago, validarPagadorTeste, urlExternaMercadoPago } from '../src/config/mercadopago-teste.js';
import { criarCheckoutAssinatura, obterPagamentoAprovado, consultarFatura } from '../src/gatewary/mercadopago.js';

const env = {
  PAYMENT_MODE: 'mp_test', NODE_ENV: 'development',
  DATABASE_URL: 'mysql://fixture:ficticio@127.0.0.1:3307/academia_kripton_checkout_test',
  MP_TEST_ACCESS_TOKEN: 'somente-fixture', MP_TEST_CREDENCIAL_CONFIRMADA: 'ASSINATURAS_TESTE',
  MP_TEST_PAGADOR_EMAIL: 'comprador@example.invalid', MP_BACK_URL: 'http://127.0.0.1:3000/checkout/success',
  mercado_pago_access_token: '', RENDER: '', DEMO_DEPLOYMENT: '', RENDER_EXTERNAL_HOSTNAME: '',
};

test('modo externo exige opt-in, conta de teste e banco local dedicado', () => {
  assert.equal(validarCredencialTesteMercadoPago(env).pagador, 'comprador@example.invalid');
  for (const alteracao of [
    { PAYMENT_MODE: 'demo' }, { NODE_ENV: 'production' }, { RENDER: 'true' }, { DEMO_DEPLOYMENT: 'academico_oficial' },
    { DATABASE_URL: env.DATABASE_URL.replace('127.0.0.1', '147.224.191.149') },
    { DATABASE_URL: env.DATABASE_URL + '?socket=/tmp/mysql.sock' }, { MP_TEST_CREDENCIAL_CONFIRMADA: '' },
    { MP_TEST_ACCESS_TOKEN: '' }, { mercado_pago_access_token: 'fixture-legado' },
  ]) assert.throws(() => validarCredencialTesteMercadoPago({ ...env, ...alteracao }), e => e.codigo.startsWith('mp_teste_'));
  assert.throws(() => validarPagadorTeste('outro@example.invalid', env), { codigo: 'mp_teste_pagador' });
  for (const url of ['http://mercadopago.com.br', 'https://mercadopago.com.br.evil.invalid', 'https://x@mercadopago.com.br', 'https://mercadopago.com.br:3000']) {
    assert.throws(() => urlExternaMercadoPago(url), { codigo: 'mp_url_invalida' });
  }
});

test('gateway reutiliza preapproval, envia chave idempotente e só comprova pagamento de teste', async t => {
  const anterior = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]));
  Object.assign(process.env, env);
  t.after(() => {
    for (const [k, v] of Object.entries(anterior)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  let chamadas = 0;
  let live_mode = true;
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    chamadas++;
    const url = new URL(input);
    assert.equal(url.hostname, 'api.mercadopago.com');
    const headers = new Headers(options.headers);
    assert.equal(headers.get('authorization'), 'Bearer somente-fixture');
    if (url.pathname === '/preapproval/') {
      assert.equal(headers.get('x-idempotency-key'), 'tentativa-fixture');
      const body = JSON.parse(options.body);
      assert.equal(body.status, 'pending');
      assert.equal(body.external_reference, 'tentativa-fixture');
      assert.equal(body.payer_email, env.MP_TEST_PAGADOR_EMAIL);
      return Response.json({ id: 'assinatura-fixture', init_point: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=fixture' });
    }
    if (url.pathname === '/authorized_payments/search') return Response.json({ results: [{
      preapproval_id: 'assinatura-fixture', payment: { id: 1234, status: 'approved' },
      currency_id: 'BRL', transaction_amount: 89,
    }] });
    assert.equal(url.pathname, '/v1/payments/1234');
    return Response.json({ id: 1234, live_mode, status: 'approved', currency_id: 'BRL', transaction_amount: 89 });
  });
  await assert.rejects(criarCheckoutAssinatura({ tipo: 'basico', email: 'terceiro@example.invalid', tentativaId: 'tentativa-fixture' }),
    { codigo: 'mp_teste_pagador' });
  assert.equal(chamadas, 0);
  assert.equal((await criarCheckoutAssinatura({ tipo: 'basico', email: env.MP_TEST_PAGADOR_EMAIL, tentativaId: 'tentativa-fixture' })).id, 'assinatura-fixture');
  assert.equal(await obterPagamentoAprovado('assinatura-fixture', 'basico'), null);
  live_mode = false;
  assert.equal((await obterPagamentoAprovado('assinatura-fixture', 'basico')).id, '1234');
  process.env.RENDER = 'true';
  const total = chamadas;
  await assert.rejects(consultarFatura('1234'), { codigo: 'mp_teste_ambiente' });
  assert.equal(chamadas, total);
});

test('controles de simulação recusam uma tentativa de assinatura externa', async t => {
  const anterior = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]));
  Object.assign(process.env, env);
  t.after(() => {
    for (const [k, v] of Object.entries(anterior)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  const { checkoutMetodos } = await import('../src/services/checkout-metodos.service.js');
  const externo = { id: 'assinatura-externa-fixture', usuario_id: 42, metodo: 'mercadopago' };
  const escrita = t.mock.fn(async () => { throw Error('O simulador não deve gravar uma tentativa externa.'); });
  const db = { checkout_tentativas: {
    updateMany: escrita,
    findFirst: async ({ where }) => {
      assert.equal(where.usuario_id, externo.usuario_id);
      assert.equal(where.id, externo.id);
      return where.metodo === externo.metodo ? externo : null;
    },
  } };
  await assert.rejects(checkoutMetodos.simularResposta(externo.usuario_id, externo.id, 'aprovar', db), { status: 404 });
  assert.equal(escrita.mock.callCount(), 0);
});

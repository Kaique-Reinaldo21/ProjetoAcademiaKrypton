import './setup-isolamento.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarServicoCheckout } from '../src/services/checkout.service.js';
import { possuiPagamentoAprovado } from '../src/gatewary/mercadopago.js';

function cenario() {
  const tentativa = { id: 'tentativa-1', usuario_id: 1, tipo: 'pro', unidade_id: null, status: 'aguardando', mp_preapproval_id: 'assinatura_123' };
  const planos = [];
  const usuario = { id: 1, email: 'aluno@example.com', role: 'aluno' };
  const assinatura = { id: tentativa.mp_preapproval_id, status: 'authorized', external_reference: tentativa.id, payer_email: usuario.email };
  const prisma = {
    $queryRaw: async () => [],
    usuarios: { findUnique: async () => usuario },
    unidades: { findUnique: async () => ({ id: 1 }) },
    checkout_tentativas: {
      findFirst: async () => null,
      findUnique: async () => tentativa,
      create: async ({ data }) => Object.assign(tentativa, data),
      update: async ({ data }) => Object.assign(tentativa, data),
      updateMany: async ({ where, data }) => {
        if (tentativa.id !== where.id || tentativa.status !== where.status || (where.mp_preapproval_id && tentativa.mp_preapproval_id !== where.mp_preapproval_id)) return { count: 0 };
        Object.assign(tentativa, data);
        return { count: 1 };
      },
    },
    transacoes_pagamento: { create: async () => ({}) },
    planos: {
      findFirst: async () => planos.find(p => p.ativo && p.mp_preapproval_id) || null,
      updateMany: async () => { for (const plano of planos) plano.ativo = false; },
      create: async ({ data }) => { const plano = { id: 1, ...data }; planos.push(plano); return plano; },
    },
  };
  prisma.$transaction = async fn => fn(prisma);
  const mp = {
    criarCheckoutAssinatura: async () => ({ id: 'assinatura_123', url: 'https://example.com/checkout' }),
    consultarAssinatura: async () => assinatura,
    possuiPagamentoAprovado: async () => true,
    obterPagamentoAprovado: async () => ({ id: '12345', valor_centavos: 14900, moeda: 'BRL', status: 'approved' }),
  };
  const servico = () => criarServicoCheckout({ prisma, ...mp });
  return { tentativa, planos, usuario, assinatura, prisma, mp, servico };
}

test('valida plano, usuário e unidade antes de criar tentativa', async () => {
  const c = cenario();
  await assert.rejects(c.servico().iniciarCheckout(1, 'invalido'), /plano válido/);
  c.usuario.role = 'admin';
  await assert.rejects(c.servico().iniciarCheckout(1, 'pro'), e => e.status === 403);
  c.usuario.role = 'aluno';
  await assert.rejects(c.servico().iniciarCheckout(1, 'basico', 0), /unidade válida/);
  c.prisma.unidades.findUnique = async () => null;
  await assert.rejects(c.servico().iniciarCheckout(1, 'basico', 5), e => e.status === 404);
});

test('impede tentativa pendente e assinatura recorrente ativa', async () => {
  const c = cenario();
  c.prisma.checkout_tentativas.findFirst = async () => c.tentativa;
  await assert.rejects(c.servico().iniciarCheckout(1, 'pro'), e => e.status === 409);
  c.prisma.checkout_tentativas.findFirst = async () => null;
  c.planos.push({ ativo: true, mp_preapproval_id: 'outra' });
  await assert.rejects(c.servico().iniciarCheckout(1, 'pro'), e => e.status === 409);
});

test('cria checkout e mantém reserva quando provedor falha', async () => {
  const c = cenario();
  const resultado = await c.servico().iniciarCheckout(1, 'pro');
  assert.equal(resultado.url, 'https://example.com/checkout');
  assert.equal(c.tentativa.status, 'aguardando');
  c.mp.criarCheckoutAssinatura = async () => { throw new Error('provedor indisponível'); };
  await assert.rejects(c.servico().iniciarCheckout(1, 'pro'), /provedor indisponível/);
  assert.equal(c.tentativa.status, 'pendente');
});

test('não ativa assinatura pendente, não autorizada ou com identificadores incompatíveis', async () => {
  for (const alteracao of [{ status: 'pending' }, { status: 'paused' }, { id: 'outra' }, { external_reference: 'outra' }]) {
    const c = cenario();
    Object.assign(c.assinatura, alteracao);
    assert.deepEqual(await c.servico().confirmarCheckoutPorAssinatura('assinatura_123'), { status: 'aguardando' });
    assert.equal(c.planos.length, 0);
  }
});

test('exige pagador correspondente e pagamento aprovado', async () => {
  const c = cenario();
  c.assinatura.payer_email = 'outro@example.com';
  await assert.rejects(c.servico().confirmarCheckoutPorAssinatura('assinatura_123'), e => e.status === 409);
  c.assinatura.payer_email = c.usuario.email;
  c.mp.obterPagamentoAprovado = async () => null;
  assert.deepEqual(await c.servico().confirmarCheckoutPorAssinatura('assinatura_123'), { status: 'aguardando' });
  assert.equal(c.planos.length, 0);
});

test('confirma uma única vez e propaga falhas sem ativar plano', async () => {
  const c = cenario();
  c.mp.consultarAssinatura = async () => { throw new Error('falha de consulta'); };
  await assert.rejects(c.servico().confirmarCheckoutPorAssinatura('assinatura_123'), /falha de consulta/);
  assert.equal(c.planos.length, 0);
  c.mp.consultarAssinatura = async () => c.assinatura;
  assert.deepEqual(await c.servico().confirmarCheckoutPorAssinatura('assinatura_123'), { status: 'confirmado' });
  assert.deepEqual(await c.servico().confirmarCheckoutPorAssinatura('assinatura_123'), { status: 'confirmado' });
  assert.equal(c.planos.length, 1);
  assert.equal(c.planos[0].mp_preapproval_id, 'assinatura_123');
});

test('consulta de pagamento filtra status, assinatura, moeda e valor sem rede', async t => {
  const tokenAnterior = process.env.mercado_pago_access_token;
  const fetchAnterior = globalThis.fetch;
  process.env.mercado_pago_access_token = 'token-ficticio';
  t.after(() => {
    globalThis.fetch = fetchAnterior;
    if (tokenAnterior === undefined) delete process.env.mercado_pago_access_token;
    else process.env.mercado_pago_access_token = tokenAnterior;
  });
  let faturas = [];
  globalThis.fetch = async url => {
    assert.match(url, /preapproval_id=assinatura_123/);
    return { ok: true, json: async () => ({ results: faturas }) };
  };
  const aprovada = { preapproval_id: 'assinatura_123', payment: { id: 12345, status: 'approved' }, currency_id: 'BRL', transaction_amount: 149 };
  for (const alteracao of [{ payment: { status: 'pending' } }, { payment: { status: 'rejected' } }, { payment: { id: 12345, status: 'approved', status_detail: 'partially_refunded' } }, { payment: { status: 'approved' } }, { preapproval_id: 'outra' }, { currency_id: 'USD' }, { transaction_amount: 89 }]) {
    faturas = [{ ...aprovada, ...alteracao }];
    assert.equal(await possuiPagamentoAprovado('assinatura_123', 'pro'), false);
  }
  faturas = [aprovada];
  assert.equal(await possuiPagamentoAprovado('assinatura_123', 'pro'), true);
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(possuiPagamentoAprovado('assinatura_123', 'pro'), /HTTP 503/);
});

function barreira(total) {
  let chegadas = 0;
  let liberar;
  const espera = new Promise(resolve => { liberar = resolve; });
  return async () => {
    if (++chegadas === total) liberar();
    await espera;
  };
}

test('reservas simultâneas são serializadas pelo bloqueio simulado', async () => {
  const c = cenario();
  const chegada = barreira(2);
  let fila = Promise.resolve();
  let reservada = false;
  let chamadasMP = 0;
  c.prisma.$transaction = async fn => {
    await chegada();
    let liberar;
    const anterior = fila;
    fila = new Promise(resolve => { liberar = resolve; });
    await anterior;
    try { return await fn(c.prisma); } finally { liberar(); }
  };
  c.prisma.checkout_tentativas.findFirst = async () => reservada ? c.tentativa : null;
  c.prisma.checkout_tentativas.create = async ({ data }) => { reservada = true; return Object.assign(c.tentativa, data); };
  c.mp.criarCheckoutAssinatura = async () => {
    chamadasMP++;
    return { id: 'assinatura_123', url: 'https://example.com' };
  };
  const resultados = await Promise.allSettled([
    c.servico().iniciarCheckout(1, 'pro'),
    c.servico().iniciarCheckout(1, 'pro'),
  ]);
  assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(resultados.find(r => r.status === 'rejected').reason.status, 409);
  assert.equal(chamadasMP, 1);
});

test('confirmações simultâneas criam um único plano com aquisição simulada', async () => {
  const c = cenario();
  const chegada = barreira(2);
  c.mp.obterPagamentoAprovado = async () => { await chegada(); return { id: '12345', valor_centavos: 14900, moeda: 'BRL', status: 'approved' }; };
  // A atualização condicional é atômica neste mock; não modela transações MySQL.
  const resultados = await Promise.all([
    c.servico().confirmarCheckoutPorAssinatura('assinatura_123'),
    c.servico().confirmarCheckoutPorAssinatura('assinatura_123'),
  ]);
  assert.deepEqual(resultados, [{ status: 'confirmado' }, { status: 'confirmado' }]);
  assert.equal(c.planos.length, 1);
});

test('aquisição perdida retorna estado persistido, inclusive ausência', async () => {
  for (const estado of ['aguardando', 'erro', null]) {
    const c = cenario();
    let consultas = 0;
    c.prisma.checkout_tentativas.findUnique = async () => ++consultas === 1 ? c.tentativa : estado ? { status: estado } : null;
    c.prisma.checkout_tentativas.updateMany = async () => ({ count: 0 });
    assert.deepEqual(await c.servico().confirmarCheckoutPorAssinatura('assinatura_123'), { status: estado || 'desconhecido' });
    assert.equal(c.planos.length, 0);
  }
});

test('falha ao salvar assinatura criada mantém reserva e impede nova cobrança', async () => {
  const c = cenario();
  let reservada = false;
  let chamadasMP = 0;
  c.prisma.checkout_tentativas.findFirst = async () => reservada ? c.tentativa : null;
  c.prisma.checkout_tentativas.create = async ({ data }) => { reservada = true; return Object.assign(c.tentativa, data); };
  c.prisma.checkout_tentativas.updateMany = async () => { throw new Error('banco indisponível'); };
  c.mp.criarCheckoutAssinatura = async () => { chamadasMP++; return { id: 'assinatura_123', url: 'https://example.com' }; };
  await assert.rejects(c.servico().iniciarCheckout(1, 'pro'), /banco indisponível/);
  assert.equal(c.tentativa.status, 'pendente');
  await assert.rejects(c.servico().iniciarCheckout(1, 'pro'), e => e.status === 409);
  assert.equal(chamadasMP, 1);
});

test('envia ao gateway o e-mail obtido do aluno autenticado', async () => {
  const c = cenario();
  let pedido;
  c.mp.criarCheckoutAssinatura = async dados => { pedido = dados; return { id: 'assinatura_123', url: 'https://example.invalid' }; };
  await c.servico().iniciarCheckout(1, 'pro');
  assert.equal(pedido.email, c.usuario.email);
  assert.equal(pedido.tipo, 'pro');
  assert.equal(pedido.tentativaId, c.tentativa.id);
});

test('falha de configuração anterior à reserva não cria tentativa', async () => {
  const c = cenario();
  let criou = false;
  c.prisma.checkout_tentativas.create = async () => { criou = true; };
  const servico = criarServicoCheckout({ prisma: c.prisma, ...c.mp, validarConfiguracaoCheckout: () => { throw new Error('configuração'); } });
  await assert.rejects(servico.iniciarCheckout(1, 'pro'), /configuração/);
  assert.equal(criou, false);
});

test('pagamento confirmado gera registro financeiro vinculado ao plano', async () => {
  const c = cenario(); let transacao;
  c.prisma.transacoes_pagamento.create = async ({ data }) => { transacao = data; };
  await c.servico().confirmarCheckoutPorAssinatura('assinatura_123');
  assert.equal(transacao.mp_payment_id, '12345');
  assert.equal(transacao.plano_id, 1);
  assert.equal(transacao.tentativa_id, c.tentativa.id);
  assert.equal(transacao.usuario_id, c.usuario.id);
  assert.equal(transacao.valor_centavos, 14900);
  assert.equal(transacao.status, 'approved');
});

test('pagamento sem identificador, recusado ou incompatível não cria plano', async () => {
  for (const pagamento of [{ id: '', valor_centavos: 14900, moeda: 'BRL', status: 'approved' }, { id: '7', valor_centavos: 14900, moeda: 'BRL', status: 'rejected' }, { id: '7', valor_centavos: 8900, moeda: 'BRL', status: 'approved' }]) {
    const c = cenario(); c.mp.obterPagamentoAprovado = async () => pagamento;
    assert.deepEqual(await c.servico().confirmarCheckoutPorAssinatura('assinatura_123'), { status: 'aguardando' });
    assert.equal(c.planos.length, 0);
  }
});

test('falha ao registrar pagamento não retorna confirmação', async () => {
  const c = cenario();
  c.prisma.transacoes_pagamento.create = async () => { throw new Error('falha ao registrar transação'); };
  await assert.rejects(c.servico().confirmarCheckoutPorAssinatura('assinatura_123'), /falha ao registrar/);
});

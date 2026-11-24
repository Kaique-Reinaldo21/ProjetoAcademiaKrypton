import './setup-isolamento.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validarConfiguracaoCheckout } from '../src/gatewary/mercadopago.js';
import { classificarErroCriacao } from '../src/gatewary/erros-checkout.js';

test('valida URL de retorno e impede destinos de produção conhecidos em desenvolvimento', t => {
  const anterior = { ...process.env };
  t.after(() => { for (const k of ['MP_BACK_URL', 'NODE_ENV', 'mercado_pago_access_token']) { if (anterior[k] === undefined) delete process.env[k]; else process.env[k] = anterior[k]; } });
  process.env.NODE_ENV = 'development'; process.env.mercado_pago_access_token = 'ficticio';
  for (const url of ['http://localhost:3000/checkout/success', 'https://teste.example.invalid/checkout/success']) {
    process.env.MP_BACK_URL = url;
    assert.equal(validarConfiguracaoCheckout().pathname, '/checkout/success');
  }
  for (const url of ['https://app.onrender.com/checkout/success', 'https://academiakripton.com.br/checkout/success', 'https://teste.example.invalid/outro', 'http://teste.example.invalid/checkout/success', 'javascript:alert(1)', 'https://teste.example.invalid/checkout/success?x=1']) {
    process.env.MP_BACK_URL = url;
    assert.throws(() => validarConfiguracaoCheckout(), e => e.codigo.startsWith('retorno_'));
  }
  process.env.mercado_pago_access_token = '';
  assert.throws(() => validarConfiguracaoCheckout(), e => e.codigo === 'token_ausente');
});

test('classifica erros sem repassar dados privados do provedor', () => {
  for (const [erro, codigo] of [[{ status: 400, message: 'Both payer and collector must be real or test users segredo' }, 'ambiente_pagador_incompativel'], [{ status: 401, message: 'segredo' }, 'credencial_recusada'], [{ status: 400, message: 'segredo' }, 'requisicao_recusada'], [{ status: 503, message: 'segredo' }, 'gateway_indisponivel']]) {
    const resultado = classificarErroCriacao(erro);
    assert.equal(resultado.codigo, codigo);
    assert.doesNotMatch(resultado.message, /segredo/);
  }
});

test('gateway real bloqueia consultas em modo demo antes de usar rede', async t => {
  const anterior = process.env.PAYMENT_MODE;
  t.after(() => { if (anterior === undefined) delete process.env.PAYMENT_MODE; else process.env.PAYMENT_MODE = anterior; });
  process.env.PAYMENT_MODE = 'demo';
  const { consultarAssinatura, consultarFatura } = await import('../src/gatewary/mercadopago.js');
  await assert.rejects(consultarAssinatura('assinatura_123'), e => e.codigo === 'gateway_desativado_demo');
  await assert.rejects(consultarFatura('123'), e => e.codigo === 'gateway_desativado_demo');
});

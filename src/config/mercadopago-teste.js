import { validarModoDemo } from './demo-db.js';
import { ErroGatewayCheckout } from '../gatewary/erros-checkout.js';

const falhar = codigo => { throw new ErroGatewayCheckout(codigo, 'Mercado Pago de teste indisponível neste ambiente.'); };

export function emTesteMercadoPago(env = process.env) {
  return env.PAYMENT_MODE === 'mp_test';
}

export function validarBancoTesteMercadoPago(env = process.env) {
  if (!emTesteMercadoPago(env) || env.NODE_ENV !== 'development' || env.RENDER || env.RENDER_EXTERNAL_HOSTNAME || env.DEMO_DEPLOYMENT) falhar('mp_teste_ambiente');
  try { validarModoDemo({ ...env, PAYMENT_MODE: 'demo' }); }
  catch { falhar('mp_teste_banco'); }
}

export function validarCredencialTesteMercadoPago(env = process.env) {
  validarBancoTesteMercadoPago(env);
  const token = env.MP_TEST_ACCESS_TOKEN?.trim();
  const pagador = env.MP_TEST_PAGADOR_EMAIL?.trim().toLowerCase();
  if (env.MP_TEST_CREDENCIAL_CONFIRMADA !== 'ASSINATURAS_TESTE' || !token || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pagador || '') ||
      env.mercado_pago_access_token?.trim()) falhar('mp_teste_credencial');
  return { token, pagador };
}

export function validarPagadorTeste(email, env = process.env) {
  if (emTesteMercadoPago(env) && (typeof email !== 'string' || email.trim().toLowerCase() !== validarCredencialTesteMercadoPago(env).pagador)) {
    falhar('mp_teste_pagador');
  }
}

export function urlExternaMercadoPago(valor) {
  let url;
  try { url = new URL(valor); } catch { falhar('mp_url_invalida'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !/^(?:[a-z0-9-]+\.)*mercadopago\.com(?:\.br)?$/.test(url.hostname)) falhar('mp_url_invalida');
  return url.href;
}

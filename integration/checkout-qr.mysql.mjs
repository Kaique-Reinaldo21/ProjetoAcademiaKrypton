import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { once } from 'node:events';
import { validarUrlTeste } from './mysql-guard.mjs';

const url = validarUrlTeste(process.env.DATABASE_URL);
Object.assign(process.env, {
  NODE_ENV: 'development', PAYMENT_MODE: 'demo', JWT_SECRET: 'somente-integracao-checkout-qr',
  mercado_pago_access_token: '',
});
const fetchLocal = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Chamada externa não permitida'); };
const { default: express } = await import('express');
const { default: jwt } = await import('jsonwebtoken');
const { default: prisma } = await import('../src/lib/prisma.js');
const { default: checkout, criarRotasQrDemo } = await import('../src/routes/checkout.routes.js');
const { criarServicoDemo } = await import('../src/services/checkout-demo.service.js');
const { PrismaClient } = await import('@prisma/client');

test('QR integra autorização, consumo único concorrente e troca de plano no MySQL 8', { timeout: 20000 }, async () => {
  const [{ db, versao }] = await prisma.$queryRaw`SELECT DATABASE() AS db, VERSION() AS versao`;
  assert.equal(db, 'academia_kripton_checkout_test');
  assert.match(versao, /^8\./);
  const outroCliente = new PrismaClient({ datasources: { db: { url } } });
  const app = express();
  app.use(express.json());
  app.use('/api/checkout', checkout);
  app.use('/checkout-qr', criarRotasQrDemo(criarServicoDemo(outroCliente)));
  app.use(express.static('public'));
  const server = app.listen(0, '127.0.0.1');
  const ids = [];
  try {
    await once(server, 'listening');
    const origin = 'http://127.0.0.1:' + server.address().port;
    const headers = { Origin: origin, 'Content-Type': 'application/json' };
    const chamar = (path, body, aluno) => fetchLocal(origin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...headers, ...(aluno ? { Authorization: 'Bearer ' + jwt.sign({ id: aluno.id, role: 'aluno' }, process.env.JWT_SECRET) } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    async function aluno() {
      const u = await prisma.usuarios.create({ data: { email: randomUUID() + '@example.invalid', nome: 'Aluno teste QR', data_nascimento: new Date('2000-01-01'), role: 'aluno' } });
      ids.push(u.id);
      return u;
    }
    async function iniciar(u, tipoPlano) {
      const r = await chamar('/api/checkout', { tipoPlano }, u);
      assert.equal(r.status, 201);
      return (await r.json()).tentativaId;
    }
    const u = await aluno(), v = await aluno();
    const id = await iniciar(u, 'elite');
    const outroId = await iniciar(v, 'pro');
    const demo = '/api/checkout/demo/' + id;
    await prisma.planos.create({ data: { usuario_id: u.id, tipo: 'pro', ativo: true } });
    assert.equal((await chamar(demo + '/qr', {})).status, 401);
    assert.equal((await chamar(demo + '/qr', {}, v)).status, 404);
    assert.equal((await chamar(demo, undefined, v)).status, 404);
    assert.equal((await chamar(demo, { acao: 'pendente' }, u)).status, 200);
    assert.equal((await chamar('/logo.png')).headers.get('content-type'), 'image/png');

    async function gerar() {
      const r = await chamar(demo + '/qr', {}, u);
      assert.equal(r.status, 201);
      assert.match(r.headers.get('cache-control'), /no-store/);
      const { imagem, link } = await r.json();
      assert.match(imagem, /^data:image\/png;base64,/);
      const destino = new URL(link);
      assert.equal(destino.origin, origin);
      assert.equal(destino.pathname, '/checkout-qr');
      assert.equal(destino.search, '');
      assert.equal(new URLSearchParams(destino.hash.slice(1)).get('tentativa'), id);
      return new URLSearchParams(destino.hash.slice(1)).get('token');
    }
    const expirado = await gerar();
    const gravado = await prisma.checkout_tentativas.findUnique({ where: { id } });
    assert.equal(gravado.qr_token_hash, createHash('sha256').update(expirado).digest('hex'));
    const get = await chamar('/checkout-qr?token=' + expirado);
    assert.equal(get.status, 200);
    assert.equal(get.headers.get('referrer-policy'), 'no-referrer');
    assert.equal((await fetchLocal(origin + '/checkout-qr', { headers: { 'Sec-Purpose': 'prefetch' } })).status, 204);
    assert.equal((await (await chamar(demo, undefined, u)).json()).status, 'pending');
    assert.equal((await chamar('/checkout-qr', { tentativa: outroId, token: expirado })).status, 410);
    await prisma.checkout_tentativas.update({ where: { id }, data: { qr_expira_em: new Date(0) } });
    assert.equal((await chamar('/checkout-qr', { tentativa: id, token: expirado })).status, 410);
    const antigo = await gerar();
    const token = await gerar();
    assert.equal((await chamar('/checkout-qr', { tentativa: id, token: antigo })).status, 410);
    process.env.PAYMENT_MODE = 'real';
    try {
      assert.equal((await chamar('/checkout-qr')).status, 403);
      assert.equal((await chamar('/checkout-qr', { tentativa: id, token })).status, 403);
      assert.equal((await chamar(demo + '/qr', {}, u)).status, 403);
    } finally {
      process.env.PAYMENT_MODE = 'demo';
    }

    const resultados = await Promise.all([
      chamar('/checkout-qr', { tentativa: id, token }),
      chamar('/checkout-qr', { tentativa: id, token }),
    ]);
    assert.deepEqual(resultados.map(r => r.status).sort(), [200, 410]);
    assert.equal((await chamar('/checkout-qr', { tentativa: id, token })).status, 410);
    assert.equal((await (await chamar(demo, undefined, u)).json()).status, 'approved');
    assert.equal(await prisma.planos.count({ where: { usuario_id: u.id, ativo: true, tipo: 'elite' } }), 1);
    assert.equal(await prisma.planos.count({ where: { usuario_id: u.id, ativo: false, tipo: 'pro' } }), 1);
    const posterior = await iniciar(u, 'pro');
    assert.equal((await (await chamar('/api/checkout/demo/' + posterior, { acao: 'recusar' }, u)).json()).status, 'rejected');
    const historico = await (await chamar('/api/checkout/demo/historico', undefined, u)).json();
    assert.deepEqual(historico.map(t => t.status).sort(), ['approved', 'rejected']);
    assert.ok(historico.every(t => t.origem === 'demo'));
    assert.equal((await (await chamar('/api/checkout/demo/' + outroId, undefined, v)).json()).status, 'pending');
  } finally {
    server.close();
    try {
      if (ids.length) {
        await prisma.transacoes_pagamento.deleteMany({ where: { usuario_id: { in: ids } } });
        await prisma.usuarios.deleteMany({ where: { id: { in: ids } } });
      }
    } finally {
      await Promise.all([prisma.$disconnect(), outroCliente.$disconnect()]);
    }
  }
});

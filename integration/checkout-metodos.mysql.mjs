import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { validarUrlTeste } from './mysql-guard.mjs';

validarUrlTeste(process.env.DATABASE_URL);
Object.assign(process.env, {
  NODE_ENV: 'development', PAYMENT_MODE: 'demo',
  JWT_SECRET: randomBytes(32).toString('hex'), mercado_pago_access_token: '',
});
const fetchLocal = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Chamadas externas bloqueadas no teste'); };
const { default: express } = await import('express');
const { default: jwt } = await import('jsonwebtoken');
const { default: prisma } = await import('../src/lib/prisma.js');
const { default: admin } = await import('../src/routes/admin.routes.js');
const { default: checkout } = await import('../src/routes/checkout.routes.js');
const { confirmarCheckoutPorAssinatura, reconciliarCheckout } = await import('../src/services/checkout.service.js');
const { consultarAssinatura } = await import('../src/gatewary/mercadopago.js');

test('métodos acadêmicos compartilham reserva e isolam confirmação e histórico financeiro', { timeout: 20000 }, async () => {
  const [{ db, versao }] = await prisma.$queryRaw`SELECT DATABASE() AS db, VERSION() AS versao`;
  assert.equal(db, 'academia_kripton_checkout_test');
  assert.match(versao, /^8\./);
  const app = express();
  app.use(express.json());
  app.use('/api/checkout', checkout);
  app.use('/api/admin', admin);
  const server = app.listen(0, '127.0.0.1');
  const ids = [];
  try {
    await once(server, 'listening');
    const origem = 'http://127.0.0.1:' + server.address().port;
    function request(path, usuario, dados) {
      return fetchLocal(origem + path, {
        method: dados ? 'POST' : 'GET',
        headers: {
          Origin: origem,
          Authorization: 'Bearer ' + jwt.sign({ id: usuario.id }, process.env.JWT_SECRET),
          'Content-Type': 'application/json',
        },
        body: dados ? JSON.stringify(dados) : undefined,
      });
    }
    const api = (path, usuario, dados) => request('/api/checkout' + path, usuario, dados);
    async function criarConta(role = 'aluno') {
      const conta = await prisma.usuarios.create({
        data: { nome: 'Conta de teste', email: randomUUID() + '@example.invalid', role },
      });
      ids.push(conta.id);
      return conta;
    }
    const dono = await criarConta(), outro = await criarConta(), operador = await criarConta('admin');
    const anterior = await prisma.planos.create({ data: { usuario_id: dono.id, tipo: 'pro', ativo: true } });
    const escolher = await api('', dono, { tipoPlano: 'elite', escolherMetodo: true });
    assert.equal(escolher.status, 200);
    assert.deepEqual(await escolher.json(), { url: '/checkout-demo.html?plano=elite' });
    assert.equal(await prisma.checkout_tentativas.count({ where: { usuario_id: dono.id } }), 0);

    const mp = { tipoPlano: 'elite', metodo: 'mercadopago_simulado' };
    const qr = { tipoPlano: 'pro', metodo: 'qr_krypton' };
    const iniciar = async dados => {
      const r = await api('', dono, dados);
      assert.equal(r.status, 201);
      const { url, tentativaId } = await r.json();
      assert.equal(url, '/checkout-demo.html?tentativa=' + tentativaId);
      return tentativaId;
    };
    const id = await iniciar(mp);
    const inicio = await prisma.checkout_tentativas.findUnique({ where: { id } });
    assert.equal(inicio.metodo, 'mercadopago_simulado');
    assert.match(inicio.mp_preapproval_id, /^sim_mp_/);
    const retomar = await api('', dono, { tipoPlano: 'elite', escolherMetodo: true });
    assert.equal((await retomar.json()).tentativaId, id);
    assert.equal((await api('', dono, qr)).status, 409);
    assert.equal((await api('/demo/' + id, outro)).status, 404);
    assert.equal((await api('/demo/' + id + '/qr', dono, {})).status, 404);
    assert.equal((await api('/demo/' + id, dono, { acao: 'aprovar' })).status, 404);
    const responder = (tentativa, acao, usuario = dono) => api('/demo/' + tentativa + '/mercadopago', usuario, { acao });
    assert.equal((await responder(id, 'aprovar', outro)).status, 404);
    assert.equal((await (await responder(id, 'pendente')).json()).status, 'pending');
    assert.deepEqual(await confirmarCheckoutPorAssinatura(inicio.mp_preapproval_id), { status: 'desconhecido' });
    assert.deepEqual(await reconciliarCheckout(id), { status: 'desconhecido' });
    await assert.rejects(consultarAssinatura(inicio.mp_preapproval_id), { codigo: 'gateway_desativado_demo' });
    process.env.PAYMENT_MODE = 'real';
    try {
      assert.equal((await responder(id, 'aprovar')).status, 403);
      assert.equal((await api('', dono, mp)).status, 403);
    } finally {
      process.env.PAYMENT_MODE = 'demo';
    }
    assert.equal((await (await responder(id, 'recusar')).json()).status, 'rejected');
    assert.equal((await (await responder(id, 'aprovar')).json()).status, 'rejected');
    assert.equal((await prisma.planos.findUnique({ where: { id: anterior.id } })).ativo, true);

    const segunda = await iniciar(mp);
    const concorrentes = await Promise.all([responder(segunda, 'aprovar'), responder(segunda, 'aprovar')]);
    assert.deepEqual(await Promise.all(concorrentes.map(async r => (await r.json()).status)), ['approved', 'approved']);
    const ativa = await prisma.planos.findMany({ where: { usuario_id: dono.id, ativo: true } });
    assert.equal(ativa.length, 1);
    assert.equal(ativa[0].tipo, 'elite');
    assert.equal(ativa[0].mp_preapproval_id, null);

    const terceiro = await iniciar(qr);
    assert.equal((await responder(terceiro, 'aprovar')).status, 404);
    assert.deepEqual(await (await api('/status/' + terceiro, dono)).json(), {
      status: 'pendente', origem: 'demo', metodo: 'qr_krypton',
    });
    assert.equal((await api('/demo/' + terceiro, dono, { acao: 'aprovar' })).status, 200);

    const historico = await (await api('/demo/historico', dono)).json();
    assert.deepEqual(historico.map(t => [t.tentativa.metodo, t.origem, t.status]).sort(), [
      ['mercadopago_simulado', 'demo_mercadopago', 'approved'],
      ['mercadopago_simulado', 'demo_mercadopago', 'rejected'],
      ['qr_krypton', 'demo', 'approved'],
    ]);
    assert.equal((await request('/api/admin/pagamentos', dono)).status, 403);
    const administrativo = await request('/api/admin/pagamentos', operador);
    assert.equal(administrativo.status, 200);
    const financeiros = await prisma.transacoes_pagamento.findMany({
      where: { usuario_id: dono.id }, select: { id: true, origem: true, mp_payment_id: true },
    });
    const idsFinanceiros = new Set(financeiros.map(t => t.id));
    const registros = (await administrativo.json()).filter(t => idsFinanceiros.has(t.id));
    assert.deepEqual(registros.map(t => t.tentativa.metodo).sort(), ['mercadopago_simulado', 'mercadopago_simulado', 'qr_krypton']);
    assert.ok(registros.every(t => !Object.hasOwn(t, 'mp_payment_id') && !Object.hasOwn(t, 'usuario_id')));
    assert.ok(financeiros.every(t => t.origem !== 'mercadopago' && t.mp_payment_id.startsWith('demo_')));
    const disputa = await Promise.all([api('', outro, mp), api('', outro, qr)]);
    assert.deepEqual(disputa.map(r => r.status).sort(), [201, 409]);
    assert.equal(await prisma.checkout_tentativas.count({ where: { usuario_id: outro.id } }), 1);
  } finally {
    server.close();
    try {
      await prisma.transacoes_pagamento.deleteMany({ where: { usuario_id: { in: ids } } });
      await prisma.usuarios.deleteMany({ where: { id: { in: ids } } });
    } finally {
      await prisma.$disconnect();
    }
  }
});

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { validarUrlTeste } from './mysql-guard.mjs';

validarUrlTeste(process.env.DATABASE_URL);
const banco = new URL(process.env.DATABASE_URL);
banco.searchParams.set('connection_limit', '1');
banco.searchParams.set('pool_timeout', '1');
process.env.DATABASE_URL = banco.href;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { default: prisma } = await import('../src/lib/prisma.js');
const { default: express } = await import('express');
const { default: rotas } = await import('../src/routes/admin.routes.js');
const { default: jwt } = await import('jsonwebtoken');

test('pool de uma conexão e falha seletiva preservam indicadores independentes', async () => {
  const admin = await prisma.usuarios.create({
    data: { role: 'admin', nome: 'Teste local', email: randomUUID() + '@example.invalid' },
  });
  const app = express();
  app.use(rotas);
  const servidor = await new Promise(resolve => {
    const instancia = app.listen(0, '127.0.0.1', () => resolve(instancia));
  });
  const url = 'http://127.0.0.1:' + servidor.address().port;
  const token = jwt.sign({ id: admin.id }, process.env.JWT_SECRET);
  const obter = caminho => fetch(url + caminho, { headers: { Authorization: 'Bearer ' + token } });
  let atrasar = false;
  let falhar = false;
  prisma.$use(async (params, next) => {
    if (atrasar && params.model === 'usuarios' && params.action === 'count') {
      atrasar = false;
      await prisma.$queryRaw`SELECT SLEEP(1.5) AS espera`;
    }
    if (falhar && params.model === 'transacoes_pagamento') {
      const limiteMysql = params.action === 'groupBy';
      throw Object.assign(new Error('dsn-secreto@exemplo.invalid'), limiteMysql
        ? { name: 'PrismaClientUnknownRequestError', cause: { errno: 1203 } }
        : { name: 'PrismaClientKnownRequestError', code: 'P2024' });
    }
    return next(params);
  });
  const respostas = [];
  const logs = [];
  const original = console.error;
  try {
    for (const rota of ['/resumo', '/indicadores']) {
      atrasar = true;
      const r = await obter(rota);
      respostas.push([r.status, await r.json()]);
    }
    assert.deepEqual(respostas.map(([status]) => status), [200, 200]);
    assert.equal(typeof respostas[0][1].total_alunos, 'number');
    assert.ok(Array.isArray(respostas[0][1].planos_por_tipo));
    assert.equal(typeof respostas[1][1].ativos, 'number');
    assert.ok(Array.isArray(respostas[1][1].valores));

    console.error = (...itens) => logs.push(itens);
    falhar = true;
    const resposta = await obter('/indicadores');
    assert.equal(resposta.status, 200);
    const dados = await resposta.json();
    assert.equal(typeof dados.ativos, 'number');
    assert.equal(dados.pendentes, null);
    assert.equal(dados.valores, null);
    assert.match(JSON.stringify(logs), /indicadores\.pendentes.*PrismaClientKnownRequestError.*P2024/);
    assert.match(JSON.stringify(logs), /indicadores\.valores.*PrismaClientUnknownRequestError.*1203/);
    assert.doesNotMatch(JSON.stringify(logs), /dsn-secreto/);
  } finally {
    console.error = original;
    servidor.close();
    await prisma.usuarios.delete({ where: { id: admin.id } });
    await prisma.$disconnect();
  }
});

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { diaDoTreino } from '../src/routes/treinos-aluno.routes.js';

test('data do treino segue São Paulo antes e depois da meia-noite local', () => {
  assert.equal(diaDoTreino(new Date('2026-12-01T02:59:59Z')).toISOString().slice(0, 10), '2026-11-30');
  assert.equal(diaDoTreino(new Date('2026-12-01T03:00:00Z')).toISOString().slice(0, 10), '2026-12-01');
});

const { validarUrlTeste } = await import('./mysql-guard.mjs');
validarUrlTeste(process.env.DATABASE_URL);
process.env.JWT_SECRET = randomUUID() + randomUUID();
const { default: prisma } = await import('../src/lib/prisma.js');
const { default: express } = await import('express');
const { default: rotas } = await import('../src/routes/usuario.routes.js');
const { default: jwt } = await import('jsonwebtoken');

test('treinos exigem aluno, usam a data do servidor, isolam contas e não duplicam', async () => {
  const app = express();
  app.use(rotas);
  const servidor = await new Promise(resolve => {
    const instancia = app.listen(0, '127.0.0.1', () => resolve(instancia));
  });
  const url = 'http://127.0.0.1:' + servidor.address().port;
  const ids = [];
  const conta = async role => {
    const { id } = await prisma.usuarios.create({
      data: { role, nome: 'Teste local', email: randomUUID() + '@example.invalid' },
    });
    ids.push(id);
    return id;
  };
  const chamar = (id, path = '', method = 'GET', Origin = url) => fetch(url + '/treinos' + path, {
    method, headers: { Origin, ...(id && { Authorization: 'Bearer ' + jwt.sign({ id }, process.env.JWT_SECRET) }) },
  });
  try {
    const a = await conta('aluno'), b = await conta('aluno'), admin = await conta('admin');
    assert.equal((await chamar(null)).status, 401);
    assert.equal((await chamar(admin, '/hoje', 'PUT')).status, 403);
    assert.equal((await chamar(a, '/hoje', 'PUT', 'https://example.invalid')).status, 403);
    assert.equal((await chamar(a, '?semanas=-1')).status, 400);
    const respostas = await Promise.all([chamar(a, '/hoje', 'PUT'), chamar(a, '/hoje', 'PUT')]);
    assert.deepEqual(respostas.map(r => r.status), [204, 204]);
    const atual = await (await chamar(a)).json();
    assert.equal(atual.registros.length, 1);
    assert.equal(atual.registros[0].dia, atual.hoje);
    assert.equal(new Date(atual.segunda).getUTCDay(), 1);
    assert.deepEqual((await (await chamar(a, '?semanas=1')).json()).registros, []);
    assert.deepEqual((await (await chamar(b)).json()).registros, []);
    assert.equal((await chamar(b, '/hoje', 'DELETE')).status, 204);
    assert.equal((await (await chamar(a)).json()).registros.length, 1);
    assert.equal((await chamar(a, '/hoje', 'DELETE')).status, 204);
    assert.deepEqual((await (await chamar(a)).json()).registros, []);
  } finally {
    servidor.close();
    await prisma.usuarios.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});

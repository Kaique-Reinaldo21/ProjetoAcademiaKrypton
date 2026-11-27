import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { PNG } from 'pngjs';
import { validarUrlTeste } from './mysql-guard.mjs';

validarUrlTeste(process.env.DATABASE_URL);
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { default: prisma } = await import('../src/lib/prisma.js');
const { default: usuarioRoutes } = await import('../src/routes/usuario.routes.js');
const { default: express } = await import('express');
const { default: jwt } = await import('jsonwebtoken');

test('perfil altera somente o nome e foto pertence ao aluno autenticado', async () => {
  const [banco] = await prisma.$queryRaw`SELECT DATABASE() AS db, VERSION() AS versao`;
  assert.equal(banco.db, 'academia_kripton_checkout_test');
  assert.match(banco.versao, /^8\./);
  const app = express();
  app.use(express.json(), usuarioRoutes);
  const servidor = app.listen(0, '127.0.0.1');
  const ids = [];
  let consulta;
  try {
    await once(servidor, 'listening');
    const origem = 'http://127.0.0.1:' + servidor.address().port;
    async function conta(role = 'aluno') {
      const u = await prisma.usuarios.create({ data: {
        nome: 'Aluno de teste', email: randomUUID() + '@example.invalid', role,
      } });
      ids.push(u.id);
      return u;
    }
    const a = await conta(), b = await conta(), admin = await conta('admin');
    const chamar = (u, caminho, method = 'GET', tipo, body, origin = origem) => fetch(origem + caminho, {
      method, headers: {
        Origin: origin,
        ...(u && { Authorization: 'Bearer ' + jwt.sign({ id: u.id }, process.env.JWT_SECRET) }),
        ...(tipo && { 'Content-Type': tipo }),
      }, body,
    });
    const json = (u, dados) => chamar(u, '/perfil', 'PUT', 'application/json', JSON.stringify(dados));
    assert.equal((await json(a, { nome: 'Nome novo', email: b.email })).status, 400);
    assert.equal((await json(admin, { nome: 'Troca' })).status, 403);
    assert.equal((await json(a, { nome: ' Nome novo ' })).status, 200);
    const { usuario } = await (await chamar(a, '/perfil')).json();
    assert.equal(usuario.nome, 'Nome novo');
    assert.equal(usuario.email, a.email);
    assert.equal(usuario.possui_foto, false);

    const foto = '/perfil/foto';
    const pixels = Buffer.from([20, 100, 70, 255]);
    const png = PNG.sync.write({ width: 1, height: 1, data: pixels });
    assert.equal((await chamar(null, foto)).status, 401);
    assert.equal((await chamar(a, foto, 'PUT', 'image/svg+xml', png)).status, 415);
    assert.equal((await chamar(a, foto, 'PUT', 'image/png', Buffer.from('imagem inválida'))).status, 400);
    assert.equal((await chamar(a, foto, 'PUT', 'image/png', png, 'https://externo.example.invalid')).status, 403);
    assert.equal((await chamar(a, foto, 'PUT', 'image/png', png)).status, 204);
    const salva = await chamar(a, foto);
    assert.equal(salva.status, 200);
    assert.equal(salva.headers.get('content-type'), 'image/png');
    assert.match(salva.headers.get('cache-control'), /no-store/);
    assert.deepEqual(PNG.sync.read(Buffer.from(await salva.arrayBuffer())).data, pixels);
    assert.equal((await chamar(b, foto)).status, 404);
    assert.equal((await chamar(b, foto, 'DELETE')).status, 204);
    assert.equal((await chamar(a, foto)).status, 200);
    assert.equal((await chamar(a, foto, 'DELETE')).status, 204);
    assert.equal((await chamar(a, foto)).status, 404);

    const agenda = u => chamar(u, '/agendamento', 'POST', 'application/json',
      JSON.stringify({ tipo: 'personal', data_hora: new Date(Date.now() + 60 * 60_000).toISOString() }));
    await prisma.planos.create({ data: { usuario_id: a.id, tipo: 'pro', ativo: true } });
    assert.equal((await agenda(a)).status, 403);
    await prisma.planos.create({ data: { usuario_id: a.id, tipo: 'elite', ativo: true, vencimento: new Date('2025-01-01') } });
    assert.equal((await agenda(a)).status, 403);
    await prisma.planos.create({ data: { usuario_id: a.id, tipo: 'elite', ativo: true } });
    assert.equal((await agenda(a)).status, 400);
    const personal = await conta('personal');
    await prisma.vinculos_profissionais.create({ data: { aluno_id: a.id, profissional_id: personal.id } });
    assert.equal((await agenda(a)).status, 201);
    const minhaAgenda = (await (await chamar(a, '/agendamentos')).json()).agendamentos;
    assert.equal(minhaAgenda.length, 1);
    consulta = minhaAgenda[0].id;
    assert.equal((await prisma.agendamentos.findUnique({ where: { id: consulta } })).profissional_id, personal.id);
    assert.equal((await (await chamar(b, '/agendamentos')).json()).agendamentos.length, 0);
  } finally {
    servidor.close();
    if (consulta) {
      await prisma.jobs.deleteMany({ where: { idempotencia: { startsWith: 'consulta_agendada:' + consulta + ':' } } });
      await prisma.agendamentos.delete({ where: { id: consulta } });
    }
    await prisma.usuarios.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});

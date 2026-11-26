import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { validarUrlTeste } from './mysql-guard.mjs';

validarUrlTeste(process.env.DATABASE_URL);
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { default: prisma } = await import('../src/lib/prisma.js');
const { default: express } = await import('express');
const { default: rotas } = await import('../src/routes/admin.routes.js');
const { default: jwt } = await import('jsonwebtoken');

test('painel exige administrador, confere dados persistidos e limita campos privados', async () => {
  const app = express();
  app.use(rotas);
  const servidor = await new Promise(resolve => {
    const instancia = app.listen(0, '127.0.0.1', () => resolve(instancia));
  });
  const url = 'http://127.0.0.1:' + servidor.address().port;
  const ids = [];
  let unidade;
  const selo = randomUUID();
  const conta = async role => {
    const u = await prisma.usuarios.create({
      data: { role, nome: 'Teste ' + selo, email: randomUUID() + '@example.invalid' },
    });
    ids.push(u.id);
    return u;
  };
  const token = (u, extras = {}) => jwt.sign({ id: u.id, versao_sessao: u.versao_sessao, ...extras }, process.env.JWT_SECRET);
  const chamar = (path, autenticacao) => fetch(url + path, {
    headers: autenticacao ? { Authorization: 'Bearer ' + autenticacao } : {},
  });
  const lista = async (path, u) => {
    const r = await chamar(path, token(u));
    assert.equal(r.status, 200, path);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    return r.json();
  };
  try {
    const admin = await conta('admin'), aluno = await conta('aluno'), profissional = await conta('nutricionista');
    for (const path of ['/resumo', '/indicadores', '/alunos', '/logins', '/vencimentos',
      '/agendamentos-proximos', '/pagamentos', '/cadastros-semana', '/auditoria', '/unidades']) {
      assert.equal((await chamar(path)).status, 401);
      assert.equal((await chamar(path, token(aluno, { role: 'admin' }))).status, 403);
      assert.equal((await chamar(path, token(profissional))).status, 403);
    }
    const antes = await lista('/indicadores', admin);
    await prisma.planos.create({ data: { usuario_id: aluno.id, tipo: 'elite', vencimento: new Date(Date.now() + 2 * 86400000) } });
    await prisma.agendamentos.create({ data: { usuario_id: aluno.id, tipo: 'nutricionista', observacao: selo, data_hora: new Date(Date.now() + 2 * 3600000) } });
    await prisma.historico_logins.create({ data: { usuario_id: aluno.id, ip: '192.0.2.1', user_agent: selo } });
    await prisma.auditoria_contas.create({ data: { autor_id: admin.id, usuario_id: aluno.id, evento: 'recuperacao_administrativa' } });
    unidade = await prisma.unidades.create({ data: { nome: selo, endereco: 'Endereço de teste', cidade: 'Cidade de teste' } });
    for (const [origem, metodo, status, valor] of [
      ['demo', 'qr_krypton', 'approved', 24900],
      ['mercadopago', 'mercadopago', 'approved', 18900],
      ['demo_mercadopago', 'mercadopago_simulado', 'pending', 9900],
    ]) {
      const tentativa = await prisma.checkout_tentativas.create({ data: { id: randomUUID(), usuario_id: aluno.id, tipo: 'elite', metodo } });
      await prisma.transacoes_pagamento.create({
        data: { usuario_id: aluno.id, tentativa_id: tentativa.id, mp_payment_id: randomUUID(), valor_centavos: valor, moeda: 'BRL', origem, status },
      });
    }

    const indicadores = await lista('/indicadores', admin);
    for (const chave of ['ativos', 'pendentes', 'vencimentos', 'agendamentos']) assert.equal(indicadores[chave], antes[chave] + 1);
    for (const [origem, acrescimo] of [['demo', 24900], ['mercadopago', 18900], ['demo_mercadopago', 0]]) {
      const total = dados => dados.valores.find(v => v.origem === origem && v.moeda === 'BRL')?.valor_centavos ?? 0;
      assert.equal(total(indicadores) - total(antes), acrescimo);
    }
    const { alunos } = await lista('/alunos?busca=' + selo, admin);
    assert.deepEqual(alunos.map(a => a.id), [aluno.id]);
    assert.deepEqual(Object.keys(alunos[0]).sort(), ['ativo', 'created_at', 'email', 'id', 'nome', 'plano', 'vencimento']);
    assert.equal((await chamar('/alunos?pagina=-2', token(admin))).status, 400);
    assert.equal((await lista('/cadastros-semana', admin)).cadastros.length, 7);
    assert.ok((await lista('/unidades', admin)).unidades.some(u => u.nome === selo));
    assert.ok((await lista('/auditoria', admin)).atividades.some(a => a.autor_id === admin.id && a.usuario_id === aluno.id));
    const [{ ip, user_agent, email }] = (await lista('/logins', admin)).logins;
    assert.deepEqual([ip, user_agent, email], [undefined, undefined, undefined]);
    const agendamento = (await lista('/agendamentos-proximos', admin)).agendamentos.find(a => a.nome === aluno.nome);
    assert.ok(agendamento);
    assert.equal(agendamento.observacao, undefined);
    const [pagamento] = await lista('/pagamentos', admin);
    assert.equal(pagamento.mp_payment_id, undefined);
    assert.equal(pagamento.usuario_id, undefined);
    const sessao = token(admin);
    await prisma.usuarios.update({ where: { id: admin.id }, data: { versao_sessao: { increment: 1 } } });
    assert.equal((await chamar('/resumo', sessao)).status, 401);
  } finally {
    servidor.close();
    if (unidade) await prisma.unidades.delete({ where: { id: unidade.id } });
    await prisma.auditoria_contas.deleteMany({ where: { usuario_id: { in: ids } } });
    await prisma.transacoes_pagamento.deleteMany({ where: { usuario_id: { in: ids } } });
    await prisma.usuarios.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

test('perfis, agenda, fichas e worker persistem em MySQL descartável', async t => {
  const url = new URL(process.env.DATABASE_URL);
  const socket = url.searchParams.get('socket') || '';
  assert.equal(url.protocol, 'mysql:');
  assert.equal(url.hostname, 'localhost');
  assert.equal(url.pathname, '/krypton_perfis_teste');
  assert.match(socket, /^\/tmp\/krypton-perfis-test-[\w]+\/mysql\.sock$/);
  assert.equal([...url.searchParams.keys()].join(), 'socket');
  assert.equal(process.env.NODE_ENV, 'test');

  const db = new PrismaClient();
  const [{ caminho, semRede }] = await db.$queryRaw`SELECT @@socket AS caminho, @@skip_networking AS semRede`;
  assert.equal(caminho, socket);
  assert.ok(semRede);
  const { default: compartilhado } = await import('../src/lib/prisma.js');
  const { criarRotasProfissionais } = await import('../src/routes/perfis-profissionais.routes.js');
  const { processarUmaVez } = await import('../src/workers/notificacoes.worker.js');
  const { adquirir, enfileirar } = await import('../src/queues/notificacoes.queue.js');
  const { processarNotificacao } = await import('../src/jobs/notificacoes.job.js');
  const { default: authRoutes } = await import('../src/routes/auth.routes.js');

  const host = express();
  host.use(express.json());
  host.use('/profissionais', criarRotasProfissionais());
  host.use('/auth', authRoutes);
  const servidor = await new Promise(resolve => { const s = host.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(async () => {
    await new Promise(resolve => servidor.close(resolve));
    await db.$disconnect();
    await compartilhado.$disconnect();
  });
  const origem = 'http://127.0.0.1:' + servidor.address().port;

  async function request(usuario, rota, method = 'GET', body, status = 200) {
    const token = usuario && jwt.sign({ id: usuario.id, versao_sessao: 0 }, process.env.JWT_SECRET, { expiresIn: '2m' });
    const resposta = await fetch(origem + rota, { method, headers: {
      ...(token && { Authorization: 'Bearer ' + token }), 'Content-Type': 'application/json',
    }, body: body === undefined ? undefined : JSON.stringify(body) });
    const dados = await resposta.json();
    assert.equal(resposta.status, status, rota + ' ' + (dados.erro || ''));
    return dados;
  }
  const api = (user, rota, ...args) => request(user, '/profissionais' + rota, ...args);
  const admin = await db.usuarios.create({ data: { nome: 'Admin fixture', email: 'admin@example.invalid', role: 'admin' } });
  const senha = 'Frase fictícia longa 123!';
  const cadastro = await request(null, '/auth/cadastro', 'POST', {
    nome: 'Aluno fixture', email: 'aluno@example.invalid', senha, data_nascimento: '2001-01-01', role: 'admin',
  }, 201);
  const a = cadastro.usuario;
  assert.equal(a.role, 'aluno');
  const b = await db.usuarios.create({ data: { nome: 'Outro aluno', email: 'outro@example.invalid' } });
  const unidade = await db.unidades.create({ data: { nome: 'Unidade teste', endereco: 'Endereço fictício', cidade: 'Cidade teste' } });
  await db.planos.create({ data: { usuario_id: a.id, tipo: 'pro' } });
  await api(a, '/contas', 'POST', { nome: 'Negado' }, 403);
  async function criar(role, prefixo) {
    const email = prefixo + '@example.invalid';
    const c = await api(admin, '/contas', 'POST', { nome: prefixo, email, role, senha }, 201);
    assert.ok(!Object.hasOwn(c, 'senha_hash'));
    const login = await request(null, '/auth/login', 'POST', { email, senha });
    assert.equal(login.usuario.role, role);
    return c;
  }
  const p = await criar('personal', 'personal');
  const q = await criar('personal', 'outro-personal');
  const n = await criar('nutricionista', 'nutricao');
  const r = await criar('recepcao', 'recepcao');
  for (const profissional of [p, n]) await api(admin, '/contas/' + profissional.id + '/alunos/' + a.id, 'PUT', {});
  const payload = { aluno_id: a.id, titulo: 'Treino A', itens: [
    { divisao: 'A', nome: 'Agachamento', series: 3, repeticoes: '10', carga: '10 kg', descanso: '60 s' },
  ] };
  await api(p, '/fichas', 'POST', payload, 403);
  await db.planos.updateMany({ where: { usuario_id: a.id }, data: { tipo: 'elite' } });
  await api(r, '/fichas', 'POST', payload, 403);
  await api(q, '/fichas', 'POST', payload, 404);
  await api(p, '/fichas', 'POST', { ...payload, itens: [] }, 400);
  const treino = await api(p, '/fichas', 'POST', payload, 201);
  assert.equal((await api(p, '/fichas', 'POST', payload, 201)).id, treino.id);
  assert.equal(await db.jobs.count({ where: { tipo: 'treino_publicado' } }), 1);
  await api(p, '/fichas/' + treino.id, 'PUT', { ...payload, titulo: 'Treino A revisado' });
  await api(p, '/fichas/' + treino.id, 'PUT', { ...payload, titulo: 'Treino A revisado' });
  assert.equal(await db.jobs.count({ where: { tipo: 'treino_atualizado' } }), 1);
  await api(q, '/fichas/' + treino.id, 'PUT', payload, 404);
  assert.equal((await api(a, '/fichas?tipo=personal'))[0].titulo, 'Treino A revisado');
  assert.deepEqual(await api(b, '/fichas?tipo=personal'), []);
  await api(n, '/fichas', 'POST', {
    aluno_id: a.id, titulo: 'Plano fictício', itens: [{ refeicao: 'Almoço', horario: '12:30', alimentos: 'Arroz', quantidades: '1 porção' }],
  }, 201);
  assert.equal((await api(a, '/fichas?tipo=nutricionista'))[0].titulo, 'Plano fictício');
  const data_hora = new Date(Date.now() + 3_600_000).toISOString();
  const agendamento = { profissional_id: p.id, tipo: 'personal', unidade_id: unidade.id, data_hora };
  await api(b, '/agenda', 'POST', agendamento, 403);
  const agenda = await api(a, '/agenda', 'POST', { ...agendamento, aluno_id: b.id }, 201);
  assert.equal(agenda.usuario_id, a.id);
  await api(r, '/agenda', 'POST', { ...agendamento, aluno_id: a.id }, 409);
  await api(q, '/agenda/' + agenda.id, 'PATCH', { acao: 'confirmar' }, 404);
  await api(r, '/agenda/' + agenda.id, 'PATCH', { acao: 'confirmar' });
  await api(p, '/agenda/' + agenda.id, 'PATCH', { acao: 'reagendar', data_hora: new Date(Date.now() + 7_200_000).toISOString() });
  await api(a, '/agenda/' + agenda.id, 'PATCH', { acao: 'cancelar' });
  const operacao = await api(r, '/agenda', 'POST', { ...agendamento, aluno_id: a.id }, 201);
  await api(p, '/agenda/' + operacao.id, 'PATCH', { acao: 'confirmar' });
  await api(p, '/agenda/' + operacao.id, 'PATCH', { acao: 'concluir' });
  await api(r, '/recepcao', 'POST', { aluno_id: a.id, unidade_id: unidade.id, motivo: 'Atendimento fictício' }, 201);
  assert.equal((await api(r, '/recepcao')).ultimos.length, 1);
  assert.deepEqual(await api(q, '/agenda'), []);

  const pendentes = await db.jobs.count();
  assert.ok(pendentes >= 7);
  await db.$disconnect();
  const dono = await adquirir(db, 60_000);
  const outro = new PrismaClient();
  t.after(() => outro.$disconnect());
  await outro.jobs.update({ where: { id: dono.id }, data: { bloqueado_ate: new Date(0) } });
  const recuperado = await adquirir(outro, 60_000);
  assert.equal(recuperado.id, dono.id);
  await processarNotificacao(db, dono);
  assert.equal(await db.notificacoes.count(), 0);
  await processarNotificacao(outro, recuperado);
  await processarUmaVez(outro, async () => { throw Error('ERRO FICTÍCIO PRIVADO'); });
  const retry = await db.jobs.findFirst({ where: { erro: 'FALHA_PROCESSAMENTO' } });
  assert.ok(retry.programado_em > new Date());
  await db.jobs.update({ where: { id: retry.id }, data: { programado_em: new Date(0) } });
  for (let i = 0; i < pendentes * 2; i++) await Promise.all([processarUmaVez(db), processarUmaVez(outro)]);
  assert.equal(await db.jobs.count({ where: { situacao: 'concluido' } }), pendentes);
  await Promise.all([enfileirar(db, 'consulta_agendada', 'fixture-repetida', [a.id, a.id]),
    enfileirar(outro, 'consulta_agendada', 'fixture-repetida', [a.id])]);
  assert.equal(await db.jobs.count({ where: { idempotencia: 'fixture-repetida' } }), 1);
  await processarUmaVez(db);
  const minhas = await api(a, '/notificacoes');
  for (const categoria of ['consulta_agendada','consulta_confirmada','consulta_reagendada','consulta_cancelada','treino_publicado','treino_atualizado','alimentacao_publicada']) {
    assert.ok(minhas.itens.some(i => i.categoria === categoria), categoria);
  }
  assert.ok((await api(r, '/notificacoes')).itens.every(i => i.categoria.startsWith('consulta')));
  await api(b, '/notificacoes/' + minhas.itens[0].id, 'PATCH', {}, 404);
  await api(a, '/notificacoes/' + minhas.itens[0].id, 'PATCH', {});
  await api(a, '/notificacoes/lidas', 'PATCH', {});
  assert.equal((await api(a, '/notificacoes')).nao_lidas, 0);
  await api(admin, '/contas/' + p.id, 'PATCH', { ativo: false });
  await api(p, '/agenda', 'GET', undefined, 401);

  const login = () => request(null, '/auth/login', 'POST', { email: 'aluno@example.invalid', senha });
  const anterior = (await login()).token;
  const comToken = (token, rota, method = 'GET') =>
    fetch(origem + '/auth' + rota, { method, headers: { Authorization: 'Bearer ' + token } });
  assert.equal((await comToken(anterior, '/me')).status, 200);
  assert.equal((await comToken(anterior, '/logout', 'POST')).status, 200);
  assert.equal((await comToken(anterior, '/me')).status, 401);
  const atual = (await login()).token;
  assert.equal((await comToken(anterior, '/logout', 'POST')).status, 200);
  assert.equal((await comToken(atual, '/me')).status, 200);
});

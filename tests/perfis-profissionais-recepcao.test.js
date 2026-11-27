import test from 'node:test';
import assert from 'node:assert/strict';
import { criarServicoProfissionais } from '../src/services/perfis-profissionais.service.js';
import { criarRotasProfissionais } from '../src/routes/perfis-profissionais.routes.js';

test('cadastro presencial valida os campos e o servidor define obrigatoriamente aluno', async () => {
  let insercao;
  const servico = criarServicoProfissionais({ usuarios: { async create(opcoes) {
    insercao = opcoes;
    return { id: 42, nome: opcoes.data.nome, email: opcoes.data.email, role: opcoes.data.role };
  } } });
  const resposta = await servico.cadastrarAlunoRecepcao({ nome: 'Aluno Fictício', email: ' ALUNO@EXAMPLE.TEST ', senha: 'senha-ficticia', data_nascimento: '2000-01-02' });
  assert.deepEqual(resposta, { id: 42, nome: 'Aluno Fictício', email: 'aluno@example.test', role: 'aluno' });
  assert.equal(insercao.data.role, 'aluno');
  assert.equal(insercao.data.senha, undefined);
  assert.match(insercao.data.senha_hash, /^\$2[aby]\$/);
  assert.deepEqual(insercao.select, { id: true, nome: true, email: true, role: true });
  await assert.rejects(servico.cadastrarAlunoRecepcao({ nome: 'Escalada', email: 'a@example.test', senha: 'senha-ficticia', data_nascimento: '2000-01-02', role: 'admin' }), /Confira os dados/);
  await assert.rejects(servico.cadastrarAlunoRecepcao({ nome: 'Data inválida', email: 'a@example.test', senha: 'senha-ficticia', data_nascimento: '2026-02-31' }), /data de nascimento/);
});

test('somente recepcao pode chamar o endpoint de cadastro presencial', async () => {
  const chamadas = [];
  const router = criarRotasProfissionais({
    autenticar: (_req, _res, next) => next(),
    servico: { async cadastrarAlunoRecepcao(body) { chamadas.push(body); return { id: 1, role: 'aluno' }; } },
    notificacoes: { listar: async () => ({}), marcar: async () => true },
  });
  const layer = router.stack.find(item => item.route?.path === '/recepcao/alunos' && item.route.methods.post);
  assert.ok(layer);
  const handlers = layer.route.stack.map(item => item.handle);
  async function request(role) {
    const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    const req = { usuario: { id: 9, role }, body: { nome: 'Aluno Fictício' }, params: {}, query: {} };
    let index = 0;
    const run = async () => {
      const handler = handlers[index++];
      if (!handler) return;
      await handler(req, res, run);
    };
    await run();
    return res;
  }
  assert.equal((await request('aluno')).statusCode, 403);
  assert.equal(chamadas.length, 0);
  const ok = await request('recepcao');
  assert.equal(ok.statusCode, 201);
  assert.equal(chamadas.length, 1);
});

test('matrícula simulada exige papel recepção e mesma origem antes do checkout', async () => {
  let confirmacoes = 0;
  const router = criarRotasProfissionais({
    autenticar: (_req, _res, next) => next(),
    servico: {},
    checkoutDemo: { async matriculaPresencial(_usuario, body) { confirmacoes++; return { tentativaId: 'fixture', status: 'approved', origem: 'demo', confirmacao: body.confirmacao }; } },
    notificacoes: { listar: async () => ({}), marcar: async () => true },
  });
  const layer = router.stack.find(item => item.route?.path === '/recepcao/matricula-simulada' && item.route.methods.post);
  assert.ok(layer);
  const handlers = layer.route.stack.map(item => item.handle);
  async function request(role, origin = 'https://app.example.test') {
    const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    const req = { usuario: { id: 4, role }, body: { confirmacao: true }, protocol: 'https', get: key => key === 'Origin' ? origin : 'app.example.test' };
    let index = 0;
    const run = async () => { const handler = handlers[index++]; if (handler) await handler(req, res, run); };
    await run(); return res;
  }
  assert.equal((await request('aluno')).statusCode, 403);
  assert.equal((await request('recepcao', 'https://malicioso.example')).statusCode, 403);
  assert.equal(confirmacoes, 0);
  assert.equal((await request('recepcao')).statusCode, 201);
  assert.equal(confirmacoes, 1);
});

test('consulta de vencimentos filtra somente planos ativos e retorna campos operacionais mínimos', async () => {
  let consulta;
  const db = { usuarios: { async findMany(opcoes) { consulta = opcoes; return []; } } };
  const servico = criarServicoProfissionais(db);
  await servico.buscarAlunos('Ada', true);
  assert.equal(consulta.where.role, 'aluno');
  assert.deepEqual(consulta.where.nome, { contains: 'Ada' });
  assert.equal(consulta.where.planos.some.ativo, true);
  assert.ok(consulta.where.planos.some.vencimento.gte instanceof Date);
  assert.ok(consulta.where.planos.some.vencimento.lte instanceof Date);
  assert.deepEqual(consulta.select, { id: true, nome: true, planos: { where: { ativo: true }, take: 1, orderBy: { id: 'desc' }, select: { tipo: true, ativo: true, vencimento: true, unidade_id: true } } });
});

test('resumo da recepção separa cadastros, matrículas e atendimentos com filtro de aluno e período', async () => {
  let filtroAtendimento;
  const db = {
    atendimentos_recepcao: { async count() { return 0; }, async findMany(opcoes) { filtroAtendimento = opcoes.where; return []; } },
    agendamentos: { async count() { return 0; } },
    usuarios: { async findMany(opcoes) { assert.equal(opcoes.where.role, 'aluno'); return []; } },
    planos: { async findMany(opcoes) { assert.equal(opcoes.where.usuarios.role, 'aluno'); return []; } },
  };
  const resumo = await criarServicoProfissionais(db).resumoRecepcao({ busca: 'Mariana', de: '2026-11-01', ate: '2026-11-27' });
  assert.deepEqual(resumo, { hoje: 0, consultas: 0, ultimos: [], cadastrosRecentes: [], matriculasRecentes: [] });
  assert.deepEqual(filtroAtendimento.aluno.nome, { contains: 'Mariana' });
  assert.equal(filtroAtendimento.criado_em.gte.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(filtroAtendimento.criado_em.lte.toISOString(), '2026-11-27T23:59:59.999Z');
});

test('vínculo aluno-especialista é idempotente e informa duplicidade sem criar outro registro', async () => {
  let existe = true, criacoes = 0, upserts = 0;
  const db = {
    async $transaction(callback) { return callback(db); },
    async $queryRaw() { return [{ id: 2 }]; },
    usuarios: { async findFirst() { return { id: 7 }; } },
    vinculos_profissionais: {
      async findUnique() { return existe ? { aluno_id: 2 } : null; },
      async upsert() { upserts++; if (!existe) criacoes++; existe = true; },
    },
  };
  const service = criarServicoProfissionais(db);
  assert.deepEqual(await service.vinculo(7, 2), { vinculado: true, existente: true });
  assert.equal(criacoes, 0);
  existe = false;
  assert.deepEqual(await service.vinculo(7, 2), { vinculado: true, existente: false });
  assert.equal(criacoes, 1);
  assert.equal(upserts, 2);
});

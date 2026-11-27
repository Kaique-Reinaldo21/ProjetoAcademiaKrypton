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

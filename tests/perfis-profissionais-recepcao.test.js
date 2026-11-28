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

test('matrícula simulada inicia pendente e exige operador, origem e confirmação separada', async t => {
  const anterior = process.env.PAYMENT_MODE;
  const segredoAnterior = process.env.JWT_SECRET;
  process.env.PAYMENT_MODE = 'demo';
  process.env.JWT_SECRET = 'segredo-ficticio-apenas-teste';
  t.after(() => {
    if (anterior === undefined) delete process.env.PAYMENT_MODE; else process.env.PAYMENT_MODE = anterior;
    if (segredoAnterior === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = segredoAnterior;
  });
  let evento, decisoes = 0, matriculaExiste = false;
  const tentativa = { id: '11111111-1111-4111-8111-111111111111', usuario_id: 20, metodo: 'qr_krypton', status: 'pendente' };
  const db = {
    usuarios: { async findFirst({ where }) { return where.role === 'recepcao' && where.id === 4 ? { id: 4 } : where.role === 'aluno' && where.id === 20 ? { id: 20 } : null; } },
    unidades: { async findUnique() { return { id: 1 }; } },
    planos: { async findFirst() { return matriculaExiste ? { id: 44 } : null; } },
    auditoria_contas: {
      async create({ data }) { evento = data; },
      async findFirst({ where }) { return where.autor_id === 4 && where.usuario_id === 20 && where.evento.in.includes(evento?.evento) ? { id: 1, evento: evento.evento } : null; },
      async updateMany({ where, data }) { if (evento?.evento === where.evento) { evento.evento = data.evento; return { count: 1 }; } return { count: 0 }; },
    },
    checkout_tentativas: { async findUnique() { return { ...tentativa }; } },
  };
  const router = criarRotasProfissionais({ autenticar: (_req, _res, next) => next(), servico: {}, db,
    metodosCheckout: { async resumo(tipo) { return { tipo, valor_centavos: 24900 }; }, async iniciar() { return { tentativaId: tentativa.id, url: '/checkout-demo.html' }; }, async simularResposta() { decisoes++; return { status: 'approved' }; } },
    checkoutDemo: { async decidir(_id, _tentativa, acao) { decisoes++; tentativa.status = acao === 'aprovar' ? 'confirmado' : 'recusado'; return { status: acao === 'aprovar' ? 'approved' : 'rejected' }; } },
    notificacoes: { listar: async () => ({}), marcar: async () => true },
  });
  async function request(path, role, body, origin = 'https://app.example.test', id = 4) {
    const layer = router.stack.find(item => item.route?.path === path && item.route.methods.post);
    const handlers = layer.route.stack.map(item => item.handle);
    let concluir;
    const respostaCompleta = new Promise(resolve => { concluir = resolve; });
    const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; concluir(this); return this; } };
    const req = { usuario: { id, role }, body, params: { id: tentativa.id }, protocol: 'https', get: key => key === 'Origin' ? origin : 'app.example.test' };
    let index = 0;
    const run = async () => { const handler = handlers[index++]; if (handler) await handler(req, res, run); };
    await run(); return respostaCompleta;
  }
  const startPath = '/recepcao/matricula-simulada';
  const reviewPath = '/recepcao/matricula-simulada/revisar';
  const confirmPath = '/recepcao/matricula-simulada/:id/confirmar';
  assert.equal((await request(startPath, 'aluno', {})).statusCode, 403);
  assert.equal((await request(startPath, 'recepcao', {}, 'https://malicioso.example')).statusCode, 403);
  const revisao = await request(reviewPath, 'recepcao', { metodo: 'qr_krypton', aluno_id: 20, tipoPlano: 'elite' });
  assert.equal(revisao.statusCode, 200, JSON.stringify(revisao.body));
  assert.equal((await request(startPath, 'recepcao', { confirmacao: true, revisao: revisao.body.revisao, metodo: 'qr_krypton', aluno_id: 20, tipoPlano: 'pro' })).statusCode, 409,
    'a alteração do plano exige nova revisão');
  assert.equal((await request(startPath, 'recepcao', { confirmacao: true, revisao: revisao.body.revisao, metodo: 'qr_krypton', aluno_id: 20, tipoPlano: 'elite' })).statusCode, 201);
  assert.match(evento.evento, /^mat-/);
  assert.equal(evento.autor_id, 4);
  assert.equal(decisoes, 0, 'criar tentativa não ativa matrícula');
  assert.equal((await request(confirmPath, 'recepcao', { acao: 'aprovar', confirmacao: true }, 'https://app.example.test', 5)).statusCode, 403);
  const aprovado = await request(confirmPath, 'recepcao', { acao: 'aprovar', confirmacao: true });
  assert.equal(aprovado.statusCode, 200, JSON.stringify(aprovado.body));
  assert.equal(aprovado.body.status, 'approved');
  assert.equal(evento.evento, 'mat-ok:' + tentativa.id.replaceAll('-', ''));
  assert.equal(decisoes, 1);
  matriculaExiste = true;
  const duplicada = await request(startPath, 'recepcao', { confirmacao: true, revisao: revisao.body.revisao, metodo: 'qr_krypton', aluno_id: 20, tipoPlano: 'elite' });
  assert.equal(duplicada.statusCode, 409);
  assert.equal(decisoes, 1);
});

test('matrícula Mercado Pago simulado usa somente o simulador local e não aprova na criação', async t => {
  const anterior = process.env.PAYMENT_MODE;
  process.env.PAYMENT_MODE = 'demo';
  t.after(() => { if (anterior === undefined) delete process.env.PAYMENT_MODE; else process.env.PAYMENT_MODE = anterior; });
  const tentativa = { id: '22222222-2222-4222-8222-222222222222', usuario_id: 30, metodo: 'mercadopago_simulado', status: 'aguardando' };
  let simulacao = 0;
  const db = { usuarios: { async findFirst({ where }) { return where.role === 'aluno' ? { id: 30 } : { id: 4 }; } }, planos: { async findFirst() { return null; } },
    auditoria_contas: { async create() {}, async findFirst() { return { id: 2 }; }, async updateMany() { return { count: 1 }; } },
    checkout_tentativas: { async findUnique() { return tentativa; } } };
  const router = criarRotasProfissionais({ autenticar: (_req, _res, next) => next(), servico: {}, db,
    metodosCheckout: { async iniciar() { return { tentativaId: tentativa.id }; }, async simularResposta(_id, _tentativa, acao) { simulacao++; return { status: acao === 'aprovar' ? 'approved' : 'pending' }; } },
    checkoutDemo: { async decidir() { throw new Error('não deve usar QR neste cenário'); } },
    notificacoes: { listar: async () => ({}), marcar: async () => true },
  });
  const layer = router.stack.find(item => item.route?.path === '/recepcao/matricula-simulada/:id/confirmar' && item.route.methods.post);
  const handlers = layer.route.stack.map(item => item.handle);
  let concluir;
  const respostaCompleta = new Promise(resolve => { concluir = resolve; });
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; concluir(this); return this; } };
  const req = { usuario: { id: 4, role: 'recepcao' }, body: { acao: 'aprovar', confirmacao: true }, params: { id: tentativa.id }, protocol: 'https', get: key => key === 'Origin' ? 'https://app.example.test' : 'app.example.test' };
  let index = 0;
  const run = async () => { const handler = handlers[index++]; if (handler) await handler(req, res, run); };
  await run();
  await respostaCompleta;
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.status, 'approved');
  assert.equal(simulacao, 1);
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

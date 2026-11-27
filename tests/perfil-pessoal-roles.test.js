import test from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { criarRotasPerfil, papeisPerfilPessoal } from '../src/routes/perfil-aluno.routes.js';

function montarBanco() {
  const usuarios = new Map(papeisPerfilPessoal.map((role, index) => [index + 1, {
    id: index + 1, role, nome: `Nome ${role}`, email: `${role}@example.test`, senha_hash: 'hash-nao-alteravel',
  }]));
  const fotos = new Map();
  const chamadas = [];
  return {
    usuarios, fotos, chamadas,
    db: {
      usuarios: {
        async update(opcoes) {
          chamadas.push(['nome', opcoes]);
          const usuario = usuarios.get(opcoes.where.id);
          Object.assign(usuario, opcoes.data);
          return { id: usuario.id, nome: usuario.nome };
        },
      },
      fotos_perfil: {
        async findUnique({ where }) { chamadas.push(['ler_foto', where]); return fotos.get(where.usuario_id) || null; },
        async upsert({ where, create, update }) {
          chamadas.push(['salvar_foto', { where, create, update }]);
          fotos.set(where.usuario_id, { imagem: create.imagem });
        },
        async deleteMany({ where }) { chamadas.push(['remover_foto', where]); fotos.delete(where.usuario_id); },
      },
    },
  };
}

function resposta() {
  return {
    statusCode: 200, headers: {}, body: undefined, finished: false,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; this.finished = true; return this; },
    sendStatus(code) { this.statusCode = code; this.finished = true; return this; },
    set(headers) { Object.assign(this.headers, headers); return this; },
    type(value) { this.headers['Content-Type'] = value; return this; },
    send(value) { this.body = value; this.finished = true; return this; },
  };
}

function camadas(db, method, path) {
  const router = criarRotasPerfil(db);
  const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]);
  assert.ok(route, `${method} ${path} deve estar registrado`);
  return route.route.stack.map(layer => layer.handle);
}

function requisicao(role, id, { method = 'PUT', path = '/perfil', body = {}, query = {}, origin = 'https://krypton.test', type = 'application/json' } = {}) {
  return {
    method, url: path, originalUrl: path, protocol: 'https',
    usuario: { id, role }, body, query,
    get(nome) { return nome.toLowerCase() === 'origin' ? origin : nome.toLowerCase() === 'host' ? 'krypton.test' : undefined; },
    is(tipo) { return type === tipo; },
  };
}

async function executar(handlers, req, res, { pularParserBruto = false } = {}) {
  const lista = pularParserBruto ? [handlers[0], handlers[1], handlers.at(-1)] : handlers;
  for (const handler of lista) {
    if (res.finished) break;
    let seguiu = false;
    await Promise.resolve(handler(req, res, () => { seguiu = true; }));
    if (!seguiu) break;
  }
  return res;
}

test('todos os cinco papéis podem persistir somente o próprio nome e a foto', async () => {
  const banco = montarBanco();
  const nomeHandlers = camadas(banco.db, 'put', '/perfil');
  const uploadHandlers = camadas(banco.db, 'put', '/perfil/foto');
  const lerHandlers = camadas(banco.db, 'get', '/perfil/foto');
  const removerHandlers = camadas(banco.db, 'delete', '/perfil/foto');
  const png = PNG.sync.write({ width: 1, height: 1, data: Buffer.from([30, 60, 90, 255]) });

  for (const [indice, role] of papeisPerfilPessoal.entries()) {
    const id = indice + 1;
    const nome = `Nome atualizado ${role}`;
    const atualizado = await executar(nomeHandlers, requisicao(role, id, { body: { nome } }), resposta());
    assert.equal(atualizado.statusCode, 200, role);
    assert.equal(banco.usuarios.get(id).nome, nome, role);

    const enviado = await executar(uploadHandlers, requisicao(role, id, {
      method: 'PUT', path: '/perfil/foto', body: png, type: 'image/png', query: { usuario_id: 999 },
    }), resposta(), { pularParserBruto: true });
    assert.equal(enviado.statusCode, 204, role);
    assert.deepEqual(banco.fotos.get(id).imagem, png, role);
    assert.equal(banco.fotos.has(999), false, 'query não pode redirecionar a gravação a outro usuário');

    const carregada = await executar(lerHandlers, requisicao(role, id, { method: 'GET', path: '/perfil/foto' }), resposta());
    assert.equal(carregada.statusCode, 200, role);
    assert.equal(carregada.headers['Cache-Control'], 'private, no-store');
    assert.deepEqual(carregada.body, png, role);

    await executar(removerHandlers, requisicao(role, id, { method: 'DELETE', path: '/perfil/foto' }), resposta());
    assert.equal(banco.fotos.has(id), false, role);
    assert.equal(banco.usuarios.get(id).email, `${role}@example.test`, 'e-mail não é alterado');
    assert.equal(banco.usuarios.get(id).role, role, 'papel não é alterado');
    assert.equal(banco.usuarios.get(id).senha_hash, 'hash-nao-alteravel', 'credenciais não são alteradas');
  }

  for (const [, chamada] of banco.chamadas.filter(([tipo]) => tipo === 'nome')) {
    assert.deepEqual(Object.keys(chamada.data), ['nome']);
    assert.deepEqual(chamada.select, { id: true, nome: true });
  }
  for (const [, chamada] of banco.chamadas.filter(([tipo]) => tipo === 'salvar_foto')) {
    assert.equal(chamada.where.usuario_id, chamada.create.usuario_id);
    assert.deepEqual(Object.keys(chamada.update), ['imagem']);
  }
});

test('papéis fora da lista não conseguem consultar ou alterar o perfil', async () => {
  const banco = montarBanco();
  const rotas = [
    ['put', '/perfil', { body: { nome: 'Intruso' } }],
    ['get', '/perfil/foto', { method: 'GET', path: '/perfil/foto' }],
    ['put', '/perfil/foto', { path: '/perfil/foto', type: 'image/png' }],
    ['delete', '/perfil/foto', { method: 'DELETE', path: '/perfil/foto' }],
  ];
  for (const [method, path, opcoes] of rotas) {
    const handlers = camadas(banco.db, method, path);
    const req = requisicao('visitante', 999, opcoes);
    const denied = await executar(handlers, req, resposta(), { pularParserBruto: method === 'put' && path.endsWith('/foto') });
    assert.equal(denied.statusCode, 403, `${method} ${path}`);
  }
  assert.equal(banco.chamadas.length, 0);
});

test('atualização rejeita campos para papel, conta ou credenciais e exige mesma origem', async () => {
  const banco = montarBanco();
  const handlers = camadas(banco.db, 'put', '/perfil');
  const escalada = await executar(handlers, requisicao('aluno', 2, {
    body: { nome: 'Nome', role: 'admin', id: 1, email: 'outro@example.test', senha_hash: 'alterado' },
  }), resposta());
  assert.equal(escalada.statusCode, 400);
  assert.equal(banco.usuarios.get(2).role, 'aluno');
  assert.equal(banco.usuarios.get(1).nome, 'Nome admin');

  const origem = await executar(handlers, requisicao('aluno', 2, { body: { nome: 'Nome' }, origin: 'https://outro.test' }), resposta());
  assert.equal(origem.statusCode, 403);
  assert.equal(banco.chamadas.length, 0);
});

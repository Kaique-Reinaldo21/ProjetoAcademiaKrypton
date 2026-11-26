import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { validarUrlTeste } from './mysql-guard.mjs';
import { iniciarGoogleSimulado } from './google-oauth-mock.mjs';

validarUrlTeste(process.env.DATABASE_URL);
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.CONTA_ORIGEM_PUBLICA = '';
const { default: prisma } = await import('../src/lib/prisma.js');
const { default: jwt } = await import('jsonwebtoken');
const { gerarHashSenha } = await import('../src/services/politica-senha.js');
const { criarServicoContas } = await import('../src/services/contas.service.js');

test('Google simulado, vínculos explícitos, sessões Krypton e histórico no MySQL', { timeout: 30000 }, async () => {
  const [banco] = await prisma.$queryRaw`SELECT DATABASE() AS db, VERSION() AS versao`;
  assert.equal(banco.db, 'academia_kripton_checkout_test');
  assert.match(banco.versao, /^8\./);
  const mock = await iniciarGoogleSimulado();
  const ids = [], estados = [];
  const senha = randomBytes(16).toString('hex');
  const senhaHash = await gerarHashSenha(senha);
  const gmail = () => randomUUID() + '@gmail.com';
  const perfil = (email = gmail()) => ({ sub: randomUUID(), email, name: 'Aluno de teste', email_verified: true });
  const request = (rota, opcoes) => fetch(mock.origem + rota, { redirect: 'manual', ...opcoes });
  const bearer = token => ({ Authorization: 'Bearer ' + token });
  const localizar = token => request('/api/auth/me', { headers: bearer(token) });
  const login = async usuario => {
    const res = await request('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: usuario.email, senha }),
    });
    assert.equal(res.status, 200);
    return (await res.json()).token;
  };
  async function criarUsuario(role, hash = senhaHash) {
    const usuario = await prisma.usuarios.create({ data: { nome: 'Conta de teste', email: gmail(), role, senha_hash: hash } });
    ids.push(usuario.id);
    return usuario;
  }
  async function iniciar(token, atual = senha) {
    const resposta = token
      ? await request('/api/auth/google/vincular', {
        method: 'POST', headers: { ...bearer(token), Origin: mock.origem },
        body: new URLSearchParams({ senhaGoogle: atual }),
      })
      : await request('/api/auth/google');
    const destino = new URL(resposta.headers.get('location'), mock.origem);
    if (destino.origin === mock.origem) return { resposta };
    assert.equal(destino.hostname, 'accounts.google.com');
    assert.deepEqual(destino.searchParams.get('scope').split(' ').sort(), ['email', 'openid', 'profile']);
    assert.equal(destino.searchParams.get('redirect_uri'), mock.callback);
    const state = destino.searchParams.get('state');
    estados.push(createHash('sha256').update(state).digest('hex'));
    return { state, cookie: resposta.headers.getSetCookie()[0].split(';')[0] };
  }
  function callback(inicio, code, state = inicio.state, cookie = inicio.cookie) {
    const query = new URLSearchParams({ code });
    if (state) query.set('state', state);
    return request('/api/auth/google/callback?' + query, { headers: cookie ? { Cookie: cookie } : {} });
  }
  async function jwtKrypton(res) {
    assert.equal(res.status, 200);
    const cookie = res.headers.getSetCookie().find(linha => linha.startsWith('token='));
    assert.match(cookie, /HttpOnly/i);
    return cookie.split(';')[0].slice('token='.length);
  }

  try {
    const novo = perfil();
    const inicio = await iniciar();
    const code = mock.autorizar(novo);
    assert.equal((await callback(inicio, code, '')).status, 303);
    assert.equal((await callback(inicio, code, 'incorreto')).status, 303);
    const outroBrowser = await iniciar();
    assert.equal((await callback(inicio, code, inicio.state, outroBrowser.cookie)).status, 303);
    assert.equal(mock.trocas, 0);
    const concorrentes = await Promise.all([callback(inicio, code), callback(inicio, code)]);
    assert.deepEqual(concorrentes.map(res => res.status).sort(), [200, 303]);
    assert.equal(mock.trocas, 1);
    const token = await jwtKrypton(concorrentes.find(res => res.status === 200));
    const sessao = jwt.verify(token, process.env.JWT_SECRET);
    const conta = await prisma.usuarios.findUnique({ where: { google_sub: novo.sub } });
    ids.push(conta.id);
    assert.equal(conta.id, sessao.id);
    assert.equal(conta.data_nascimento, null);
    assert.equal(conta.senha_hash, null);
    assert.equal(sessao.role, 'aluno');
    assert.equal(sessao.versao_sessao, 0);
    assert.equal((await localizar(token)).status, 200);
    assert.equal((await request('/api/admin/alunos', { headers: bearer(token) })).status, 403);
    assert.equal((await localizar(token.slice(0, -8) + 'invalido')).status, 401);
    assert.equal((await localizar(jwt.sign({ id: conta.id }, process.env.JWT_SECRET, { expiresIn: -1 }))).status, 401);
    const segundo = await jwtKrypton(await callback(await iniciar(), mock.autorizar({ ...novo, email: gmail() })));
    assert.equal(jwt.verify(segundo, process.env.JWT_SECRET).id, conta.id);
    assert.equal((await prisma.usuarios.findUnique({ where: { id: conta.id } })).email, novo.email);

    const tradicional = await criarUsuario('aluno');
    const admin = await criarUsuario('admin');
    const legado = await criarUsuario('aluno', null);
    for (const identidade of [
      { ...perfil(), email_verified: false },
      perfil(tradicional.email), perfil(admin.email), perfil(legado.email),
      perfil(randomUUID() + '@example.invalid'),
    ]) {
      const negado = await callback(await iniciar(), mock.autorizar(identidade));
      assert.equal(negado.status, 303);
      assert.ok(!negado.headers.getSetCookie().some(linha => linha.startsWith('token=')));
      assert.equal(await prisma.usuarios.count({ where: { google_sub: identidade.sub } }), 0);
    }

    const tradicionalToken = await login(tradicional);
    assert.equal((await iniciar(await login(admin))).resposta.status, 303);
    assert.equal((await iniciar(tradicionalToken, senha + 'incorreta')).resposta.status, 303);
    const plano = await prisma.planos.create({ data: { usuario_id: tradicional.id, tipo: 'pro', ativo: true } });
    const tentativa = await prisma.checkout_tentativas.create({ data: {
      id: randomUUID(), usuario_id: tradicional.id, tipo: 'pro', status: 'confirmado',
    } });
    await prisma.transacoes_pagamento.create({ data: {
      mp_payment_id: 'demo_' + tentativa.id, usuario_id: tradicional.id, tentativa_id: tentativa.id,
      plano_id: plano.id, valor_centavos: 14900, moeda: 'BRL', status: 'approved', origem: 'demo',
    } });
    const identidade = perfil(tradicional.email);
    assert.equal((await callback(await iniciar(tradicionalToken), mock.autorizar(perfil()))).status, 303);
    const vinculado = await jwtKrypton(await callback(await iniciar(tradicionalToken), mock.autorizar(identidade)));
    assert.equal(jwt.verify(vinculado, process.env.JWT_SECRET).id, tradicional.id);
    assert.equal((await localizar(tradicionalToken)).status, 401);
    assert.equal((await localizar(vinculado)).status, 200);
    assert.equal(await prisma.auditoria_contas.count({ where: { usuario_id: tradicional.id, evento: 'google_vinculado' } }), 1);
    const enviados = new Map();
    const contas = criarServicoContas({ enviarEmail: async (email, segredo) => { enviados.set(email, segredo); } });
    await contas.solicitar(conta.email);
    assert.equal(enviados.size, 0);
    await contas.solicitar(tradicional.email);
    const novaSenha = randomBytes(4).toString('base64url');
    await contas.redefinir(enviados.get(tradicional.email), novaSenha, novaSenha);
    assert.equal((await localizar(vinculado)).status, 401);
    const novoJwt = await jwtKrypton(await callback(await iniciar(), mock.autorizar(identidade)));
    assert.equal((await localizar(novoJwt)).status, 200);
    assert.equal(await prisma.planos.count({ where: { id: plano.id, ativo: true } }), 1);
    assert.equal(await prisma.transacoes_pagamento.count({ where: { tentativa_id: tentativa.id, status: 'approved' } }), 1);
    await prisma.usuarios.update({ where: { id: tradicional.id }, data: { senha_redefinicao_obrigatoria: true } });
    assert.equal((await localizar(novoJwt)).status, 401);
    assert.equal((await callback(await iniciar(), mock.autorizar(identidade))).status, 303);
  } finally {
    mock.fechar();
    await prisma.estados_oauth_google.deleteMany({ where: { state_hash: { in: estados } } });
    await prisma.transacoes_pagamento.deleteMany({ where: { usuario_id: { in: ids } } });
    await prisma.auditoria_contas.deleteMany({ where: { usuario_id: { in: ids } } });
    await prisma.usuarios.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});

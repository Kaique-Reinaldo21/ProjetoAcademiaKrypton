import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { validarUrlTeste } from './mysql-guard.mjs';

validarUrlTeste(process.env.DATABASE_URL);
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.NODE_ENV = 'test';
const { default: express } = await import('express');
const { default: jwt } = await import('jsonwebtoken');
const { default: prisma } = await import('../src/lib/prisma.js');
const { criarServicoContas } = await import('../src/services/contas.service.js');
const { conferirSenha, gerarHashSenha } = await import('../src/services/politica-senha.js');
const { criarRotasContas } = await import('../src/routes/contas.routes.js');
const { login } = await import('../src/controllers/auth.controller.js');
const { default: authMiddleware } = await import('../src/middleware/auth.js');

test('recuperação, alteração e redefinição administrativa no MySQL 8', { timeout: 20000 }, async () => {
  const [{ db, versao }] = await prisma.$queryRaw`SELECT DATABASE() AS db, VERSION() AS versao`;
  assert.equal(db, 'academia_kripton_checkout_test');
  assert.match(versao, /^8\./);

  const caixa = new Map();
  let instante = Date.now();
  const app = express();
  app.use(express.json());
  const servico = criarServicoContas({
    agora: () => new Date(instante),
    enviarEmail: async (email, token) => {
      if (!caixa.has(email)) caixa.set(email, []);
      caixa.get(email).push(token);
    },
  });
  app.use('/api/auth', criarRotasContas(servico));
  app.post('/api/auth/login', login);
  app.get('/api/auth/me', authMiddleware, (req, res) => res.json({ id: req.usuario.id, role: req.usuario.role }));
  const server = app.listen(0, '127.0.0.1');
  const unicos = [];
  const buckets = new Set();
  try {
    await once(server, 'listening');
    const origem = 'http://127.0.0.1:' + server.address().port;
    const chamar = (rota, dados, token, origin = origem) => fetch(origem + '/api/auth' + rota, {
      method: dados ? 'POST' : 'GET',
      headers: {
        Origin: origin, 'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: dados ? JSON.stringify(dados) : undefined,
    });
    const senhaInicial = randomBytes(22).toString('base64url');
    const novaSenha = randomBytes(22).toString('base64url');
    const outraSenha = randomBytes(22).toString('base64url');
    const hashInicial = await gerarHashSenha(senhaInicial);
    const usuario = async (role, senha_hash = hashInicial) => {
      const u = await prisma.usuarios.create({
        data: { nome: 'Conta fictícia', email: randomUUID() + '@example.invalid', data_nascimento: new Date('2001-01-01'), role, senha_hash },
      });
      unicos.push(u.id);
      return u;
    };
    const aluno = await usuario('aluno');
    const admin = await usuario('admin');
    const google = await usuario('aluno', null);
    for (const alvo of [aluno, admin, google]) {
      for (const escopo of ['alteracao-conta', 'recuperacao-conta', 'recuperacao-admin']) buckets.add(escopo + ':' + alvo.id);
    }
    for (const escopo of ['recuperacao-ip', 'redefinicao-ip']) buckets.add(escopo + ':127.0.0.1');
    const sessao = (u, role = u.role, incluirVersao = true) => jwt.sign({
      id: u.id, role, ...(incluirVersao ? { versao_sessao: u.versao_sessao } : {}),
    }, process.env.JWT_SECRET);
    const atual = u => prisma.usuarios.findUnique({ where: { id: u.id } });
    const alterar = (token, senhaAtual, nova) => chamar('/senha', { senhaAtual, novaSenha: nova, confirmacao: nova }, token);
    const redefinir = (token, nova) => chamar('/redefinir', { token, novaSenha: nova, confirmacao: nova });
    const iniciarAdmin = (token, senhaAdmin = senhaInicial, u = aluno) => chamar('/admin/recuperacao', { email: u.email, senhaAdmin }, token);
    async function aguardarEmail(u, numero) {
      for (let i = 0; i < 70; i++) {
        const tokens = caixa.get(u.email) || [];
        if (tokens.length >= numero) return tokens[numero - 1];
        await setTimeout(20);
      }
      assert.fail('Link não chegou à caixa postal de teste.');
    }

    const semConta = await chamar('/recuperacao', { email: 'inexistente-' + randomUUID() + '@example.invalid' });
    const conta = await chamar('/recuperacao', { email: aluno.email });
    const contaGoogle = await chamar('/recuperacao', { email: google.email });
    assert.deepEqual([semConta.status, conta.status, contaGoogle.status], [202, 202, 202]);
    const respostaGenerica = await conta.json();
    assert.deepEqual(await semConta.json(), respostaGenerica);
    assert.deepEqual(await contaGoogle.json(), respostaGenerica);
    assert.equal((await chamar('/recuperacao', { email: aluno.email }, undefined, 'https://externo.example.invalid')).status, 403);
    const primeiro = await aguardarEmail(aluno, 1);
    assert.equal(caixa.size, 1);
    const registro = await prisma.recuperacoes_senha.findUnique({ where: { usuario_id: aluno.id } });
    assert.equal(registro.token_hash, createHash('sha256').update(primeiro).digest('hex'));
    assert.equal(+registro.expira_em - instante, 15 * 60_000);
    instante += 15 * 60_000;
    assert.equal((await redefinir(primeiro, novaSenha)).status, 410);

    await chamar('/recuperacao', { email: aluno.email });
    const segundo = await aguardarEmail(aluno, 2);
    await chamar('/recuperacao', { email: aluno.email });
    const terceiro = await aguardarEmail(aluno, 3);
    await chamar('/recuperacao', { email: aluno.email });
    assert.equal((await redefinir(segundo, novaSenha)).status, 410);
    const concorrentes = await Promise.all([redefinir(terceiro, novaSenha), redefinir(terceiro, novaSenha)]);
    assert.deepEqual(concorrentes.map(r => r.status).sort(), [200, 410]);
    assert.equal((await redefinir(terceiro, novaSenha)).status, 410);
    assert.equal(caixa.get(aluno.email).length, 3);
    assert.equal((await chamar('/me', null, sessao(aluno, aluno.role, false))).status, 401);
    assert.ok(await conferirSenha(novaSenha, (await atual(aluno)).senha_hash));

    const loginNovo = await chamar('/login', { email: aluno.email, senha: novaSenha });
    assert.equal(loginNovo.status, 200);
    const { token: sessaoPosReset } = await loginNovo.json();
    assert.equal((await alterar(undefined, novaSenha, outraSenha)).status, 401);
    assert.equal((await alterar(sessaoPosReset, senhaInicial, outraSenha)).status, 403);
    assert.equal((await alterar(sessao(google), senhaInicial, outraSenha)).status, 409);
    assert.equal((await alterar(sessaoPosReset, novaSenha, outraSenha)).status, 200);
    assert.equal((await chamar('/me', null, sessaoPosReset)).status, 401);
    const loginAlterado = await chamar('/login', { email: aluno.email, senha: outraSenha });
    assert.equal(loginAlterado.status, 200);
    const { token: sessaoAluno } = await loginAlterado.json();
    assert.equal((await iniciarAdmin(undefined)).status, 401);
    assert.equal((await iniciarAdmin(sessaoAluno)).status, 403);
    assert.equal((await iniciarAdmin(sessao(await atual(aluno), 'admin'))).status, 403);
    assert.equal((await iniciarAdmin(sessao(admin), novaSenha)).status, 403);
    assert.equal((await iniciarAdmin(sessao(admin), senhaInicial, google)).status, 409);
    assert.equal((await iniciarAdmin(sessao(admin))).status, 200);
    assert.equal((await chamar('/me', null, sessaoAluno)).status, 401);
    assert.equal((await chamar('/login', { email: aluno.email, senha: outraSenha })).status, 401);
    assert.equal((await chamar('/me', null, sessao(admin))).status, 200);
    assert.equal((await redefinir(await aguardarEmail(aluno, 4), novaSenha)).status, 200);
    assert.equal((await atual(aluno)).role, 'aluno');
    assert.equal((await atual(admin)).role, 'admin');
    assert.equal((await atual(google)).senha_hash, null);
    const eventos = await prisma.auditoria_contas.findMany({ where: { usuario_id: aluno.id }, orderBy: { id: 'asc' } });
    assert.deepEqual(eventos.map(e => e.evento), ['senha_redefinida', 'senha_alterada', 'recuperacao_administrativa', 'senha_redefinida']);
    assert.equal(eventos[2].autor_id, admin.id);
    const respostas = await Promise.all(Array.from({ length: 15 }, () => chamar('/recuperacao', { email: 'invalido' })));
    assert.ok(respostas.some(r => r.status === 429));
    assert.ok(respostas.every(r => [202, 429].includes(r.status)));
  } finally {
    server.close();
    try {
      if (unicos.length) {
        await prisma.auditoria_contas.deleteMany({ where: { usuario_id: { in: unicos } } });
        await prisma.usuarios.deleteMany({ where: { id: { in: unicos } } });
      }
      if (buckets.size) {
        const chaves = [...buckets].map(chave => createHmac('sha256', process.env.JWT_SECRET).update(chave).digest('hex'));
        await prisma.limites_conta.deleteMany({ where: { chave: { in: chaves } } });
      }
    } finally {
      await prisma.$disconnect();
    }
  }
});

import './setup-isolamento.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DESTINO_ACADEMICO_OFICIAL } from '../src/config/demo-hosts.js';
import { validarModoDemo, validarArquivoCaDemo, validarTlsBanco, criarServicoDemo } from '../src/services/checkout-demo.service.js';

const env = { NODE_ENV: 'development', PAYMENT_MODE: 'demo', DATABASE_URL: 'mysql://demo:senha@127.0.0.1:3307/academia_kripton_checkout_test' };

test('inicialização permite TLS sem validar identidade somente no banco acadêmico aprovado', () => {
  const host = 'booqcxfmlvclpjzw2uce-mysql.services.clever-cloud.com';
  const banco = 'booqcxfmlvclpjzw2uce';
  const destino = `mysql://u:p@${host}:3306/${banco}`;
  const base = {
    NODE_ENV: 'production',
    PAYMENT_MODE: 'demo',
    DEMO_DEPLOYMENT: 'academico_isolado',
    DEMO_DATABASE_HOST: host,
    DEMO_DATABASE_NAME: banco,
    DEMO_ALLOW_UNVERIFIED_TLS: 'I_UNDERSTAND_TEST_ONLY',
    DATABASE_URL: destino + '?sslaccept=accept_invalid_certs',
  };
  assert.equal(validarTlsBanco(base), 'accept_invalid_certs');
  assert.equal(validarTlsBanco({ ...base, DATABASE_URL: destino + '?sslaccept=strict' }), undefined);
  assert.throws(() => validarTlsBanco({ ...base, PAYMENT_MODE: 'real', DATABASE_URL: destino + '?sslaccept=strict' }),
    erro => erro.codigoConfiguracao === 'PAYMENT_MODE_INVALIDO');

  const { banco: bancoPrincipal, host: hostPrincipal } = DESTINO_ACADEMICO_OFICIAL;
  const urlPrincipal = `mysql://u:p@${hostPrincipal}:3306/${bancoPrincipal}`;
  for (const alteracao of [
    { DEMO_ALLOW_UNVERIFIED_TLS: undefined },
    { DEMO_ALLOW_UNVERIFIED_TLS: 'true' },
    { PAYMENT_MODE: 'real' },
    { PAYMENT_MODE: undefined },
    { DEMO_DEPLOYMENT: undefined },
    { NODE_ENV: 'development' },
    { ...env, DATABASE_URL: env.DATABASE_URL + '?sslaccept=accept_invalid_certs' },
    { DEMO_DATABASE_NAME: bancoPrincipal, DATABASE_URL: base.DATABASE_URL.replace('/' + banco, '/' + bancoPrincipal) },
    { DEMO_DATABASE_HOST: hostPrincipal, DEMO_DATABASE_NAME: bancoPrincipal, DATABASE_URL: urlPrincipal + '?sslaccept=accept_invalid_certs' },
    { PAYMENT_MODE: 'real', DATABASE_URL: urlPrincipal + '?sslaccept=strict&sslaccept=accept_invalid_certs' },
    { PAYMENT_MODE: undefined, DATABASE_URL: urlPrincipal + '?ssl%61ccept=%61ccept_invalid_certs' },
    { DEMO_DATABASE_HOST: 'outro.example', DATABASE_URL: base.DATABASE_URL.replace(host, 'outro.example') },
    { DATABASE_URL: base.DATABASE_URL.replace(':3306/', '/') },
    { DATABASE_URL: base.DATABASE_URL.replace(':3306/', ':3307/') },
    { DATABASE_URL: base.DATABASE_URL + '&sslaccept=strict' },
    { DATABASE_URL: base.DATABASE_URL + '&socket=/tmp/mysql' },
  ]) {
    assert.throws(() => validarTlsBanco({ ...base, ...alteracao }), { status: 403 });
  }
});
test('modo demo exige desenvolvimento e o endereço do banco exato', () => {
  validarModoDemo(env);
  for (const alteracao of [{ NODE_ENV: 'production' }, { PAYMENT_MODE: 'real' }, { DATABASE_URL: 'mysql://u:p@localhost:3307/academia_kripton_checkout_test' }, { DATABASE_URL: 'mysql://u:p@127.0.0.1:3306/academia_kripton_checkout_test' }, { DATABASE_URL: 'mysql://u:p@127.0.0.1:3307/academia_kripton' }, { DATABASE_URL: env.DATABASE_URL + '?socket=x' }]) assert.throws(() => validarModoDemo({ ...env, ...alteracao }), e => e.status === 403);
});
function cenario() {
  const tentativas = [], transacoes = [], planos = [{ id: 1, usuario_id: 1, ativo: true, tipo: 'basico', unidade_id: 1 }];
  const db = {
    $queryRaw: async () => [], usuarios: {
      findUnique: async ({ where }) => where.id === 1 ? { id: 1, role: 'aluno' } : null,
      findFirst: async ({ where }) => where.id === 1 && where.role === 'aluno' ? { id: 1 } : where.id === 9 && where.role === 'recepcao' ? { id: 9 } : null,
    }, unidades: { findUnique: async () => ({ id: 1 }) },
    checkout_tentativas: {
      findFirst: async ({ where }) => tentativas.find(t => t.usuario_id === where.usuario_id && where.status.in.includes(t.status)),
      create: async ({ data }) => { tentativas.push({ ...data }); },
      update: async ({ where, data }) => Object.assign(tentativas.find(t => t.id === where.id), data),
    },
    transacoes_pagamento: {
      create: async ({ data }) => { const t = { id: transacoes.length + 1, ...data }; transacoes.push(t); return t; },
      findFirst: async ({ where }) => { const t = transacoes.find(x => x.tentativa_id === where.tentativa_id && x.usuario_id === where.usuario_id && x.origem === where.origem); return t && { ...t, tentativa: tentativas.find(x => x.id === t.tentativa_id) }; },
      update: async ({ where, data }) => Object.assign(transacoes.find(t => t.id === where.id), data),
      findMany: async () => transacoes,
    },
    planos: { findFirst: async ({ where }) => planos.find(p => p.usuario_id === where.usuario_id && p.ativo) || null,
      updateMany: async ({ where }) => planos.filter(p => p.usuario_id === where.usuario_id && p.ativo).forEach(p => { p.ativo = false; }), create: async ({ data }) => { const p = { id: planos.length + 1, ...data }; planos.push(p); return p; } },
  };
  let fila = Promise.resolve(); db.$transaction = async fn => { let liberar; const anterior = fila; fila = new Promise(resolve => { liberar = resolve; }); await anterior; try { return await fn(db); } finally { liberar(); } };
  return { servico: criarServicoDemo(db, () => validarModoDemo(env)), planos, transacoes, tentativas };
}
test('pendente e recusa preservam plano e registram uma transação', async () => {
  const c = cenario(), r = await c.servico.iniciar(1, 'pro');
  assert.equal(c.transacoes[0].status, 'pending');
  await c.servico.decidir(1, r.tentativaId, 'pendente');
  assert.equal(c.planos[0].ativo, true);
  await c.servico.decidir(1, r.tentativaId, 'recusar');
  assert.equal(c.transacoes[0].status, 'rejected'); assert.equal(c.planos.length, 1);
  await c.servico.decidir(1, r.tentativaId, 'aprovar');
  assert.equal(c.transacoes[0].status, 'rejected');
});

test('aprovação concorrente troca plano uma vez e verifica proprietário', async () => {
  const c = cenario(), r = await c.servico.iniciar(1, 'elite');
  await assert.rejects(c.servico.consultar(2, r.tentativaId), e => e.status === 404);
  await assert.rejects(c.servico.decidir(2, r.tentativaId, 'aprovar'), e => e.status === 404);
  const respostas = await Promise.all([c.servico.decidir(1, r.tentativaId, 'aprovar'), c.servico.decidir(1, r.tentativaId, 'aprovar')]);
  assert.deepEqual(respostas, [{ status: 'approved' }, { status: 'approved' }]);
  assert.equal(c.planos.length, 2); assert.equal(c.planos[0].ativo, false); assert.equal(c.planos[1].tipo, 'elite');
  assert.equal(c.transacoes.length, 1); assert.equal(c.transacoes[0].plano_id, 2);
});

test('planos demonstrativos mantêm valor e nome, inclusive Básico com unidade', async () => {
  for (const [tipo, nome, valor] of [['basico', 'Básico', 8900], ['pro', 'Pro', 14900], ['elite', 'Elite', 24900]]) {
    const c = cenario();
    const resultado = await c.servico.iniciar(1, tipo, 1);
    const dados = await c.servico.consultar(1, resultado.tentativaId);
    assert.match(resultado.url, /^\/checkout-demo\.html\?tentativa=/);
    assert.equal(dados.plano, nome); assert.equal(dados.valor_centavos, valor);
    assert.equal(dados.status, 'pending');
  }
});


test('perfil isolado aceita somente seu próprio par Clever Cloud', () => {
  const host = 'booqcxfmlvclpjzw2uce-mysql.services.clever-cloud.com';
  const banco = 'booqcxfmlvclpjzw2uce';
  const base = { NODE_ENV: 'production', PAYMENT_MODE: 'demo', DEMO_DEPLOYMENT: 'academico_isolado', DEMO_DATABASE_HOST: host, DEMO_DATABASE_NAME: banco, DATABASE_URL: `mysql://u:p@${host}:3306/${banco}?sslcert=ca.pem&sslaccept=strict` };
  validarModoDemo(base);
  for (const alteracao of [
    { DATABASE_URL: `mysql://u:p@${host}:3307/${banco}?sslcert=ca.pem&sslaccept=strict` },
    { DEMO_DATABASE_NAME: DESTINO_ACADEMICO_OFICIAL.banco, DATABASE_URL: base.DATABASE_URL.replace('/' + banco, '/' + DESTINO_ACADEMICO_OFICIAL.banco) },
    { DEMO_DATABASE_HOST: 'outro.services.clever-cloud.com', DATABASE_URL: `mysql://u:p@outro.services.clever-cloud.com:3306/${banco}?sslcert=ca.pem&sslaccept=strict` },
    { DATABASE_URL: `mysql://u:p@${host}:3306/${banco}?sslcert=ca.pem&sslaccept=accept_invalid_certs` },
  ]) assert.throws(() => validarModoDemo({ ...base, ...alteracao }), e => e.status === 403);
});


test('diagnóstico não expõe dados da URL e identifica causa de configuração', () => {
  const base = { NODE_ENV: 'production', PAYMENT_MODE: 'demo', DEMO_DEPLOYMENT: 'academico_isolado', DEMO_DATABASE_HOST: 'booqcxfmlvclpjzw2uce-mysql.services.clever-cloud.com', DEMO_DATABASE_NAME: 'booqcxfmlvclpjzw2uce', DATABASE_URL: 'mysql://usuario:segredo@booqcxfmlvclpjzw2uce-mysql.services.clever-cloud.com:3306/booqcxfmlvclpjzw2uce?sslcert=ca.pem&sslaccept=strict' };
  for (const [alteracao, codigo] of [[{ NODE_ENV: 'test' }, 'NODE_ENV_INVALIDO'], [{ PAYMENT_MODE: 'real' }, 'PAYMENT_MODE_INVALIDO'], [{ DEMO_DEPLOYMENT: '' }, 'DEMO_DEPLOYMENT_INVALIDO'], [{ DEMO_DATABASE_HOST: 'errado' }, 'HOST_INVALIDO'], [{ DEMO_DATABASE_NAME: 'outro' }, 'SCHEMA_INVALIDO'], [{ DATABASE_URL: base.DATABASE_URL.replace(':3306/', ':3307/') }, 'DESTINO_OU_PORTA_NAO_APROVADO'], [{ DATABASE_URL: base.DATABASE_URL.replace('sslcert=ca.pem', 'sslcert=') }, 'SSLCERT_VAZIO_OU_DUPLICADO'], [{ DATABASE_URL: base.DATABASE_URL.replace('strict', 'accept_invalid_certs') }, 'SSLACCEPT_INVALIDO'], [{ DATABASE_URL: base.DATABASE_URL + '&socket=segredo' }, 'PARAMETRO_NAO_PERMITIDO']]) {
    assert.throws(() => validarModoDemo({ ...base, ...alteracao }), erro => erro.codigoConfiguracao === codigo && !String(erro.stack).includes('segredo'));
  }
  assert.throws(() => validarArquivoCaDemo(base), erro => erro.codigoConfiguracao === 'CA_INACESSIVEL' && !String(erro.stack).includes('segredo'));
});


test('TLS estrito aceita CA do sistema ou arquivo explícito, recusando duplicatas', t => {
  const host = 'booqcxfmlvclpjzw2uce-mysql.services.clever-cloud.com';
  const banco = 'booqcxfmlvclpjzw2uce';
  const pasta = mkdtempSync(path.join(tmpdir(), 'checkout-ca-'));
  t.after(() => rmSync(pasta, { recursive: true, force: true }));
  const arquivo = path.join(pasta, 'ca.pem');
  writeFileSync(arquivo, 'conteúdo fictício: confiança é verificada pelo Prisma na conexão');
  const env = { NODE_ENV: 'production', PAYMENT_MODE: 'demo', DEMO_DEPLOYMENT: 'academico_isolado', DEMO_DATABASE_HOST: host, DEMO_DATABASE_NAME: banco };
  const base = `mysql://u:p@${host}:3306/${banco}?sslaccept=strict`;
  for (const url of [base, base + '&sslcert=' + encodeURIComponent(arquivo)]) {
    const atual = { ...env, DATABASE_URL: url }; validarModoDemo(atual); validarArquivoCaDemo(atual);
  }
  for (const url of [base + '&sslaccept=strict', base + '&sslcert=', base + '&sslcert=a&sslcert=b', base.replace('strict', 'accept_invalid_certs')]) {
    assert.throws(() => validarModoDemo({ ...env, DATABASE_URL: url }));
  }
});

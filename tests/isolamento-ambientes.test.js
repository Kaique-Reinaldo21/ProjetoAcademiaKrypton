import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rootCertificates } from 'node:tls';
import { DESTINO_ACADEMICO_OFICIAL, DESTINO_DEMO_TLS_SEM_VALIDACAO } from '../src/config/demo-hosts.js';
import { datasourcePoolDemo, validarModoDemo } from '../src/config/demo-db.js';
import { validarTlsBanco } from '../src/services/checkout-demo.service.js';
import { consultarAssinatura, consultarFatura } from '../src/gatewary/mercadopago.js';

function ambiente(perfil, destino) {
  return {
    NODE_ENV: 'production', PAYMENT_MODE: 'demo', DEMO_DEPLOYMENT: perfil, DEMO_PRISMA_POOL: 'serial',
    DEMO_DATABASE_HOST: destino.host, DEMO_DATABASE_NAME: destino.banco, RENDER: 'true',
    RENDER_EXTERNAL_HOSTNAME: destino.render,
    DATABASE_URL: `mysql://fixture:nao-real@${destino.host}:${destino.porta}/${destino.banco}?sslaccept=strict`,
  };
}

const oficial = ambiente('academico_oficial', DESTINO_ACADEMICO_OFICIAL);
const isolado = ambiente('academico_isolado', DESTINO_DEMO_TLS_SEM_VALIDACAO);
const urlSemBanco = 'mysql://fixture:nao-real@127.0.0.1:1/testes_sem_banco';
const rejeitado = codigo => erro => erro.status === 403 && erro.codigoConfiguracao === codigo;

function comCa(t) {
  const pasta = mkdtempSync(path.join(tmpdir(), 'krypton-oficial-'));
  t.after(() => rmSync(pasta, { recursive: true, force: true }));
  const arquivo = path.join(pasta, 'ca.pem');
  writeFileSync(arquivo, rootCertificates[0]);
  return { pasta, arquivo, env: { ...oficial, DATABASE_URL: oficial.DATABASE_URL + '&sslcert=' + encodeURIComponent(arquivo) } };
}

test('oficial aceita o IPv4, a porta e o schema autorizados com CA legível', t => {
  const { env, arquivo } = comCa(t);
  assert.deepEqual(DESTINO_ACADEMICO_OFICIAL, {
    host: '147.224.191.149', banco: 'krypton_oficial', porta: '3306', render: 'projetoacademiakrypton.onrender.com',
  });
  assert.equal(validarTlsBanco(env), undefined);
  assert.equal(new URL(datasourcePoolDemo(env)).searchParams.get('sslcert'), arquivo);
  assert.equal(validarTlsBanco({ ...env, DEMO_PRISMA_POOL: '' }), undefined);
  assert.equal(datasourcePoolDemo({ ...env, DEMO_PRISMA_POOL: '' }), undefined);
});

test('oficial rejeita Clever Cloud legado, outro IPv4, schema e porta incorretos', t => {
  const { env } = comCa(t);
  for (const [host, banco, porta] of [
    ['b7ah1lmgd5imdjqu51eq-mysql.services.clever-cloud.com', 'b7ah1lmgd5imdjqu51eq', '3306'],
    ['147.224.191.150', 'krypton_oficial', '3306'],
    ['147.224.191.149', 'outro_schema', '3306'],
    ['147.224.191.149', 'krypton_oficial', '3307'],
    ['147.224.191.149', 'krypton_oficial', ''],
  ]) {
    const url = new URL(env.DATABASE_URL);
    url.hostname = host;
    url.pathname = '/' + banco;
    url.port = porta;
    assert.throws(() => validarTlsBanco({ ...env, DEMO_DATABASE_HOST: host, DEMO_DATABASE_NAME: banco, DATABASE_URL: url.href }),
      rejeitado('DESTINO_OU_PORTA_NAO_APROVADO'));
  }
});

test('oficial rejeita CA ausente, vazia, duplicada ou inacessível antes de usar o Prisma', t => {
  const { env, pasta } = comCa(t);
  for (const [url, codigo] of [
    [oficial.DATABASE_URL, 'CA_OBRIGATORIA'],
    [oficial.DATABASE_URL + '&sslcert=', 'SSLCERT_VAZIO_OU_DUPLICADO'],
    [env.DATABASE_URL + '&ssl%63ert=outra.pem', 'SSLCERT_VAZIO_OU_DUPLICADO'],
    [oficial.DATABASE_URL + '&sslcert=' + encodeURIComponent(path.join(pasta, 'ausente.pem')), 'CA_INACESSIVEL'],
    [oficial.DATABASE_URL + '&sslcert=' + encodeURIComponent(pasta), 'CA_INACESSIVEL'],
    [env.DATABASE_URL + '&sslaccept=strict', 'SSLACCEPT_INVALIDO'],
    [env.DATABASE_URL.replace('strict', 'invalido'), 'SSLACCEPT_INVALIDO'],
    [env.DATABASE_URL + '&socket=/tmp/mysql.sock', 'PARAMETRO_NAO_PERMITIDO'],
  ]) {
    const invalido = { ...env, DATABASE_URL: url };
    const erroSeguro = erro => rejeitado(codigo)(erro) && !/fixture|nao-real/.test(erro.stack);
    assert.throws(() => validarTlsBanco(invalido), erroSeguro);
    assert.throws(() => datasourcePoolDemo(invalido), erroSeguro);
  }
});

test('configuração Oracle oficial mantém o gateway real do Mercado Pago bloqueado', async t => {
  const { env } = comCa(t);
  assert.equal(validarTlsBanco(env), undefined);
  const anterior = process.env.PAYMENT_MODE;
  process.env.PAYMENT_MODE = env.PAYMENT_MODE;
  t.after(() => {
    if (anterior === undefined) delete process.env.PAYMENT_MODE;
    else process.env.PAYMENT_MODE = anterior;
  });
  await assert.rejects(consultarAssinatura('fixture'), { codigo: 'gateway_desativado_demo' });
  await assert.rejects(consultarFatura('fixture'), { codigo: 'gateway_desativado_demo' });
});

test('isolamento exige o serviço Render e o destino exatos, com pool serial em ambos', t => {
  const { env: oficial } = comCa(t);
  for (const [atual, outro] of [[oficial, isolado], [isolado, oficial]]) {
    assert.equal(validarTlsBanco(atual), undefined);
    const pool = new URL(datasourcePoolDemo(atual));
    assert.equal(pool.hostname, atual.DEMO_DATABASE_HOST);
    assert.equal(pool.pathname, '/' + atual.DEMO_DATABASE_NAME);
    assert.equal(pool.searchParams.get('sslaccept'), 'strict');
    assert.equal(pool.searchParams.get('connection_limit'), '1');
    assert.equal(pool.searchParams.get('pool_timeout'), '30');
    const cruzado = { ...atual, DATABASE_URL: outro.DATABASE_URL,
      DEMO_DATABASE_HOST: outro.DEMO_DATABASE_HOST, DEMO_DATABASE_NAME: outro.DEMO_DATABASE_NAME };
    assert.throws(() => validarModoDemo(cruzado), rejeitado('DESTINO_OU_PORTA_NAO_APROVADO'));
    assert.throws(() => datasourcePoolDemo(cruzado), rejeitado('DESTINO_OU_PORTA_NAO_APROVADO'));
    assert.throws(() => validarModoDemo({ ...atual, RENDER_EXTERNAL_HOSTNAME: outro.RENDER_EXTERNAL_HOSTNAME }),
      rejeitado('SERVICO_RENDER_NAO_APROVADO'));
    assert.throws(() => validarModoDemo({ ...atual, RENDER_EXTERNAL_HOSTNAME: '' }),
      rejeitado('SERVICO_RENDER_NAO_APROVADO'));
    assert.throws(() => validarModoDemo({ ...atual, DATABASE_URL: atual.DATABASE_URL + '&connection_limit=1' }),
      rejeitado('PARAMETRO_NAO_PERMITIDO'));
    assert.throws(() => validarTlsBanco({ ...atual, DEMO_DEPLOYMENT: '', PAYMENT_MODE: 'real' }),
      rejeitado('PAYMENT_MODE_INVALIDO'));
  }
  assert.doesNotThrow(() => validarModoDemo({ ...oficial, RENDER: undefined, RENDER_EXTERNAL_HOSTNAME: undefined }));
});

test('isolamento oficial exige TLS estrito mesmo que o consentimento da exceção seja copiado', t => {
  const { env: oficial } = comCa(t);
  const comExcecao = atual => ({ ...atual, DEMO_ALLOW_UNVERIFIED_TLS: 'I_UNDERSTAND_TEST_ONLY',
    DATABASE_URL: atual.DATABASE_URL.replace('strict', 'accept_invalid_certs') });
  assert.throws(() => validarTlsBanco(comExcecao(oficial)), rejeitado('SSLACCEPT_INVALIDO'));
  assert.equal(validarTlsBanco(comExcecao(isolado)), 'accept_invalid_certs');
  assert.throws(() => validarTlsBanco({ ...oficial, DATABASE_URL: oficial.DATABASE_URL.split('?')[0] }),
    rejeitado('SSLACCEPT_INVALIDO'));
});

test('isolamento bloqueia migrations sem ação explícita ou sob o perfil errado antes da conexão', () => {
  const rodar = (args, env) => spawnSync(process.execPath, ['scripts/migrate-demo-hospedado.js', ...args], {
    env: { ...process.env, ...env, DATABASE_URL: urlSemBanco }, encoding: 'utf8', timeout: 4000,
  });
  const semOpcao = rodar([], oficial);
  assert.ifError(semOpcao.error);
  assert.equal(semOpcao.status, 1);
  assert.match(semOpcao.stderr, /ARGUMENTO_INVALIDO/);
  const ambienteErrado = rodar(['--verificar'], { ...oficial, RENDER_EXTERNAL_HOSTNAME: isolado.RENDER_EXTERNAL_HOSTNAME });
  assert.ifError(ambienteErrado.error);
  assert.equal(ambienteErrado.status, 1);
  assert.match(ambienteErrado.stderr, /SERVICO_RENDER_NAO_APROVADO/);
  assert.doesNotMatch(ambienteErrado.stderr, /fixture|nao-real/);
  const aplicarOficial = rodar(['--aplicar'], oficial);
  assert.ifError(aplicarOficial.error);
  assert.equal(aplicarOficial.status, 1);
  assert.match(aplicarOficial.stderr, /MIGRACAO_OFICIAL_RESTRITA_AO_LOCALHOST/);
});

test('cliente Prisma exige a política oficial pelo IP mesmo sem flags do Render ou pool serial', () => {
  const resultado = spawnSync(process.execPath, ['--input-type=module', '--eval', "await import('./src/lib/prisma.js')"], {
    env: { ...process.env, DATABASE_URL: oficial.DATABASE_URL, NODE_ENV: 'production',
      DEMO_DEPLOYMENT: '', DEMO_PRISMA_POOL: '', PAYMENT_MODE: 'real', RENDER: '', RENDER_EXTERNAL_HOSTNAME: '' },
    encoding: 'utf8', timeout: 4000,
  });
  assert.ifError(resultado.error);
  assert.equal(resultado.status, 1);
  assert.match(resultado.stderr, /PAYMENT_MODE_INVALIDO/);
  assert.doesNotMatch(resultado.stderr, /fixture|nao-real/);
});

test('diagnóstico de banco no Render oficial valida configuração antes da conexão', () => {
  const resultado = spawnSync(process.execPath, ['scripts/check-db.js'], {
    env: { ...process.env, ...oficial, DEMO_PRISMA_POOL: '', DEMO_DEPLOYMENT: '',
      DATABASE_URL: urlSemBanco },
    encoding: 'utf8', timeout: 4000,
  });
  assert.ifError(resultado.error);
  assert.equal(resultado.status, 1);
  assert.match(resultado.stderr, /DEMO_DEPLOYMENT_INVALIDO/);
  assert.doesNotMatch(resultado.stderr, /fixture|nao-real/);
});

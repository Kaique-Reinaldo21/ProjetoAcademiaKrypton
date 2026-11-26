import assert from 'node:assert/strict';
import test from 'node:test';
import { datasourcePoolDemo, validarModoDemo } from '../src/config/demo-db.js';
import { DESTINO_DEMO_TLS_SEM_VALIDACAO as destino } from '../src/config/demo-hosts.js';

const env = Object.freeze({
  NODE_ENV: 'production', PAYMENT_MODE: 'demo', DEMO_DEPLOYMENT: 'academico_isolado',
  DEMO_PRISMA_POOL: 'serial', DEMO_DATABASE_HOST: destino.host, DEMO_DATABASE_NAME: destino.banco,
  DATABASE_URL: `mysql://teste:nao-real@${destino.host}:${destino.porta}/${destino.banco}?sslaccept=strict&sslcert=%2Fetc%2Fsecrets%2Fca.pem`,
});

test('pool interno mantém destino e TLS validados, sem modificar DATABASE_URL', () => {
  const original = new URL(env.DATABASE_URL);
  const interno = new URL(datasourcePoolDemo(env));
  assert.equal(interno.searchParams.get('connection_limit'), '1');
  assert.equal(interno.searchParams.get('pool_timeout'), '30');
  interno.searchParams.delete('connection_limit');
  interno.searchParams.delete('pool_timeout');
  assert.deepEqual(Object.fromEntries(interno.searchParams), Object.fromEntries(original.searchParams));
  assert.equal(interno.host, original.host);
  assert.equal(interno.pathname, original.pathname);
  assert.doesNotThrow(() => validarModoDemo(env));
});

test('pool demonstrativo não atua fora do modo aprovado nem aceita parâmetros externos', () => {
  for (const alteracao of [{ NODE_ENV: 'development' }, { PAYMENT_MODE: 'real' }, { DEMO_PRISMA_POOL: '' }]) {
    assert.equal(datasourcePoolDemo({ ...env, ...alteracao }), undefined);
  }
  for (const alteracao of [
    { DEMO_DEPLOYMENT: '' }, { DEMO_DATABASE_NAME: 'outro' }, { DEMO_DATABASE_HOST: 'outro.invalid' },
    { DATABASE_URL: env.DATABASE_URL.replace(':3306/', ':3307/') },
    { DATABASE_URL: env.DATABASE_URL + '&pool_timeout=30' },
    { DATABASE_URL: env.DATABASE_URL + '&connection_limit=1' },
    { DATABASE_URL: env.DATABASE_URL.replace('strict', 'accept_invalid_certs') },
  ]) {
    assert.throws(() => datasourcePoolDemo({ ...env, ...alteracao }), { status: 403 });
  }
  const optIn = { ...env, DATABASE_URL: env.DATABASE_URL.replace('strict', 'accept_invalid_certs'),
    DEMO_ALLOW_UNVERIFIED_TLS: 'I_UNDERSTAND_TEST_ONLY' };
  assert.equal(new URL(datasourcePoolDemo(optIn)).searchParams.get('sslaccept'), 'accept_invalid_certs');
  assert.throws(() => datasourcePoolDemo({ ...optIn, DATABASE_URL: optIn.DATABASE_URL.replace(destino.host, 'outro.invalid'),
    DEMO_DATABASE_HOST: 'outro.invalid' }), { status: 403 });
});

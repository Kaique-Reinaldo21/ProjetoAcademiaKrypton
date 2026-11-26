import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { DESTINO_ACADEMICO_OFICIAL, DESTINO_DEMO_TLS_SEM_VALIDACAO } from '../src/config/demo-hosts.js';
import { datasourcePoolDemo, validarModoDemo } from '../src/config/demo-db.js';
import { validarTlsBanco } from '../src/services/checkout-demo.service.js';

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
const rejeitado = codigo => erro => erro.status === 403 && erro.codigoConfiguracao === codigo;

test('isolamento exige o serviço Render e o destino exatos, com pool serial em ambos', () => {
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

test('isolamento oficial exige TLS estrito mesmo que o consentimento da exceção seja copiado', () => {
  const comExcecao = atual => ({ ...atual, DEMO_ALLOW_UNVERIFIED_TLS: 'I_UNDERSTAND_TEST_ONLY',
    DATABASE_URL: atual.DATABASE_URL.replace('strict', 'accept_invalid_certs') });
  assert.throws(() => validarTlsBanco(comExcecao(oficial)), rejeitado('SSLACCEPT_INVALIDO'));
  assert.equal(validarTlsBanco(comExcecao(isolado)), 'accept_invalid_certs');
  assert.throws(() => validarTlsBanco({ ...oficial, DATABASE_URL: oficial.DATABASE_URL.split('?')[0] }),
    rejeitado('SSLACCEPT_INVALIDO'));
});

test('isolamento bloqueia migrations sem ação explícita ou sob o perfil errado antes da conexão', () => {
  const rodar = (args, env) => spawnSync(process.execPath, ['scripts/migrate-demo-hospedado.js', ...args], {
    env: { ...process.env, ...env }, encoding: 'utf8', timeout: 4000,
  });
  const semOpcao = rodar([], oficial);
  assert.equal(semOpcao.status, 1);
  assert.match(semOpcao.stderr, /ARGUMENTO_INVALIDO/);
  const ambienteErrado = rodar(['--aplicar'], { ...oficial, RENDER_EXTERNAL_HOSTNAME: isolado.RENDER_EXTERNAL_HOSTNAME });
  assert.equal(ambienteErrado.status, 1);
  assert.match(ambienteErrado.stderr, /SERVICO_RENDER_NAO_APROVADO/);
  assert.doesNotMatch(ambienteErrado.stderr, /fixture|nao-real/);
});

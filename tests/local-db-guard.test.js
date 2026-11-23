import test from 'node:test';
import assert from 'node:assert/strict';
import { validarBancoLocal } from '../scripts/local-db-guard.js';

function comEnv(url, ambiente, fn) {
  const anteriorUrl = process.env.DATABASE_URL;
  const anteriorEnv = process.env.NODE_ENV;
  try {
    if (url === null) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = url;
    if (ambiente === null) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = ambiente;
    return fn();
  } finally {
    if (anteriorUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = anteriorUrl;
    if (anteriorEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = anteriorEnv;
  }
}

test('aceita banco local MySQL em development', () => {
  comEnv('mysql://usuario:senha@localhost:3306/academia_kripton', 'development', () => {
    assert.equal(validarBancoLocal().banco, 'academia_kripton');
  });
});

test('recusa Clever Cloud e hosts de rede', () => {
  for (const host of ['mysql.clever-cloud.com', '192.168.0.12']) {
    comEnv('mysql://usuario:senha@' + host + ':3306/academia_kripton', 'development', () => {
      assert.throws(() => validarBancoLocal(), /bloqueada/i);
    });
  }
});

test('recusa ambiente de producao e URL sem banco', () => {
  comEnv('mysql://usuario:senha@127.0.0.1:3306/academia_kripton', 'production', () => {
    assert.throws(() => validarBancoLocal(), /production/i);
  });
  comEnv('mysql://usuario:senha@127.0.0.1:3306', 'development', () => {
    assert.throws(() => validarBancoLocal(), /nome do banco/i);
  });
});

test('recusa configuracao ausente', () => {
  comEnv(null, 'development', () => {
    assert.throws(() => validarBancoLocal(), /DATABASE_URL/i);
  });
});

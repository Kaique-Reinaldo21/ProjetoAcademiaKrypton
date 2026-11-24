import test from 'node:test';
import assert from 'node:assert/strict';
import { validarDestinoAdministrativo } from '../scripts/reconciliar-checkout-guard.js';

test('comando administrativo exige URL MySQL local explícita sem parâmetros', () => {
  assert.equal(validarDestinoAdministrativo('mysql://u:p@127.0.0.1:3306/banco'), 'mysql://u:p@127.0.0.1:3306/banco');
  for (const url of [undefined, 'mysql://u:p@mysql.clever-cloud.com/banco', 'mysql://u:p@192.168.1.1/banco', 'mysql://u:p@localhost/banco?socket=/tmp/mysql.sock', 'mysql://u:p@localhost/', 'https://localhost/banco']) {
    assert.throws(() => validarDestinoAdministrativo(url));
  }
});

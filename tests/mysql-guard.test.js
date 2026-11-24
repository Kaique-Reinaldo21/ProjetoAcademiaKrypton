import test from 'node:test';
import assert from 'node:assert/strict';
import { validarUrlTeste } from '../integration/mysql-guard.mjs';

test('guarda aceita somente banco de teste local exato sem parâmetros', () => {
  for (const url of ['mysql://u:p@localhost/academia_kripton_checkout_test', 'mysql://u:p@127.0.0.1:3306/academia_kripton_checkout_test']) assert.equal(validarUrlTeste(url), url);
  for (const url of [undefined, 'mysql://u:p@localhost/academia_kripton', 'mysql://u:p@remote/academia_kripton_checkout_test', 'mysql://u:p@[::1]/academia_kripton_checkout_test', 'mysql://u:p@localhost/academia_kripton_checkout_test?socket=/tmp/mysql.sock', 'mysql://u:p@localhost/academia_kripton_checkout_test/outro', 'https://localhost/academia_kripton_checkout_test']) assert.throws(() => validarUrlTeste(url));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { limiteFoto, prepararFoto } from '../src/routes/perfil-aluno.routes.js';

test('foto aceita PNG real e grava nova imagem sem o conteúdo anexado', () => {
  const dados = Buffer.from([50, 90, 30, 255]);
  const png = PNG.sync.write({ width: 1, height: 1, data: dados });
  const recebida = Buffer.concat([png, Buffer.from('dados externos ao PNG')]);
  const preparada = prepararFoto(recebida);
  assert.ok(preparada);
  assert.deepEqual(PNG.sync.read(preparada).data, dados);
  assert.ok(!preparada.includes('dados externos ao PNG'));
});

test('foto recusa conteúdo inválido, corrompido ou acima dos limites', () => {
  const pequena = PNG.sync.write({ width: 1, height: 1, data: Buffer.alloc(4) });
  pequena[32] ^= 1;
  const grande = PNG.sync.write({ width: 321, height: 1, data: Buffer.alloc(321 * 4) });
  for (const dados of [undefined, Buffer.from('GIF89a'), pequena, grande, Buffer.alloc(limiteFoto + 1)]) {
    assert.equal(prepararFoto(dados), null);
  }
});

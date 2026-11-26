import test from 'node:test';
import assert from 'node:assert/strict';
import { identidadeGoogle } from '../src/services/google-oauth.service.js';

test('identidade exige sub do Google e e-mail explicitamente confirmado', () => {
  const perfil = { provider: 'google', id: '123', emails: [{ value: 'Aluno@gmail.com', verified: true }] };
  assert.deepEqual(identidadeGoogle(perfil), { sub: '123', email: 'aluno@gmail.com', nome: 'Aluno Krypton', emailAutoritativo: true });
  for (const entrada of [
    { ...perfil, id: '' }, { ...perfil, provider: 'outro' },
    { ...perfil, emails: [{ value: 'aluno@gmail.com' }] },
    { ...perfil, emails: [{ value: 'aluno@gmail.com', verified: 'true' }] },
  ]) assert.equal(identidadeGoogle(entrada), null);
  const externo = { ...perfil, emails: [{ value: 'aluno@example.test', verified: true }] };
  assert.equal(identidadeGoogle(externo).emailAutoritativo, false);
  assert.equal(identidadeGoogle({ ...externo, _json: { hd: 'example.test' } }).emailAutoritativo, true);
});

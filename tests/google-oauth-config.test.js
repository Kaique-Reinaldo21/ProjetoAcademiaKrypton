import test from 'node:test';
import assert from 'node:assert/strict';
import { obterCallbackGoogle } from '../src/config/google-oauth-config.js';

test('desenvolvimento mantém retorno local padrão e aceita URL configurada', () => {
  assert.throws(() => obterCallbackGoogle({ NODE_ENV: 'development', GOOGLE_CALLBACK_URL: 'http://exemplo.test/api/auth/google/callback' }), /GOOGLE_CALLBACK_URL/);
  assert.equal(obterCallbackGoogle({ NODE_ENV: 'development' }), 'http://localhost:3000/api/auth/google/callback');
  assert.equal(obterCallbackGoogle({ NODE_ENV: 'development', GOOGLE_CALLBACK_URL: 'http://localhost:4000/api/auth/google/callback' }), 'http://localhost:4000/api/auth/google/callback');
});

test('produção exige HTTPS com domínio e rota de retorno válidos', () => {
  const url = 'https://academia.example/api/auth/google/callback';
  assert.equal(obterCallbackGoogle({ NODE_ENV: 'production', GOOGLE_CALLBACK_URL: url }), url);
  for (const invalida of [undefined, 'http://localhost:3000/api/auth/google/callback', 'https://localhost/api/auth/google/callback', 'https://127.0.0.1/api/auth/google/callback', 'https://x.localhost/api/auth/google/callback', 'http://academia.example/api/auth/google/callback', 'https://academia.example/outra', 'https://user:senha@academia.example/api/auth/google/callback', 'https://academia.example/api/auth/google/callback?x=1']) {
    assert.throws(() => obterCallbackGoogle({ NODE_ENV: 'production', GOOGLE_CALLBACK_URL: invalida }), /GOOGLE_CALLBACK_URL/);
  }
});

test('outros ambientes não recebem fallback localhost', () => {
  assert.throws(() => obterCallbackGoogle({ NODE_ENV: 'test' }), /GOOGLE_CALLBACK_URL/);
  assert.throws(() => obterCallbackGoogle({}), /GOOGLE_CALLBACK_URL/);
});

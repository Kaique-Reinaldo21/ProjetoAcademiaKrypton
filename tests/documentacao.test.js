// Testes locais sem acesso ao banco ou credenciais: node --test tests/documentacao.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const spec = JSON.parse(readFileSync(new URL('../public/openapi.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('OpenAPI tem versao e endpoints de leitura existentes', () => {
  assert.match(spec.openapi, /^3\./);
  assert.ok(spec.paths['/api/health']?.get);
  assert.ok(spec.paths['/api/unidades']?.get);
  assert.ok(spec.paths['/api/usuario/agendamentos']?.get);
  assert.ok(spec.paths['/api/admin/resumo']?.get);
});

test('OpenAPI distingue endpoints com autenticacao', () => {
  assert.equal(spec.paths['/api/health'].get.security, undefined);
  assert.ok(spec.paths['/api/usuario/perfil'].get.security);
});

test('Comandos de diagnostico nao alteram o banco', () => {
  const comandosProibidos =
    /\b(?:npx\s+)?prisma\s+(?:migrate\s+reset|db\s+push|db\s+seed)\b|\bnode\s+(?:prisma\/seed\.js|scripts\/seed-local-unidades\.js)\b|\bnpm(?:\s+run)?\s+seed\b/i;

  for (const nome of [
    'check:env',
    'check:db',
    'check:syntax',
    'prisma:status',
  ]) {
    assert.ok(pkg.scripts[nome], nome);
    assert.doesNotMatch(pkg.scripts[nome], comandosProibidos);
  }
});

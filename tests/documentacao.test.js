// Testes locais sem acesso ao banco ou credenciais: node --test tests/documentacao.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const spec = JSON.parse(readFileSync(new URL('../public/openapi.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('OpenAPI tem versao e endpoints de leitura existentes', () => {
  assert.equal(spec.openapi, '3.0.3');
  assert.equal(spec.info.version, '1.0.0');
  assert.ok(spec.paths['/api/health']?.get);
  assert.ok(spec.paths['/api/unidades']?.get);
  assert.ok(spec.paths['/api/usuario/agendamentos']?.get);
  assert.ok(spec.paths['/api/admin/resumo']?.get);
});

test('OpenAPI documenta os cinco perfis e os fluxos acadêmicos implementados', () => {
  assert.deepEqual(spec.components.schemas.Papel.enum, ['admin', 'aluno', 'recepcao', 'personal', 'nutricionista']);
  for (const caminho of [
    '/api/usuario/perfil', '/api/usuario/perfil/foto',
    '/api/profissionais/contas', '/api/profissionais/contas/{id}/alunos/{aluno}',
    '/api/profissionais/recepcao/alunos',
    '/api/profissionais/recepcao/matricula-simulada',
    '/api/profissionais/recepcao/matricula-simulada/{id}/confirmar',
    '/api/profissionais/documentos', '/api/profissionais/documentos/gerar',
    '/api/profissionais/documentos/{id}', '/api/profissionais/documentos/{id}/arquivo',
    '/api/profissionais/agenda', '/api/profissionais/recepcao',
    '/api/profissionais/fichas', '/api/profissionais/notificacoes',
    '/api/checkout', '/api/auth/senha', '/api/auth/recuperacao',
  ]) assert.ok(spec.paths[caminho], caminho);
  assert.ok(spec.tags.some(({ name }) => name === 'Perfil pessoal'));
  assert.ok(spec.tags.some(({ name }) => name === 'Notificações'));
  assert.ok(spec.paths['/api/profissionais/alunos'].get.parameters.some(({ name }) => name === 'vencendo'));
});

test('OpenAPI distingue endpoints com autenticacao', () => {
  assert.equal(spec.paths['/api/health'].get.security, undefined);
  assert.ok(spec.paths['/api/usuario/perfil'].get.security);
});

test('Operações OpenAPI têm tags, respostas e referências resolvíveis', () => {
  const tags = new Set(spec.tags.map(({ name }) => name));
  const methods = new Set(['get', 'post', 'put', 'patch', 'delete']);
  const operationIds = new Set();
  const visit = (value, local = spec) => {
    if (Array.isArray(value)) return value.forEach((item) => visit(item, local));
    if (!value || typeof value !== 'object') return;
    if (typeof value.$ref === 'string') {
      assert.ok(value.$ref.startsWith('#/'), `Referência externa inesperada: ${value.$ref}`);
      const target = value.$ref.slice(2).split('/').reduce((obj, key) => obj?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], local);
      assert.ok(target, `Referência não resolvida: ${value.$ref}`);
    }
    Object.values(value).forEach((item) => visit(item, local));
  };

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!methods.has(method)) continue;
      assert.ok(operation.operationId, `${method.toUpperCase()} ${path}: operationId`);
      assert.ok(!operationIds.has(operation.operationId), `operationId duplicado: ${operation.operationId}`);
      operationIds.add(operation.operationId);
      assert.ok(operation.tags?.length, `${method.toUpperCase()} ${path}: tags`);
      operation.tags.forEach((tag) => assert.ok(tags.has(tag), `Tag desconhecida: ${tag}`));
      assert.ok(Object.keys(operation.responses || {}).length, `${method.toUpperCase()} ${path}: responses`);
      const declaredParams = [...(pathItem.parameters || []), ...(operation.parameters || [])]
        .filter(({ in: location }) => location === 'path').map(({ name }) => name);
      for (const [, name] of path.matchAll(/\{([^}]+)\}/g)) {
        assert.ok(declaredParams.includes(name), `${method.toUpperCase()} ${path}: parâmetro ${name}`);
      }
      visit(operation);
    }
  }
});

test('Swagger UI carrega a especificação local e permite executar somente GET', () => {
  const html = readFileSync(new URL('../public/api-docs.html', import.meta.url), 'utf8');
  assert.match(html, /swagger-ui-bundle\.js/);
  assert.match(html, /url:\s*['"]\/openapi\.json['"]/);
  assert.match(html, /supportedSubmitMethods:\s*\[['"]get['"]\]/);
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

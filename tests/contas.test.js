import test from 'node:test';
import assert from 'node:assert/strict';
import { conferirSenha, erroNovaSenha, gerarHashSenha } from '../src/services/politica-senha.js';
import { normalizarEmail, criarServicoContas } from '../src/services/contas.service.js';
import { criarEmailRecuperacao } from '../src/services/recuperacao-email.service.js';

test('política aceita frases longas e rejeita truncamento do bcrypt por byte', async () => {
  const caracteres = 'ç'.repeat(36);
  assert.equal(erroNovaSenha('a'.repeat(5), undefined, 'aluno'), 'Use pelo menos 6 caracteres.');
  assert.equal(erroNovaSenha('a'.repeat(6), undefined, 'aluno'), null);
  assert.equal(erroNovaSenha('é'.repeat(37), undefined, 'aluno'), 'A senha pode ter até 72 bytes em UTF-8.');
  assert.equal(erroNovaSenha('a'.repeat(11), undefined, 'admin'), 'Use pelo menos 12 caracteres.');
  assert.equal(erroNovaSenha(caracteres), null);
  assert.match(erroNovaSenha(caracteres + 'a'), /72 bytes/);
  assert.match(erroNovaSenha('uma frase comprida', 'outra frase comprida'), /iguais/);
  assert.equal(erroNovaSenha('a'.repeat(72)), null);
  const hash = await gerarHashSenha(caracteres);
  assert.notEqual(hash, caracteres);
  assert.equal(await conferirSenha(caracteres, hash), true);
  assert.equal(await conferirSenha(caracteres + 'a', hash), false);
});

test('e-mail inválido e token malformado são recusados antes de consultar o banco', async () => {
  let consultas = 0;
  const db = new Proxy({}, { get() { consultas++; throw new Error('Banco não esperado'); } });
  const servico = criarServicoContas({ db, enviarEmail() { throw new Error('Envio não esperado'); } });
  assert.equal(normalizarEmail('  Contato@Example.invalid '), 'contato@example.invalid');
  assert.equal(normalizarEmail('inválido'), null);
  await servico.solicitar('inválido');
  await assert.rejects(servico.redefinir('inválido', 'uma frase comprida', 'uma frase comprida'), { status: 410 });
  await assert.rejects(servico.recuperarComoAdmin({ id: 1, role: 'aluno' }, 'outro@example.invalid', 'irrelevante'), { status: 403 });
  assert.equal(consultas, 0);
});

test('SMTP exige configuração completa e origem HTTPS em produção', () => {
  const env = {
    NODE_ENV: 'production', CONTA_ORIGEM_PUBLICA: 'https://demo.example.invalid',
    CONTA_SMTP_HOST: 'smtp.example.invalid', CONTA_SMTP_PORTA: '2525',
    CONTA_SMTP_USUARIO: 'somente_teste', CONTA_SMTP_SENHA: 'somente_teste',
    CONTA_EMAIL_REMETENTE: 'contas@example.invalid',
  };
  assert.equal(typeof criarEmailRecuperacao(env), 'function');
  assert.equal(criarEmailRecuperacao({ ...env, CONTA_ORIGEM_PUBLICA: 'http://demo.example.invalid' }), null);
  assert.equal(criarEmailRecuperacao({ ...env, CONTA_ORIGEM_PUBLICA: 'https://demo.example.invalid/?debug=true' }), null);
  assert.equal(criarEmailRecuperacao({ ...env, CONTA_SMTP_SENHA: '' }), null);
});

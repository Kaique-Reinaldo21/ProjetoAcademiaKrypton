import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticarInicializacao } from '../src/lib/diagnostico-inicializacao.js';

test('classifica códigos Prisma sem incluir mensagem ou credenciais', () => {
  for (const [codigo, categoria] of [['P1000', 'autenticacao'], ['P1001', 'servidor_inalcancavel'], ['P1002', 'tempo_de_conexao_esgotado'], ['P1011', 'tls'], ['P1017', 'prisma_outro']]) {
    const dados = diagnosticarInicializacao({ name: 'PrismaClientInitializationError', errorCode: codigo, message: 'mysql://usuario:senha@host/banco', stack: 'token privado' });
    assert.deepEqual(dados, { categoria, classe: 'PrismaClientInitializationError', codigo });
    assert.doesNotMatch(JSON.stringify(dados), /senha|usuario|host|token/);
  }
});

test('usa code como alternativa e rejeita valores arbitrários', () => {
  assert.equal(diagnosticarInicializacao({ name: 'Error', code: 'P1001' }).codigo, 'P1001');
  assert.deepEqual(diagnosticarInicializacao({ name: 'mysql://senha@host', code: 'SENHA_SECRETA' }), { categoria: 'desconhecida', classe: 'Desconhecida', codigo: 'INDISPONIVEL' });
});

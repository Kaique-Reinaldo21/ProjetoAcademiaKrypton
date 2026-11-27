import test from 'node:test';
import assert from 'node:assert/strict';
import { criarServicoProfissionais } from '../src/services/perfis-profissionais.service.js';

function bancoFichaExistente() {
  const registros = [];
  const ficha = { id: 13, aluno_id: 2, profissional_id: 7, tipo: 'personal', titulo: 'Treino A', orientacoes: null,
    itens: [{ divisao: 'A', nome: 'Agachamento', series: 3, repeticoes: '10', carga: null, descanso: null, orientacoes: null }] };
  const db = {
    async $queryRaw() { return [{ id: 2 }]; },
    async $transaction(callback) { return callback(db); },
    usuarios: { async findFirst() { return { id: 2 }; } },
    vinculos_profissionais: { async findFirst() { return { profissional_id: 7 }; } },
    planos: { async findFirst() { return { tipo: 'elite', ativo: true, vencimento: null }; } },
    jobs: { async createMany() { return { count: 1 }; } },
    fichas_profissionais: {
      async findFirst({ where }) { return where.profissional_id === ficha.profissional_id && where.aluno_id === ficha.aluno_id ? ficha : null; },
      async findMany() { return []; },
      async create({ data }) { registros.push(data); return { id: 14, ...data }; },
      async update({ data }) { Object.assign(ficha, data); return ficha; },
    },
  };
  return { db, ficha, registros };
}

test('personal pode publicar ficha com um exercício e limites de 1 a 30 séries', async () => {
  const { db, registros } = bancoFichaExistente();
  const service = criarServicoProfissionais(db);
  const entrada = { aluno_id: 2, titulo: 'Treino único', itens: [{ divisao: 'A', nome: 'Agachamento', series: 1, repeticoes: '8' }] };
  const criada = await service.salvarFicha({ id: 7, role: 'personal' }, entrada);
  assert.equal(criada.itens.length, 1);
  assert.equal(criada.itens[0].series, 1);
  assert.equal(registros.length, 1);
  await assert.rejects(service.salvarFicha({ id: 7, role: 'personal' }, { ...entrada, itens: [{ ...entrada.itens[0], series: 0 }] }), /1 a 30 séries/);
  await assert.rejects(service.salvarFicha({ id: 7, role: 'personal' }, { ...entrada, itens: [{ ...entrada.itens[0], series: 31 }] }), /1 a 30 séries/);
});

test('edição da ficha preserva exercícios enviados e rejeita ficha de outro aluno', async () => {
  const { db, ficha } = bancoFichaExistente();
  const service = criarServicoProfissionais(db);
  const itens = [...ficha.itens, { divisao: 'B', nome: 'Remada', series: 2, repeticoes: '12' }];
  const atualizada = await service.salvarFicha({ id: 7, role: 'personal' }, { aluno_id: 2, titulo: 'Treino A', itens }, 13);
  assert.equal(atualizada.itens.length, 2);
  assert.equal(atualizada.itens[0].nome, 'Agachamento');
  await assert.rejects(service.salvarFicha({ id: 8, role: 'personal' }, { aluno_id: 2, titulo: 'Treino A', itens }, 13), /Ficha não encontrada/);
});

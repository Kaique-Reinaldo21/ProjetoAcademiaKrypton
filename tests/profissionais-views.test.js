import test from 'node:test';
import assert from 'node:assert/strict';
import { payloadFicha } from '../public/js/dashboard/profissionais-views.js';

test('payload separa orientação geral de exercício na ficha de treino', () => {
  const item = { divisao: 'A', nome: 'Agachamento', orientacoes: 'Joelhos alinhados' };
  const payload = payloadFicha({ aluno_id: '8', titulo: 'Treino A', orientacoes_gerais: 'Aquecimento antes de iniciar' }, [item]);
  assert.equal(payload.orientacoes, 'Aquecimento antes de iniciar');
  assert.equal(payload.itens[0].orientacoes, 'Joelhos alinhados');
});

test('payload separa orientação geral de refeição no plano alimentar', () => {
  const item = { refeicao: 'Almoço', orientacoes: 'Evitar substituição' };
  const payload = payloadFicha({ aluno_id: '8', titulo: 'Plano', orientacoes_gerais: 'Hidratação ao longo do dia' }, [item]);
  assert.equal(payload.orientacoes, 'Hidratação ao longo do dia');
  assert.equal(payload.itens[0].orientacoes, 'Evitar substituição');
});

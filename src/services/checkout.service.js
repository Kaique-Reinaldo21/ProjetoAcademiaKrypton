import { randomUUID } from 'node:crypto';
import prisma from '../lib/prisma.js';
import {
  PLANOS_MP,
  criarCheckoutAssinatura,
  consultarAssinatura,
  possuiPagamentoAprovado,
  obterPagamentoAprovado,
  buscarAssinaturasPorPagador,
  validarConfiguracaoCheckout,
} from '../gatewary/mercadopago.js';

export class ErroCheckout extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

export const camposHistoricoPagamento = {
  id: true, origem: true, status: true, valor_centavos: true, moeda: true, criado_em: true,
  tentativa: { select: { tipo: true, metodo: true } },
};

export function criarServicoCheckout({ prisma, criarCheckoutAssinatura, consultarAssinatura, possuiPagamentoAprovado, obterPagamentoAprovado, buscarAssinaturasPorPagador, validarConfiguracaoCheckout, simulado = false }) {
const metodo = simulado ? 'mercadopago_simulado' : 'mercadopago';
const pagamentoDemoId = id => 'demo_mp_' + id;

async function iniciarCheckout(usuarioId, tipo, unidadeIdInformada) {
  if (typeof tipo !== 'string' || !Object.hasOwn(PLANOS_MP, tipo)) {
    throw new ErroCheckout('Selecione um plano válido (basico, pro ou elite).');
  }

  if (validarConfiguracaoCheckout) validarConfiguracaoCheckout();

  const { usuario, tentativa, checkoutDemo } = await prisma.$transaction(async tx => {
  // O bloqueio serializa as reservas do mesmo aluno antes de consultar tentativas.
  await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${Number(usuarioId)} FOR UPDATE`;
  const usuario = await tx.usuarios.findUnique({
    where: { id: Number(usuarioId) },
    select: { id: true, email: true, role: true },
  });
  if (!usuario || usuario.role !== 'aluno') {
    throw new ErroCheckout('Somente alunos podem contratar planos.', 403);
  }

  let unidadeId = null;
  if (tipo === 'basico') {
    unidadeId = Number(unidadeIdInformada);
    if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
      throw new ErroCheckout('Selecione uma unidade válida para o plano Básico.');
    }
    const unidade = await tx.unidades.findUnique({ where: { id: unidadeId }, select: { id: true } });
    if (!unidade) throw new ErroCheckout('Unidade não encontrada.', 404);
  }

  const pendente = await tx.checkout_tentativas.findFirst({
    where: { usuario_id: usuario.id, status: { in: ['pendente', 'aguardando'] } },
  });
  if (pendente) {
    throw new ErroCheckout(
      'Já existe um checkout em andamento. Conclua-o ou solicite suporte para cancelamento.',
      409
    );
  }

  // Evita iniciar outra cobrança recorrente enquanto a assinatura anterior continua ativa.
  const recorrente = await tx.planos.findFirst({
    where: {
      usuario_id: usuario.id,
      ativo: true,
      mp_preapproval_id: { not: null },
    },
    select: { id: true },
  });
  if (recorrente) {
    throw new ErroCheckout(
      'Sua assinatura recorrente já está ativa. A troca requer atualização ou cancelamento da cobrança atual; procure o suporte.',
      409
    );
  }

  const id = randomUUID();
  // O adaptador de demonstração é local e permite persistir reserva e resposta inicial em uma transação.
  const checkoutDemo = simulado ? await criarCheckoutAssinatura({ tipo, email: usuario.email, tentativaId: id }) : null;
  const tentativa = await tx.checkout_tentativas.create({
    data: {
      id,
      usuario_id: usuario.id,
      tipo,
      unidade_id: unidadeId,
      status: checkoutDemo ? 'aguardando' : 'pendente',
      metodo,
      ...(checkoutDemo && { mp_preapproval_id: checkoutDemo.id, resposta_mp_demo: 'pendente' }),
    },
  });
  if (checkoutDemo) {
    await tx.transacoes_pagamento.create({ data: {
      mp_payment_id: pagamentoDemoId(id), mp_preapproval_id: checkoutDemo.id,
      usuario_id: usuario.id, tentativa_id: id, valor_centavos: Math.round(PLANOS_MP[tipo].valor * 100),
      moeda: 'BRL', status: 'pending', origem: 'demo_mercadopago',
    } });
  }

  return { usuario, tentativa, checkoutDemo };
  }, { isolationLevel: 'ReadCommitted' });

  if (checkoutDemo) return { url: checkoutDemo.url, tentativaId: tentativa.id };

  // Uma falha ou timeout do provedor pode ocorrer depois da criação remota.
  // Mantenha a reserva pendente para reconciliação manual, evitando nova cobrança.
  const checkout = await criarCheckoutAssinatura({
    tipo,
    email: usuario.email,
    tentativaId: tentativa.id,
  });
  const gravacao = await prisma.checkout_tentativas.updateMany({
    where: { id: tentativa.id, status: 'pendente', mp_preapproval_id: null },
    data: { status: 'aguardando', mp_preapproval_id: checkout.id },
  });
  if (!gravacao.count) {
    const atual = await prisma.checkout_tentativas.findUnique({ where: { id: tentativa.id } });
    if (!atual || atual.mp_preapproval_id !== checkout.id || !['aguardando', 'confirmado'].includes(atual.status)) {
      throw new ErroCheckout('Tentativa alterada durante o checkout; revisão manual necessária.', 409);
    }
  }
  return { url: checkout.url, tentativaId: tentativa.id };
}

async function confirmarCheckoutPorAssinatura(preapprovalId) {
  if (typeof preapprovalId !== 'string' || !/^[a-zA-Z0-9_-]{8,120}$/.test(preapprovalId)) {
    throw new ErroCheckout('Identificador de assinatura inválido.');
  }
  const tentativa = await prisma.checkout_tentativas.findUnique({
    where: { mp_preapproval_id: preapprovalId, metodo },
  });
  if (!tentativa) return { status: 'desconhecido' };
  if (tentativa.status === 'confirmado') return { status: 'confirmado' };
  if (tentativa.status !== 'aguardando') return { status: tentativa.status };

  // Nunca aceitar 'aprovado' enviado pelo front-end ou pelo webhook como comprovante.
  const assinatura = await consultarAssinatura(preapprovalId);
  if (
    String(assinatura.id) !== preapprovalId ||
    (assinatura.status !== 'authorized' && !(simulado && assinatura.status === 'canceled')) ||
    assinatura.external_reference !== tentativa.id
  ) {
    return { status: 'aguardando' };
  }

  const usuario = await prisma.usuarios.findUnique({
    where: { id: tentativa.usuario_id },
    select: { id: true, email: true },
  });
  if (!usuario || String(assinatura.payer_email || '').toLowerCase() !== usuario.email.toLowerCase()) {
    throw new ErroCheckout('Dados do pagador incompatíveis com a tentativa.', 409);
  }

  if (simulado && assinatura.status === 'canceled') {
    const status = await prisma.$transaction(async tx => {
      const recusada = await tx.checkout_tentativas.updateMany({
        where: { id: tentativa.id, metodo, status: 'aguardando' },
        data: { status: 'recusado' },
      });
      if (!recusada.count) {
        return (await tx.checkout_tentativas.findUnique({ where: { id: tentativa.id } }))?.status || 'desconhecido';
      }
      await tx.transacoes_pagamento.update({
        where: { mp_payment_id: pagamentoDemoId(tentativa.id) },
        data: { status: 'rejected', atualizado_em: new Date() },
      });
      return 'recusado';
    });
    return { status };
  }

  const pago = await obterPagamentoAprovado(preapprovalId, tentativa.tipo);
  if (!pago || typeof pago.id !== 'string' || !/^[1-9][0-9]{0,99}$/.test(pago.id) || pago.status !== 'approved' || pago.moeda !== 'BRL' || pago.valor_centavos !== Math.round(PLANOS_MP[tentativa.tipo]?.valor * 100)) return { status: 'aguardando' };

  const status = await prisma.$transaction(async tx => {
    const aquisicao = await tx.checkout_tentativas.updateMany({
      where: {
        id: tentativa.id,
        status: 'aguardando',
        mp_preapproval_id: preapprovalId,
      },
      data: { status: 'confirmado' },
    });
    if (aquisicao.count === 0) {
      const atual = await tx.checkout_tentativas.findUnique({ where: { id: tentativa.id } });
      return atual?.status || 'desconhecido';
    }

    const assinaturaExistente = await tx.planos.findFirst({
      where: {
        usuario_id: usuario.id,
        ativo: true,
        mp_preapproval_id: { not: null },
      },
      select: { id: true },
    });
    if (assinaturaExistente) {
      // Não substituir cobrança recorrente pré-existente em andamento.
      throw new ErroCheckout('Há outra assinatura recorrente ativa; atualização manual necessária.', 409);
    }

    await tx.planos.updateMany({
      where: { usuario_id: usuario.id, ativo: true },
      data: { ativo: false },
    });
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const vencimento = new Date(inicio);
    vencimento.setDate(vencimento.getDate() + 30);

    const planoCriado = await tx.planos.create({
      data: {
        usuario_id: usuario.id,
        tipo: tentativa.tipo,
        unidade_id: tentativa.unidade_id,
        ativo: true,
        inicio,
        vencimento,
        mp_preapproval_id: simulado ? null : preapprovalId,
      },
    });
    if (simulado) {
      await tx.transacoes_pagamento.update({
        where: { mp_payment_id: pagamentoDemoId(tentativa.id) },
        data: { plano_id: planoCriado.id, status: 'approved', atualizado_em: new Date() },
      });
    } else await tx.transacoes_pagamento.create({ data: {
      mp_payment_id: pago.id, mp_preapproval_id: preapprovalId,
      usuario_id: usuario.id, tentativa_id: tentativa.id, plano_id: planoCriado.id,
      valor_centavos: pago.valor_centavos, moeda: pago.moeda, status: pago.status,
      data_fatura: pago.data_fatura || null,
    } });
    return 'confirmado';
  }, { isolationLevel: 'ReadCommitted' });

  return { status };
}

// Retorna motivos operacionais sem criar cobranças nem liberar reservas incertas.
async function reconciliarCheckout(tentativaId, { dryRun = false } = {}) {
  const tentativa = await prisma.checkout_tentativas.findUnique({ where: { id: tentativaId, metodo } });
  if (!tentativa) return { status: 'desconhecido' };
  if (!['pendente', 'aguardando'].includes(tentativa.status)) return { status: tentativa.status };
  const usuario = await prisma.usuarios.findUnique({ where: { id: tentativa.usuario_id }, select: { id: true, email: true } });
  const plano = PLANOS_MP[tentativa.tipo];
  if (!usuario?.email || !plano) return { status: 'revisao_manual', motivo: 'dados_locais_invalidos' };

  let candidatos;
  if (tentativa.mp_preapproval_id) {
    candidatos = [await consultarAssinatura(tentativa.mp_preapproval_id)];
  } else {
    const resultados = await buscarAssinaturasPorPagador(usuario.email);
    candidatos = resultados.filter(item => item?.external_reference === tentativa.id);
    if (!candidatos.length) return { status: 'revisao_manual', motivo: 'assinatura_nao_encontrada' };
    if (candidatos.length !== 1) return { status: 'revisao_manual', motivo: 'multiplas_assinaturas' };
    // A busca pode omitir campos: obtenha os detalhes antes de associar.
    if (typeof candidatos[0]?.id !== 'string') return { status: 'revisao_manual', motivo: 'dados_incompativeis' };
    const idEncontrado = candidatos[0].id;
    const detalhes = await consultarAssinatura(idEncontrado);
    if (detalhes?.id !== idEncontrado) return { status: 'revisao_manual', motivo: 'dados_incompativeis' };
    candidatos = [detalhes];
  }
  const assinatura = candidatos[0];
  const id = assinatura?.id;
  const recorrencia = assinatura?.auto_recurring;
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(id) ||
      (tentativa.mp_preapproval_id && id !== tentativa.mp_preapproval_id) ||
      assinatura.external_reference !== tentativa.id ||
      typeof assinatura.payer_email !== 'string' || assinatura.payer_email.toLowerCase() !== usuario.email.toLowerCase() ||
      assinatura.reason !== 'Academia Krypton - Plano ' + plano.nome ||
      recorrencia?.frequency !== 1 || recorrencia?.frequency_type !== 'months' ||
      recorrencia?.currency_id !== 'BRL' || Number(recorrencia?.transaction_amount) !== plano.valor ||
      !['pending', 'authorized'].includes(assinatura.status)) {
    return { status: 'revisao_manual', motivo: 'dados_incompativeis' };
  }
  if (dryRun) {
    const pagamentoAprovado = assinatura.status === 'authorized'
      ? await possuiPagamentoAprovado(id, tentativa.tipo)
      : false;
    return { status: 'diagnostico', assinatura: assinatura.status, pagamento_aprovado: pagamentoAprovado, plano_ativado: false };
  }
  if (!tentativa.mp_preapproval_id) {
    const associacao = await prisma.checkout_tentativas.updateMany({
      where: { id: tentativa.id, status: 'pendente', mp_preapproval_id: null },
      data: { mp_preapproval_id: id, status: 'aguardando' },
    });
    if (!associacao.count) {
      const atual = await prisma.checkout_tentativas.findUnique({ where: { id: tentativa.id } });
      if (!atual || atual.mp_preapproval_id !== id || !['aguardando', 'confirmado'].includes(atual.status)) {
        return { status: 'revisao_manual', motivo: 'alteracao_concorrente' };
      }
    }
  } else if (tentativa.status === 'pendente') {
    const associacao = await prisma.checkout_tentativas.updateMany({
      where: { id: tentativa.id, status: 'pendente', mp_preapproval_id: id },
      data: { status: 'aguardando' },
    });
    if (!associacao.count) {
      const atual = await prisma.checkout_tentativas.findUnique({ where: { id: tentativa.id } });
      if (!atual || atual.mp_preapproval_id !== id || !['aguardando', 'confirmado'].includes(atual.status)) return { status: 'revisao_manual', motivo: 'alteracao_concorrente' };
    }
  }
  return confirmarCheckoutPorAssinatura(id);
}

async function consultarCheckout(usuarioId, tentativaId) {
  const tentativa = await prisma.checkout_tentativas.findFirst({
    where: { id: tentativaId, usuario_id: Number(usuarioId), metodo },
    select: { status: true, mp_preapproval_id: true },
  });
  if (!tentativa) throw new ErroCheckout('Checkout não encontrado.', 404);
  if (tentativa.status === 'aguardando' && tentativa.mp_preapproval_id) {
    return confirmarCheckoutPorAssinatura(tentativa.mp_preapproval_id);
  }
  return { status: tentativa.status };
}

  return { iniciarCheckout, confirmarCheckoutPorAssinatura, consultarCheckout, reconciliarCheckout };
}

export const { iniciarCheckout, confirmarCheckoutPorAssinatura, consultarCheckout, reconciliarCheckout } = criarServicoCheckout({
  prisma, criarCheckoutAssinatura, consultarAssinatura, possuiPagamentoAprovado, obterPagamentoAprovado, buscarAssinaturasPorPagador, validarConfiguracaoCheckout,
});

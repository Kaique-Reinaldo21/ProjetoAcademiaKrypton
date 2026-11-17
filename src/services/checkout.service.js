import { randomUUID } from 'node:crypto';
import prisma from '../lib/prisma.js';
import {
  PLANOS_MP,
  criarCheckoutAssinatura,
  consultarAssinatura,
  possuiPagamentoAprovado,
} from '../gatewary/mercadopago.js';

export class ErroCheckout extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

export async function iniciarCheckout(usuarioId, tipo, unidadeIdInformada) {
  if (typeof tipo !== 'string' || !PLANOS_MP[tipo]) {
    throw new ErroCheckout('Selecione um plano válido (basico, pro ou elite).');
  }

  const usuario = await prisma.usuarios.findUnique({
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
    const unidade = await prisma.unidades.findUnique({ where: { id: unidadeId }, select: { id: true } });
    if (!unidade) throw new ErroCheckout('Unidade não encontrada.', 404);
  }

  const pendente = await prisma.checkout_tentativas.findFirst({
    where: { usuario_id: usuario.id, status: { in: ['pendente', 'aguardando'] } },
  });
  if (pendente) {
    throw new ErroCheckout(
      'Já existe um checkout em andamento. Conclua-o ou solicite suporte para cancelamento.',
      409
    );
  }

  // Evita iniciar outra cobrança recorrente enquanto a assinatura anterior continua ativa.
  const recorrente = await prisma.planos.findFirst({
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

  const tentativa = await prisma.checkout_tentativas.create({
    data: {
      id: randomUUID(),
      usuario_id: usuario.id,
      tipo,
      unidade_id: unidadeId,
      status: 'pendente',
    },
  });

  try {
    const checkout = await criarCheckoutAssinatura({
      tipo,
      email: usuario.email,
      tentativaId: tentativa.id,
    });
    await prisma.checkout_tentativas.update({
      where: { id: tentativa.id },
      data: { status: 'aguardando', mp_preapproval_id: checkout.id },
    });
    return { url: checkout.url, tentativaId: tentativa.id };
  } catch (erro) {
    await prisma.checkout_tentativas.updateMany({
      where: { id: tentativa.id, status: 'pendente' },
      data: { status: 'erro' },
    });
    throw erro;
  }
}

export async function confirmarCheckoutPorAssinatura(preapprovalId) {
  if (typeof preapprovalId !== 'string' || !/^[a-zA-Z0-9_-]{8,120}$/.test(preapprovalId)) {
    throw new ErroCheckout('Identificador de assinatura inválido.');
  }
  const tentativa = await prisma.checkout_tentativas.findUnique({
    where: { mp_preapproval_id: preapprovalId },
  });
  if (!tentativa) return { status: 'desconhecido' };
  if (tentativa.status === 'confirmado') return { status: 'confirmado' };
  if (tentativa.status !== 'aguardando') return { status: tentativa.status };

  // Nunca aceitar 'aprovado' enviado pelo front-end ou pelo webhook como comprovante.
  const assinatura = await consultarAssinatura(preapprovalId);
  if (
    String(assinatura.id) !== preapprovalId ||
    assinatura.status !== 'authorized' ||
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

  const pago = await possuiPagamentoAprovado(preapprovalId, tentativa.tipo);
  if (!pago) return { status: 'aguardando' };

  const status = await prisma.$transaction(async tx => {
    const aquisicao = await tx.checkout_tentativas.updateMany({
      where: {
        id: tentativa.id,
        status: 'aguardando',
        mp_preapproval_id: preapprovalId,
      },
      data: { status: 'confirmado' },
    });
    if (aquisicao.count === 0) return 'confirmado'; // Repetição de webhook/retorno.

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

    await tx.planos.create({
      data: {
        usuario_id: usuario.id,
        tipo: tentativa.tipo,
        unidade_id: tentativa.unidade_id,
        ativo: true,
        inicio,
        vencimento,
        mp_preapproval_id: preapprovalId,
      },
    });
    return 'confirmado';
  });

  return { status };
}

export async function consultarCheckout(usuarioId, tentativaId) {
  const tentativa = await prisma.checkout_tentativas.findFirst({
    where: { id: tentativaId, usuario_id: Number(usuarioId) },
    select: { status: true, mp_preapproval_id: true },
  });
  if (!tentativa) throw new ErroCheckout('Checkout não encontrado.', 404);
  if (tentativa.status === 'aguardando' && tentativa.mp_preapproval_id) {
    return confirmarCheckoutPorAssinatura(tentativa.mp_preapproval_id);
  }
  return { status: tentativa.status };
}

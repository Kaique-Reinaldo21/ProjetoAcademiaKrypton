import prisma from '../lib/prisma.js';
import { PLANOS_MP } from '../gatewary/mercadopago.js';
import { criarAdaptadorMercadoPagoSimulado } from '../gatewary/mercadopago-simulado.js';
import { servicoDemo, validarModoDemo } from './checkout-demo.service.js';
import { criarServicoCheckout, ErroCheckout } from './checkout.service.js';

const origemPorMetodo = { qr_krypton: 'demo', mercadopago_simulado: 'demo_mercadopago' };
const respostas = { aprovar: 'aprovada', pendente: 'pendente', recusar: 'recusada' };
const statusDemo = { confirmado: 'approved', recusado: 'rejected' };
const urlTentativa = id => '/checkout-demo.html?tentativa=' + encodeURIComponent(id);
const naoEncontrado = () => new ErroCheckout('Checkout não encontrado.', 404);

const mercadoPago = criarServicoCheckout({
  prisma,
  simulado: true,
  validarConfiguracaoCheckout: validarModoDemo,
  ...criarAdaptadorMercadoPagoSimulado(prisma, validarModoDemo),
});

function resumo(tipo) {
  validarModoDemo();
  if (typeof tipo !== 'string' || !Object.hasOwn(PLANOS_MP, tipo)) throw new ErroCheckout('Selecione um plano válido.');
  const plano = PLANOS_MP[tipo];
  return { tipo, plano: plano.nome, valor_centavos: Math.round(plano.valor * 100) };
}

async function abrir(usuarioId, tipo, unidadeId) {
  resumo(tipo);
  const ativa = await prisma.checkout_tentativas.findFirst({
    where: {
      usuario_id: Number(usuarioId),
      status: { in: ['pendente', 'aguardando'] },
      metodo: { in: Object.keys(origemPorMetodo) },
    },
    select: { id: true },
  });
  if (ativa) return { url: urlTentativa(ativa.id), tentativaId: ativa.id };

  const params = new URLSearchParams({ plano: tipo });
  if (tipo === 'basico') params.set('unidade', String(unidadeId ?? ''));
  return { url: '/checkout-demo.html?' + params };
}

function iniciar(usuarioId, tipo, unidadeId, metodo = 'qr_krypton') {
  resumo(tipo);
  if (metodo === 'qr_krypton') return servicoDemo.iniciar(usuarioId, tipo, unidadeId);
  if (metodo === 'mercadopago_simulado') return mercadoPago.iniciarCheckout(usuarioId, tipo, unidadeId);
  throw new ErroCheckout('Selecione um método de pagamento válido.');
}

async function consultar(usuarioId, id) {
  validarModoDemo();
  const tentativa = await prisma.checkout_tentativas.findFirst({
    where: { id, usuario_id: Number(usuarioId), metodo: { in: Object.keys(origemPorMetodo) } },
  });
  if (!tentativa) throw naoEncontrado();
  if (tentativa.metodo === 'qr_krypton') return servicoDemo.consultar(usuarioId, id);

  const resultado = await mercadoPago.consultarCheckout(usuarioId, id);
  return {
    ...resumo(tentativa.tipo), tentativaId: id, metodo: tentativa.metodo,
    origem: origemPorMetodo[tentativa.metodo], status: statusDemo[resultado.status] || 'pending',
  };
}

async function simularResposta(usuarioId, id, acao) {
  validarModoDemo();
  if (typeof acao !== 'string' || !Object.hasOwn(respostas, acao)) throw new ErroCheckout('Resposta simulada inválida.');
  const where = { id, usuario_id: Number(usuarioId), metodo: 'mercadopago_simulado' };
  const tentativa = await prisma.checkout_tentativas.findFirst({ where, select: { id: true } });
  if (!tentativa) throw naoEncontrado();
  if (acao !== 'pendente') {
    // A primeira resposta terminal vence. Consultas posteriores repetem a confirmação de forma idempotente.
    await prisma.checkout_tentativas.updateMany({
      where: { ...where, status: 'aguardando', resposta_mp_demo: 'pendente' },
      data: { resposta_mp_demo: respostas[acao] },
    });
  }
  return consultar(usuarioId, id);
}

export const checkoutMetodos = { abrir, iniciar, resumo, consultar, simularResposta };

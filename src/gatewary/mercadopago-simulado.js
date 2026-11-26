import { PLANOS_MP } from './mercadopago.js';

const respostas = { pendente: 'pending', aprovada: 'authorized', recusada: 'canceled' };

export function criarAdaptadorMercadoPagoSimulado(db, validarModoDemo) {
  async function buscar(id) {
    validarModoDemo();
    return db.checkout_tentativas.findUnique({
      where: { mp_preapproval_id: id, metodo: 'mercadopago_simulado' },
      include: { usuarios: { select: { email: true } } },
    });
  }

  return {
    async criarCheckoutAssinatura({ tentativaId }) {
      validarModoDemo();
      return {
        id: 'sim_mp_' + tentativaId,
        url: '/checkout-demo.html?tentativa=' + encodeURIComponent(tentativaId),
      };
    },
    async consultarAssinatura(id) {
      const tentativa = await buscar(id);
      if (!tentativa) return {};
      return {
        id, status: respostas[tentativa.resposta_mp_demo],
        external_reference: tentativa.id, payer_email: tentativa.usuarios.email,
      };
    },
    async obterPagamentoAprovado(id, tipo) {
      const tentativa = await buscar(id);
      if (tentativa?.resposta_mp_demo !== 'aprovada' || tentativa.tipo !== tipo) return null;
      return {
        id: BigInt('0x' + tentativa.id.replaceAll('-', '')).toString(),
        status: 'approved', moeda: 'BRL', valor_centavos: Math.round(PLANOS_MP[tipo].valor * 100),
      };
    },
  };
}

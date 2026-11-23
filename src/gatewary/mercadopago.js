// Integração de assinaturas. Nunca ative plano pelo retorno do navegador sem consultar o provedor.
import 'dotenv/config';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';

export const PLANOS_MP = Object.freeze({
  basico: { nome: 'Básico', valor: 89.00 },
  pro: { nome: 'Pro', valor: 149.00 },
  elite: { nome: 'Elite', valor: 249.00 },
});

function cliente() {
  const token = process.env.mercado_pago_access_token;
  if (!token) throw new Error('Configure mercado_pago_access_token no arquivo .env.');
  return new PreApproval(new MercadoPagoConfig({ accessToken: token }));
}

export async function criarCheckoutAssinatura({ tipo, email, tentativaId }) {
  const plano = PLANOS_MP[tipo];
  if (!plano) throw new Error('Tipo de plano inválido.');

  const retorno = process.env.MP_BACK_URL;
  if (!retorno) throw new Error('Configure MP_BACK_URL (URL pública de /checkout/success).');
  const url = new URL(retorno);
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.hostname === 'localhost')) {
    throw new Error('MP_BACK_URL deve utilizar HTTPS em ambiente público.');
  }
  const assinatura = await cliente().create({
    body: {
      reason: 'Academia Krypton - Plano ' + plano.nome,
      payer_email: email,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: plano.valor,
        currency_id: 'BRL',
      },
      external_reference: tentativaId,
      back_url: url.toString(),
      status: 'pending',
    },
  });
  if (!assinatura?.id || !assinatura?.init_point) {
    throw new Error('O Mercado Pago não retornou o identificador e a URL do checkout.');
  }
  return { id: String(assinatura.id), url: assinatura.init_point };
}

export async function consultarAssinatura(id) {
  return cliente().get({ id: String(id) });
}

export async function consultarFatura(id) {
  return apiMercadoPago('/authorized_payments/' + encodeURIComponent(String(id)));
}

async function apiMercadoPago(caminho) {
  const token = process.env.mercado_pago_access_token;
  if (!token) throw new Error('Token do Mercado Pago ausente.');
  const resposta = await fetch('https://api.mercadopago.com' + caminho, {
    headers: { Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(12000),
  });
  if (!resposta.ok) throw new Error('Erro ao consultar faturas no Mercado Pago (HTTP ' + resposta.status + ').');
  return resposta.json();
}

export async function possuiPagamentoAprovado(id, tipo) {
  const plano = PLANOS_MP[tipo];
  if (!plano) return false;
  const dados = await apiMercadoPago(
    '/authorized_payments/search?preapproval_id=' + encodeURIComponent(String(id)) + '&limit=100'
  );
  return Array.isArray(dados.results) && dados.results.some(fatura =>
    String(fatura.preapproval_id) === String(id) &&
    fatura.payment?.status === 'approved' &&
    fatura.currency_id === 'BRL' &&
    Number(fatura.transaction_amount) === plano.valor
  );
}

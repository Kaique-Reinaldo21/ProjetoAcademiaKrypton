// Integração de assinaturas. Nunca ative plano pelo retorno do navegador sem consultar o provedor.
import 'dotenv/config';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import { emTesteMercadoPago, urlExternaMercadoPago, validarCredencialTesteMercadoPago, validarPagadorTeste } from '../config/mercadopago-teste.js';
import { ErroGatewayCheckout, classificarErroCriacao } from './erros-checkout.js';

export const PLANOS_MP = Object.freeze({
  basico: { nome: 'Básico', valor: 89.00 },
  pro: { nome: 'Pro', valor: 149.00 },
  elite: { nome: 'Elite', valor: 249.00 },
});

function bloquearGatewayNoDemo() {
  if (process.env.PAYMENT_MODE === 'demo') throw new ErroGatewayCheckout('gateway_desativado_demo', 'Mercado Pago desativado no modo demonstração.');
}

function tokenGateway() {
  bloquearGatewayNoDemo();
  if (emTesteMercadoPago()) return validarCredencialTesteMercadoPago().token;
  if (process.env.PAYMENT_MODE !== 'real' || !process.env.mercado_pago_access_token?.trim()) {
    throw new ErroGatewayCheckout('token_ausente', 'Gateway indisponível neste ambiente.');
  }
  return process.env.mercado_pago_access_token;
}

function cliente() {
  return new PreApproval(new MercadoPagoConfig({ accessToken: tokenGateway(), options: { redirect: 'error' } }));
}

export function validarConfiguracaoCheckout() {
  const falha = codigo => { throw new ErroGatewayCheckout(codigo, 'O pagamento está indisponível por uma configuração da academia. Entre em contato com o suporte.'); };
  tokenGateway();
  let url;
  try { url = new URL(process.env.MP_BACK_URL); } catch { falha('retorno_invalido'); }
  if (url.pathname !== '/checkout/success' || url.search || url.hash || url.username || url.password ||
      (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) falha('retorno_invalido');
  if (process.env.NODE_ENV !== 'production' && (url.hostname.endsWith('.onrender.com') || ['academiakripton.com.br', 'www.academiakripton.com.br'].includes(url.hostname))) falha('retorno_producao');
  return url;
}

export async function criarCheckoutAssinatura({ tipo, email, tentativaId }) {
  const plano = PLANOS_MP[tipo];
  if (!plano) throw new Error('Tipo de plano inválido.');

  const url = validarConfiguracaoCheckout();
  validarPagadorTeste(email);
  let assinatura;
  try {
    assinatura = await cliente().create({
    requestOptions: { idempotencyKey: tentativaId },
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
  } catch (erro) {
    throw classificarErroCriacao(erro);
  }
  if (typeof assinatura?.id !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(assinatura.id) || !assinatura.init_point) {
    throw new ErroGatewayCheckout('resposta_incompleta', 'O provedor não concluiu o checkout. Entre em contato com o suporte antes de tentar novamente.');
  }
  return { id: String(assinatura.id), url: urlExternaMercadoPago(assinatura.init_point) };
}

export async function consultarAssinatura(id) {
  const gateway = cliente();
  try {
    return await gateway.get({ id: String(id) });
  } catch (erro) {
    throw classificarErroCriacao(erro);
  }
}

// Busca completa por pagador; inconsistências ou limites são tratados como ambiguidade.
export async function buscarAssinaturasPorPagador(email) {
  const encontrados = [];
  let offset = 0;
  let totalAnterior;
  for (let pagina = 0; pagina < 100; pagina++) {
    const params = new URLSearchParams({ payer_email: email, limit: '100', offset: String(offset) });
    const dados = await apiMercadoPago('/preapproval/search?' + params);
    const paging = dados?.paging;
    if (!Array.isArray(dados?.results) || !Number.isSafeInteger(paging?.total) ||
        !Number.isSafeInteger(paging?.offset) || paging.offset !== offset ||
        !Number.isSafeInteger(paging?.limit) || paging.limit < 1 ||
        (totalAnterior !== undefined && paging.total !== totalAnterior) ||
        dados.results.length > paging.limit || offset + dados.results.length > paging.total) {
      throw new Error('Paginação de assinaturas incompleta ou inconsistente.');
    }
    totalAnterior = paging.total;
    encontrados.push(...dados.results);
    offset += dados.results.length;
    if (offset === paging.total) return encontrados;
    if (!dados.results.length) throw new Error('Paginação de assinaturas incompleta.');
  }
  throw new Error('Limite de páginas de assinaturas excedido.');
}

export async function consultarFatura(id) {
  return apiMercadoPago('/authorized_payments/' + encodeURIComponent(String(id)));
}

async function apiMercadoPago(caminho) {
  const token = tokenGateway();
  const resposta = await fetch('https://api.mercadopago.com' + caminho, {
    headers: { Authorization: 'Bearer ' + token },
    redirect: 'error',
    signal: AbortSignal.timeout(12000),
  });
  if (!resposta.ok) throw new Error('Erro ao consultar faturas no Mercado Pago (HTTP ' + resposta.status + ').');
  return resposta.json();
}

export async function obterPagamentoAprovado(id, tipo) {
  const plano = PLANOS_MP[tipo];
  if (!plano) return null;
  const dados = await apiMercadoPago(
    '/authorized_payments/search?preapproval_id=' + encodeURIComponent(String(id)) + '&limit=100'
  );
  if (!Array.isArray(dados.results)) return null;
  const fatura = dados.results.find(f => {
    const pagamentoId = f.payment?.id;
    return String(f.preapproval_id) === String(id) &&
      f.payment?.status === 'approved' && f.payment?.status_detail !== 'partially_refunded' &&
      ((typeof pagamentoId === 'number' && Number.isSafeInteger(pagamentoId) && pagamentoId > 0) ||
       (typeof pagamentoId === 'string' && /^[1-9][0-9]{0,99}$/.test(pagamentoId))) &&
      f.currency_id === 'BRL' && Number(f.transaction_amount) === plano.valor;
  });
  if (!fatura) return null;
  if (emTesteMercadoPago()) {
    const pagamento = await apiMercadoPago('/v1/payments/' + encodeURIComponent(String(fatura.payment.id)));
    if (pagamento.live_mode !== false || String(pagamento.id) !== String(fatura.payment.id) ||
        pagamento.status !== 'approved' || pagamento.status_detail === 'partially_refunded' ||
        pagamento.currency_id !== 'BRL' || Number(pagamento.transaction_amount) !== plano.valor) return null;
  }
  const dataFatura = fatura.date_created ? new Date(fatura.date_created) : null;
  return { id: String(fatura.payment.id), valor_centavos: Math.round(plano.valor * 100), moeda: 'BRL', status: 'approved', data_fatura: dataFatura && !Number.isNaN(dataFatura.valueOf()) ? dataFatura : null };
}

export async function possuiPagamentoAprovado(id, tipo) {
  return Boolean(await obterPagamentoAprovado(id, tipo));
}

import { ErroCheckout } from '../lib/erro-checkout.js';
import { DESTINO_DEMO_TLS_SEM_VALIDACAO, destinoAcademico } from './demo-hosts.js';

export const TLS_SEM_VALIDACAO = 'accept_invalid_certs';

export function validarModoDemo(env = process.env) {
  const negar = codigo => { const erro = new ErroCheckout('Demonstração indisponível neste ambiente.', 403); erro.codigoConfiguracao = codigo; throw erro; };
  if (env.PAYMENT_MODE !== 'demo') return negar('PAYMENT_MODE_INVALIDO');
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { return negar('DATABASE_URL_INVALIDA'); }
  if (url.protocol !== 'mysql:' || url.hash) return negar('DATABASE_URL_PROTOCOLO_OU_FRAGMENTO');
  if (env.NODE_ENV === 'development' && url.hostname === '127.0.0.1' && url.port === '3307' && url.pathname === '/academia_kripton_checkout_test' && !url.search && !env.DEMO_DEPLOYMENT && !env.RENDER_EXTERNAL_HOSTNAME) return;
  if (env.NODE_ENV !== 'production') return negar('NODE_ENV_INVALIDO');
  const destino = destinoAcademico(env.DEMO_DEPLOYMENT);
  if (!destino) return negar('DEMO_DEPLOYMENT_INVALIDO');
  if ((env.RENDER === 'true' || env.RENDER_EXTERNAL_HOSTNAME) && env.RENDER_EXTERNAL_HOSTNAME !== destino.render) {
    return negar('SERVICO_RENDER_NAO_APROVADO');
  }
  const host = url.hostname.toLowerCase();
  const permitido = (env.DEMO_DATABASE_HOST || '').toLowerCase();
  const banco = env.DEMO_DATABASE_NAME || '';
  if (!permitido || host !== permitido || host === 'localhost' || host === '127.0.0.1' || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host) || !host.includes('.')) return negar('HOST_INVALIDO');
  if (!/^[A-Za-z0-9_]{1,64}$/.test(banco) || url.pathname !== '/' + banco) return negar('SCHEMA_INVALIDO');
  if (destino.host !== host || destino.banco !== banco || destino.porta !== url.port) return negar('DESTINO_OU_PORTA_NAO_APROVADO');
  const params = url.searchParams;
  if ([...params.keys()].some(p => !['sslcert', 'sslaccept'].includes(p))) return negar('PARAMETRO_NAO_PERMITIDO');
  if (params.getAll('sslcert').length > 1 || (params.has('sslcert') && !params.get('sslcert'))) return negar('SSLCERT_VAZIO_OU_DUPLICADO');
  if (params.getAll('sslaccept').length !== 1) return negar('SSLACCEPT_INVALIDO');
  const sslaccept = params.get('sslaccept');
  if (sslaccept === 'strict') return;
  if (sslaccept !== TLS_SEM_VALIDACAO || destino !== DESTINO_DEMO_TLS_SEM_VALIDACAO ||
      env.DEMO_ALLOW_UNVERIFIED_TLS !== 'I_UNDERSTAND_TEST_ONLY') {
    return negar('SSLACCEPT_INVALIDO');
  }
  return sslaccept;
}

// Os parâmetros ficam restritos ao datasource interno. A URL recebida passa pela política TLS original.
export function datasourcePoolDemo(env = process.env) {
  if (env.DEMO_PRISMA_POOL !== 'serial' || env.NODE_ENV !== 'production' || env.PAYMENT_MODE !== 'demo') return;
  validarModoDemo(env);
  const url = new URL(env.DATABASE_URL);
  url.searchParams.set('connection_limit', '1');
  url.searchParams.set('pool_timeout', '30');
  return url.href;
}

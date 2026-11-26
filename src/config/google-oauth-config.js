import { isIP } from 'node:net';

// Não retorna nem registra credenciais; chamado apenas quando OAuth está habilitado.
export function obterCallbackGoogle(env = process.env) {
  const ambiente = env.NODE_ENV;
  const configurada = env.GOOGLE_CALLBACK_URL;
  if (!configurada && ambiente === 'development') return 'http://localhost:3000/api/auth/google/callback';
  let url;
  try { url = new URL(configurada); } catch { throw new Error('GOOGLE_CALLBACK_URL deve ser uma URL válida para o retorno Google OAuth.'); }
  const caminhos = ['/api/auth/google/callback', '/api/auth/callback/google', '/auth/google/callback', '/auth/callback/google'];
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!caminhos.includes(url.pathname) || url.username || url.password || url.search || url.hash) {
    throw new Error('GOOGLE_CALLBACK_URL deve apontar para uma rota válida de retorno Google OAuth, sem credenciais ou parâmetros.');
  }
  if (ambiente !== 'development' && (url.protocol !== 'https:' || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.') || isIP(host))) {
    throw new Error('GOOGLE_CALLBACK_URL deve usar HTTPS e um domínio público fora do ambiente de desenvolvimento.');
  }
  if (ambiente === 'development' && url.protocol !== 'https:' &&
      (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '::1'].includes(host))) {
    throw new Error('GOOGLE_CALLBACK_URL deve usar HTTPS ou HTTP em loopback no desenvolvimento.');
  }
  return url.toString();
}

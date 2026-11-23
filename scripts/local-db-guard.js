// Guarda central para impedir que utilitarios locais alterem o Clever Cloud/Render.
import 'dotenv/config';

export function validarBancoLocal() {
  const env = (process.env.NODE_ENV || '').trim().toLowerCase();
  if (env === 'production') throw new Error('Bloqueado: NODE_ENV=production.');

  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL nao configurada no .env.');

  let url;
  try { url = new URL(raw); }
  catch { throw new Error('DATABASE_URL invalida. Confira o .env.'); }

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const hostsLocais = new Set(['localhost', '127.0.0.1', '::1']);
  if (url.protocol !== 'mysql:' || !hostsLocais.has(host)) {
    throw new Error('Operacao local bloqueada: DATABASE_URL deve usar mysql:// com host localhost, 127.0.0.1 ou ::1. Nunca rode o setup no Clever Cloud.');
  }
  if (!url.pathname || url.pathname === '/') {
    throw new Error('DATABASE_URL precisa indicar o nome do banco MySQL.');
  }
  return { host, banco: decodeURIComponent(url.pathname.slice(1)) };
}

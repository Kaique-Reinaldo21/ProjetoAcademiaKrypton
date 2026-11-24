export function validarDestinoAdministrativo(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('DATABASE_URL deve ser informada explicitamente no ambiente.'); }
  if (url.protocol !== 'mysql:' || !['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname || url.pathname === '/' || url.search || url.hash) {
    throw new Error('Comando bloqueado: DATABASE_URL deve apontar para MySQL local, sem parâmetros.');
  }
  return raw;
}

export function validarUrlTeste(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('DATABASE_URL de teste ausente ou inválida.'); }
  if (url.protocol !== 'mysql:' || !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.pathname !== '/academia_kripton_checkout_test' || url.search || url.hash) {
    throw new Error('Bloqueado: use mysql:// em localhost ou 127.0.0.1 e banco academia_kripton_checkout_test, sem parâmetros.');
  }
  return raw;
}

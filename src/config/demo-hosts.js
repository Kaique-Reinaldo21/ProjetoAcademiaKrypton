// Destinos públicos autorizados. Credenciais ficam no ambiente de cada serviço.
export const DESTINO_DEMO_TLS_SEM_VALIDACAO = Object.freeze({
  host: 'booqcxfmlvclpjzw2uce-mysql.services.clever-cloud.com',
  banco: 'booqcxfmlvclpjzw2uce',
  porta: '3306',
  render: 'projetoacademiakrypton-1.onrender.com',
});

export const DESTINO_ACADEMICO_OFICIAL = Object.freeze({
  host: '147.224.191.149',
  banco: 'krypton_oficial',
  porta: '3306',
  render: 'projetoacademiakrypton.onrender.com',
});

export function destinoAcademico(perfil) {
  if (perfil === 'academico_isolado') return DESTINO_DEMO_TLS_SEM_VALIDACAO;
  if (perfil === 'academico_oficial') return DESTINO_ACADEMICO_OFICIAL;
}

export function exigeModoOficial(env) {
  if (env.DEMO_DEPLOYMENT === 'academico_oficial' ||
      env.RENDER_EXTERNAL_HOSTNAME === DESTINO_ACADEMICO_OFICIAL.render) return true;
  return URL.canParse(env.DATABASE_URL) &&
    new URL(env.DATABASE_URL).hostname === DESTINO_ACADEMICO_OFICIAL.host;
}

export function exigeModoAcademico(env) {
  return Boolean(env.DEMO_DEPLOYMENT) || [
    DESTINO_DEMO_TLS_SEM_VALIDACAO, DESTINO_ACADEMICO_OFICIAL,
  ].some(destino => destino.render === env.RENDER_EXTERNAL_HOSTNAME);
}

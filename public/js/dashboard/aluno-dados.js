export class ErroApi extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}

export async function api(caminho, opcoes = {}) {
  const token = localStorage.getItem('token');
  const headers = new Headers(opcoes.headers);
  if (token) headers.set('Authorization', 'Bearer ' + token);
  const r = await fetch(caminho, {
    ...opcoes, headers, mode: 'same-origin', credentials: 'same-origin',
    redirect: 'error', cache: 'no-store', referrerPolicy: 'same-origin',
  });
  if (!r.ok) {
    if (r.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      location.replace('/login.html');
    }
    const json = await r.json().catch(() => ({}));
    throw new ErroApi(json.erro || 'Tente novamente em instantes.', r.status);
  }
  if (r.status === 204) return null;
  if (r.headers.get('Content-Type')?.startsWith('image/png')) return r.blob();
  return r.json();
}

export function enviar(caminho, dados, method = 'POST') {
  return api(caminho, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
}

export function criarDadosAluno() {
  const cache = new Map();
  const fontes = {
    perfil: async () => (await api('/api/usuario/perfil')).usuario,
    plano: async () => {
      try { return (await api('/api/usuario/plano')).plano; }
      catch (falha) {
        if (falha.status === 404) return null;
        throw falha;
      }
    },
    unidades: async () => (await api('/api/usuario/unidades')).unidades,
    agenda: async () => (await api('/api/usuario/agendamentos')).agendamentos,
    historico: () => api('/api/checkout/demo/historico'),
  };

  return {
    ler(chave) {
      if (!cache.has(chave)) {
        cache.set(chave, fontes[chave]().catch(falha => { cache.delete(chave); throw falha; }));
      }
      return cache.get(chave);
    },
    invalidar(...chaves) { chaves.forEach(chave => cache.delete(chave)); },
  };
}

const formatoDia = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' });
const formatoHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const dia = data => data ? formatoDia.format(new Date(data)) : '—';
export const quando = data => formatoHora.format(new Date(data));
export const reais = centavos => formatoMoeda.format(centavos / 100);
export const profissional = tipo => tipo === 'personal' ? 'Personal trainer' : 'Nutricionista';
export const eliteAtivo = plano => plano?.tipo === 'elite' && plano.status === 'ativo' && plano.mostra_agendamento;

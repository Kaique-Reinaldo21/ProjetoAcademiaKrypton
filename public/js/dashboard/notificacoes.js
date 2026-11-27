import { api } from './aluno-dados.js';
import { elemento, icone } from './design-system.js';

export function montarNotificacoes() {
  const cabecalho = document.querySelector('.kd-header');
  if (!cabecalho) return;
  const url = '/api/profissionais/notificacoes';
  const sino = elemento('button', null, 'kd-button');
  const total = elemento('span');
  sino.type = 'button';
  sino.setAttribute('aria-label', 'Notificações');
  sino.append(icone('bell'), total);
  const janela = elemento('dialog', null, 'kd-card w-100');
  janela.style.maxWidth = '34rem';
  janela.setAttribute('aria-label', 'Notificações');
  const lista = elemento('div');
  function botao(rotulo, acao) {
    const b = elemento('button', rotulo, 'kd-button');
    b.type = 'button';
    b.addEventListener('click', acao);
    return b;
  }
  async function carregar() {
    try {
      const { itens, nao_lidas } = await api(url);
      total.textContent = nao_lidas ? String(nao_lidas) : '';
      if (!janela.open) return;
      lista.replaceChildren();
      if (!itens.length) lista.append(elemento('p', 'Nenhuma notificação.'));
      for (const item of itens) {
        const grupo = elemento('article', null, 'kd-card mb-2');
        grupo.append(elemento('h3', item.titulo), elemento('p', item.mensagem),
          elemento('small', new Date(item.criado_em).toLocaleString('pt-BR')));
        const link = elemento('a', 'Abrir no painel', 'kd-button');
        if (/^\/(?:dashboard|profissional|admin)\.html(?:#[a-z-]+)?$/.test(item.destino)) {
          link.href = item.destino;
          link.addEventListener('click', () => janela.close());
          grupo.append(link);
        }
        if (!item.lida_em) grupo.append(botao('Marcar como lida', () => marcar('/' + item.id)));
        lista.append(grupo);
      }
    } catch {
      if (janela.open) lista.replaceChildren(elemento('p', 'Não foi possível consultar as notificações.'));
    }
  }
  async function marcar(sufixo) {
    try { await api(url + sufixo, { method: 'PATCH' }); await carregar(); }
    catch { lista.prepend(elemento('p', 'Não foi possível marcar a notificação.')); }
  }
  janela.append(elemento('h2', 'Notificações'), botao('Fechar', () => janela.close()),
    botao('Marcar todas como lidas', () => marcar('/lidas')), lista);
  sino.addEventListener('click', () => { janela.showModal(); carregar(); });
  cabecalho.append(sino);
  document.body.append(janela);
  carregar();
  window.addEventListener('focus', carregar);
}

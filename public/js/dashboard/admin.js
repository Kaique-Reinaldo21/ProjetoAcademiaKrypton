import { api } from './aluno-dados.js';
import { configurarMenu, erro, estado } from './design-system.js';
import { abas } from './admin-views.js';

const conteudo = document.getElementById('conteudo');
const menu = document.getElementById('menu');
const fecharMenu = configurarMenu(document.getElementById('abrir-menu'), menu, document.getElementById('fundo-menu'), document.querySelector('.kd-workspace'));
let conta, aba;
let descartar = () => {};

function renderizar(navegando = false) {
  if (!conta) return;
  const hash = location.hash.slice(1);
  if (hash === 'conteudo' && aba) return;
  const destino = Object.hasOwn(abas, hash) ? hash : 'visao-geral';
  const [titulo, exibir] = abas[destino];
  descartar();
  document.title = titulo + ' | Administração Krypton';
  document.getElementById('secao-atual').textContent = titulo;
  for (const link of menu.querySelectorAll('nav a')) {
    if (link.hash === '#' + destino) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  conteudo.replaceChildren();
  descartar = exibir(conteudo, conta) || (() => {});
  conteudo.setAttribute('aria-busy', 'false');
  aba = destino;
  if (navegando) {
    window.scrollTo(0, 0);
    conteudo.focus({ preventScroll: true });
  }
}

async function sair(botao) {
  botao.disabled = true;
  try {
    await api('/api/auth/logout', { method: 'POST' });
    for (const chave of ['token', 'usuario', 'checkout_tentativa_id']) localStorage.removeItem(chave);
    location.replace('/login.html');
  } catch {
    botao.disabled = false;
    document.getElementById('falha-sair')?.remove();
    const aviso = estado('Não foi possível encerrar a sessão. Tente novamente.', null, 'erro');
    aviso.id = 'falha-sair';
    conteudo.prepend(aviso);
  }
}

document.addEventListener('click', evento => {
  const botao = evento.target.closest('[data-sair]');
  if (botao) sair(botao);
  const link = evento.target.closest('.kd-nav a, .kd-marca');
  if (link) {
    fecharMenu();
    if (link.hash === location.hash) conteudo.focus();
  }
});
window.addEventListener('hashchange', () => renderizar(true));

async function iniciar() {
  conteudo.replaceChildren(estado('Carregando painel…'));
  try {
    const { usuario } = await api('/api/auth/me');
    if (usuario.role === 'aluno') return location.replace('/dashboard.html');
    if (usuario.role !== 'admin') {
      conteudo.setAttribute('aria-busy', 'false');
      conteudo.replaceChildren(estado('Acesso restrito à administração.'));
      return;
    }
    conta = usuario;
    document.getElementById('nome-cabecalho').textContent = conta.nome;
    document.getElementById('avatar-admin').textContent = conta.nome.trim().split(/\s+/).slice(0, 2)
      .map(parte => [...parte][0]?.toUpperCase()).join('');
    renderizar();
  } catch {
    conteudo.setAttribute('aria-busy', 'false');
    erro(conteudo, 'Não foi possível abrir o painel.', iniciar);
  }
}
iniciar();

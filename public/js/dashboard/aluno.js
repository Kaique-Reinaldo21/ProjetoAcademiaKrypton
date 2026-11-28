import { montarNotificacoes } from './notificacoes.js';
import { api, criarDadosAluno } from './aluno-dados.js';
import { configurarMenu, elemento, erro, estado, icone } from './design-system.js';
import { agendamentos, configuracoes, documentos, faturas, inicio, modulo } from './aluno-views.js';

const conteudo = document.getElementById('conteudo');
const menu = document.getElementById('menu');
const fecharMenu = configurarMenu(document.getElementById('abrir-menu'), menu, document.getElementById('fundo-menu'), document.querySelector('.kd-workspace'));
const abas = {
  inicio: ['Início', inicio],
  treinos: ['Treinos', modulo],
  'treinos-extras': ['Treinos extras', modulo],
  progresso: ['Meu progresso', modulo],
  nutricao: ['Nutrição', modulo],
  agendamentos: ['Agendamentos', agendamentos],
  faturas: ['Faturas', faturas],
  arquivos: ['Documentos', documentos],
  configuracoes: ['Configurações', configuracoes],
};

let abaAtual = '';
const contexto = {
  dados: criarDadosAluno(),
  foto: null,
  pagamento: null,
  verificando: false,
  definirFoto,
  carregarFoto,
  atualizarIdentidade,
  verificarPagamento,
};

function atualizarIdentidade() {
  const nome = contexto.usuario.nome || 'Aluno';
  document.getElementById('nome-cabecalho').textContent = nome;
  const remover = document.querySelector('[data-remover-foto]');
  if (remover) remover.disabled = !contexto.foto;
  const iniciais = nome.trim().split(/\s+/).slice(0, 2).map(parte => [...parte][0]?.toUpperCase()).join('');
  document.querySelectorAll('[data-avatar]').forEach(avatar => {
    if (contexto.foto) {
      const imagem = elemento('img');
      imagem.alt = '';
      imagem.src = contexto.foto;
      avatar.replaceChildren(imagem);
    } else {
      avatar.replaceChildren(iniciais ? document.createTextNode(iniciais) : icone('person'));
    }
  });
}

function definirFoto(blob) {
  if (contexto.foto) URL.revokeObjectURL(contexto.foto);
  contexto.foto = blob ? URL.createObjectURL(blob) : null;
  atualizarIdentidade();
}

async function carregarFoto() {
  try { definirFoto(await api('/api/usuario/perfil/foto')); }
  catch (falha) {
    if (falha.status === 404) definirFoto(null);
    else throw falha;
  }
}

function renderizar(navegacao = false) {
  if (!contexto.usuario) return;
  let chave = location.hash.slice(1).split('/')[0];
  if (chave === 'conteudo' && abaAtual) return;
  if (!Object.hasOwn(abas, chave)) chave = 'inicio';

  const [nome, render] = abas[chave];
  document.title = nome + ' | Academia Krypton';
  document.getElementById('secao-atual').textContent = nome;
  for (const link of menu.querySelectorAll('nav a')) {
    if (link.hash === '#' + chave) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const aba = elemento('div');
  aba.dataset.aba = chave;
  conteudo.replaceChildren(aba);
  render(aba, contexto, chave, nome);
  atualizarIdentidade();
  conteudo.setAttribute('aria-busy', 'false');
  if (navegacao && abaAtual !== chave) {
    window.scrollTo(0, 0);
    conteudo.focus({ preventScroll: true });
  }
  abaAtual = chave;
}

async function verificarPagamento() {
  const id = localStorage.getItem('checkout_tentativa_id');
  if (!id || contexto.verificando) return;
  contexto.verificando = true;
  contexto.pagamento = { mensagem: 'Verificando pagamento…' };
  if (abaAtual === 'faturas') renderizar();

  try {
    const dados = await api('/api/checkout/status/' + encodeURIComponent(id));
    const demo = ['demo', 'demo_mercadopago'].includes(dados.origem);
    if (dados.status === 'confirmado') {
      localStorage.removeItem('checkout_tentativa_id');
      contexto.pagamento = {
        mensagem: demo ? 'Simulação aprovada. Confira seu plano em Faturas.' : 'Pagamento confirmado. Confira seu plano em Faturas.',
        tom: 'positivo',
      };
      contexto.dados.invalidar('plano', 'historico');
    } else if (dados.status === 'recusado') {
      localStorage.removeItem('checkout_tentativa_id');
      contexto.pagamento = { mensagem: demo ? 'Simulação recusada. Seu plano não foi alterado.' : 'Pagamento recusado. Seu plano não foi alterado.', tom: 'erro' };
      contexto.dados.invalidar('historico');
    } else {
      contexto.pagamento = {
        mensagem: demo ? 'Simulação pendente. Retome o checkout para concluir.' : 'Pagamento pendente. Seu plano permanece igual até a confirmação.',
        tom: 'atencao',
        ...(demo && { url: '/checkout-demo.html?tentativa=' + encodeURIComponent(id) }),
      };
    }
  } catch (falha) {
    if (falha.status === 404) localStorage.removeItem('checkout_tentativa_id');
    contexto.pagamento = { mensagem: falha.status === 404 ? 'Esta tentativa não está mais disponível.' : 'Não foi possível verificar o pagamento. Tente novamente em Faturas.', tom: 'erro' };
  } finally {
    contexto.verificando = false;
    if (['inicio', 'faturas'].includes(abaAtual)) renderizar();
  }
}

async function encerrar(botao) {
  botao.disabled = true;
  try {
    await api('/api/auth/logout', { method: 'POST' });
    for (const chave of ['token', 'usuario', 'checkout_tentativa_id']) localStorage.removeItem(chave);
    location.replace('/login.html');
  } catch {
    const existente = document.getElementById('falha-logout');
    if (!existente) {
      const aviso = estado('Sessão ativa.', 'Não foi possível sair. Tente novamente.', 'erro');
      aviso.id = 'falha-logout';
      conteudo.prepend(aviso);
    }
    botao.disabled = false;
  }
}

document.addEventListener('click', evento => {
  const foto = evento.target.closest('a[href="#configuracoes/foto"]');
  if (foto && location.hash === foto.hash && !evento.defaultPrevented &&
      !evento.ctrlKey && !evento.metaKey && !evento.shiftKey && !evento.altKey) {
    evento.preventDefault();
    conteudo.querySelector('[data-foto]')?.click();
  }
  const sair = evento.target.closest('[data-sair]');
  if (sair) encerrar(sair);
  const link = evento.target.closest('.kd-nav a, .kd-marca');
  if (link) {
    fecharMenu();
    if (link.hash === location.hash) conteudo.focus();
  }
});
window.addEventListener('hashchange', () => renderizar(true));
window.addEventListener('pagehide', evento => {
  if (!evento.persisted && contexto.foto) URL.revokeObjectURL(contexto.foto);
});

async function iniciar() {
  conteudo.replaceChildren(estado('Carregando painel…'));
  try {
    const { usuario } = await api('/api/auth/me');
    if (usuario.role === 'admin') return location.replace('/admin.html');
    if (['recepcao', 'personal', 'nutricionista'].includes(usuario.role)) return location.replace('/profissional.html');
    if (usuario.role !== 'aluno') {
      conteudo.setAttribute('aria-busy', 'false');
      conteudo.replaceChildren(estado('Área restrita a alunos.'));
      return;
    }
    contexto.usuario = usuario;
    montarNotificacoes();
    renderizar();
    verificarPagamento();
    contexto.dados.ler('perfil').then(perfil => {
      if (perfil.possui_foto) return carregarFoto();
    }).catch(() => { /* As iniciais permanecem disponíveis quando a foto falha. */ });
  } catch (falha) {
    conteudo.setAttribute('aria-busy', 'false');
    erro(conteudo, falha.message, iniciar);
  }
}

iniciar();

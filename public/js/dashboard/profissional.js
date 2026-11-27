import { api } from './aluno-dados.js';
import { configurarMenu, elemento } from './design-system.js';
import { montarNotificacoes } from './notificacoes.js';
import { acao, agendaPainel, bloco, campo, dataLocal, editor, fichaPublicada, formulario, escolha, ler, papeis, salvar } from './profissionais-views.js';

const raiz = document.getElementById('conteudo');
const menu = document.getElementById('menu');
const fecharMenu = configurarMenu(document.getElementById('abrir-menu'), menu, document.getElementById('fundo-menu'), document.querySelector('.kd-workspace'));
let usuario, versao = 0;

async function recepcao(area) {
  const { hoje, consultas, ultimos } = await ler('/recepcao');
  const resumo = elemento('div', null, 'kd-grid kd-grid-dois');
  resumo.append(bloco('Atendimentos hoje', elemento('p', String(hoje))), bloco('Próximas consultas', elemento('p', String(consultas))));
  const lista = elemento('div');
  const unidades = await ler('/unidades');
  function mostrar(alunos) {
    lista.replaceChildren();
    for (const a of alunos) {
      const p = a.planos[0];
      const vencimento = p?.vencimento && new Date(p.vencimento).toISOString().slice(0, 10);
      const situacao = p?.ativo && (!vencimento || vencimento >= new Date().toISOString().slice(0, 10)) ? 'ativo' : 'inativo';
      const info = p ? [p.tipo, situacao, vencimento && 'vence em ' + vencimento.split('-').reverse().join('/'),
        unidades.find(u => u.id === p.unidade_id)?.nome].filter(Boolean).join(' · ') : 'Sem plano';
      lista.append(elemento('p', a.nome + ' · ID ' + a.id + ' · ' + info));
    }
    if (!alunos.length) lista.append(elemento('p', 'Nenhum aluno encontrado.'));
  }
  mostrar(await ler('/alunos'));
  area.append(resumo, bloco('Localizar aluno', formulario([campo('busca', 'Nome do aluno', 'search', '', true)], 'Buscar',
    async d => mostrar(await ler('/alunos?busca=' + encodeURIComponent(d.busca)))), lista),
  bloco('Registrar atendimento', formulario([campo('aluno_id', 'ID do aluno', 'number'),
    escolha('unidade_id', 'Unidade', unidades.map(u => [u.id, u.nome]), '', true), campo('motivo', 'Motivo do atendimento')],
  'Registrar', async d => { await salvar('/recepcao', d); await renderizar(); })),
  bloco('Últimos atendimentos', ...ultimos.map(i => elemento('p', [i.aluno.nome, i.unidade?.nome, i.motivo, dataLocal(i.criado_em)].filter(Boolean).join(' · ')))));
}

async function especialista(area) {
  const alunos = (await ler('/meus-alunos')).map(v => v.aluno);
  const fichas = await ler('/fichas');
  area.append(bloco('Alunos vinculados', elemento('p', alunos.length ? alunos.map(a => a.nome).join(' · ') : 'Nenhum aluno vinculado.')));
  if (!alunos.length) return;
  const edicao = bloco(usuario.role === 'personal' ? 'Ficha de treino' : 'Plano alimentar');
  function editar(ficha) {
    edicao.replaceChildren(elemento('h2', ficha ? 'Editar material' : 'Publicar material'), editor(alunos, usuario.role, ficha, renderizar));
  }
  editar();
  area.append(edicao);
  for (const ficha of fichas) {
    const conteudo = fichaPublicada(ficha);
    conteudo.append(elemento('p', alunos.find(a => a.id === ficha.aluno_id)?.nome), acao('Editar', () => { editar(ficha); edicao.scrollIntoView(); }));
    area.append(conteudo);
  }
}

async function renderizar() {
  const atual = ++versao;
  const area = elemento('div');
  raiz.setAttribute('aria-busy', 'true');
  raiz.replaceChildren(elemento('p', 'Carregando painel…'));
  try {
    if (location.hash === '#agenda') await agendaPainel(area, usuario, renderizar, usuario.role === 'recepcao');
    else if (usuario.role === 'recepcao') await recepcao(area);
    else await especialista(area);
    if (versao === atual) raiz.replaceChildren(area);
  } catch (e) {
    if (versao === atual) raiz.replaceChildren(elemento('p', e.message), acao('Tentar novamente', renderizar));
  } finally { if (versao === atual) raiz.setAttribute('aria-busy', 'false'); }
}

document.getElementById('sair').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); }
  finally {
    for (const chave of ['token', 'usuario', 'checkout_tentativa_id']) localStorage.removeItem(chave);
    location.replace('/login.html');
  }
});
window.addEventListener('hashchange', () => { fecharMenu(); renderizar(); });
try {
  ({ usuario } = await api('/api/auth/me'));
  if (!Object.hasOwn(papeis, usuario.role)) location.replace(usuario.role === 'admin' ? '/admin.html' : '/dashboard.html');
  else {
    document.getElementById('perfil').textContent = papeis[usuario.role] + ' · ' + usuario.nome;
    montarNotificacoes();
    renderizar();
  }
} catch { raiz.replaceChildren(elemento('p', 'Não foi possível abrir a sessão.')); }

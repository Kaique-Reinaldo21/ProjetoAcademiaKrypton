import { api } from './aluno-dados.js';
import { configurarMenu, elemento } from './design-system.js';
import { montarNotificacoes } from './notificacoes.js';
import { criarIdentidadePainel, montarEditorPerfil } from './perfil-pessoal.js';
import { acao, agendaPainel, bloco, campo, dataLocal, editor, fichaPublicada, formulario, escolha, ler, papeis, salvar } from './profissionais-views.js';

const raiz = document.getElementById('conteudo');
const menu = document.getElementById('menu');
const fecharMenu = configurarMenu(document.getElementById('abrir-menu'), menu, document.getElementById('fundo-menu'), document.querySelector('.kd-workspace'));
const rotulos = { ...papeis, admin: 'Administrador', aluno: 'Aluno' };
const paginas = {
  personal: [
    ['visao-geral', 'Visão geral', 'speedometer2'], ['alunos', 'Meus alunos', 'people'],
    ['agenda', 'Minha agenda', 'calendar3'], ['fichas', 'Fichas de treino', 'clipboard2-pulse'], ['documentos', 'Documentos', 'file-earmark-pdf'],
    ['notificacoes', 'Notificações', 'bell'], ['minha-conta', 'Minha conta', 'person-circle'],
  ],
  nutricionista: [
    ['visao-geral', 'Visão geral', 'speedometer2'], ['alunos', 'Meus alunos', 'people'],
    ['agenda', 'Minha agenda', 'calendar3'], ['fichas', 'Planos alimentares', 'journal-medical'], ['documentos', 'Documentos', 'file-earmark-pdf'],
    ['notificacoes', 'Notificações', 'bell'], ['minha-conta', 'Minha conta', 'person-circle'],
  ],
  recepcao: [
    ['visao-geral', 'Visão geral', 'speedometer2'], ['alunos', 'Alunos', 'people'],
    ['novo-aluno', 'Novo aluno', 'person-plus'], ['planos', 'Planos e matrículas', 'card-checklist'],
    ['agenda', 'Agendamentos', 'calendar3'], ['atendimentos', 'Atendimentos', 'clipboard-check'],
    ['unidades', 'Unidades', 'geo-alt'], ['notificacoes', 'Notificações', 'bell'], ['minha-conta', 'Minha conta', 'person-circle'],
  ],
};

let usuario, versao = 0, identidade;
const hojeISO = () => new Date().toLocaleDateString('en-CA');
const rotaAluno = busca => '/alunos' + (busca ? '?' + new URLSearchParams(busca) : '');

function titulo(area, titulo, subtitulo) {
  const topo = elemento('header', null, 'kd-pagina-topo');
  topo.append(elemento('h1', titulo), elemento('p', subtitulo, 'kd-texto-suave'));
  area.append(topo);
}

function indicador(tituloTexto, valor, detalhe) {
  const card = bloco(tituloTexto, elemento('p', String(valor), 'kd-display kd-indicador-valor'));
  if (detalhe) card.append(elemento('p', detalhe, 'kd-texto-suave'));
  return card;
}

function atalho(rotulo, hash, icone) {
  const link = elemento('a', null, 'kd-button kd-button-atalho');
  link.href = '#' + hash;
  link.append(elemento('i', null, 'bi bi-' + icone), document.createTextNode(rotulo));
  return link;
}

function statusPlano(planos = [], unidades = []) {
  const plano = planos[0];
  if (!plano) return 'Sem plano';
  const vencimento = plano.vencimento ? new Date(plano.vencimento).toLocaleDateString('pt-BR') : 'sem vencimento definido';
  const ativo = plano.ativo && (!plano.vencimento || plano.vencimento.slice(0, 10) >= hojeISO());
  const unidade = unidades.find(item => item.id === plano.unidade_id)?.nome;
  return [plano.tipo, ativo ? 'Ativo' : 'Inativo/vencido', 'vence em ' + vencimento, unidade].filter(Boolean).join(' · ');
}

function listaVazia(texto) { return elemento('p', texto, 'kd-estado'); }

function renderAlunos(destino, alunos, unidades = [], editarLista) {
  destino.replaceChildren();
  if (!alunos.length) return destino.append(listaVazia('Nenhum aluno encontrado.'));
  for (const a of alunos) {
    const item = bloco(a.nome, elemento('p', 'Cadastro ' + a.id + ' · ' + statusPlano(a.planos, unidades)));
    if (editarLista) item.append(editarLista(a));
    destino.append(item);
  }
}

async function carregarAlunos() { return ler(rotaAluno()); }

async function alunosVinculados(area, ficha = false) {
  const resultado = await ler('/meus-alunos');
  const alunos = resultado.map(v => v.aluno);
  const lista = bloco('Alunos vinculados');
  if (alunos.length) lista.append(...alunos.map(aluno => elemento('p', aluno.nome)));
  else lista.append(listaVazia('Ainda não há alunos vinculados.'));
  area.append(lista);
  if (ficha) await fichasProfissionais(area, alunos);
}

async function fichasProfissionais(area, alunos) {
  const tipo = usuario.role;
  const registro = bloco(tipo === 'personal' ? 'Fichas de treino' : 'Planos alimentares');
  const editorFicha = bloco('Publicar material profissional');
  const lista = bloco('Materiais publicados');
  if (alunos.length) editorFicha.append(editor(alunos, tipo, null, renderizar));
  else editorFicha.append(listaVazia('Vincule alunos antes de publicar materiais.'));
  registro.append(editorFicha, lista);
  area.append(registro);
  const fichas = await ler('/fichas');
  if (!fichas.length) return lista.append(listaVazia('Nenhum material publicado.'));
  for (const ficha of fichas) {
    const conteudo = fichaPublicada(ficha);
    const aluno = alunos.find(item => item.id === ficha.aluno_id);
    if (aluno) conteudo.prepend(elemento('p', 'Aluno: ' + aluno.nome, 'kd-texto-suave'));
    conteudo.append(acao('Editar', () => {
      editorFicha.replaceChildren(elemento('h2', 'Editar material'), editor(alunos, tipo, ficha, renderizar));
      editorFicha.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    lista.append(conteudo);
  }
}

async function visaoEspecialista(area) {
  titulo(area, 'Visão geral', 'Resumo atualizado do seu trabalho e dos atendimentos.');
  const [vinculos, agenda, fichas] = await Promise.all([ler('/meus-alunos'), ler('/agenda'), ler('/fichas')]);
  const alunos = vinculos.map(item => item.aluno);
  const hoje = hojeISO();
  const consultasHoje = agenda.filter(item => new Date(item.data_hora).toLocaleDateString('en-CA') === hoje && !['cancelado', 'concluido'].includes(item.situacao));
  const proximas = agenda.filter(item => new Date(item.data_hora) >= new Date() && !['cancelado', 'concluido'].includes(item.situacao))
    .sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora)).slice(0, 5);
  area.append(elemento('p', `Olá, ${usuario.nome}. Aqui está seu resumo de hoje.`, 'kd-sauda'));
  const indicadores = elemento('div', null, 'kd-grid kd-grid-indicadores');
  indicadores.append(indicador('Alunos vinculados', alunos.length), indicador('Consultas de hoje', consultasHoje.length),
    indicador('Materiais publicados', fichas.length, usuario.role === 'personal' ? 'Fichas de treino' : 'Planos alimentares'));
  area.append(indicadores, bloco('Atalhos', atalho('Ver meus alunos', 'alunos', 'people'), atalho('Abrir agenda', 'agenda', 'calendar3'),
    atalho(usuario.role === 'personal' ? 'Gerenciar fichas' : 'Gerenciar planos alimentares', 'fichas', 'journal-medical')));
  const lista = bloco('Próximos atendimentos');
  if (!proximas.length) lista.append(listaVazia('Nenhum atendimento agendado.'));
  else for (const item of proximas) lista.append(elemento('p', [item.usuarios?.nome || 'Aluno', dataLocal(item.data_hora), item.situacao, item.unidade?.nome].filter(Boolean).join(' · ')));
  area.append(lista);
}

async function paginaAlunos(area) {
  titulo(area, usuario.role === 'recepcao' ? 'Alunos' : 'Meus alunos', 'Consulte somente as informações necessárias ao seu papel.');
  const resultado = bloco('Pesquisar alunos');
  const lista = elemento('div');
  if (usuario.role === 'recepcao') {
    const resultados = await api('/api/profissionais/unidades');
    const form = formulario([campo('busca', 'Buscar por nome', 'search', '', true)], 'Pesquisar', async dados => {
      const encontrados = await ler(rotaAluno(dados.busca ? { busca: dados.busca } : {}));
      renderAlunos(lista, encontrados, resultados);
    });
    const filtroVencimento = document.createElement('button');
    filtroVencimento.className = 'kd-button';
    filtroVencimento.type = 'button';
    filtroVencimento.textContent = 'Planos que vencem em até 30 dias';
    filtroVencimento.addEventListener('click', async () => renderAlunos(lista, await ler(rotaAluno({ vencendo: '30' })), resultados));
    resultado.append(form, filtroVencimento);
    const dados = await ler(rotaAluno());
    renderAlunos(lista, dados, resultados);
  } else {
    const alunos = (await ler('/meus-alunos')).map(item => item.aluno);
    renderAlunos(lista, alunos);
  }
  resultado.append(lista);
  area.append(resultado);
}

async function paginaFichas(area) {
  titulo(area, usuario.role === 'personal' ? 'Fichas de treino' : 'Planos alimentares', 'Crie e mantenha materiais para alunos vinculados com plano elegível.');
  const alunos = (await ler('/meus-alunos')).map(item => item.aluno);
  await fichasProfissionais(area, alunos);
}

async function baixarDocumento(id, botao) {
  botao.disabled = true;
  try {
    const arquivo = await api(`/api/profissionais/documentos/${id}/arquivo`);
    const url = URL.createObjectURL(arquivo);
    const link = elemento('a', '');
    link.href = url;
    link.download = `krypton-documento-${id}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (falha) {
    botao.after(elemento('p', falha.message, 'kd-feedback'));
  } finally { botao.disabled = false; }
}

async function documentosProfissionais(area) {
  titulo(area, 'Documentos profissionais', 'Anexe PDFs no formato seguro do Krypton ou gere documentos a partir das fichas existentes. Arquivos permanecem privados.');
  area.append(acao('Atualizar status', renderizar));
  const [vinculos, fichas, documentos] = await Promise.all([ler('/meus-alunos'), ler('/fichas'), api('/api/profissionais/documentos')]);
  const alunos = vinculos.map(item => item.aluno);
  const listaFichas = fichas.map(ficha => [ficha.id, `${ficha.titulo} · ${alunos.find(a => a.id === ficha.aluno_id)?.nome || 'aluno'}`]);
  const gerar = bloco('Gerar PDF de uma ficha');
  if (listaFichas.length) gerar.append(formulario([escolha('ficha_id', 'Ficha profissional', listaFichas)], 'Solicitar geração', async dados => {
    await salvar('/documentos/gerar', { ficha_id: dados.ficha_id });
    await renderizar();
  }));
  else gerar.append(listaVazia('Publique uma ficha para habilitar a geração de PDF.'));

  const upload = bloco('Anexar PDF');
  if (alunos.length) {
    const form = elemento('form', null, 'kd-form');
    const alvo = escolha('aluno_id', 'Aluno vinculado', alunos.map(a => [a.id, a.nome]));
    const nome = campo('titulo', 'Título do documento');
    const label = elemento('label', 'PDF no formato Krypton (até 5 MB)');
    const arquivo = elemento('input', null, 'kd-input');
    arquivo.type = 'file'; arquivo.accept = 'application/pdf'; arquivo.required = true;
    label.append(arquivo);
    const enviarArquivo = elemento('button', 'Anexar documento', 'kd-button kd-button-primario');
    enviarArquivo.type = 'submit';
    const status = elemento('p'); status.setAttribute('role', 'status');
    form.append(alvo, nome, label, enviarArquivo, status);
    form.addEventListener('submit', async evento => {
      evento.preventDefault();
      const file = arquivo.files[0];
      if (!file || file.size > 5 * 1024 * 1024) { status.textContent = 'Selecione um PDF de até 5 MB.'; return; }
      enviarArquivo.disabled = true; status.textContent = 'Enviando…';
      try {
        await api('/api/profissionais/documentos', { method: 'POST', headers: {
          'Content-Type': 'application/pdf', 'X-Aluno-Id': alvo.querySelector('select').value,
          'X-Documento-Titulo': encodeURIComponent(nome.querySelector('input').value),
        }, body: file });
        await renderizar();
      } catch (falha) { status.textContent = falha.message; }
      finally { enviarArquivo.disabled = false; }
    });
    upload.append(form);
  } else upload.append(listaVazia('Vincule alunos elegíveis antes de anexar documentos.'));

  const registros = bloco('Documentos dos alunos vinculados');
  if (!documentos.length) registros.append(listaVazia('Nenhum documento cadastrado.'));
  for (const documento of documentos) {
    const card = bloco(documento.titulo,
      elemento('p', `${documento.aluno?.nome || 'Aluno'} · ${documento.tipo === 'personal' ? 'Treino' : 'Alimentação'} · ${documento.origem === 'ficha' ? 'Gerado pela ficha' : 'Anexo'}`),
      elemento('p', `Estado: ${documento.situacao} · ${dataLocal(documento.criado_em)}`, 'kd-texto-suave'));
    if (documento.situacao === 'disponivel') {
      card.append(acao('Baixar PDF', evento => baixarDocumento(documento.id, evento.currentTarget)));
      const substituir = elemento('input', null, 'kd-input');
      substituir.type = 'file'; substituir.accept = 'application/pdf'; substituir.setAttribute('aria-label', 'Selecionar PDF para substituir');
      substituir.addEventListener('change', async () => {
        const file = substituir.files[0];
        if (!file || file.size > 5 * 1024 * 1024) return card.append(elemento('p', 'Selecione um PDF de até 5 MB.', 'kd-feedback'));
        try {
          await api(`/api/profissionais/documentos/${documento.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: file });
          await renderizar();
        } catch (falha) { card.append(elemento('p', falha.message, 'kd-feedback')); }
      });
      card.append(substituir, acao('Remover documento', async () => {
        if (!confirm('Remover este documento permanentemente?')) return;
        await api(`/api/profissionais/documentos/${documento.id}`, { method: 'DELETE' });
        await renderizar();
      }));
    }
    registros.append(card);
  }
  area.append(gerar, upload, registros);
}

async function recepcaoInicio(area) {
  titulo(area, 'Visão geral', 'Indicadores operacionais da recepção.');
  const [{ hoje, consultas, ultimos }, vencendo, catalogo] = await Promise.all([ler('/recepcao'), ler(rotaAluno({ vencendo: '30' })), api('/api/unidades')]);
  area.append(elemento('p', `Olá, ${usuario.nome}.`, 'kd-sauda'));
  const indicadores = elemento('div', null, 'kd-grid kd-grid-indicadores');
  indicadores.append(indicador('Atendimentos hoje', hoje), indicador('Próximas consultas', consultas), indicador('Planos próximos ao vencimento', vencendo.length));
  area.append(indicadores, bloco('Atalhos', atalho('Pesquisar alunos', 'alunos', 'people'), atalho('Cadastrar aluno', 'novo-aluno', 'person-plus'),
    atalho('Abrir agendamentos', 'agenda', 'calendar3'), atalho('Consultar unidades', 'unidades', 'geo-alt')));
  const lista = bloco('Planos com vencimento próximo');
  renderAlunos(lista, vencendo, catalogo.unidades);
  area.append(lista);
  const atendimentos = bloco('Atendimentos recentes');
  if (!ultimos.length) atendimentos.append(listaVazia('Nenhum atendimento registrado.'));
  else for (const registro of ultimos) atendimentos.append(elemento('p', [registro.aluno.nome, registro.unidade?.nome, registro.motivo, dataLocal(registro.criado_em)].filter(Boolean).join(' · ')));
  area.append(atendimentos);
}

async function novoAluno(area) {
  titulo(area, 'Novo aluno', 'Cadastro presencial. O papel aluno é definido pelo servidor e nenhum plano é contratado aqui.');
  const senha = campo('senha', 'Senha escolhida pelo aluno', 'password');
  const entradaSenha = senha.querySelector('input');
  entradaSenha.minLength = 6;
  entradaSenha.maxLength = 72;
  entradaSenha.autocomplete = 'new-password';
  area.append(bloco('Dados do aluno', formulario([
    campo('nome', 'Nome completo'), campo('email', 'E-mail', 'email'), campo('data_nascimento', 'Data de nascimento', 'date'),
    senha, elemento('p', 'A senha deve ter pelo menos 6 caracteres e até 72 bytes UTF-8.', 'kd-texto-suave'),
  ], 'Cadastrar aluno', async dados => {
    const resposta = await salvar('/recepcao/alunos', dados);
    area.replaceChildren(elemento('p', `Cadastro realizado para ${resposta.nome}. O aluno pode entrar com o e-mail informado e a senha definida no cadastro.`, 'kd-estado'));
  })));
}

async function planosRecepcao(area) {
  titulo(area, 'Planos e matrículas', 'Consulte valores e situação. A contratação deve ser confirmada pelo próprio aluno em sua conta.');
  const tipos = ['basico', 'pro', 'elite'];
  const planos = await Promise.all(tipos.map(async tipo => api('/api/checkout/demo/planos/' + tipo)));
  const cards = elemento('div', null, 'kd-grid kd-grid-indicadores');
  for (const plano of planos) cards.append(bloco(plano.plano, elemento('p', (plano.valor_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })),
    elemento('p', plano.tipo === 'elite' ? 'Inclui elegibilidade para atendimento profissional conforme regras atuais.' : 'Consulte benefícios no fluxo oficial de contratação.')));
  const alunos = await ler(rotaAluno());
  const { unidades } = await api('/api/unidades');
  const matriculas = bloco('Matrículas e situação atual');
  renderAlunos(matriculas, alunos, unidades);
  area.append(cards, matriculas, bloco('Orientação de contratação', elemento('p', 'A recepção pode explicar os planos e encaminhar o aluno ao checkout. O aluno deve entrar em sua própria conta e confirmar a contratação; esta tela não inicia pagamentos nem altera matrículas.')));
}

async function unidadesRecepcao(area) {
  titulo(area, 'Unidades', 'Informações cadastradas para orientar os alunos.');
  const { unidades } = await api('/api/unidades');
  if (!unidades.length) return area.append(listaVazia('Nenhuma unidade disponível.'));
  for (const unidade of unidades) area.append(bloco(unidade.nome, ...[unidade.endereco, unidade.cidade, unidade.telefone, unidade.horario].filter(Boolean).map(valor => elemento('p', valor))));
}

async function atendimentos(area) {
  titulo(area, 'Atendimentos', 'Registre e consulte o histórico de atendimentos da recepção.');
  const [resumo, alunos, catalogo] = await Promise.all([ler('/recepcao'), ler(rotaAluno()), api('/api/unidades')]);
  const { unidades } = catalogo;
  const seletor = escolha('aluno_id', 'Aluno', alunos.map(a => [a.id, a.nome]));
  const unidade = escolha('unidade_id', 'Unidade', unidades.map(a => [a.id, a.nome]), '', true);
  const historico = bloco('Histórico recente');
  if (!resumo.ultimos.length) historico.append(listaVazia('Nenhum atendimento registrado.'));
  else for (const i of resumo.ultimos) historico.append(elemento('p', [i.aluno.nome, i.unidade?.nome, i.motivo, dataLocal(i.criado_em)].filter(Boolean).join(' · ')));
  area.append(bloco('Registrar atendimento', formulario([seletor, unidade, campo('motivo', 'Motivo')], 'Registrar atendimento', async dados => {
    await salvar('/recepcao', dados);
    await renderizar();
  })), historico);
}

async function notificacoes(area) {
  titulo(area, 'Notificações', 'Avisos destinados à sua conta.');
  const { itens, nao_lidas } = await api('/api/profissionais/notificacoes');
  const grupo = bloco(nao_lidas + ' não lidas');
  if (!itens.length) grupo.append(listaVazia('Nenhuma notificação.'));
  for (const item of itens) {
    const card = bloco(item.titulo, elemento('p', item.mensagem), elemento('small', dataLocal(item.criado_em)));
    if (!item.lida_em) card.append(acao('Marcar como lida', async () => {
      try { await api('/api/profissionais/notificacoes/' + item.id, { method: 'PATCH' }); await renderizar(); }
      catch (falha) { card.append(elemento('p', falha.message, 'kd-feedback')); }
    }));
    grupo.append(card);
  }
  if (nao_lidas) grupo.prepend(acao('Marcar todas como lidas', async () => {
    try { await api('/api/profissionais/notificacoes/lidas', { method: 'PATCH' }); await renderizar(); }
    catch (falha) { grupo.append(elemento('p', falha.message, 'kd-feedback')); }
  }));
  area.append(grupo);
}

async function paginaAgenda(area) {
  titulo(area, usuario.role === 'recepcao' ? 'Agendamentos' : 'Minha agenda', 'Consulte horários e atualize somente os atendimentos sob sua responsabilidade.');
  await agendaPainel(area, usuario, renderizar, usuario.role === 'recepcao');
}

function nav() {
  const itens = paginas[usuario.role] || [];
  menu.querySelector('.kd-nav').replaceChildren();
  for (const [hash, texto, icon] of itens) {
    const link = elemento('a', null);
    link.href = '#' + hash;
    link.dataset.pagina = hash;
    link.append(elemento('i', null, 'bi bi-' + icon), document.createTextNode(texto));
    menu.querySelector('.kd-nav').append(link);
  }
  const seguranca = elemento('a', 'Segurança da conta');
  seguranca.href = '/configuracoes-conta.html';
  seguranca.append(elemento('i', null, 'bi bi-shield-lock'));
  menu.querySelector('.kd-nav').append(seguranca);
}

async function renderizar() {
  const atual = ++versao;
  const pagina = (location.hash || '#visao-geral').slice(1);
  const area = elemento('div');
  raiz.setAttribute('aria-busy', 'true');
  menu.querySelectorAll('[data-pagina]').forEach(link => {
    if (link.dataset.pagina === pagina) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  raiz.replaceChildren(elemento('p', 'Carregando painel…'));
  try {
    if (pagina === 'minha-conta') {
      titulo(area, 'Minha conta', 'Dados pessoais, segurança e sessão.');
      area.append(montarEditorPerfil(usuario, {
        aoAtualizarNome: nome => { identidade.atualizarNome(nome); document.getElementById('perfil').textContent = rotulos[usuario.role] + ' · ' + nome; },
        aoAtualizarFoto: foto => identidade.definirFoto(foto),
      }));
      area.append(bloco('Segurança da conta', elemento('p', 'Altere ou recupere suas credenciais nas configurações de segurança.'), (() => { const a = elemento('a', 'Abrir configurações de segurança', 'kd-button'); a.href = '/configuracoes-conta.html'; return a; })()));
    } else if (pagina === 'visao-geral') {
      if (usuario.role === 'recepcao') await recepcaoInicio(area);
      else await visaoEspecialista(area);
    } else if (pagina === 'alunos') await paginaAlunos(area);
    else if (pagina === 'novo-aluno' && usuario.role === 'recepcao') await novoAluno(area);
    else if (pagina === 'planos' && usuario.role === 'recepcao') await planosRecepcao(area);
    else if (pagina === 'unidades' && usuario.role === 'recepcao') await unidadesRecepcao(area);
    else if (pagina === 'atendimentos' && usuario.role === 'recepcao') await atendimentos(area);
    else if (pagina === 'agenda') await paginaAgenda(area);
    else if (pagina === 'fichas' && ['personal', 'nutricionista'].includes(usuario.role)) await paginaFichas(area);
    else if (pagina === 'documentos' && ['personal', 'nutricionista'].includes(usuario.role)) await documentosProfissionais(area);
    else if (pagina === 'notificacoes') await notificacoes(area);
    else await recepcaoInicio(area);
    if (versao === atual) raiz.replaceChildren(area);
  } catch (e) {
    if (versao === atual) raiz.replaceChildren(elemento('p', e.message, 'kd-estado'), acao('Tentar novamente', renderizar));
  } finally { if (versao === atual) raiz.setAttribute('aria-busy', 'false'); }
}

document.getElementById('sair').addEventListener('click', async evento => {
  const botao = evento.currentTarget;
  botao.disabled = true;
  try {
    await api('/api/auth/logout', { method: 'POST' });
    for (const chave of ['token', 'usuario', 'checkout_tentativa_id']) localStorage.removeItem(chave);
    location.replace('/login.html');
  } catch (falha) {
    botao.disabled = false;
    raiz.prepend(elemento('p', `Não foi possível encerrar a sessão: ${falha.message}`, 'kd-estado'));
  }
});
window.addEventListener('hashchange', () => { fecharMenu(); renderizar(); });
try {
  ({ usuario } = await api('/api/auth/me'));
  if (!Object.hasOwn(papeis, usuario.role)) location.replace(usuario.role === 'admin' ? '/admin.html' : '/dashboard.html');
  else {
    document.getElementById('perfil').textContent = rotulos[usuario.role] + ' · ' + usuario.nome;
    identidade = criarIdentidadePainel(usuario, { avatar: document.getElementById('avatar-profissional'), nome: document.getElementById('nome-cabecalho') });
    nav();
    montarNotificacoes();
    renderizar();
  }
} catch { raiz.replaceChildren(elemento('p', 'Não foi possível abrir a sessão.')); }

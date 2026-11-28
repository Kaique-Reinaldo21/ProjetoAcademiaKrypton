import { api } from './aluno-dados.js';
import { configurarMenu, elemento, itemAcaoConta } from './design-system.js';
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
  const [{ hoje, consultas, ultimos, cadastrosRecentes, matriculasRecentes }, vencendo, catalogo] = await Promise.all([ler('/recepcao'), ler(rotaAluno({ vencendo: '30' })), api('/api/unidades')]);
  area.append(elemento('p', `Olá, ${usuario.nome}.`, 'kd-sauda'));
  const indicadores = elemento('div', null, 'kd-grid kd-grid-indicadores');
  indicadores.append(indicador('Atendimentos hoje', hoje), indicador('Próximas consultas', consultas), indicador('Planos próximos ao vencimento', vencendo.length));
  area.append(indicadores, bloco('Atalhos', atalho('Pesquisar alunos', 'alunos', 'people'), atalho('Cadastrar aluno', 'novo-aluno', 'person-plus'),
    atalho('Registrar atendimento', 'atendimentos', 'clipboard-check'), atalho('Consultar atendimentos', 'atendimentos', 'clock-history'),
    atalho('Abrir agendamentos', 'agenda', 'calendar3'), atalho('Consultar unidades', 'unidades', 'geo-alt')));
  const lista = bloco('Planos com vencimento próximo');
  renderAlunos(lista, vencendo, catalogo.unidades);
  area.append(lista);
  const atendimentos = bloco('Atendimentos recentes');
  if (!ultimos.length) atendimentos.append(listaVazia('Nenhum atendimento registrado.'));
  else for (const registro of ultimos) atendimentos.append(elemento('p', [registro.aluno.nome, registro.unidade?.nome, registro.motivo, dataLocal(registro.criado_em)].filter(Boolean).join(' · ')));
  const cadastros = bloco('Cadastros recentes');
  if (!cadastrosRecentes?.length) cadastros.append(listaVazia('Nenhum cadastro de aluno recente.'));
  else for (const registro of cadastrosRecentes) cadastros.append(elemento('p', `${registro.nome} · cadastro ${registro.created_at ? dataLocal(registro.created_at) : 'data não disponível'}`));
  const matriculas = bloco('Matrículas registradas');
  if (!matriculasRecentes?.length) matriculas.append(listaVazia('Nenhuma matrícula registrada.'));
  else for (const registro of matriculasRecentes) matriculas.append(elemento('p', `${registro.usuarios.nome} · ${registro.tipo} · ${registro.ativo ? 'ativa' : 'inativa'} · início ${dataLocal(registro.inicio)}`));
  area.append(atendimentos, cadastros, matriculas);
}

async function novoAluno(area) {
  titulo(area, 'Novo aluno', 'Cadastro presencial. O papel aluno é definido pelo servidor; a contratação simulada pode ser iniciada após o cadastro.');
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
    area.replaceChildren(elemento('p', `Cadastro realizado para ${resposta.nome}. O aluno pode entrar com sua própria conta.`, 'kd-estado'));
    try {
      const { unidades } = await api('/api/unidades');
      area.append(bloco('Contratação simulada após o cadastro', elemento('p', 'A recepção continua autenticada em sua própria conta. A matrícula é simulada, exige confirmação e fica registrada com o responsável.'),
        await formularioMatricula([resposta], unidades)));
    } catch { area.append(elemento('p', 'O cadastro foi concluído; não foi possível carregar as unidades para a contratação simulada.', 'kd-feedback')); }
  })));
}

async function formularioMatricula(alunos, unidades) {
  const campoBusca = campo('busca_aluno', 'Pesquisar aluno por nome', 'search', '', true);
  const entradaBusca = campoBusca.querySelector('input');
  const seletorAluno = escolha('aluno_id', 'Aluno', alunos.map(a => [a.id, a.nome]));
  const entradaAluno = seletorAluno.querySelector('select');
  const statusBusca = elemento('p'); statusBusca.setAttribute('role', 'status');
  let sequenciaBusca = 0;
  let timerBusca;
  entradaBusca.addEventListener('input', () => {
    clearTimeout(timerBusca);
    const sequencia = ++sequenciaBusca;
    timerBusca = setTimeout(async () => {
      const termo = entradaBusca.value.trim();
      if (!termo) {
        entradaAluno.replaceChildren(new Option('Selecione', ''), ...alunos.map(a => new Option(a.nome, a.id)));
        statusBusca.textContent = '';
        return;
      }
      entradaAluno.replaceChildren(new Option('Buscando…', ''));
      try {
        const encontrados = await ler('/alunos?busca=' + encodeURIComponent(termo));
        if (sequencia !== sequenciaBusca) return;
        entradaAluno.replaceChildren(new Option(encontrados.length ? 'Selecione' : 'Nenhum aluno encontrado', ''), ...encontrados.map(a => new Option(a.nome, a.id)));
        statusBusca.textContent = encontrados.length ? `${encontrados.length} resultados.` : 'Nenhum aluno encontrado.';
      } catch (falha) { statusBusca.textContent = falha.message; }
    }, 250);
  });
  const campoPlano = escolha('tipoPlano', 'Plano', [['basico', 'Básico'], ['pro', 'Pro'], ['elite', 'Elite']]);
  const campoUnidade = escolha('unidade_id', 'Unidade (obrigatória no Básico)', unidades.map(u => [u.id, u.nome]), '', true);
  const campoMetodo = escolha('metodo', 'Forma de pagamento simulada', [['qr_krypton', 'PIX Krypton'], ['mercadopago_simulado', 'Mercado Pago simulado']]);
  const seletorUnidade = campoUnidade.querySelector('select');
  const alternarUnidade = () => { const exige = campoPlano.querySelector('select').value === 'basico'; seletorUnidade.required = exige; campoUnidade.hidden = !exige; };
  campoPlano.querySelector('select').addEventListener('change', alternarUnidade);
  alternarUnidade();
  const campos = [
    campoBusca, seletorAluno, statusBusca,
    campoPlano, campoUnidade, campoMetodo,
  ];
  let revisada = false;
  let tentativaId = null;
  const form = formulario(campos, 'Revisar contratação', async (dados, formularioAtual) => {
    const submit = formularioAtual.querySelector('button[type="submit"]');
    const status = formularioAtual.querySelector('[role="status"]');
    if (!revisada) {
      if (!dados.aluno_id || !dados.tipoPlano || (dados.tipoPlano === 'basico' && !dados.unidade_id)) throw Error('Selecione aluno, plano e unidade quando exigida.');
      const aluno = alunos.find(item => String(item.id) === String(dados.aluno_id)) ||
        (await ler('/alunos?busca=' + encodeURIComponent(entradaBusca.value.trim()))).find(item => String(item.id) === String(dados.aluno_id));
      const nomes = { basico: 'Básico', pro: 'Pro', elite: 'Elite' };
      const precos = { basico: 89, pro: 149, elite: 249 };
      const unidadeNome = unidades.find(item => String(item.id) === String(dados.unidade_id))?.nome;
      formularioAtual.append(bloco('Resumo da contratação', elemento('p', `Aluno: ${aluno?.nome || 'Aluno selecionado'}`),
        elemento('p', `Plano: ${nomes[dados.tipoPlano]} · R$ ${precos[dados.tipoPlano].toFixed(2).replace('.', ',')} / mês`),
        ...(dados.tipoPlano === 'basico' ? [elemento('p', 'Unidade: ' + unidadeNome)] : []),
        elemento('p', `Forma de pagamento: ${dados.metodo === 'qr_krypton' ? 'PIX Krypton' : 'Mercado Pago'} simulado. Nenhuma cobrança real será realizada.`),
        elemento('p', 'A tentativa permanecerá pendente até uma resposta simulada explícita. O plano só será ativado se aprovada.')));
      const confirmar = elemento('input'); confirmar.type = 'checkbox'; confirmar.name = 'confirmar_pagamento'; confirmar.required = true;
      const rotulo = elemento('label', 'Confirmo que o aluno autorizou o pagamento simulado e que devo ativar esta matrícula.');
      rotulo.prepend(confirmar); formularioAtual.append(rotulo);
      revisada = true;
      submit.textContent = 'Criar tentativa de pagamento';
      status.textContent = 'Revise o resumo, selecione a confirmação e crie a tentativa pendente.';
      return false;
    }
    if (tentativaId) return false;
    const confirmar = formularioAtual.querySelector('[name="confirmar_pagamento"]');
    if (!confirmar?.checked) throw Error('Confirme explicitamente a autorização para criar o pagamento simulado.');
    const tentativa = await salvar('/recepcao/matricula-simulada', {
      aluno_id: dados.aluno_id, tipoPlano: dados.tipoPlano, unidade_id: dados.unidade_id,
      metodo: dados.metodo, confirmacao: true,
    });
    tentativaId = tentativa.tentativaId;
    submit.hidden = true;
    confirmar.disabled = true;
    const acoes = bloco('Confirmação do pagamento simulado', elemento('p', `Tentativa ${tentativaId} · status pendente. Os controles abaixo são exclusivos do simulador acadêmico.`));
    const controles = elemento('div', null, 'kd-acoes-pagamento');
    for (const [acaoPagamento, rotulo] of [['aprovar', 'Simular pagamento aprovado'], ['pendente', 'Manter pendente'], ['recusar', 'Simular pagamento recusado']]) {
      controles.append(acao(rotulo, async botao => {
        botao.target.disabled = true;
        try {
          const resultado = await api(`/api/profissionais/recepcao/matricula-simulada/${encodeURIComponent(tentativaId)}/confirmar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: acaoPagamento, confirmacao: true }),
          });
          status.textContent = resultado.status === 'approved' ? 'Pagamento simulado aprovado e matrícula ativada.' : resultado.status === 'rejected' ? 'Pagamento recusado; a matrícula não foi ativada.' : 'Pagamento pendente; a matrícula não foi ativada.';
          if (resultado.status === 'approved') setTimeout(renderizar, 700);
          if (resultado.status !== 'pending') controles.querySelectorAll('button').forEach(item => { item.disabled = true; });
        } catch (falha) { status.textContent = falha.message; botao.target.disabled = false; }
      }));
    }
    acoes.append(controles); formularioAtual.append(acoes);
    status.textContent = 'Tentativa criada e pendente. Escolha uma resposta no simulador.';
    return false;
  });
  return form;
}

async function planosRecepcao(area) {
  titulo(area, 'Planos e matrículas', 'Consulte valores e situação; no modo acadêmico demo, a recepção pode registrar matrícula simulada com confirmação.');
  const tipos = ['basico', 'pro', 'elite'];
  const planos = await Promise.all(tipos.map(async tipo => api('/api/checkout/demo/planos/' + tipo)));
  const cards = elemento('div', null, 'kd-grid kd-grid-indicadores');
  for (const plano of planos) cards.append(bloco(plano.plano, elemento('p', (plano.valor_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })),
    elemento('p', plano.tipo === 'elite' ? 'Inclui elegibilidade para atendimento profissional conforme regras atuais.' : 'Consulte benefícios no fluxo oficial de contratação.')));
  const alunos = await ler(rotaAluno());
  const { unidades } = await api('/api/unidades');
  const matriculas = bloco('Matrículas e situação atual');
  renderAlunos(matriculas, alunos, unidades);
  area.append(cards, matriculas, bloco('Matrícula presencial', elemento('p', 'A recepção permanece autenticada na própria conta. A contratação abaixo é exclusivamente simulada, exige confirmação explícita e registra a pessoa responsável; fora do modo acadêmico demo a API recusa a operação.'),
    await formularioMatricula(alunos, unidades)));
}

async function unidadesRecepcao(area) {
  titulo(area, 'Unidades', 'Informações cadastradas para orientar os alunos.');
  const { unidades } = await api('/api/unidades');
  if (!unidades.length) return area.append(listaVazia('Nenhuma unidade disponível.'));
  for (const unidade of unidades) area.append(bloco(unidade.nome, ...[unidade.endereco, unidade.cidade, unidade.telefone, unidade.horario].filter(Boolean).map(valor => elemento('p', valor))));
}

async function atendimentos(area) {
  titulo(area, 'Atendimentos', 'Registre e consulte o histórico de atendimentos da recepção.');
  const [alunos, catalogo] = await Promise.all([ler(rotaAluno()), api('/api/unidades')]);
  const { unidades } = catalogo;
  const seletor = escolha('aluno_id', 'Aluno', alunos.map(a => [a.id, a.nome]));
  const unidade = escolha('unidade_id', 'Unidade', unidades.map(a => [a.id, a.nome]), '', true);
  const historico = bloco('Histórico recente');
  const buscaHistorico = elemento('form', null, 'kd-form');
  const buscaAluno = campo('busca', 'Pesquisar por aluno', 'search', '', true);
  const dataDe = campo('de', 'De', 'date', '', true), dataAte = campo('ate', 'Até', 'date', '', true);
  const filtrar = elemento('button', 'Filtrar histórico', 'kd-button'); filtrar.type = 'submit';
  const estadoHistorico = elemento('p'); estadoHistorico.setAttribute('role', 'status');
  buscaHistorico.append(buscaAluno, dataDe, dataAte, filtrar, estadoHistorico, historico);
  async function carregarHistorico(filtros = {}) {
    historico.replaceChildren(listaVazia('Carregando atendimentos…'));
    estadoHistorico.textContent = '';
    try {
      const query = new URLSearchParams(Object.fromEntries(Object.entries(filtros).filter(([, v]) => v)));
      const resumo = await ler('/recepcao' + (query.size ? '?' + query : ''));
      estadoHistorico.textContent = '';
      historico.replaceChildren();
      if (!resumo.ultimos.length) return historico.append(listaVazia('Nenhum atendimento nesse filtro.'));
      for (const i of resumo.ultimos) historico.append(elemento('p', `Atendimento · ${[i.aluno.nome, i.unidade?.nome, i.motivo, dataLocal(i.criado_em)].filter(Boolean).join(' · ')}`));
      estadoHistorico.textContent = `${resumo.ultimos.length} atendimentos encontrados. Cadastros e matrículas têm listas separadas; vínculos profissionais são gerenciados pelo administrador.`;
    } catch (falha) { historico.replaceChildren(elemento('p', falha.message, 'kd-feedback')); }
  }
  buscaHistorico.addEventListener('submit', e => { e.preventDefault(); carregarHistorico({ busca: buscaAluno.querySelector('input').value, de: dataDe.querySelector('input').value, ate: dataAte.querySelector('input').value }); });
  carregarHistorico();
  area.append(bloco('Registrar atendimento', formulario([seletor, unidade, campo('motivo', 'Motivo')], 'Registrar atendimento', async dados => {
    await salvar('/recepcao', dados);
    await renderizar();
  })), buscaHistorico);
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
      const acoes = elemento('div', null, 'kd-acoes-conta');
      if (usuario.possuiSenhaLocal) {
        const senha = elemento('a', 'Abrir', 'kd-button'); senha.href = '/configuracoes-conta.html#alterar';
        acoes.append(itemAcaoConta('key', 'Alterar senha', 'Atualize a senha da sua conta.', senha));
      }
      if (usuario.podeVincularGoogle) {
        const google = elemento('a', 'Vincular', 'kd-button'); google.href = '/configuracoes-conta.html#vincular-google';
        acoes.append(itemAcaoConta('google', 'Vincular Google', 'Conecte sua conta Google com segurança.', google));
      }
      const sairConta = elemento('button', 'Encerrar sessão', 'kd-button'); sairConta.type = 'button'; sairConta.dataset.sair = '';
      acoes.append(itemAcaoConta('box-arrow-right', 'Encerrar sessão', 'Finalize o acesso neste dispositivo.', sairConta));
      area.append(bloco('Segurança da conta', acoes));
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
document.addEventListener('click', evento => {
  const botao = evento.target.closest('[data-sair]');
  if (botao && botao.id !== 'sair') document.getElementById('sair').click();
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

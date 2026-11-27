import { api, enviar } from './aluno-dados.js';
import { elemento } from './design-system.js';

export const base = '/api/profissionais';
export const papeis = { recepcao: 'Recepção', personal: 'Personal trainer', nutricionista: 'Nutrição' };
export const ler = rota => api(base + rota);
export const salvar = (rota, dados, method) => enviar(base + rota, dados, method);

export function campo(nome, rotulo, tipo = 'text', valor = '', opcional = false) {
  const label = elemento('label', rotulo);
  const input = elemento('input', null, 'kd-input');
  Object.assign(input, { name: nome, type: tipo, value: valor ?? '', required: !opcional });
  label.append(input);
  return label;
}

export function escolha(nome, rotulo, itens, selecionado = '', opcional = false) {
  const label = elemento('label', rotulo);
  const select = elemento('select', null, 'kd-input');
  select.name = nome;
  select.required = !opcional;
  for (const [id, texto] of [['', 'Selecione'], ...itens]) {
    const option = elemento('option', texto);
    option.value = id;
    select.append(option);
  }
  select.value = selecionado;
  label.append(select);
  return label;
}

export function acao(texto, executar) {
  const button = elemento('button', texto, 'kd-button');
  button.type = 'button';
  button.addEventListener('click', executar);
  return button;
}

export function formulario(campos, texto, executar) {
  const form = elemento('form', null, 'kd-form');
  const submit = elemento('button', texto, 'kd-button kd-button-primario');
  const status = elemento('p');
  status.setAttribute('role', 'status');
  form.append(...campos, submit, status);
  form.addEventListener('submit', async evento => {
    evento.preventDefault();
    submit.disabled = true;
    status.textContent = 'Salvando…';
    try { await executar(Object.fromEntries(new FormData(form)), form); status.textContent = 'Operação concluída.'; }
    catch (e) { status.textContent = e.message; }
    finally { submit.disabled = false; }
  });
  return form;
}

export function bloco(titulo, ...conteudo) {
  const card = elemento('section', null, 'kd-card mb-3');
  card.append(elemento('h2', titulo), ...conteudo);
  return card;
}

export const dataLocal = valor => new Date(valor).toLocaleString('pt-BR');
const treino = [
  ['divisao', 'Dia ou divisão'], ['nome', 'Exercício'], ['series', 'Séries', 'number'], ['repeticoes', 'Repetições'],
  ['carga', 'Carga', 'text', true], ['descanso', 'Descanso', 'text', true], ['orientacoes', 'Orientações do exercício', 'text', true],
];
const alimentacao = [
  ['refeicao', 'Refeição'], ['horario', 'Horário', 'time'], ['alimentos', 'Alimentos'], ['quantidades', 'Quantidades'],
  ['orientacoes', 'Orientações da refeição', 'text', true],
];
const definicao = tipo => tipo === 'personal' ? treino : alimentacao;

export function fichaPublicada(ficha) {
  const lista = elemento('ul');
  for (const item of ficha.itens) {
    const valores = definicao(ficha.tipo).filter(([chave]) => item[chave] != null)
      .map(([chave, rotulo]) => rotulo + ': ' + item[chave]);
    lista.append(elemento('li', valores.join(' · ')));
  }
  const card = bloco(ficha.titulo, lista);
  if (ficha.orientacoes) card.append(elemento('p', ficha.orientacoes));
  return card;
}

export async function publicarNoAluno(destino, tipo) {
  destino.replaceChildren(elemento('p', 'Carregando materiais…'));
  try {
    const fichas = await ler('/fichas?tipo=' + tipo);
    destino.replaceChildren(...(fichas.length ? fichas.map(fichaPublicada) : [elemento('p', 'Nenhum material disponibilizado.')]));
  } catch { destino.replaceChildren(elemento('p', 'Não foi possível consultar os materiais.')); }
}

export function editor(alunos, tipo, ficha, concluir) {
  const itens = elemento('div');
  let numeroItem = 0;
  function adicionar(item = {}) {
    numeroItem += 1;
    const idAjudaSeries = `ajuda-series-${numeroItem}`;
    const grupo = elemento('fieldset', null, 'kd-card mb-2');
    grupo.append(elemento('legend', tipo === 'personal' ? 'Exercício' : 'Refeição'));
    for (const [nome, rotulo, formato, opcional] of definicao(tipo)) {
      const controle = campo(nome, rotulo, formato, item[nome] ?? (tipo === 'personal' && nome === 'series' ? '3' : ''), opcional);
      const input = controle.querySelector('input');
      if (tipo === 'personal' && nome === 'series') {
        input.min = '1'; input.max = '30'; input.step = '1'; input.required = true;
        input.setAttribute('aria-describedby', idAjudaSeries);
      }
      const exemplos = { divisao: 'Ex.: Treino A — membros superiores', nome: 'Ex.: Agachamento livre', repeticoes: 'Ex.: 8 a 12', carga: 'Ex.: carga confortável', descanso: 'Ex.: 60 segundos', orientacoes: 'Ex.: manter a postura e interromper se houver dor' };
      if (tipo === 'personal' && exemplos[nome]) input.placeholder = exemplos[nome];
      grupo.append(controle);
    }
    if (tipo === 'personal') {
      const ajuda = elemento('small', 'Use um número inteiro de 1 a 30 séries.', 'kd-texto-suave');
      ajuda.id = idAjudaSeries; grupo.append(ajuda);
    }
    grupo.append(acao('Remover item', () => { if (itens.children.length > 1) grupo.remove(); }));
    itens.append(grupo);
  }
  for (const item of ficha?.itens || [{}]) adicionar(item);
  return formulario([
    escolha('aluno_id', 'Aluno', alunos.map(a => [a.id, a.nome]), ficha?.aluno_id),
    campo('titulo', 'Título', 'text', ficha?.titulo),
    campo('orientacoes', 'Orientações gerais', 'text', ficha?.orientacoes, true),
    itens, acao('Adicionar item', () => { if (itens.children.length < 40) adicionar(); }),
  ], ficha ? 'Salvar alterações' : 'Publicar', async dados => {
    const lista = [...itens.children].map(grupo => Object.fromEntries([...grupo.querySelectorAll('input')].map(input => [input.name, input.value])));
    await salvar(ficha ? '/fichas/' + ficha.id : '/fichas', {
      aluno_id: dados.aluno_id, titulo: dados.titulo, orientacoes: dados.orientacoes, itens: lista,
    }, ficha ? 'PUT' : 'POST');
    await concluir();
  });
}

export async function agendaPainel(destino, usuario, recarregar, criar = false) {
  const agenda = await ler('/agenda');
  const area = bloco('Consultas');
  for (const item of agenda) {
    const titulo = usuario.role === 'aluno' ? item.profissional?.nome : item.usuarios?.nome;
    const linha = bloco(titulo || 'Consulta legada', elemento('p',
      [papeis[item.tipo], dataLocal(item.data_hora), item.situacao, item.unidade?.nome].filter(Boolean).join(' · ')));
    const abertas = ['agendado', 'confirmado'].includes(item.situacao);
    if (abertas) {
      const opcoes = usuario.role === 'aluno' ? [['cancelar', 'Cancelar']] :
        [['cancelar', 'Cancelar'], ['reagendar', 'Reagendar'], item.situacao === 'agendado' ? ['confirmar', 'Confirmar'] : ['concluir', 'Concluir']];
      const horario = campo('data_hora', 'Novo horário', 'datetime-local', '', true);
      horario.hidden = true;
      const acoes = escolha('acao', 'Ação', opcoes);
      acoes.addEventListener('change', e => { horario.hidden = e.target.value !== 'reagendar'; });
      linha.append(formulario([acoes, horario], 'Atualizar consulta', async dados => {
        if (dados.acao === 'reagendar') {
          if (!dados.data_hora) throw Error('Informe o novo horário.');
          dados.data_hora = new Date(dados.data_hora).toISOString();
        }
        await salvar('/agenda/' + item.id, dados, 'PATCH');
        await recarregar();
      }));
    }
    area.append(linha);
  }
  if (!agenda.length) area.append(elemento('p', 'Nenhuma consulta cadastrada.'));
  destino.append(area);
  if (criar) await agendaFormulario(destino, usuario, recarregar);
}

export async function agendaFormulario(destino, usuario, recarregar) {
  const unidades = await ler('/unidades');
  const recepcao = usuario.role === 'recepcao';
  const idAluno = campo('aluno_id', 'ID do aluno', 'number');
  const select = escolha('profissional_id', 'Profissional vinculado', []);
  const escolhaProfissional = select.querySelector('select');
  const dadosProfissionais = new Map();
  const aviso = elemento('p');
  async function carregar(id) {
    escolhaProfissional.replaceChildren(new Option('Selecione', ''));
    dadosProfissionais.clear();
    try {
      const opcoes = await ler('/opcoes' + (recepcao ? '?aluno_id=' + encodeURIComponent(id) : ''));
      for (const { profissional } of opcoes) {
        dadosProfissionais.set(String(profissional.id), profissional.role);
        escolhaProfissional.append(new Option(profissional.nome + ' · ' + papeis[profissional.role], profissional.id));
      }
      aviso.textContent = opcoes.length ? '' : 'Nenhum profissional disponível. É necessário ter vínculo e plano Elite ativo.';
    } catch (e) { aviso.textContent = e.message; }
  }
  if (recepcao) idAluno.addEventListener('change', e => carregar(e.target.value));
  else await carregar();
  const campos = [
    ...(recepcao ? [idAluno] : []), select, aviso, campo('data_hora', 'Data e hora', 'datetime-local'),
    escolha('unidade_id', 'Unidade', unidades.map(u => [u.id, u.nome]), '', true),
  ];
  destino.append(bloco('Novo agendamento', formulario(campos, 'Agendar', async dados => {
    await salvar('/agenda', { ...dados, tipo: dadosProfissionais.get(dados.profissional_id), data_hora: new Date(dados.data_hora).toISOString() });
    await recarregar();
  })));
}

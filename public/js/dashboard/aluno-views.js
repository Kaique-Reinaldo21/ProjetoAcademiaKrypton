import { api, dia, eliteAtivo, enviar, profissional, quando, reais } from './aluno-dados.js';
import { calendarioTreinos, historicoTreinos, registrarTreino } from './aluno-treinos.js';
import { badge, elemento, erro, estado, icone } from './design-system.js';

const planos = { basico: 'Básico', pro: 'Pro', elite: 'Elite' };
const preco = { basico: 8900, pro: 14900, elite: 24900 };
const situacoesPlano = {
  ativo: ['Ativo', 'positivo'], inativo: ['Inativo', 'erro'], vencido: ['Vencido', 'atencao'],
};
const situacoesTransacao = {
  approved: ['Aprovada', 'positivo'], pending: ['Pendente', 'atencao'], rejected: ['Recusada', 'erro'],
};
const modulos = {
  treinos: ['Planos de treino e sessões da academia.', 'Nenhum treino registrado.', 'Sua rotina aparecerá aqui quando houver treinos cadastrados.', 'lightning-charge'],
  'treinos-extras': ['Atividades complementares e acesso a treinos com personal.', 'Nenhum treino extra registrado.', 'Os treinos complementares aparecerão nesta seção.', 'plus-square'],
  avaliacoes: ['Resultados e registros de avaliações físicas.', 'Nenhuma avaliação disponível.', 'Quando uma avaliação for registrada, você poderá consultá-la aqui.', 'clipboard2-pulse'],
  progresso: ['Acompanhe a frequência e suas medições.', 'Sem medições no momento.', 'Quando houver registros, eles aparecerão aqui.', 'graph-up-arrow'],
  nutricao: ['Acompanhamento nutricional e agendamentos.', 'Nenhum acompanhamento disponível.', 'Orientações nutricionais aparecerão aqui quando forem disponibilizadas.', 'egg-fried'],
  arquivos: ['Documentos compartilhados com você.', 'Nenhum arquivo disponível.', 'Os documentos enviados pela academia aparecerão nesta seção.', 'folder2'],
};

function botao(texto, href, destaque = false) {
  const node = elemento('a', texto, 'kd-button' + (destaque ? ' kd-button-primario' : ''));
  node.href = href;
  return node;
}

function card(titulo, ...conteudo) {
  const node = elemento('section', null, 'kd-card aluno-detalhe');
  node.append(elemento('h2', titulo), ...conteudo);
  return node;
}

function titulo(raiz, nome, subtitulo) {
  const topo = elemento('div', null, 'aluno-topo');
  topo.append(elemento('h1', nome), elemento('p', subtitulo, 'kd-texto-suave'));
  raiz.append(topo);
}

function carregar(node, contexto, chave, exibir, limpar = true) {
  if (limpar) node.replaceChildren(estado('Carregando…'));
  contexto.dados.ler(chave).then(exibir).catch(falha => {
    erro(node, falha.status === 403 && chave === 'historico'
      ? 'O extrato demonstrativo só está disponível no ambiente acadêmico.'
      : falha.message, () => carregar(node, contexto, chave, exibir));
  });
}

function metricas(iconeNome, nome, valor, nota) {
  const node = elemento('section', null, 'kd-card aluno-metrica');
  node.append(icone(iconeNome), elemento('h2', nome), elemento('strong', valor), elemento('p', nota, 'kd-texto-suave'));
  return node;
}

export function inicio(raiz, contexto) {
  const hero = elemento('section', null, 'kd-card aluno-hero');
  const avatar = elemento('a', null, 'kd-avatar');
  avatar.href = '#configuracoes/foto';
  avatar.dataset.avatar = '';
  avatar.setAttribute('aria-label', 'Editar foto de perfil');
  const apresentacao = elemento('div');
  const saudacao = elemento('h1', 'Olá, ' + (contexto.usuario.nome.trim().split(/\s+/)[0] || 'aluno') + '!');
  apresentacao.append(saudacao, elemento('p', 'Acompanhe seu plano e organize sua rotina na Krypton.', 'kd-texto-suave'));
  hero.append(avatar, apresentacao);
  raiz.append(hero);

  const resumo = elemento('div', null, 'kd-grid aluno-resumo');
  const plano = elemento('div');
  const agenda = elemento('div');
  const frequencia = card('Frequência semanal', calendarioTreinos());
  resumo.append(plano, frequencia, agenda);
  raiz.append(resumo);
  carregar(plano, contexto, 'plano', p => {
    const item = card('Plano atual', elemento('strong', p?.nome || 'Sem plano', 'aluno-plano-nome'));
    item.dataset.plano = p?.tipo || '';
    if (p) {
      item.append(badge(...(situacoesPlano[p.status] || [p.status])));
      if (preco[p.tipo]) item.append(elemento('p', reais(preco[p.tipo]) + ' / mês'));
      if (p.vencimento) item.append(elemento('p', 'Vence em ' + dia(p.vencimento), 'kd-texto-suave'));
    }
    item.append(botao('Ver assinatura', '#faturas'));
    plano.replaceChildren(item);
  });
  carregar(agenda, contexto, 'agenda', itens => {
    const proximo = itens.find(item => new Date(item.data_hora) >= new Date());
    agenda.replaceChildren(metricas('calendar-event', 'Próximo agendamento', proximo ? profissional(proximo.tipo) : 'Sem agendamento',
      proximo ? quando(proximo.data_hora) : 'As próximas sessões aparecem aqui.'));
  });

  const area = elemento('section', null, 'aluno-area');
  const atalhos = elemento('div', null, 'kd-grid aluno-atalhos');
  for (const [hash, nome, desenho] of [
    ['treinos', 'Treinos', 'lightning-charge'], ['treinos-extras', 'Treinos extras', 'plus-square'],
    ['avaliacoes', 'Avaliações', 'clipboard2-pulse'], ['progresso', 'Meu progresso', 'graph-up-arrow'],
    ['nutricao', 'Nutrição', 'egg-fried'], ['agendamentos', 'Agendamentos', 'calendar3'],
    ['faturas', 'Faturas', 'receipt'], ['arquivos', 'Arquivos', 'folder2'],
  ]) {
    const link = elemento('a', null, 'kd-card kd-card-link aluno-atalho');
    link.href = '#' + hash;
    link.append(icone(desenho), elemento('h3', nome));
    atalhos.append(link);
  }
  area.append(elemento('h2', 'Acesso rápido'), atalhos);
  raiz.append(area);

  const item = elemento('section', null, 'kd-card aluno-pendencia aluno-area');
  const texto = elemento('div');
  const resumoPendencias = elemento('p', 'Consultando transações…', 'kd-texto-suave');
  texto.append(elemento('h2', 'Pendências'), resumoPendencias);
  item.append(texto, botao('Ver faturas', '#faturas'));
  raiz.append(item);
  contexto.dados.ler('historico').then(lista => {
    const pendentes = lista.filter(t => t.status === 'pending').length;
    resumoPendencias.textContent = pendentes ? `${pendentes} ${pendentes === 1 ? 'transação pendente' : 'transações pendentes'} no extrato.` : 'Nenhuma transação pendente no extrato.';
  }).catch(() => { resumoPendencias.textContent = 'O extrato está indisponível.'; });
  if (contexto.pagamento?.mensagem) item.prepend(badge(contexto.pagamento.mensagem, contexto.pagamento.tom));
}

export function modulo(raiz, contexto, chave, nome) {
  const [subtitulo, vazio, explicacao, desenho] = modulos[chave];
  titulo(raiz, nome, subtitulo);
  if (chave === 'treinos') raiz.append(card('Treino de hoje', registrarTreino()));
  if (chave === 'progresso') {
    raiz.append(card('Frequência semanal', calendarioTreinos()), card('Evolução da frequência', historicoTreinos()),
      card('Peso, medidas e avaliações', estado(vazio, explicacao)));
    return;
  }
  if (chave === 'nutricao') {
    const painel = elemento('div', null, 'kd-grid kd-grid-dois');
    raiz.append(painel);
    carregar(painel, contexto, 'plano', p => {
      if (!eliteAtivo(p)) {
        painel.replaceChildren(card('Acompanhamento com o Elite',
          elemento('p', 'O Elite inclui consultas com nutricionista e acesso aos materiais personalizados quando disponibilizados.'),
          botao('Conhecer ou alterar plano', '#faturas')));
        return;
      }
      painel.replaceChildren(
        card('Agendamento', botao('Agendar consulta', '#agendamentos')),
        ...['Plano alimentar', 'Refeições', 'Receitas', 'Orientações do nutricionista', 'Documentos'].map(
          nome => card(nome, estado('Nenhum material disponibilizado.'))),
      );
    });
    return;
  }
  const corpo = estado(vazio, explicacao);
  const bloco = card(nome, corpo);
  bloco.prepend(icone(desenho));
  raiz.append(bloco);
  if (chave === 'treinos-extras') {
    const acesso = elemento('section', null, 'aluno-area');
    raiz.append(acesso);
    carregar(acesso, contexto, 'plano', p => {
      const habilitado = eliteAtivo(p);
      const servico = 'Treino com personal trainer';
      acesso.replaceChildren(card(servico,
        elemento('p', habilitado ? 'Disponível com seu plano Elite ativo.' : 'Disponível para alunos com plano Elite ativo.', 'kd-texto-suave'),
        habilitado ? botao('Abrir agendamentos', '#agendamentos') : botao('Consultar meu plano', '#faturas')));
    });
  }
}

function feedback(form, texto, falhou = false) {
  const node = form.querySelector('[role="status"]');
  node.textContent = texto;
  node.dataset.tom = falhou ? 'erro' : 'positivo';
}

function formAgendamento(contexto, recarregar) {
  const form = elemento('form', null, 'kd-form');
  form.innerHTML = `
    <label>Serviço<select class="kd-input" name="tipo"><option value="personal">Personal trainer</option><option value="nutricionista">Nutricionista</option></select></label>
    <label>Data e hora<input class="kd-input" name="data_hora" type="datetime-local" required></label>
    <label>Observação<textarea class="kd-input" name="observacao" rows="3"></textarea></label>
    <div><button class="kd-button kd-button-primario">Agendar</button></div>
    <p class="kd-feedback" role="status"></p>`;
  form.addEventListener('submit', async evento => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(form));
    const botao = form.querySelector('button');
    botao.disabled = true;
    try {
      const data = new Date(dados.data_hora);
      if (!Number.isFinite(+data) || data <= new Date()) throw new Error('Selecione uma data e hora futuras.');
      await enviar('/api/usuario/agendamento', { ...dados, data_hora: data.toISOString() });
      form.reset();
      feedback(form, 'Agendamento realizado.');
      contexto.dados.invalidar('agenda');
      recarregar();
    } catch (falha) {
      feedback(form, falha.message, true);
    } finally { botao.disabled = false; }
  });
  return form;
}

export function agendamentos(raiz, contexto) {
  titulo(raiz, 'Agendamentos', 'Consulte suas sessões e agende os serviços do plano Elite.');
  const colunas = elemento('div', null, 'kd-grid kd-grid-dois');
  const lista = elemento('div');
  const formulario = elemento('div');
  colunas.append(card('Minhas sessões', lista), card('Novo agendamento', formulario));
  raiz.append(colunas);
  const recarregar = () => carregar(lista, contexto, 'agenda', itens => {
    if (!itens.length) return lista.replaceChildren(estado('Nenhuma sessão agendada.'));
    const ul = elemento('ul', null, 'aluno-lista');
    for (const item of itens) {
      const li = elemento('li');
      li.append(elemento('strong', profissional(item.tipo)), elemento('p', quando(item.data_hora), 'kd-texto-suave'));
      if (item.observacao) li.append(elemento('p', item.observacao));
      ul.append(li);
    }
    lista.replaceChildren(ul);
  });
  recarregar();
  carregar(formulario, contexto, 'plano', p => {
    formulario.replaceChildren(eliteAtivo(p) ? formAgendamento(contexto, recarregar) :
      estado('Disponível no Elite ativo.', 'Você pode consultar suas sessões existentes nesta página.'));
  });
}

function tabelaHistorico(lista) {
  const area = elemento('div', null, 'aluno-detalhe');
  if (!lista.length) {
    area.append(estado('Nenhuma transação registrada.'));
    return area;
  }
  area.innerHTML = `
    <div class="kd-form aluno-filtros">
      <label><span id="rotulo-metodo">Método</span><select aria-labelledby="rotulo-metodo" class="kd-input" name="metodo"><option value="">Todos os métodos</option><option value="qr_krypton">QR Code Krypton</option><option value="mercadopago_simulado">Mercado Pago simulado</option><option value="mercadopago">Mercado Pago financeiro</option></select></label>
      <label><span id="rotulo-status">Status</span><select aria-labelledby="rotulo-status" class="kd-input" name="status"><option value="">Todos os estados</option><option value="approved">Aprovada</option><option value="pending">Pendente</option><option value="rejected">Recusada</option></select></label>
    </div>
    <div class="kd-tabela-scroll" tabindex="0" aria-label="Extrato de transações">
      <table class="kd-tabela">
        <thead><tr><th scope="col">Data</th><th scope="col">Método</th><th scope="col">Plano</th><th scope="col">Valor</th><th scope="col">Situação</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
    <div data-vazio hidden></div>`;
  const info = area.querySelector('[data-vazio]');
  const corpo = area.querySelector('tbody');
  const tipo = area.querySelector('[name="metodo"]');
  const status = area.querySelector('[name="status"]');
  const metodo = t => t.tentativa?.metodo || (t.origem === 'demo' ? 'qr_krypton' : t.origem === 'demo_mercadopago' ? 'mercadopago_simulado' : t.origem);
  const temSimulacao = lista.some(t => ['demo', 'demo_mercadopago'].includes(t.origem));
  const temFinanceiro = lista.some(t => t.origem === 'mercadopago');
  if (temSimulacao) area.prepend(elemento('p', temFinanceiro
    ? 'QR Code Krypton e Mercado Pago simulado são operações acadêmicas sem cobrança real.'
    : 'Operações de demonstração. Sem cobrança real.', 'kd-texto-suave'));

  function filtrar() {
    corpo.replaceChildren();
    const itens = lista.filter(t => (!tipo.value || tipo.value === metodo(t)) && (!status.value || status.value === t.status));
    for (const t of itens) {
      const tr = elemento('tr');
      const nome = metodo(t) === 'qr_krypton' ? 'QR Code Krypton' :
        metodo(t) === 'mercadopago_simulado' && temFinanceiro ? 'Mercado Pago simulado' : 'Mercado Pago';
      for (const texto of [dia(t.criado_em), nome, planos[t.tentativa?.tipo] || '—', reais(t.valor_centavos)]) {
        tr.append(elemento('td', texto));
      }
      const celula = elemento('td');
      celula.append(badge(...(situacoesTransacao[t.status] || [t.status])));
      tr.append(celula);
      corpo.append(tr);
    }
    info.hidden = itens.length > 0;
    if (!itens.length) info.replaceChildren(estado('Nenhuma transação corresponde aos filtros.'));
  }
  area.addEventListener('change', filtrar);
  filtrar();
  return area;
}

function detalhesPlano(p, contexto) {
  if (!p) return card('Plano atual', estado('Nenhum plano contratado.'),
    botao('Escolher plano', '/escolher-plano.html', true));

  const topo = elemento('div', null, 'aluno-card-titulo');
  topo.append(elemento('h2', p.nome), badge(...(situacoesPlano[p.status] || [p.status])));
  const datas = elemento('dl');
  for (const [rotulo, valor] of [['Valor mensal', reais(preco[p.tipo])], ['Início', dia(p.inicio)], ['Vencimento', dia(p.vencimento)]]) {
    const par = elemento('div');
    par.append(elemento('dt', rotulo), elemento('dd', valor));
    datas.append(par);
  }
  const beneficios = elemento('ul', null, 'aluno-lista');
  for (const beneficio of p.beneficios) beneficios.append(elemento('li', beneficio));
  const painel = elemento('section', null, 'kd-card aluno-detalhe');
  const acao = p.status === 'ativo' ? 'Alterar plano' : 'Escolher plano';
  painel.append(topo, datas, beneficios, botao(acao, '/escolher-plano.html', true));
  if (p.status === 'ativo' && p.unidade) {
    painel.append(elemento('p', 'Unidade vinculada · ' + p.unidade.nome, 'kd-texto-suave'));
  }
  if (p.status === 'ativo' && p.mostra_todas_unidades && p.todas_unidades?.length) {
    const lista = elemento('details');
    lista.append(elemento('summary', 'Unidades disponíveis'));
    const itens = elemento('ul', null, 'aluno-lista');
    function exibirUnidades(unidades) {
      itens.replaceChildren(...unidades.map(unidade => elemento('li',
        [unidade.nome, unidade.endereco, unidade.cidade, unidade.horario, unidade.telefone].filter(Boolean).join(' · '))));
    }
    exibirUnidades(p.todas_unidades);
    lista.addEventListener('toggle', () => {
      if (lista.open) contexto.dados.ler('unidades').then(exibirUnidades).catch(() => {});
    });
    lista.append(itens);
    painel.append(lista);
  }
  return painel;
}

export function faturas(raiz, contexto) {
  titulo(raiz, 'Faturas', 'Assinatura, pendências e histórico de pagamentos.');
  const resumo = elemento('div', null, 'kd-grid kd-grid-dois');
  const plano = elemento('div');
  const pendencias = elemento('div', null, 'kd-card aluno-detalhe');
  pendencias.append(elemento('h2', 'Pendências'));
  const verificar = elemento('button', 'Verificar pagamento', 'kd-button');
  verificar.type = 'button';
  verificar.addEventListener('click', () => contexto.verificarPagamento());
  const historico = elemento('div');
  const pendente = contexto.pagamento;
  pendencias.append(elemento('p', pendente?.mensagem || 'Acompanhe abaixo os pagamentos que ainda aguardam confirmação.', 'kd-texto-suave'));
  if (pendente?.url) pendencias.append(botao('Retomar checkout', pendente.url));
  if (localStorage.getItem('checkout_tentativa_id') && !contexto.verificando) pendencias.append(verificar);
  contexto.dados.ler('historico').then(lista => {
    const total = lista.filter(item => item.status === 'pending').length;
    if (total) pendencias.append(badge(`${total} ${total === 1 ? 'pendência' : 'pendências'} no extrato`, 'atencao'));
  }).catch(() => {});
  resumo.append(plano, pendencias);
  const area = elemento('section', null, 'kd-card aluno-detalhe aluno-area');
  area.append(elemento('h2', 'Extrato de transações'), historico);
  raiz.append(resumo, area);
  carregar(plano, contexto, 'plano', p => plano.replaceChildren(detalhesPlano(p, contexto)));
  carregar(historico, contexto, 'historico', lista => historico.replaceChildren(tabelaHistorico(lista)));
}

async function normalizarFoto(arquivo) {
  if (!['image/png', 'image/jpeg'].includes(arquivo?.type) || arquivo.size > 5 * 1024 * 1024) {
    throw new Error('Selecione uma imagem JPEG ou PNG de até 5 MB.');
  }
  const imagem = await createImageBitmap(arquivo).catch(() => { throw new Error('Não foi possível ler a imagem.'); });
  try {
    const escala = Math.min(1, 320 / Math.max(imagem.width, imagem.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(imagem.width * escala));
    canvas.height = Math.max(1, Math.round(imagem.height * escala));
    canvas.getContext('2d').drawImage(imagem, 0, 0, canvas.width, canvas.height);
    const png = await new Promise(resolver => canvas.toBlob(resolver, 'image/png'));
    if (!png) throw new Error('Não foi possível converter a imagem.');
    return png;
  } finally { imagem.close(); }
}

function formularioPerfil(perfil, contexto) {
  const form = elemento('form', null, 'kd-form');
  form.innerHTML = `
    <label>Nome<input class="kd-input" name="nome" maxlength="120" autocomplete="name" required></label>
    <label>E-mail<input class="kd-input" name="email" type="email" readonly></label>
    <label>Data de nascimento<input class="kd-input" name="nascimento" readonly></label>
    <div><button class="kd-button kd-button-primario">Salvar nome</button></div>
    <p class="kd-feedback" role="status"></p>`;
  form.elements.nome.value = perfil.nome;
  form.elements.email.value = perfil.email;
  form.elements.nascimento.value = perfil.data_nascimento ? dia(perfil.data_nascimento) : 'Não informada';
  form.addEventListener('submit', async evento => {
    evento.preventDefault();
    const botao = form.querySelector('button');
    botao.disabled = true;
    try {
      const { usuario } = await enviar('/api/usuario/perfil', { nome: form.elements.nome.value }, 'PUT');
      contexto.usuario.nome = form.elements.nome.value = usuario.nome;
      contexto.dados.invalidar('perfil');
      contexto.atualizarIdentidade();
      feedback(form, 'Nome atualizado.');
    } catch (falha) {
      feedback(form, falha.message, true);
    } finally { botao.disabled = false; }
  });
  return form;
}

function fotoPerfil(contexto) {
  const bloco = elemento('div', null, 'aluno-detalhe');
  bloco.innerHTML = `
    <div class="aluno-perfil-topo"><span class="kd-avatar aluno-perfil-avatar" data-avatar aria-hidden="true"></span><div class="aluno-acoes">
      <button class="kd-button" type="button" data-foto>Alterar foto</button>
      <button class="kd-button" type="button" data-remover-foto>Remover foto</button>
    </div></div>
    <p class="kd-feedback" role="status"></p>
    <dialog class="kd-card kd-dialog" aria-labelledby="selecionar-foto">
      <form class="kd-form">
        <h2 id="selecionar-foto">Foto de perfil</h2>
        <label>Imagem JPEG ou PNG, até 5 MB<input class="kd-input" type="file" accept="image/jpeg,image/png" required></label>
        <p class="kd-feedback" role="status"></p>
        <div class="aluno-acoes">
          <button class="kd-button kd-button-primario">Salvar foto</button>
          <button class="kd-button" type="button" data-fechar>Cancelar</button>
        </div>
      </form>
    </dialog>`;
  const dialog = bloco.querySelector('dialog');
  const form = dialog.querySelector('form');
  const remover = bloco.querySelector('[data-remover-foto]');
  remover.disabled = !contexto.foto;
  const abrir = () => {
    form.reset();
    feedback(form, '');
    dialog.showModal();
  };
  bloco.querySelector('[data-foto]').addEventListener('click', abrir);
  if (location.hash === '#configuracoes/foto') queueMicrotask(() => { if (bloco.isConnected) abrir(); });
  bloco.querySelector('[data-fechar]').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', async evento => {
    evento.preventDefault();
    const salvar = form.querySelector('button');
    salvar.disabled = true;
    try {
      const png = await normalizarFoto(form.querySelector('input').files[0]);
      await api('/api/usuario/perfil/foto', { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: png });
      await contexto.carregarFoto();
      contexto.dados.invalidar('perfil');
      remover.disabled = !contexto.foto;
      feedback(bloco, 'Foto atualizada.');
      dialog.close();
    } catch (falha) {
      feedback(form, falha.message, true);
    } finally { salvar.disabled = false; }
  });
  remover.addEventListener('click', async () => {
    remover.disabled = true;
    try {
      await api('/api/usuario/perfil/foto', { method: 'DELETE' });
      contexto.definirFoto(null);
      contexto.dados.invalidar('perfil');
      feedback(bloco, 'Foto removida.');
    } catch (falha) {
      feedback(bloco, falha.message, true);
      remover.disabled = false;
    }
  });
  return bloco;
}

export function configuracoes(raiz, contexto) {
  titulo(raiz, 'Configurações', 'Gerencie seu perfil, sua foto e a segurança da conta.');
  const pessoal = elemento('div');
  const acoes = elemento('div', null, 'aluno-acoes');
  if (contexto.usuario.possuiSenhaLocal) acoes.append(botao('Alterar senha', '/configuracoes-conta.html#alterar'));
  if (contexto.usuario.podeVincularGoogle) acoes.append(botao('Vincular Google', '/configuracoes-conta.html#vincular-google'));
  const sair = elemento('button', 'Encerrar sessão', 'kd-button');
  sair.type = 'button';
  sair.dataset.sair = '';
  acoes.append(sair);
  const seguranca = card('Segurança da conta', contexto.usuario.possuiSenhaLocal ? acoes :
    elemento('p', 'A senha desta conta é gerenciada pelo Google.', 'kd-texto-suave'));
  if (!contexto.usuario.possuiSenhaLocal) seguranca.append(acoes);
  const lateral = elemento('div', null, 'kd-grid');
  lateral.append(card('Foto de perfil', fotoPerfil(contexto)), seguranca);
  const colunas = elemento('div', null, 'kd-grid kd-grid-dois');
  colunas.append(card('Dados pessoais', pessoal), lateral);
  raiz.append(colunas);
  carregar(pessoal, contexto, 'perfil', perfil => pessoal.replaceChildren(formularioPerfil(perfil, contexto)));
}

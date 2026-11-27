import { agendaPainel, fichaPublicada } from './profissionais-views.js';
import { api, dia, eliteAtivo, profissional, quando, reais } from './aluno-dados.js';
import { calendarioTreinos, historicoTreinos, registrarTreino } from './aluno-treinos.js';
import { badge, elemento, erro, estado, icone } from './design-system.js';
import { montarEditorPerfil } from './perfil-pessoal.js';

const planos = { basico: 'Básico', pro: 'Pro', elite: 'Elite' };
const preco = { basico: 8900, pro: 14900, elite: 24900 };
const situacoesPlano = {
  ativo: ['Ativo', 'positivo'], inativo: ['Inativo', 'erro'], vencido: ['Vencido', 'atencao'],
};
const situacoesTransacao = {
  approved: ['Aprovada', 'positivo'], pending: ['Pendente', 'atencao'], rejected: ['Recusada', 'erro'],
};
const situacoesDocumento = { processando: ['Processando', 'atencao'], disponivel: ['Disponível', 'positivo'], falhou: ['Falha no processamento', 'erro'] };
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
  apresentacao.append(saudacao, elemento('p', 'Acompanhe seu plano e seus treinos.', 'kd-texto-suave'));
  hero.append(avatar, apresentacao);
  raiz.append(hero);

  const resumo = elemento('div', null, 'kd-grid aluno-resumo');
  const plano = elemento('div', null, 'aluno-resumo-plano');
  const agenda = elemento('div', null, 'aluno-resumo-agenda');
  const frequencia = card('Frequência semanal', calendarioTreinos());
  frequencia.classList.add('aluno-resumo-frequencia');
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
    ['faturas', 'Faturas', 'receipt'], ['arquivos', 'Documentos', 'file-earmark-pdf'],
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
  if (chave === 'treinos') {
    raiz.append(card('Treino de hoje', registrarTreino()));
    return;
  }
  if (chave === 'progresso') {
    raiz.append(card('Frequência semanal', calendarioTreinos()), card('Evolução da frequência', historicoTreinos()),
      card('Peso, medidas e avaliações', estado(vazio, explicacao)));
    return;
  }
  if (chave === 'nutricao') {
    const painel = elemento('div');
    raiz.append(painel);
    carregar(painel, contexto, 'plano', async p => {
      if (!eliteAtivo(p)) {
        painel.replaceChildren(card('Acompanhamento com o Elite',
          elemento('p', 'O Elite inclui consultas com nutricionista e acesso aos materiais personalizados quando disponibilizados.'),
          botao('Conhecer ou alterar plano', '#faturas')));
        return;
      }
      painel.replaceChildren(card('Agendamento', botao('Agendar consulta', '#agendamentos')));
      await materiaisProfissionais(painel, contexto, 'nutricionista', 'Planos alimentares');
    });
    return;
  }
  const corpo = estado(vazio, explicacao);
  const bloco = card(nome, corpo);
  bloco.prepend(icone(desenho));
  raiz.append(bloco);
  if (chave === 'treinos-extras') {
    const area = elemento('div');
    raiz.append(area);
    carregar(area, contexto, 'plano', async p => {
      if (!eliteAtivo(p)) return area.replaceChildren(card('Materiais personalizados', elemento('p', 'Disponíveis para alunos com plano Elite ativo.'), botao('Consultar meu plano', '#faturas')));
      await materiaisProfissionais(area, contexto, 'personal', 'Fichas personalizadas');
    });
  }
}

async function materiaisProfissionais(destino, contexto, tipo, tituloLista) {
  const atualizar = elemento('button', 'Atualizar materiais', 'kd-button');
  atualizar.type = 'button';
  const lista = elemento('div');
  const carregarMateriais = async () => {
    lista.replaceChildren(estado('Carregando materiais…'));
    try {
      const [fichas, documentos] = await Promise.all([
        api('/api/profissionais/fichas?tipo=' + tipo), api('/api/profissionais/documentos'),
      ]);
      lista.replaceChildren();
      const pdfs = documentos.filter(item => item.tipo === tipo);
      if (!fichas.length && !pdfs.length) return lista.append(estado('Nenhum material disponível.', 'Quando o profissional publicar materiais, eles aparecerão aqui.'));
      const blocoFichas = card(tituloLista);
      for (const ficha of fichas) {
        const registro = fichaPublicada(ficha);
        const profissionalNome = ficha.profissional?.nome || 'Profissional vinculado';
        registro.prepend(elemento('p', `${profissionalNome} · Atualizada em ${dia(ficha.atualizado_em || ficha.criado_em)}`, 'kd-texto-suave'));
        blocoFichas.append(registro);
      }
      if (fichas.length) lista.append(blocoFichas);
      for (const documento of pdfs) {
        const registro = card(documento.titulo,
          elemento('p', `${documento.profissional?.nome || 'Profissional vinculado'} · ${dia(documento.disponibilizado_em || documento.criado_em)}`, 'kd-texto-suave'),
          badge(...(situacoesDocumento[documento.situacao] || [documento.situacao])));
        if (documento.situacao === 'disponivel') {
          const baixar = elemento('button', 'Baixar PDF', 'kd-button kd-button-primario');
          baixar.type = 'button';
          baixar.addEventListener('click', async () => {
            baixar.disabled = true;
            try {
              const arquivo = await api(`/api/profissionais/documentos/${documento.id}/arquivo`);
              const url = URL.createObjectURL(arquivo); const link = elemento('a', '');
              link.href = url; link.download = `krypton-documento-${documento.id}.pdf`;
              document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
            } catch (falha) { erro(registro, falha.message, carregarMateriais); }
            finally { baixar.disabled = false; }
          });
          registro.append(baixar);
        }
        lista.append(registro);
      }
    } catch (falha) { erro(lista, falha.message, carregarMateriais); }
  };
  atualizar.addEventListener('click', carregarMateriais);
  destino.append(card(tituloLista, atualizar), lista);
  await carregarMateriais();
}

export async function documentos(raiz) {
  titulo(raiz, 'Documentos profissionais', 'Consulte e baixe os materiais disponibilizados pelos profissionais vinculados.');
  const area = elemento('div');
  const filtro = elemento('select', null, 'kd-input');
  filtro.setAttribute('aria-label', 'Filtrar documentos por categoria');
  for (const [valor, texto] of [['todos', 'Todos os documentos'], ['personal', 'Treino'], ['nutricionista', 'Alimentação']]) filtro.append(new Option(texto, valor));
  const atualizar = elemento('button', 'Atualizar status', 'kd-button');
  atualizar.type = 'button';
  atualizar.addEventListener('click', carregar);
  filtro.addEventListener('change', carregar);
  raiz.append(filtro, atualizar, area);
  await carregar();

  async function carregar() {
    area.replaceChildren(estado('Carregando documentos…'));
    try {
      const itens = (await api('/api/profissionais/documentos')).filter(item => filtro.value === 'todos' || item.tipo === filtro.value);
      area.replaceChildren();
      if (!itens.length) return area.append(estado('Nenhum documento profissional disponível.', 'Quando um profissional publicar um documento, ele aparecerá aqui.'));
      for (const documento of itens) {
        const tipo = documento.tipo === 'personal' ? 'Treino' : 'Alimentação';
        const cartao = card(documento.titulo,
          elemento('p', `${tipo} · ${documento.profissional?.nome || 'Profissional'} · ${dia(documento.criado_em)}`, 'kd-texto-suave'),
          badge(...(situacoesDocumento[documento.situacao] || [documento.situacao])));
        if (documento.situacao === 'disponivel') {
          const baixar = elemento('button', 'Baixar PDF', 'kd-button kd-button-primario');
          baixar.type = 'button';
          baixar.addEventListener('click', async () => {
            baixar.disabled = true;
            try {
              const arquivo = await api(`/api/profissionais/documentos/${documento.id}/arquivo`);
              const url = URL.createObjectURL(arquivo);
              const link = elemento('a', '');
              link.href = url;
              link.download = `krypton-documento-${documento.id}.pdf`;
              document.body.append(link);
              link.click();
              link.remove();
              setTimeout(() => URL.revokeObjectURL(url), 60_000);
            } catch (falha) { erro(cartao, falha.message, carregar); }
            finally { baixar.disabled = false; }
          });
          cartao.append(baixar);
        }
        area.append(cartao);
      }
    } catch (falha) {
      if (falha.status === 403) area.replaceChildren(estado('Documentos disponíveis para plano Elite ativo.', 'A elegibilidade é verificada pela API.'));
      else erro(area, falha.message, carregar);
    }
  }
}

export function agendamentos(raiz, contexto) {
  titulo(raiz, 'Agendamentos', 'Consulte suas sessões e agende os serviços do plano Elite.');
  const area = elemento('div');
  raiz.append(area);
  async function atualizar() {
    area.replaceChildren(estado('Carregando consultas…'));
    const conteudo = elemento('div');
    try {
      const plano = await contexto.dados.ler('plano');
      await agendaPainel(conteudo, contexto.usuario, atualizar, eliteAtivo(plano));
      area.replaceChildren(conteudo);
    } catch { erro(area, 'Não foi possível consultar a agenda.', atualizar); }
  }
  atualizar();
}

function tabelaHistorico(lista) {
  const area = elemento('div', null, 'aluno-detalhe');
  if (!lista.length) {
    area.append(estado('Nenhuma transação registrada.'));
    return area;
  }
  area.innerHTML = `
    <div class="kd-form aluno-filtros">
      <label><span id="rotulo-metodo">Método</span><select aria-labelledby="rotulo-metodo" class="kd-input" name="metodo"><option value="">Todos os métodos</option><option value="qr_krypton">QR Code Krypton</option><option value="mercadopago_simulado">Mercado Pago simulado</option><option value="mercadopago_teste">Mercado Pago teste externo</option><option value="mercadopago">Mercado Pago financeiro</option></select></label>
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
  const metodo = t => t.origem === 'mercadopago_test' ? 'mercadopago_teste' : t.tentativa?.metodo || (t.origem === 'demo' ? 'qr_krypton' : t.origem === 'demo_mercadopago' ? 'mercadopago_simulado' : t.origem);
  const temSimulacao = lista.some(t => ['demo', 'demo_mercadopago'].includes(t.origem));
  const temFinanceiro = lista.some(t => t.origem === 'mercadopago');
  if (temSimulacao) area.prepend(elemento('p', temFinanceiro
    ? 'QR Code Krypton e Mercado Pago simulado são operações acadêmicas sem cobrança real.'
    : 'Operações de demonstração. Sem cobrança real.', 'kd-texto-suave'));

  function filtrar() {
    corpo.replaceChildren();
    const itens = lista.filter(t => (!tipo.value || tipo.value === metodo(t)) && (!status.value || status.value === t.status));
    const nomes = {
      qr_krypton: 'PIX Krypton', mercadopago_simulado: 'Mercado Pago simulado',
      mercadopago_teste: 'Mercado Pago teste externo', mercadopago: 'Mercado Pago',
    };
    for (const t of itens) {
      const tr = elemento('tr');
      const nome = nomes[metodo(t)] || 'Outro método';
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

export function configuracoes(raiz, contexto) {
  titulo(raiz, 'Configurações', 'Gerencie seu perfil, sua foto e a segurança da conta.');
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
  const colunas = elemento('div', null, 'kd-grid kd-grid-dois');
  const perfil = montarEditorPerfil(contexto.usuario, {
    aoAtualizarNome: () => { contexto.dados.invalidar('perfil'); contexto.atualizarIdentidade(); },
    aoAtualizarFoto: blob => { contexto.dados.invalidar('perfil'); contexto.definirFoto(blob); },
  });
  colunas.append(perfil, seguranca);
  raiz.append(colunas);
}

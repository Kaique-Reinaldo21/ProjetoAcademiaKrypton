import { gerirProfissionais } from './admin-profissionais.js';
import { api, dia, profissional, quando } from './aluno-dados.js';
import { badge, elemento, erro, estado, graficoBarras, icone, itemAcaoConta } from './design-system.js';
import { montarEditorPerfil } from './perfil-pessoal.js';

const buscar = caminho => api('/api/admin/' + caminho);
const planos = { basico: 'Básico', pro: 'Pro', elite: 'Elite' };
const papeis = { admin: 'Administrador', aluno: 'Aluno', personal: 'Personal trainer', nutricionista: 'Nutricionista' };
const status = { approved: ['Aprovado', 'positivo'], pending: ['Pendente', 'atencao'], rejected: ['Recusado', 'erro'] };
const origens = { demo: 'QR Code Krypton', demo_mercadopago: 'Mercado Pago simulado', mercadopago: 'Mercado Pago financeiro' };
const financeiro = origem => origem === 'mercadopago';
const moeda = (centavos, codigo) => /^[A-Z]{3}$/.test(codigo)
  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: codigo }).format(centavos / 100)
  : '—';
const hora = data => data ? quando(data) : '—';

function cabecalho(raiz, titulo, legenda) {
  const topo = elemento('header', null, 'admin-topo');
  topo.append(elemento('h1', titulo), elemento('p', legenda, 'kd-texto-suave'));
  raiz.append(topo);
}

function cartao(titulo, conteudo) {
  const area = elemento('section', null, 'kd-card admin-card');
  area.append(elemento('h2', titulo), conteudo);
  return area;
}

function link(texto, href) {
  const item = elemento('a', texto, 'kd-button');
  item.href = href;
  return item;
}

function fonte(caminho) {
  let consulta;
  return () => consulta ??= buscar(caminho).finally(() => { consulta = undefined; });
}

function carregar(consulta, desenhar) {
  const area = elemento('div');
  async function ler() {
    area.replaceChildren(estado('Carregando…'));
    try {
      const dados = await consulta();
      if (area.isConnected) area.replaceChildren(desenhar(dados));
    } catch {
      if (area.isConnected) erro(area, 'Tente novamente para consultar os dados.', ler);
    }
  }
  ler();
  return area;
}

function tabela(titulo, colunas, linhas, vazio) {
  if (!linhas.length) return estado(vazio);
  const area = elemento('div', null, 'kd-tabela-scroll');
  area.tabIndex = 0;
  area.setAttribute('role', 'region');
  area.setAttribute('aria-label', titulo);
  const table = elemento('table', null, 'kd-tabela admin-tabela');
  const topo = table.createTHead().insertRow();
  for (const rotulo of colunas) {
    const th = elemento('th', rotulo);
    th.scope = 'col';
    topo.append(th);
  }
  const corpo = table.createTBody();
  for (const valores of linhas) {
    const linha = corpo.insertRow();
    for (const valor of valores) linha.insertCell().append(valor instanceof Node ? valor : String(valor ?? '—'));
  }
  area.append(table);
  return area;
}

function transacoes(lista) {
  return tabela('Transações registradas', ['Data', 'Método e origem', 'Plano', 'Valor', 'Situação'],
    lista.map(t => [hora(t.criado_em), origens[t.origem] || 'Origem não classificada',
      planos[t.tentativa?.tipo], moeda(t.valor_centavos, t.moeda),
      badge(...(status[t.status] || ['Outro estado']))]), 'Nenhuma transação encontrada.');
}

function atividades(lista) {
  return tabela('Atividades administrativas', ['Data', 'Ação', 'Administrador', 'Conta afetada'],
    lista.map(a => [hora(a.criado_em), 'Recuperação administrativa de conta', '#' + a.autor_id, '#' + a.usuario_id]),
    'Nenhuma atividade administrativa registrada.');
}

function grafico(serie, titulo, tipo, instancias) {
  if (!serie.length || !serie.some(p => p.valor > 0)) return estado('Nenhum registro no período.');
  if (!window.Chart) return graficoBarras(serie, titulo);

  const container = elemento('div');
  const visual = elemento('div', null, 'admin-grafico');
  const canvas = elemento('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  visual.append(canvas);
  const dados = elemento('details');
  dados.append(elemento('summary', 'Ver dados do gráfico'), graficoBarras(serie, titulo));
  container.append(visual, dados);
  const dataset = {
    label: titulo, data: serie.map(item => item.valor),
    backgroundColor: tipo === 'doughnut' ? ['#a7b0aa', '#2DFF7A', '#8B5CF6'] : '#1AD962',
    borderColor: tipo === 'doughnut' ? '#141615' : '#2DFF7A', tension: .2,
  };
  instancias.push(new window.Chart(canvas, {
    type: tipo, data: { labels: serie.map(item => item.rotulo), datasets: [dataset] },
    options: {
      maintainAspectRatio: false, animation: false, color: '#a7b0aa',
      plugins: { legend: { display: tipo === 'doughnut', position: 'bottom' } },
      ...(tipo === 'line' && { scales: { x: { ticks: { color: "#a7b0aa" } }, y: { beginAtZero: true, ticks: { precision: 0, color: "#a7b0aa" }, grid: { color: "#2b302d" } } } }),
    },
  }));
  return container;
}

function distribuicao(dados, instancias) {
  if (!Array.isArray(dados.planos_por_tipo)) throw new Error('Distribuição indisponível.');
  const serie = Object.entries(planos).map(([tipo, rotulo]) => ({
    rotulo, valor: dados.planos_por_tipo.find(plano => plano.tipo === tipo)?.quantidade || 0,
  }));
  return grafico(serie, 'Planos ativos por tipo', 'doughnut', instancias);
}

function cadastros(dados, instancias) {
  const serie = dados.cadastros.map(item => ({ rotulo: dia(item.data).slice(0, 5), valor: item.quantidade }));
  return grafico(serie, 'Cadastros por dia', 'line', instancias);
}

function cardsIndicadores({ resumo, indicadores: i }) {
  const area = elemento('div', null, 'kd-grid admin-indicadores');
  const valores = [
    ['people', 'Total de alunos', resumo?.total_alunos, 'Contas de aluno'],
    ['person-check', 'Alunos ativos', i?.ativos, 'Com plano ativo'],
    ['person-plus', 'Novos cadastros', i?.novos, 'Últimos sete dias'],
    ['clock-history', 'Pagamentos pendentes', i?.pendentes, 'Transações registradas'],
    ['calendar2-week', 'Planos a vencer', i?.vencimentos, 'Próximos sete dias'],
    ['calendar-event', 'Agendamentos', i?.agendamentos, 'Próximos sete dias'],
  ];
  for (const [simbolo, nome, valor, legenda] of valores) {
    const item = elemento('section', null, 'kd-card admin-metrica');
    const exibicao = valor == null ? elemento('p', 'Indisponível') : elemento('strong', valor, 'kd-display');
    item.append(icone(simbolo), elemento('h2', nome), exibicao, elemento('p', legenda, 'kd-texto-suave'));
    area.append(item);
  }
  return area;
}

function valoresAprovados({ valores }) {
  if (!Array.isArray(valores)) throw new Error('Valores indisponíveis.');
  const area = elemento('div', null, 'kd-grid admin-valores');
  for (const [nome, filtrar] of [
    ['Simulados', item => ['demo', 'demo_mercadopago'].includes(item.origem)],
    ['Financeiros', item => financeiro(item.origem)],
  ]) {
    const totais = new Map();
    for (const item of valores.filter(filtrar)) {
      totais.set(item.moeda, (totais.get(item.moeda) ?? 0) + item.valor_centavos);
    }
    const valor = [...totais].map(([codigo, centavos]) => moeda(centavos, codigo)).join(' · ');
    const item = elemento('div', null, 'admin-total');
    item.append(elemento('h3', nome), elemento('strong', valor || 'Nenhum valor aprovado', 'kd-display'));
    area.append(item);
  }
  area.append(elemento('p', 'Histórico acumulado de transações aprovadas. Simulações não geram receita.', 'kd-texto-suave'));
  return area;
}

function areaGraficos(lerResumo = fonte('resumo')) {
  const area = elemento('div', null, 'kd-grid kd-grid-dois');
  const graficos = [];
  area.append(cartao('Distribuição dos planos', carregar(lerResumo, dados => distribuicao(dados, graficos))),
    cartao('Evolução dos cadastros', carregar(() => buscar('cadastros-semana'), dados => cadastros(dados, graficos))));
  return { area, destruir: () => graficos.forEach(chart => chart.destroy()) };
}

function visaoGeral(raiz) {
  cabecalho(raiz, 'Visão geral', 'Acompanhe alunos, planos e operações da academia.');
  const lerResumo = fonte('resumo');
  const lerIndicadores = fonte('indicadores');
  const { area, destruir } = areaGraficos(lerResumo);
  raiz.append(carregar(async () => {
    const [resumo, indicadores] = await Promise.allSettled([lerResumo(), lerIndicadores()]);
    if (resumo.status === 'rejected' && indicadores.status === 'rejected') throw new Error('Indicadores indisponíveis.');
    return { resumo: resumo.value, indicadores: indicadores.value };
  }, cardsIndicadores));
  raiz.append(cartao('Valores transacionados', carregar(lerIndicadores, valoresAprovados)), area);
  const recentes = elemento('div', null, 'kd-grid kd-grid-dois');
  recentes.append(
    cartao('Pagamentos recentes', carregar(() => buscar('pagamentos'), lista => transacoes(lista.slice(0, 5)))),
    cartao('Atividades administrativas', carregar(() => buscar('auditoria'), dados => atividades(dados.atividades.slice(0, 5)))),
  );
  raiz.append(recentes);
  return destruir;
}

function alunos(raiz) {
  cabecalho(raiz, 'Alunos', 'Consulte cadastros e a situação das assinaturas.');
  const form = elemento('form', null, 'kd-form admin-filtros');
  form.innerHTML = '<label>Nome ou e-mail<input class="kd-input" name="busca" type="search" maxlength="180"></label><button class="kd-button">Buscar</button>';
  const area = elemento('div');
  const card = cartao('Cadastros', form);
  card.append(area);
  raiz.append(card);
  const hoje = new Date().toISOString().slice(0, 10);
  let pagina = 1;
  let busca = '';
  function listar() {
    const filtros = new URLSearchParams({ pagina, busca });
    area.replaceChildren(carregar(() => buscar('alunos?' + filtros), dados => {
      const conteudo = elemento('div');
      conteudo.append(tabela('Alunos', ['Nome', 'E-mail', 'Cadastro', 'Plano', 'Situação'],
        dados.alunos.map(a => [
          a.nome, a.email, dia(a.created_at), planos[a.plano],
          badge(!a.plano ? 'Sem plano' : !a.ativo ? 'Inativo' : a.vencimento?.slice(0, 10) < hoje ? 'Vencido' : 'Ativo'),
        ]), 'Nenhum aluno encontrado.'));
      const nav = elemento('div', null, 'admin-paginacao');
      nav.append(elemento('span', 'Página ' + pagina));
      for (const [nome, delta, habilitado] of [['Anterior', -1, pagina > 1], ['Próxima', 1, dados.tem_proxima]]) {
        const botao = elemento('button', nome, 'kd-button');
        botao.type = 'button';
        botao.disabled = !habilitado;
        botao.addEventListener('click', () => { pagina += delta; listar(); });
        nav.append(botao);
      }
      conteudo.append(nav);
      return conteudo;
    }));
  }
  form.addEventListener('submit', evento => {
    evento.preventDefault();
    busca = form.elements.busca.value.trim();
    pagina = 1;
    listar();
  });
  listar();
}

function pagamentos(raiz) {
  cabecalho(raiz, 'Pagamentos', 'Consulte as últimas 100 transações registradas.');
  raiz.append(cartao('Valores transacionados', carregar(() => buscar('indicadores'), valoresAprovados)),
    cartao('Histórico', carregar(() => buscar('pagamentos'), lista => {
      const area = elemento('div', null, 'admin-card');
      const filtros = elemento('div', null, 'kd-form admin-filtros');
      filtros.innerHTML = '<label for="admin-origem">Origem</label><select class="kd-input" id="admin-origem"><option value="">Todas</option><option value="sim">Simulações</option><option value="real">Financeiras</option></select><label for="admin-status">Situação</label><select class="kd-input" id="admin-status"><option value="">Todas</option><option value="approved">Aprovadas</option><option value="pending">Pendentes</option><option value="rejected">Recusadas</option></select>';
      const tabelaFiltrada = elemento('div');
      const [origem, situacao] = filtros.querySelectorAll('select');
      function filtrar() {
        tabelaFiltrada.replaceChildren(transacoes(lista.filter(t => (!situacao.value || t.status === situacao.value) &&
          (!origem.value || (origem.value === 'real' ? financeiro(t.origem) : ['demo', 'demo_mercadopago'].includes(t.origem))))));
      }
      filtros.addEventListener('change', filtrar);
      area.append(filtros, tabelaFiltrada);
      filtrar();
      return area;
    })));
}

function visualizarPlanos(raiz) {
  cabecalho(raiz, 'Planos', 'Valores atuais e vencimentos mais próximos.');
  raiz.append(cartao('Catálogo', carregar(() => buscar('resumo'), dados =>
    tabela('Catálogo de planos', ['Plano', 'Mensalidade', 'Planos ativos'], Object.entries(planos).map(([tipo, nome]) =>
      [nome, moeda(dados.precos[tipo] * 100, 'BRL'), dados.planos_por_tipo?.find(p => p.tipo === tipo)?.quantidade ?? (Array.isArray(dados.planos_por_tipo) ? 0 : 'Indisponível')]), 'Nenhum plano.'))),
  cartao('Próximos vencimentos', carregar(() => buscar('vencimentos'), dados =>
    tabela('Próximos vencimentos', ['Aluno', 'Plano', 'Vencimento'],
      dados.vencimentos.map(v => [v.nome, planos[v.tipo], dia(v.vencimento)]), 'Nenhum vencimento próximo.'))));
}

function agendamentos(raiz) {
  cabecalho(raiz, 'Agendamentos', 'Consulte as próximas seis sessões registradas.');
  raiz.append(cartao('Próximas sessões', carregar(() => buscar('agendamentos-proximos'), dados =>
    tabela('Próximas sessões', ['Aluno', 'Serviço', 'Data e hora'],
      dados.agendamentos.map(a => [a.nome, profissional(a.tipo), hora(a.data_hora)]), 'Nenhuma sessão futura.'))));
}

function unidades(raiz) {
  cabecalho(raiz, 'Unidades', 'Consulte os endereços e horários cadastrados.');
  raiz.append(cartao('Unidades da academia', carregar(() => buscar('unidades'), dados =>
    tabela('Unidades', ['Unidade', 'Cidade', 'Endereço', 'Horário', 'Telefone'],
      dados.unidades.map(u => [u.nome, u.cidade, u.endereco, u.horario, u.telefone]), 'Nenhuma unidade cadastrada.'))));
}

function relatorios(raiz) {
  cabecalho(raiz, 'Relatórios', 'Consulte a evolução dos cadastros e a distribuição dos planos.');
  const { area, destruir } = areaGraficos();
  raiz.append(area, cartao('Valores transacionados', carregar(() => buscar('indicadores'), valoresAprovados)));
  return destruir;
}

function auditoria(raiz) {
  cabecalho(raiz, 'Auditoria', 'Consulte ações administrativas e os últimos acessos registrados.');
  raiz.append(cartao('Atividades administrativas', carregar(() => buscar('auditoria'), dados => atividades(dados.atividades))),
    cartao('Acessos recentes', carregar(() => buscar('logins'), dados =>
      tabela('Acessos recentes', ['Data', 'Nome', 'Perfil'],
        dados.logins.map(l => [hora(l.data_login), l.nome, papeis[l.role]]), 'Nenhum acesso registrado.'))));
}

function configuracoes(raiz, conta, identidade) {
  cabecalho(raiz, 'Configurações', 'Gerencie a segurança da conta administrativa.');
  raiz.append(montarEditorPerfil(conta, {
    aoAtualizarNome: nome => identidade.atualizarNome(nome),
    aoAtualizarFoto: foto => identidade.definirFoto(foto),
  }));
  const acoes = elemento('div', null, 'kd-acoes-conta');
  if (conta.possuiSenhaLocal) acoes.append(itemAcaoConta('key', 'Alterar senha', 'Atualize a senha da conta administrativa.', link('Abrir', '/configuracoes-conta.html#alterar')),
    itemAcaoConta('shield-lock', 'Recuperação administrativa', 'Gerencie as opções protegidas de recuperação da conta.', link('Abrir', '/configuracoes-conta.html#administracao')));
  if (conta.podeVincularGoogle) acoes.append(itemAcaoConta('google', 'Vincular Google', 'Conecte sua conta Google com segurança.', link('Vincular', '/configuracoes-conta.html#vincular-google')));
  const sair = elemento('button', 'Encerrar sessão', 'kd-button');
  sair.type = 'button';
  sair.dataset.sair = '';
  acoes.append(itemAcaoConta('box-arrow-right', 'Encerrar sessão', 'Finalize o acesso neste dispositivo.', sair));
  raiz.append(cartao('Segurança da conta', acoes));
}

function funcionarios(raiz) {
  cabecalho(raiz, 'Funcionários', 'Gerencie contas profissionais e vínculos com alunos.');
  const area = elemento('div');
  raiz.append(area);
  return gerirProfissionais(area);
}

export const abas = {
  'visao-geral': ['Visão geral', visaoGeral], alunos: ['Alunos', alunos], funcionarios: ['Funcionários', funcionarios],
  pagamentos: ['Pagamentos', pagamentos], planos: ['Planos', visualizarPlanos], agendamentos: ['Agendamentos', agendamentos],
  unidades: ['Unidades', unidades], relatorios: ['Relatórios', relatorios], auditoria: ['Auditoria', auditoria],
  configuracoes: ['Configurações', configuracoes],
};

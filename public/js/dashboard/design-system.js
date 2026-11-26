export function elemento(tag, texto, classe) {
  const node = document.createElement(tag);
  if (texto != null) node.textContent = texto;
  if (classe) node.className = classe;
  return node;
}

export function icone(nome) {
  const node = elemento('i', null, 'bi bi-' + nome);
  node.setAttribute('aria-hidden', 'true');
  return node;
}

export function badge(texto, tom) {
  const node = elemento('span', texto, 'kd-badge');
  if (tom) node.dataset.tom = tom;
  return node;
}

export function estado(titulo, texto, tom) {
  const node = elemento('div', null, 'kd-estado');
  if (tom) node.dataset.tom = tom;
  node.setAttribute('role', tom === 'erro' ? 'alert' : 'status');
  node.append(elemento('strong', titulo));
  if (texto) node.append(elemento('p', texto));
  return node;
}

export function erro(node, mensagem, recarregar) {
  const aviso = estado('Não foi possível carregar.', mensagem, 'erro');
  if (recarregar) {
    const botao = elemento('button', 'Tentar novamente', 'kd-button');
    botao.type = 'button';
    botao.addEventListener('click', recarregar);
    aviso.append(botao);
  }
  node.replaceChildren(aviso);
}

export function configurarMenu(botao, menu, fundo, workspace) {
  const mobile = matchMedia('(max-width: 820px)');
  function mudar(aberto, devolverFoco = false) {
    menu.toggleAttribute('data-aberto', aberto);
    workspace.inert = aberto;
    fundo.hidden = !aberto;
    botao.setAttribute('aria-expanded', String(aberto));
    if (aberto) menu.querySelector('a[aria-current="page"]')?.focus();
    if (devolverFoco) botao.focus();
  }

  botao.addEventListener('click', () => mudar(!menu.hasAttribute('data-aberto')));
  fundo.addEventListener('click', () => mudar(false, true));
  document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && menu.hasAttribute('data-aberto')) mudar(false, true);
  });
  mobile.addEventListener('change', () => mudar(false));
  return () => mudar(false);
}

export function graficoBarras(serie, titulo) {
  if (!serie.length) return estado('Sem medições no momento.', 'Quando houver registros, eles aparecerão aqui.');
  const max = Math.max(1, ...serie.map(ponto => ponto.valor));
  const lista = elemento('ul', null, 'kd-chart');
  lista.setAttribute('aria-label', titulo);
  for (const { rotulo, valor } of serie) {
    const item = elemento('li');
    const barra = elemento('meter');
    barra.max = max;
    barra.value = valor;
    barra.setAttribute('aria-label', rotulo);
    item.append(elemento('span', rotulo), barra, elemento('span', String(valor)));
    lista.append(item);
  }
  return lista;
}

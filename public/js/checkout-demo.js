const params = new URLSearchParams(location.search);
const tentativa = params.get('tentativa');
const metodos = document.getElementById('metodos');
const selecao = document.getElementById('selecao');
const continuar = document.getElementById('continuar');
const opcaoExterna = document.getElementById('opcao-mp-externo');
const opcaoSimulada = document.getElementById('opcao-mp-simulado');
const tokenAluno = localStorage.getItem('token');
const endpoint = '/api/checkout/demo/' + encodeURIComponent(tentativa || '');
const headers = { 'Content-Type': 'application/json', ...(tokenAluno ? { Authorization: 'Bearer ' + tokenAluno } : {}) };
const situacao = document.getElementById('situacao');
const mensagem = document.getElementById('mensagem');
const imagem = document.getElementById('qr');
const copiar = document.getElementById('copiar');
const renovar = document.getElementById('renovar');
const validade = document.getElementById('validade');
const botoes = [...document.querySelectorAll('[data-acao]')];
const botoesMp = [...document.querySelectorAll('[data-resposta-mp]')];
const rotulos = { pending: 'Pendente', approved: 'Aprovada', rejected: 'Recusada' };
const beneficios = {
  basico: ['1 unidade exclusiva', 'Musculação completa', 'Área de cardio'],
  pro: ['Todas as unidades', 'Musculação e cardio ilimitados', 'Lutas e artes marciais', 'Quadras esportivas'],
  elite: ['Todas as unidades', 'Musculação, cardio e lutas', 'Quadras esportivas', 'Nutricionista incluso', 'Personal Trainer incluso'],
};
let metodo;
let link;
let expiraEm;
let encaminhando = false;
let ocupada = false;

async function api(caminho, opcoes = {}) {
  const resposta = await fetch(caminho, {
    headers,
    credentials: 'include',
    mode: 'same-origin',
    redirect: 'error',
    referrerPolicy: 'same-origin',
    cache: 'no-store',
    ...opcoes,
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || 'Checkout indisponível.');
  return dados;
}

function atualizarControles() {
  const expirado = Boolean(link && Date.now() >= expiraEm);
  metodos.disabled = Boolean(tentativa) || ocupada;
  continuar.disabled = ocupada;
  imagem.hidden = !link || expirado;
  copiar.disabled = !link || expirado || ocupada || encaminhando;
  renovar.disabled = ocupada || encaminhando || situacao.dataset.status !== 'pending';
  [...botoes, ...botoesMp].forEach(botao => { botao.disabled = renovar.disabled; });
  if (expirado) validade.textContent = 'Código expirado. Gere um novo para continuar.';
}

function mostrarStatus(status, concluir = false) {
  situacao.dataset.status = status;
  situacao.textContent = rotulos[status] || 'Indisponível';
  if (status !== 'pending' || concluir) {
    encaminhando = true;
    localStorage.setItem('checkout_tentativa_id', tentativa);
    setTimeout(() => location.replace('/dashboard.html'), status === 'approved' ? 1100 : 550);
  }
  atualizarControles();
}

async function gerar() {
  ocupada = true;
  atualizarControles();
  try {
    const dados = await api(endpoint + '/qr', { method: 'POST', body: '{}' });
    link = dados.link;
    expiraEm = Date.parse(dados.expiraEm);
    imagem.src = dados.imagem;
    validade.textContent = 'Válido até ' + new Date(expiraEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    mensagem.textContent = '';
  } catch (erro) {
    mensagem.textContent = erro.message;
  } finally {
    ocupada = false;
    atualizarControles();
  }
}

async function consultar(inicial = false) {
  if (encaminhando || ocupada) return;
  ocupada = true;
  try {
    const dados = await api(endpoint);
    if (inicial) {
      mostrarResumo(dados);
      metodo = dados.metodo;
      if (metodo === 'mercadopago') {
        opcaoExterna.hidden = false;
        opcaoSimulada.hidden = true;
        opcaoExterna.querySelector('input').value = 'mercadopago';
        mensagem.textContent = 'Aguardando confirmação da assinatura pelo Mercado Pago.';
        document.getElementById('nota-academica').textContent = 'Integração externa de teste.';
      }
      metodos.querySelectorAll('input').forEach(input => { input.checked = input.value === metodo; });
      document.getElementById('painel-qr').hidden = metodo !== 'qr_krypton';
      document.getElementById('ferramentas-qr').hidden = metodo !== 'qr_krypton';
      document.getElementById('painel-mp').hidden = metodo !== 'mercadopago_simulado';
    }
    mostrarStatus(dados.status);
  } catch (erro) {
    mensagem.textContent = erro.message;
  } finally {
    ocupada = false;
    atualizarControles();
  }
}

renovar.addEventListener('click', gerar);
copiar.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(link);
    mensagem.textContent = 'Link copiado.';
  } catch {
    mensagem.textContent = 'Não foi possível copiar. Use a câmera para ler o QR Code.';
  }
});

function mostrarResumo(dados) {
  document.getElementById('resumo').dataset.tipo = dados.tipo;
  document.getElementById('plano').textContent = dados.plano;
  document.getElementById('valor').textContent = (dados.valor_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const itens = (beneficios[dados.tipo] || []).map(texto => {
    const item = document.createElement('li');
    item.textContent = texto;
    return item;
  });
  document.getElementById('beneficios').replaceChildren(...itens);
}

function atualizarSelecao() {
  metodo = metodos.querySelector('input:checked').value;
  const externo = metodo === 'mercadopago_teste';
  const mercadoPago = externo || metodo === 'mercadopago_simulado';
  document.getElementById('nota-academica').textContent = externo ? 'Integração externa de teste.' : 'Simulação acadêmica. Sem cobrança real.';
  continuar.textContent = mercadoPago ? 'Continuar com Mercado Pago' : 'Continuar com QR Code';
  continuar.classList.toggle('primario', !mercadoPago);
  continuar.classList.toggle('primario-mp', mercadoPago);
  document.getElementById('instrucao-metodo').textContent = externo
    ? 'Abra o checkout do Mercado Pago com a conta de comprador de teste autorizada.' : mercadoPago
    ? 'Use respostas simuladas do Mercado Pago para testar a assinatura.'
    : 'Escaneie o QR Code pelo celular para aprovar a simulação.';
}

metodos.addEventListener('change', atualizarSelecao);
continuar.addEventListener('click', async () => {
  ocupada = true;
  atualizarControles();
  try {
    const dados = await api('/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ tipoPlano: params.get('plano'), unidade_id: params.get('unidade'), metodo }),
    });
    if (!dados.tentativaId) throw new Error('Tentativa indisponível.');
    if (metodo === 'mercadopago_teste') {
      const url = new URL(dados.url);
      if (url.protocol !== 'https:' || url.username || url.password || url.port ||
          !/^(?:[a-z0-9-]+\.)*mercadopago\.com(?:\.br)?$/.test(url.hostname)) throw new Error('URL de pagamento inválida.');
      localStorage.setItem('checkout_tentativa_id', dados.tentativaId);
      location.assign(url.href);
      return;
    }
    localStorage.setItem('checkout_tentativa_id', dados.tentativaId);
    location.replace('/checkout-demo.html?tentativa=' + encodeURIComponent(dados.tentativaId));
  } catch (erro) {
    mensagem.textContent = erro.message;
    ocupada = false;
    atualizarControles();
  }
});

[...botoes, ...botoesMp].forEach(botao => botao.addEventListener('click', async () => {
  ocupada = true;
  atualizarControles();
  try {
    const mercadoPago = metodo === 'mercadopago_simulado';
    const dados = await api(endpoint + (mercadoPago ? '/mercadopago' : ''), {
      method: 'POST',
      body: JSON.stringify({ acao: mercadoPago ? botao.dataset.respostaMp : botao.dataset.acao }),
    });
    mostrarStatus(dados.status, !mercadoPago);
  } catch (erro) {
    mensagem.textContent = erro.message;
  } finally {
    ocupada = false;
    atualizarControles();
  }
}));

async function iniciar() {
  if (!tentativa) {
    try {
      const tipo = params.get('plano');
      if (!tipo) throw new Error('Tentativa indisponível.');
      const resumo = await api('/api/checkout/demo/planos/' + encodeURIComponent(tipo));
      mostrarResumo(resumo);
      if (resumo.mercadoPagoExterno) {
        opcaoExterna.hidden = false;
        opcaoSimulada.hidden = true;
        opcaoSimulada.querySelector('input').disabled = true;
        opcaoExterna.querySelector('input').checked = true;
      }
      atualizarSelecao();
      situacao.textContent = 'Escolha o método de pagamento';
      selecao.hidden = false;
      atualizarControles();
    } catch (erro) {
      situacao.textContent = 'Checkout indisponível';
      mensagem.textContent = erro.message;
    }
    return;
  }
  await consultar(true);
  if (metodo === 'qr_krypton' && situacao.dataset.status === 'pending') await gerar();
  if (situacao.dataset.status) setInterval(consultar, 2500);
}
iniciar();

const tentativa = new URLSearchParams(location.search).get('tentativa');
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
const rotulos = { pending: 'Pendente', approved: 'Aprovada', rejected: 'Recusada' };
const beneficios = {
  basico: ['1 unidade exclusiva', 'Musculação completa', 'Área de cardio'],
  pro: ['Todas as unidades', 'Musculação e cardio ilimitados', 'Lutas e artes marciais', 'Quadras esportivas'],
  elite: ['Todas as unidades', 'Musculação, cardio e lutas', 'Quadras esportivas', 'Nutricionista incluso', 'Personal Trainer incluso'],
};
let link;
let expiraEm;
let encaminhando = false;
let ocupada = false;

async function api(sufixo = '', opcoes = {}) {
  const resposta = await fetch(endpoint + sufixo, { headers, credentials: 'include', cache: 'no-store', ...opcoes });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || 'Checkout indisponível.');
  return dados;
}

function atualizarControles() {
  const expirado = Boolean(link && Date.now() >= expiraEm);
  imagem.hidden = !link || expirado;
  copiar.disabled = !link || expirado || ocupada || encaminhando;
  renovar.disabled = ocupada || encaminhando || situacao.dataset.status !== 'pending';
  botoes.forEach(botao => { botao.disabled = renovar.disabled; });
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
    const dados = await api('/qr', { method: 'POST', body: '{}' });
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
    const dados = await api();
    if (inicial) {
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

botoes.forEach(botao => botao.addEventListener('click', async () => {
  ocupada = true;
  atualizarControles();
  try {
    const dados = await api('', { method: 'POST', body: JSON.stringify({ acao: botao.dataset.acao }) });
    mostrarStatus(dados.status, true);
  } catch (erro) {
    mensagem.textContent = erro.message;
  } finally {
    ocupada = false;
    atualizarControles();
  }
}));

async function iniciar() {
  if (!tentativa) {
    situacao.textContent = 'Tentativa indisponível';
    return;
  }
  await consultar(true);
  if (situacao.dataset.status === 'pending') await gerar();
  if (situacao.dataset.status) setInterval(consultar, 2500);
}
iniciar();

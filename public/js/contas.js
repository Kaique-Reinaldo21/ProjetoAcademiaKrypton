const pagina = document.body.dataset.pagina;
const mensagem = document.getElementById('mensagem');
const auth = localStorage.getItem('token');
const headers = { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) };
const contaApi = '/api/auth';
const nova = document.getElementById('novaSenha');
const confirmacao = document.getElementById('confirmacao');
let tokenRecuperacao;

if (pagina === 'redefinir') {
  tokenRecuperacao = new URLSearchParams(location.hash.slice(1)).get('token');
  history.replaceState(null, '', location.pathname);
  if (!tokenRecuperacao) {
    document.querySelector('#redefinir button[type="submit"]').disabled = true;
    mostrar('Link inválido ou expirado. Solicite uma nova recuperação.', true);
  }
}

function mostrar(texto, erro) {
  mensagem.className = 'alert-msg ' + (erro ? 'alert-erro' : 'alert-ok');
  mensagem.textContent = texto;
  mensagem.hidden = false;
}

function avaliar() {
  const senha = nova.value;
  const comprimento = [...senha].length;
  const bytes = new TextEncoder().encode(senha).length;
  const erro = bytes > 72 ? 'Use até 72 bytes em UTF-8.' : comprimento < 12 ? 'Use pelo menos 12 caracteres.' : '';
  nova.setCustomValidity(erro);
  confirmacao.setCustomValidity(confirmacao.value === senha ? '' : 'As senhas precisam ser iguais.');
  const forca = erro ? (senha ? 1 : 0) : comprimento >= 18 ? 3 : 2;
  document.getElementById('forca').value = forca;
  document.getElementById('forca-texto').textContent = ['Força da senha', 'Considere uma senha mais longa', 'Comprimento adequado', 'Bom comprimento'][forca];
}

if (nova) {
  nova.addEventListener('input', avaliar);
  confirmacao.addEventListener('input', avaliar);
}

document.querySelectorAll('[data-mostrar]').forEach(botao => {
  botao.addEventListener('click', () => {
    const campo = document.getElementById(botao.dataset.mostrar);
    campo.type = campo.type === 'password' ? 'text' : 'password';
    botao.textContent = campo.type === 'password' ? 'Mostrar senha' : 'Ocultar senha';
  });
});

async function api(caminho, dados) {
  const resposta = await fetch(contaApi + caminho, {
    credentials: 'same-origin',
    mode: 'same-origin',
    redirect: 'error',
    referrerPolicy: 'same-origin',
    headers,
    cache: 'no-store',
    ...(dados ? { method: 'POST', body: JSON.stringify(dados) } : {}),
  });
  const resultado = await resposta.json();
  if (!resposta.ok) throw new Error(resultado.erro || 'Não foi possível concluir.');
  return resultado;
}

function ligarFormulario(id, caminho, logout) {
  const form = document.getElementById(id);
  if (!form) return;
  form.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (form.contains(nova)) {
      avaliar();
      if (!form.reportValidity()) return;
    }
    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    try {
      const dados = Object.fromEntries(new FormData(form));
      if (id === 'redefinir') dados.token = tokenRecuperacao;
      const resultado = await api(caminho, dados);
      form.reset();
      if (form.contains(nova)) avaliar();
      mostrar(resultado.mensagem, false);
      if (logout) {
        tokenRecuperacao = null;
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        setTimeout(() => location.replace('/login.html'), 1400);
      }
    } catch (erro) {
      mostrar(erro.message, true);
    } finally {
      botao.disabled = false;
    }
  });
}

ligarFormulario('recuperar', '/recuperacao');
ligarFormulario('redefinir', '/redefinir', true);
ligarFormulario('alterar', '/senha', true);
ligarFormulario('recuperar-admin', '/admin/recuperacao');

async function carregarConta() {
  try {
    const { usuario } = await api('/me');
    document.getElementById('alterar').hidden = !usuario.possuiSenhaLocal;
    document.getElementById('conta-google').hidden = usuario.possuiSenhaLocal;
    document.getElementById('administracao').hidden = usuario.role !== 'admin' || !usuario.possuiSenhaLocal;
    const voltar = document.getElementById('voltar');
    voltar.href = usuario.role === 'admin' ? '/admin.html' : '/dashboard.html';
    voltar.textContent = 'Voltar ao painel';
  } catch (erro) {
    mostrar(erro.message, true);
  }
}

if (pagina === 'configuracoes') carregarConta();

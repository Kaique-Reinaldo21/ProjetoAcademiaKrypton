const dadosQr = new URLSearchParams(location.hash.slice(1));
history.replaceState(null, '', location.pathname);
const resultado = document.getElementById('resultado');
let iniciou = false;

async function confirmarQuandoVisivel() {
  if (iniciou || document.visibilityState !== 'visible' || document.prerendering) return;
  iniciou = true;
  try {
    const resposta = await fetch('/checkout-qr', {
      method: 'POST',
      credentials: 'omit',
      mode: 'same-origin',
      redirect: 'error',
      referrerPolicy: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tentativa: dadosQr.get('tentativa'), token: dadosQr.get('token') }),
    });
    const dados = await resposta.json();
    if (!resposta.ok || dados.status !== 'approved') throw new Error(dados.erro || 'Não foi possível confirmar.');
    resultado.dataset.status = 'approved';
    resultado.textContent = 'Simulação aprovada. Redirecionando…';
    setTimeout(() => location.replace('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 1800);
  } catch (erro) {
    resultado.dataset.status = 'rejected';
    resultado.textContent = erro.message;
  } finally {
    dadosQr.delete('token');
  }
}

document.addEventListener('visibilitychange', confirmarQuandoVisivel);
document.addEventListener('prerenderingchange', confirmarQuandoVisivel);
confirmarQuandoVisivel();

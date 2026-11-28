import { api, enviar } from './aluno-dados.js';
import { elemento, estado } from './design-system.js';

const limiteArquivo = 5 * 1024 * 1024;
const rotulosPapel = { admin: 'Administrador', aluno: 'Aluno', recepcao: 'Recepção', personal: 'Personal trainer', nutricionista: 'Nutricionista' };

export async function normalizarFoto(arquivo) {
  if (!['image/png', 'image/jpeg'].includes(arquivo?.type) || arquivo.size > limiteArquivo) {
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

function aplicarAvatar(avatar, nome, foto) {
  if (!avatar) return;
  if (foto) {
    const imagem = elemento('img');
    imagem.alt = '';
    imagem.src = foto;
    avatar.replaceChildren(imagem);
    return;
  }
  const iniciais = String(nome || '').trim().split(/\s+/).slice(0, 2)
    .map(parte => [...parte][0]?.toLocaleUpperCase('pt-BR')).join('');
  avatar.replaceChildren(iniciais ? document.createTextNode(iniciais) : elemento('i', null, 'bi bi-person'));
}

export function criarIdentidadePainel(usuario, { avatar, nome: nomeElemento } = {}) {
  let fotoUrl = null;
  function atualizar() {
    if (nomeElemento) nomeElemento.textContent = usuario.nome;
    aplicarAvatar(avatar, usuario.nome, fotoUrl);
  }
  function definirFoto(blob) {
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    fotoUrl = blob ? URL.createObjectURL(blob) : null;
    atualizar();
  }
  async function carregarFoto() {
    try {
      const foto = await api('/api/usuario/perfil/foto');
      definirFoto(foto);
      return foto;
    }
    catch (falha) {
      if (falha.status === 404) { definirFoto(null); return null; }
      else throw falha;
    }
  }
  function atualizarNome(nome) {
    usuario.nome = nome;
    atualizar();
  }
  atualizar();
  carregarFoto().catch(() => {});
  window.addEventListener('pagehide', evento => {
    if (!evento.persisted && fotoUrl) URL.revokeObjectURL(fotoUrl);
  });
  return { atualizarNome, carregarFoto, definirFoto };
}

function feedback(node, mensagem, falhou = false) {
  node.textContent = mensagem;
  if (falhou) node.dataset.tom = 'erro';
  else delete node.dataset.tom;
}

function mostrarAvatar(avatar, nome, fotoUrl) {
  aplicarAvatar(avatar, nome, fotoUrl);
}

export function montarEditorPerfil(usuario, { aoAtualizarNome = () => {}, aoAtualizarFoto = () => {}, abrirFoto = false } = {}) {
  const raiz = elemento('section', null, 'kd-card kd-perfil-pessoal');
  raiz.append(elemento('h2', 'Perfil pessoal'), elemento('p', 'Atualize seu nome de exibição e sua foto.'));
  const colunas = elemento('div', null, 'kd-grid kd-grid-dois');
  const avatar = elemento('button', null, 'kd-avatar kd-perfil-avatar');
  avatar.type = 'button';
  avatar.setAttribute('aria-label', 'Ampliar foto de perfil');
  const ampliarFoto = elemento('button', 'Ampliar foto', 'kd-button kd-perfil-ampliar');
  ampliarFoto.type = 'button';
  ampliarFoto.setAttribute('aria-label', 'Ampliar foto de perfil');
  const acoesFoto = elemento('div', null, 'kd-perfil-acoes');
  const trocarFoto = elemento('button', 'Adicionar ou trocar foto', 'kd-button');
  trocarFoto.type = 'button';
  const removerFoto = elemento('button', 'Remover foto', 'kd-button');
  removerFoto.type = 'button';
  removerFoto.disabled = true;
  acoesFoto.append(trocarFoto, removerFoto);
  const fotoCard = elemento('div', null, 'kd-perfil-foto');
  fotoCard.append(avatar, ampliarFoto, acoesFoto);

  const formulario = elemento('form', null, 'kd-form');
  const nomeLabel = elemento('label', 'Nome de exibição');
  const nome = elemento('input', null, 'kd-input');
  nome.name = 'nome';
  nome.maxLength = 120;
  nome.autocomplete = 'name';
  nome.required = true;
  nomeLabel.append(nome);
  const emailLabel = elemento('label', 'E-mail');
  const email = elemento('input', null, 'kd-input');
  email.type = 'email';
  email.readOnly = true;
  emailLabel.append(email);
  const papelLabel = elemento('label', 'Papel');
  const papel = elemento('input', null, 'kd-input');
  papel.readOnly = true;
  papelLabel.append(papel);
  const salvarNome = elemento('button', 'Salvar nome', 'kd-button kd-button-primario');
  salvarNome.type = 'submit';
  const mensagemNome = elemento('p', null, 'kd-feedback');
  mensagemNome.setAttribute('role', 'status');
  formulario.append(nomeLabel, emailLabel, papelLabel, salvarNome, mensagemNome);
  colunas.append(fotoCard, formulario);

  const dialogo = elemento('dialog', null, 'kd-card kd-dialog');
  dialogo.setAttribute('aria-labelledby', 'perfil-foto-titulo');
  const formFoto = elemento('form', null, 'kd-form');
  const titulo = elemento('h2', 'Foto de perfil');
  titulo.id = 'perfil-foto-titulo';
  const labelFoto = elemento('label', 'Imagem JPEG ou PNG, até 5 MB');
  const arquivo = elemento('input', null, 'kd-input');
  arquivo.type = 'file';
  arquivo.accept = 'image/jpeg,image/png';
  arquivo.required = true;
  labelFoto.append(arquivo);
  const previa = elemento('img', null, 'kd-perfil-previa');
  previa.alt = 'Prévia da nova foto de perfil';
  previa.hidden = true;
  formFoto.append(titulo, labelFoto, previa);
  const mensagemFoto = elemento('p', null, 'kd-feedback');
  mensagemFoto.setAttribute('role', 'status');
  const acoesDialogo = elemento('div', null, 'kd-perfil-acoes');
  const salvarFoto = elemento('button', 'Salvar foto', 'kd-button kd-button-primario');
  salvarFoto.type = 'submit';
  const cancelar = elemento('button', 'Cancelar', 'kd-button');
  cancelar.type = 'button';
  cancelar.addEventListener('click', () => dialogo.close());
  acoesDialogo.append(salvarFoto, cancelar);
  formFoto.append(mensagemFoto, acoesDialogo);
  dialogo.append(formFoto);
  raiz.append(colunas, dialogo);

  let fotoUrl = null;
  let previaUrl = null;
  let fotoPreparada = null;
  function definirFoto(blob) {
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    fotoUrl = blob ? URL.createObjectURL(blob) : null;
    mostrarAvatar(avatar, usuario.nome, fotoUrl);
    removerFoto.disabled = !fotoUrl;
  }
  async function carregarFoto() {
    try {
      const foto = await api('/api/usuario/perfil/foto');
      definirFoto(foto);
      return foto;
    }
    catch (falha) {
      if (falha.status === 404) { definirFoto(null); return null; }
      else throw falha;
    }
  }
  function carregar() {
    formulario.setAttribute('aria-busy', 'true');
    api('/api/usuario/perfil').then(({ usuario: perfil }) => {
      nome.value = perfil.nome;
      email.value = perfil.email;
      papel.value = rotulosPapel[usuario.role] || 'Perfil autenticado';
      return carregarFoto();
    }).catch(() => {
      formulario.replaceChildren(estado('Não foi possível carregar o perfil.', 'Tente novamente mais tarde.', 'erro'));
    }).finally(() => formulario.removeAttribute('aria-busy'));
  }
  carregar();
  window.addEventListener('pagehide', evento => {
    if (!evento.persisted && fotoUrl) URL.revokeObjectURL(fotoUrl);
  });

  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    salvarNome.disabled = true;
    try {
      const { usuario: atualizado } = await enviar('/api/usuario/perfil', { nome: nome.value }, 'PUT');
      usuario.nome = atualizado.nome;
      nome.value = atualizado.nome;
      aoAtualizarNome(atualizado.nome);
      feedback(mensagemNome, 'Nome atualizado.');
    } catch (falha) { feedback(mensagemNome, falha.message, true); }
    finally { salvarNome.disabled = false; }
  });
  trocarFoto.addEventListener('click', () => {
    formFoto.reset();
    fotoPreparada = null;
    previa.hidden = true;
    if (previaUrl) URL.revokeObjectURL(previaUrl);
    previaUrl = null;
    feedback(mensagemFoto, '');
    dialogo.showModal();
  });
  function ampliar() { if (fotoUrl) { previa.src = fotoUrl; previa.hidden = false; dialogo.showModal(); cancelar.focus(); } }
  avatar.addEventListener('click', ampliar);
  ampliarFoto.addEventListener('click', ampliar);
  arquivo.addEventListener('change', async () => {
    fotoPreparada = null;
    previa.hidden = true;
    if (previaUrl) URL.revokeObjectURL(previaUrl);
    previaUrl = null;
    if (!arquivo.files[0]) return;
    try {
      fotoPreparada = await normalizarFoto(arquivo.files[0]);
      previaUrl = URL.createObjectURL(fotoPreparada);
      previa.src = previaUrl;
      previa.hidden = false;
      feedback(mensagemFoto, 'Prévia pronta. Confirme em Salvar foto.');
    } catch (falha) { feedback(mensagemFoto, falha.message, true); }
  });
  dialogo.addEventListener('close', () => {
    if (previaUrl) URL.revokeObjectURL(previaUrl);
    previaUrl = null; fotoPreparada = null;
    previa.removeAttribute('src'); previa.hidden = true;
  });
  formFoto.addEventListener('submit', async evento => {
    evento.preventDefault();
    salvarFoto.disabled = true;
    try {
      const png = fotoPreparada || await normalizarFoto(arquivo.files[0]);
      await api('/api/usuario/perfil/foto', { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: png });
      const foto = await carregarFoto();
      await aoAtualizarFoto(foto);
      feedback(mensagemFoto, 'Foto atualizada.');
      dialogo.close();
    } catch (falha) { feedback(mensagemFoto, falha.message, true); }
    finally { salvarFoto.disabled = false; }
  });
  removerFoto.addEventListener('click', async () => {
    removerFoto.disabled = true;
    try {
      await api('/api/usuario/perfil/foto', { method: 'DELETE' });
      definirFoto(null);
      await aoAtualizarFoto(null);
      feedback(mensagemNome, 'Foto removida.');
    } catch (falha) {
      feedback(mensagemNome, falha.message, true);
      removerFoto.disabled = !fotoUrl;
    }
  });
  if (abrirFoto || location.hash === '#configuracoes/foto') {
    queueMicrotask(() => { if (raiz.isConnected) dialogo.showModal(); });
  }
  return raiz;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { criarIdentidadePainel, montarEditorPerfil } from '../public/js/dashboard/perfil-pessoal.js';

class ElementoFalso {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.listeners = {}; this.dataset = {}; this.attributes = {}; this.files = []; this.value = ''; this.disabled = false; this.isConnected = true; }
  set textContent(value) { this.text = String(value); }
  get textContent() { return this.text ?? this.children.map(item => item.textContent || '').join(''); }
  set className(value) { this.classes = value; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
  reset() { for (const item of buscar(this, no => no.tagName === 'INPUT')) { item.value = ''; item.files = []; } }
  showModal() { this.open = true; }
  close() { this.open = false; }
  focus() { this.focused = true; }
}

function buscar(raiz, criterio) {
  return [raiz, ...raiz.children.flatMap(filho => buscar(filho, criterio))].filter(criterio);
}

function evento() { return { preventDefault() {} }; }

async function aguardar() { await new Promise(resolve => setTimeout(resolve, 0)); }
async function aguardarAte(condicao) {
  for (let tentativa = 0; tentativa < 30 && !condicao(); tentativa++) await aguardar();
}

test('interface compartilhada permite nome e foto persistentes nos cinco papéis', async () => {
  const anteriores = {
    document: globalThis.document, window: globalThis.window, location: globalThis.location,
    fetch: globalThis.fetch, localStorage: globalThis.localStorage, createImageBitmap: globalThis.createImageBitmap,
  };
  const usuarios = new Map();
  const fotos = new Map();
  globalThis.document = {
    createElement: tag => {
      const node = new ElementoFalso(tag);
      if (tag === 'canvas') {
        node.getContext = () => ({ drawImage() {} });
        node.toBlob = callback => callback(new Blob(['png-renderizado'], { type: 'image/png' }));
      }
      return node;
    },
    createTextNode: texto => ({ tagName: '#TEXT', textContent: texto, children: [] }),
  };
  globalThis.window = { addEventListener() {} };
  globalThis.location = { hash: '' };
  globalThis.localStorage = { getItem: () => 'token-fixture' };
  globalThis.createImageBitmap = async () => ({ width: 80, height: 60, close() {} });
  globalThis.fetch = async (caminho, opcoes = {}) => {
    if (caminho === '/api/usuario/perfil' && !opcoes.method) {
      const id = Number(globalThis.fixtureUsuarioId);
      return Response.json({ usuario: usuarios.get(id) });
    }
    const id = Number(globalThis.fixtureUsuarioId);
    if (caminho === '/api/usuario/perfil' && opcoes.method === 'PUT') {
      const { nome } = JSON.parse(opcoes.body);
      usuarios.get(id).nome = nome;
      return Response.json({ usuario: { id, nome } });
    }
    if (caminho === '/api/usuario/perfil/foto' && opcoes.method === 'PUT') {
      fotos.set(id, opcoes.body);
      return new Response(null, { status: 204 });
    }
    if (caminho === '/api/usuario/perfil/foto' && opcoes.method === 'DELETE') {
      fotos.delete(id);
      return new Response(null, { status: 204 });
    }
    if (caminho === '/api/usuario/perfil/foto' && !opcoes.method) {
      return fotos.has(id)
        ? new Response(fotos.get(id), { headers: { 'Content-Type': 'image/png' } })
        : new Response(null, { status: 404 });
    }
    return new Response(null, { status: 404 });
  };

  try {
    const papeis = ['admin', 'aluno', 'recepcao', 'personal', 'nutricionista'];
    for (const [indice, role] of papeis.entries()) {
      const id = indice + 1;
      globalThis.fixtureUsuarioId = id;
      usuarios.set(id, { id, role, nome: `Nome ${role}`, email: `${role}@example.test` });
      const usuario = usuarios.get(id);
      const callbacks = { nomes: 0, fotos: [] };
      const avatarCabecalho = new ElementoFalso('span');
      const nomeCabecalho = new ElementoFalso('span');
      const identidade = criarIdentidadePainel(usuario, { avatar: avatarCabecalho, nome: nomeCabecalho });
      await aguardar();
      const raiz = montarEditorPerfil(usuario, {
        aoAtualizarNome: nomeAtualizado => { callbacks.nomes++; identidade.atualizarNome(nomeAtualizado); },
        aoAtualizarFoto: foto => { callbacks.fotos.push(foto); identidade.definirFoto(foto); },
      });
      await aguardar();

      const forms = buscar(raiz, no => no.tagName === 'FORM');
      const nome = buscar(forms[0], no => no.tagName === 'INPUT' && no.name === 'nome')[0];
      assert.equal(nome.value, `Nome ${role}`, role);
      assert.equal(buscar(forms[0], no => no.tagName === 'INPUT' && no.type === 'email')[0].value, `${role}@example.test`);
      assert.equal(buscar(forms[0], no => no.tagName === 'INPUT' && no.readOnly && no.value)[1].value,
        { admin: 'Administrador', aluno: 'Aluno', recepcao: 'Recepção', personal: 'Personal trainer', nutricionista: 'Nutricionista' }[role]);
      nome.value = `Atualizado ${role}`;
      await forms[0].listeners.submit[0](evento());
      assert.equal(usuarios.get(id).nome, `Atualizado ${role}`, role);
      assert.equal(callbacks.nomes, 1, role);
      assert.equal(nomeCabecalho.textContent, `Atualizado ${role}`, role);

      buscar(raiz, no => no.tagName === 'BUTTON' && no.textContent === 'Adicionar ou trocar foto')[0].listeners.click[0]();
      const dialogo = buscar(raiz, no => no.tagName === 'DIALOG')[0];
      assert.equal(dialogo.open, true, role);
      const formFoto = buscar(dialogo, no => no.tagName === 'FORM')[0];
      const arquivo = buscar(formFoto, no => no.tagName === 'INPUT' && no.type === 'file')[0];
      arquivo.files = [{ type: 'image/png', size: 100 }];
      await arquivo.listeners.change[0]();
      assert.ok(buscar(formFoto, no => no.tagName === 'IMG' && !no.hidden).length, `${role}: prévia antes do upload`);
      await formFoto.listeners.submit[0](evento());
      assert.equal(fotos.has(id), true, role);
      assert.equal(callbacks.fotos.length, 1, role + ': callbacks de foto');
      assert.equal(callbacks.fotos.at(-1) instanceof Blob, true, role + ': ' + String(callbacks.fotos.at(-1)?.constructor?.name) + ' ' + buscar(formFoto, no => no.tagName === 'P')[0]?.textContent);
      assert.equal(dialogo.open, false, role);

      const avatar = buscar(raiz, no => no.tagName === 'BUTTON' && no.classes?.includes('kd-perfil-avatar'))[0];
      assert.ok(buscar(avatar, no => no.tagName === 'IMG').length, role);
      assert.ok(buscar(avatarCabecalho, no => no.tagName === 'IMG').length, role);
      avatar.listeners.click[0]();
      assert.equal(dialogo.open, true, `${role}: modal de ampliação`);
      assert.equal(buscar(formFoto, no => no.tagName === 'IMG' && !no.hidden).length > 0, true);
      dialogo.close();
      const painelAposLogin = montarEditorPerfil({ ...usuarios.get(id) });
      const avatarAposLogin = buscar(painelAposLogin, no => no.tagName === 'BUTTON' && no.classes?.includes('kd-perfil-avatar'))[0];
      await aguardarAte(() => buscar(avatarAposLogin, no => no.tagName === 'IMG').length > 0);
      assert.ok(buscar(avatarAposLogin, no => no.tagName === 'IMG').length, `foto persistiu após login de ${role}`);
      buscar(raiz, no => no.tagName === 'BUTTON' && no.textContent === 'Remover foto')[0].listeners.click[0]();
      await aguardar();
      assert.equal(fotos.has(id), false, role);
      assert.equal(callbacks.fotos.at(-1), null, role);
      assert.equal(avatar.textContent, `A${role[0].toUpperCase()}`, role);
      assert.equal(avatarCabecalho.textContent, `A${role[0].toUpperCase()}`, role);

      const novaSessao = montarEditorPerfil({ ...usuarios.get(id) });
      const nomePersistido = buscar(buscar(novaSessao, no => no.tagName === 'FORM')[0], no => no.tagName === 'INPUT' && no.name === 'nome')[0];
      await aguardarAte(() => nomePersistido.value === `Atualizado ${role}`);
      assert.equal(nomePersistido.value, `Atualizado ${role}`, `persistência após login de ${role}`);
    }
  } finally {
    for (const [nome, valor] of Object.entries(anteriores)) {
      if (valor === undefined) delete globalThis[nome];
      else globalThis[nome] = valor;
    }
  }
});

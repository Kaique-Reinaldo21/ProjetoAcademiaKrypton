import { createHash, randomBytes } from 'node:crypto';
import prisma from '../lib/prisma.js';
import { ErroConta, normalizarEmail } from './contas.service.js';
import { conferirSenha } from './politica-senha.js';

export const validadeEstadoGoogle = 10 * 60_000;
const hash = valor => createHash('sha256').update(valor).digest('hex');
const chave = () => randomBytes(32).toString('base64url');
const chaveValida = valor => typeof valor === 'string' && /^[A-Za-z0-9_-]{43}$/.test(valor);
const recusar = () => new ErroConta('Não foi possível autenticar com o Google.', 403);

export function identidadeGoogle(perfil) {
  const email = normalizarEmail(perfil?.emails?.[0]?.value);
  if (perfil?.provider !== 'google' || typeof perfil.id !== 'string' ||
      !/^[A-Za-z0-9_-]{1,255}$/.test(perfil.id) || !email ||
      perfil.emails[0].verified !== true) return null;

  const dominio = email.split('@')[1];
  const dominioGoogle = perfil._json?.hd;
  const nome = typeof perfil.displayName === 'string' && perfil.displayName.trim()
    ? [...perfil.displayName.trim()].slice(0, 120).join('') : 'Aluno Krypton';
  return {
    sub: perfil.id, email, nome,
    emailAutoritativo: dominio === 'gmail.com' ||
      (typeof dominioGoogle === 'string' && dominioGoogle.toLowerCase() === dominio),
  };
}

export function criarServicoGoogle(db = prisma) {
  async function prepararVinculo(sessao, senha) {
    if (sessao.role !== 'aluno') throw recusar();
    const usuario = await db.usuarios.findUnique({ where: { id: sessao.id } });
    if (usuario?.role !== 'aluno' || usuario.google_sub || usuario.senha_redefinicao_obrigatoria ||
        usuario.versao_sessao !== sessao.versao_sessao ||
        !await conferirSenha(senha, usuario.senha_hash)) throw recusar();
    return usuario;
  }

  async function emitirEstado(vinculo) {
    const state = chave();
    const navegador = chave();
    const agora = new Date();
    await db.estados_oauth_google.deleteMany({ where: { expira_em: { lte: agora } } });
    await db.estados_oauth_google.create({ data: {
      state_hash: hash(state), navegador_hash: hash(navegador),
      expira_em: new Date(+agora + validadeEstadoGoogle),
      usuario_id: vinculo?.id, versao_sessao: vinculo?.versao_sessao,
    } });
    return { state, navegador };
  }

  async function consumirEstado(state, navegador) {
    if (!chaveValida(state) || !chaveValida(navegador)) return null;
    const where = {
      state_hash: hash(state), navegador_hash: hash(navegador), expira_em: { gt: new Date() },
    };
    const registro = await db.estados_oauth_google.findFirst({ where });
    if (!registro) return null;
    const removido = await db.estados_oauth_google.deleteMany({ where });
    return removido.count === 1 ? registro : null;
  }

  async function vincular(identidade, estado) {
    return db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${estado.usuario_id} FOR UPDATE`;
      const usuario = await tx.usuarios.findUnique({ where: { id: estado.usuario_id } });
      if (usuario?.role !== 'aluno' || !usuario.senha_hash || usuario.google_sub ||
          usuario.senha_redefinicao_obrigatoria || usuario.versao_sessao !== estado.versao_sessao ||
          normalizarEmail(usuario.email) !== identidade.email) throw recusar();
      const vinculado = await tx.usuarios.update({
        where: { id: usuario.id },
        data: { google_sub: identidade.sub, versao_sessao: { increment: 1 } },
      });
      await tx.auditoria_contas.create({ data: {
        usuario_id: usuario.id, autor_id: usuario.id, evento: 'google_vinculado',
      } });
      return vinculado;
    });
  }

  async function autenticar(perfil, estado) {
    const identidade = identidadeGoogle(perfil);
    if (!identidade || !estado) throw recusar();
    try {
      if (estado.usuario_id !== null) return await vincular(identidade, estado);
      const usuario = await db.usuarios.findUnique({ where: { google_sub: identidade.sub } });
      if (usuario) {
        if (usuario.role !== 'aluno' || usuario.senha_redefinicao_obrigatoria) throw recusar();
        return usuario;
      }
      const existente = await db.usuarios.findUnique({ where: { email: identidade.email }, select: { id: true } });
      if (existente || !identidade.emailAutoritativo) throw recusar();
      return await db.usuarios.create({ data: {
        nome: identidade.nome, email: identidade.email, google_sub: identidade.sub,
      } });
    } catch (erro) {
      if (erro.code === 'P2002') throw recusar();
      throw erro;
    }
  }

  return { prepararVinculo, emitirEstado, consumirEstado, autenticar };
}

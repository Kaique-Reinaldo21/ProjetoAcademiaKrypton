import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import prisma from '../lib/prisma.js';
import { conferirSenha, erroNovaSenha, gerarHashSenha } from './politica-senha.js';
import { criarEmailRecuperacao } from './recuperacao-email.service.js';

const quinzeMinutos = 15 * 60_000;
const hashToken = token => createHash('sha256').update(token).digest('hex');
export const mensagemRecuperacao = 'Se a conta puder receber um link, enviaremos as instruções por e-mail.';

export class ErroConta extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

export function normalizarEmail(email) {
  if (typeof email !== 'string') return null;
  const normalizado = email.trim().toLowerCase();
  return normalizado.length <= 180 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(normalizado)
    ? normalizado : null;
}

function exigirSenha(senha, confirmacao) {
  if (typeof confirmacao !== 'string') throw new ErroConta('Confirme a nova senha.');
  const erro = erroNovaSenha(senha, confirmacao);
  if (erro) throw new ErroConta(erro);
}

function tokenInvalido() {
  return new ErroConta('Link inválido ou expirado. Solicite uma nova recuperação.', 410);
}

export function criarServicoContas({
  db = prisma, enviarEmail = criarEmailRecuperacao(), segredo = process.env.JWT_SECRET,
  agora = () => new Date(),
} = {}) {
  async function dentroDoLimite(escopo, identidade, teto, janela = quinzeMinutos) {
    if (!segredo) throw new ErroConta('Serviço de contas indisponível.', 503);
    const chave = createHmac('sha256', segredo).update(`${escopo}:${identidade}`).digest('hex');
    const instante = agora();
    const expira = new Date(instante.getTime() + janela);
    const contador = await db.$transaction(async tx => {
      await tx.$executeRaw`
        INSERT INTO limites_conta (chave, contador, expira_em) VALUES (${chave}, 1, ${expira})
        ON DUPLICATE KEY UPDATE
          contador = IF(expira_em <= ${instante}, 1, LEAST(contador + 1, ${teto + 1})),
          expira_em = IF(expira_em <= ${instante}, ${expira}, expira_em)
      `;
      return (await tx.limites_conta.findUnique({ where: { chave } })).contador;
    });
    if (randomInt(100) === 0) {
      db.$executeRaw`DELETE FROM limites_conta WHERE expira_em < ${instante} ORDER BY expira_em LIMIT 500`
        .catch(() => console.warn('Limpeza dos limites de conta indisponível.'));
    }
    return contador <= teto;
  }

  async function limitar(escopo, identidade, teto) {
    if (!await dentroDoLimite(escopo, identidade, teto)) {
      throw new ErroConta('Limite de solicitações atingido. Tente novamente em alguns minutos.', 429);
    }
  }

  async function bloquearUsuarios(tx, primeiro, segundo = primeiro) {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id IN (${primeiro}, ${segundo}) ORDER BY id FOR UPDATE`;
  }

  function exigirSessao(usuario, sessao) {
    if (!usuario || usuario.versao_sessao !== sessao.versao_sessao || usuario.senha_redefinicao_obrigatoria) {
      throw new ErroConta('Sessão expirada. Entre novamente.', 401);
    }
  }

  async function gravarRecuperacao(tx, usuarioId, token) {
    const dados = { token_hash: hashToken(token), expira_em: new Date(agora().getTime() + quinzeMinutos) };
    await tx.recuperacoes_senha.upsert({
      where: { usuario_id: usuarioId },
      update: dados,
      create: { usuario_id: usuarioId, ...dados },
    });
  }

  async function enviarLink(email, token) {
    try {
      await enviarEmail(email, token);
    } catch {
      console.error('Falha no transporte de recuperação de senha.');
      throw new ErroConta('Falha no envio. Tente novamente.', 503);
    }
  }

  async function solicitar(emailInformado) {
    const email = normalizarEmail(emailInformado);
    if (!email || !enviarEmail) return;
    const conta = await db.usuarios.findUnique({ where: { email }, select: { id: true, senha_hash: true } });
    if (!conta?.senha_hash || !await dentroDoLimite('recuperacao-conta', conta.id, 3, 60 * 60_000)) return;
    const token = randomBytes(32).toString('base64url');
    const destino = await db.$transaction(async tx => {
      await bloquearUsuarios(tx, conta.id);
      const atual = await tx.usuarios.findUnique({ where: { id: conta.id } });
      if (!atual?.senha_hash || atual.email.toLowerCase() !== email) return null;
      await gravarRecuperacao(tx, atual.id, token);
      return atual.email;
    });
    if (destino) await enviarLink(destino, token);
  }

  async function trocarSenha(tx, usuarioId, senhaHash, evento) {
    await tx.usuarios.update({
      where: { id: usuarioId },
      data: {
        senha_hash: senhaHash,
        senha_redefinicao_obrigatoria: false,
        versao_sessao: { increment: 1 },
      },
    });
    await tx.auditoria_contas.create({ data: { usuario_id: usuarioId, autor_id: usuarioId, evento } });
  }

  async function redefinir(token, senha, confirmacao) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw tokenInvalido();
    exigirSenha(senha, confirmacao);
    const token_hash = hashToken(token);
    const recuperacao = await db.recuperacoes_senha.findUnique({ where: { token_hash } });
    if (!recuperacao || recuperacao.expira_em <= agora()) throw tokenInvalido();
    const senhaHash = await gerarHashSenha(senha);
    await db.$transaction(async tx => {
      await bloquearUsuarios(tx, recuperacao.usuario_id);
      const consumido = await tx.recuperacoes_senha.deleteMany({
        where: { usuario_id: recuperacao.usuario_id, token_hash, expira_em: { gt: agora() } },
      });
      if (consumido.count !== 1) throw tokenInvalido();
      await trocarSenha(tx, recuperacao.usuario_id, senhaHash, 'senha_redefinida');
    });
  }

  async function alterar(sessao, senhaAtual, senha, confirmacao) {
    exigirSenha(senha, confirmacao);
    const conta = await db.usuarios.findUnique({ where: { id: sessao.id } });
    exigirSessao(conta, sessao);
    if (!conta.senha_hash) throw new ErroConta('Sua conta usa Google. Gerencie a senha na conta Google.', 409);
    if (!await conferirSenha(senhaAtual, conta.senha_hash)) throw new ErroConta('Senha atual incorreta.', 403);
    if (senha === senhaAtual) throw new ErroConta('Escolha uma senha diferente da atual.');
    const senhaHash = await gerarHashSenha(senha);
    await db.$transaction(async tx => {
      await bloquearUsuarios(tx, sessao.id);
      exigirSessao(await tx.usuarios.findUnique({ where: { id: sessao.id } }), sessao);
      await tx.recuperacoes_senha.deleteMany({ where: { usuario_id: sessao.id } });
      await trocarSenha(tx, sessao.id, senhaHash, 'senha_alterada');
    });
  }

  async function recuperarComoAdmin(sessao, emailInformado, senhaAdmin) {
    if (sessao.role !== 'admin') throw new ErroConta('Apenas administradores podem iniciar esta recuperação.', 403);
    if (!enviarEmail) throw new ErroConta('Envio de e-mail indisponível.', 503);
    const autor = await db.usuarios.findUnique({ where: { id: sessao.id } });
    exigirSessao(autor, sessao);
    if (!await conferirSenha(senhaAdmin, autor.senha_hash)) throw new ErroConta('Confirme com a senha local do administrador.', 403);

    const email = normalizarEmail(emailInformado);
    const alvo = email && await db.usuarios.findUnique({ where: { email } });
    if (!alvo) throw new ErroConta('Conta não encontrada.', 404);
    if (alvo.id === autor.id) throw new ErroConta('Use a opção de alteração da própria senha.');
    const token = randomBytes(32).toString('base64url');

    const destino = await db.$transaction(async tx => {
      await bloquearUsuarios(tx, autor.id, alvo.id);
      const atual = await tx.usuarios.findUnique({ where: { id: autor.id } });
      exigirSessao(atual, sessao);
      if (atual.role !== 'admin') throw new ErroConta('Apenas administradores podem iniciar esta recuperação.', 403);
      const conta = await tx.usuarios.findUnique({ where: { id: alvo.id } });
      if (!conta || conta.email !== alvo.email) throw new ErroConta('Conta não encontrada.', 404);
      if (!conta.senha_hash) throw new ErroConta('Esta conta usa Google para recuperar o acesso.', 409);

      await gravarRecuperacao(tx, conta.id, token);
      await tx.usuarios.update({
        where: { id: conta.id },
        data: { versao_sessao: { increment: 1 }, senha_redefinicao_obrigatoria: true },
      });
      await tx.auditoria_contas.create({
        data: { autor_id: autor.id, usuario_id: conta.id, evento: 'recuperacao_administrativa' },
      });
      return conta.email;
    });
    await enviarLink(destino, token);
  }

  return { solicitar, redefinir, alterar, recuperarComoAdmin, limitar };
}

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import prisma from '../lib/prisma.js';
import { emTesteMercadoPago, validarBancoTesteMercadoPago } from '../config/mercadopago-teste.js';
import { camposHistoricoPagamento, ErroCheckout } from './checkout.service.js';
import { TLS_SEM_VALIDACAO, validarArquivoCaDemo, validarModoDemo } from '../config/demo-db.js';

import { exigeModoAcademico } from '../config/demo-hosts.js';

export { validarArquivoCaDemo, validarModoDemo };

export function validarSimuladorCheckout() {
  if (emTesteMercadoPago()) return validarBancoTesteMercadoPago();
  return validarModoDemo();
}
export { AVISO_TLS_DEMO } from '../config/demo-db.js';

const validadeQrMs = 5 * 60_000;
const hashQr = token => createHash('sha256').update(token).digest('hex');
const qrInvalido = () => new ErroCheckout('Código indisponível. Gere um novo código no checkout.', 410);
const revogarQr = { qr_token_hash: null, qr_expira_em: null };

const planos = { basico: { nome: 'Básico', centavos: 8900 }, pro: { nome: 'Pro', centavos: 14900 }, elite: { nome: 'Elite', centavos: 24900 } };
export function validarTlsBanco(env = process.env) {
  // Inspeciona todas as ocorrências, inclusive quando PAYMENT_MODE não é demo.
  const url = URL.canParse(env.DATABASE_URL) ? new URL(env.DATABASE_URL) : null;
  if (env.PAYMENT_MODE === 'demo' || exigeModoAcademico(env) || url?.searchParams.getAll('sslaccept').includes(TLS_SEM_VALIDACAO)) {
    const sslaccept = validarModoDemo(env);
    if (env.DEMO_DEPLOYMENT !== 'academico_oficial') validarArquivoCaDemo(env);
    return sslaccept;
  }
}

export function criarServicoDemo(db = prisma, validar = validarSimuladorCheckout) {
  async function iniciar(usuarioId, tipo, unidadeInformada) {
    validar();
    if (!Object.hasOwn(planos, tipo)) throw new ErroCheckout('Selecione um plano válido.');
    const unidade = tipo === 'basico' ? Number(unidadeInformada) : null;
    if (tipo === 'basico' && (!Number.isSafeInteger(unidade) || unidade <= 0)) throw new ErroCheckout('Selecione uma unidade válida.');
    const id = randomUUID();
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${Number(usuarioId)} FOR UPDATE`;
      const aluno = await tx.usuarios.findUnique({ where: { id: Number(usuarioId) } });
      if (!aluno || aluno.role !== 'aluno') throw new ErroCheckout('Somente alunos podem contratar planos.', 403);
      if (unidade && !await tx.unidades.findUnique({ where: { id: unidade } })) throw new ErroCheckout('Unidade não encontrada.', 404);
      if (await tx.checkout_tentativas.findFirst({ where: { usuario_id: aluno.id, status: { in: ['pendente', 'aguardando'] } } })) throw new ErroCheckout('Já existe um checkout em andamento.', 409);
      await tx.checkout_tentativas.create({ data: { id, usuario_id: aluno.id, tipo, unidade_id: unidade, status: 'pendente', metodo: 'qr_krypton' } });
      await tx.transacoes_pagamento.create({ data: { mp_payment_id: 'demo_' + id, usuario_id: aluno.id, tentativa_id: id, valor_centavos: planos[tipo].centavos, moeda: 'BRL', status: 'pending', origem: 'demo' } });
    }, { isolationLevel: 'ReadCommitted' });
    return { url: '/checkout-demo.html?tentativa=' + encodeURIComponent(id), tentativaId: id };
  }
  async function consultar(usuarioId, id) {
    validar();
    const transacao = await db.transacoes_pagamento.findFirst({ where: { tentativa_id: id, usuario_id: Number(usuarioId), origem: 'demo' }, include: { tentativa: true } });
    if (!transacao) throw new ErroCheckout('Checkout não encontrado.', 404);
    const plano = planos[transacao.tentativa.tipo];
    return { tentativaId: id, tipo: transacao.tentativa.tipo, plano: plano.nome, valor_centavos: transacao.valor_centavos, status: transacao.status, metodo: 'qr_krypton', origem: 'demo' };
  }
  function buscarTransacao(tx, usuarioId, id) {
    return tx.transacoes_pagamento.findFirst({
      where: { tentativa_id: id, usuario_id: usuarioId, origem: 'demo' },
      include: { tentativa: true },
    });
  }

  async function bloquearAluno(tx, usuarioId) {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${usuarioId} FOR UPDATE`;
    const aluno = await tx.usuarios.findUnique({ where: { id: usuarioId }, select: { role: true } });
    if (aluno?.role !== 'aluno') throw new ErroCheckout('Somente alunos podem simular pagamentos.', 403);
  }

  async function aplicarDecisao(tx, transacao, acao) {
    const { tentativa, usuario_id: usuarioId } = transacao;
    if (transacao.status !== 'pending') return { status: transacao.status };
    if (acao === 'pendente') return { status: 'pending' };

    if (acao === 'recusar') {
      await tx.transacoes_pagamento.update({ where: { id: transacao.id }, data: { status: 'rejected', atualizado_em: new Date() } });
      await tx.checkout_tentativas.update({ where: { id: tentativa.id }, data: { status: 'recusado', ...revogarQr } });
      return { status: 'rejected' };
    }

    await tx.planos.updateMany({ where: { usuario_id: usuarioId, ativo: true }, data: { ativo: false } });
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const vencimento = new Date(inicio);
    vencimento.setDate(vencimento.getDate() + 30);
    const plano = await tx.planos.create({ data: { usuario_id: usuarioId, tipo: tentativa.tipo, unidade_id: tentativa.unidade_id, ativo: true, inicio, vencimento } });
    await tx.transacoes_pagamento.update({ where: { id: transacao.id }, data: { status: 'approved', plano_id: plano.id, atualizado_em: new Date() } });
    await tx.checkout_tentativas.update({ where: { id: tentativa.id }, data: { status: 'confirmado', ...revogarQr } });
    return { status: 'approved' };
  }

  async function decidir(usuarioId, id, acao) {
    validar();
    if (!['aprovar', 'pendente', 'recusar'].includes(acao)) throw new ErroCheckout('Ação inválida.');
    return db.$transaction(async tx => {
      const transacao = await buscarTransacao(tx, Number(usuarioId), id);
      if (!transacao) throw new ErroCheckout('Checkout não encontrado.', 404);
      await bloquearAluno(tx, Number(usuarioId));
      return aplicarDecisao(tx, await buscarTransacao(tx, Number(usuarioId), id), acao);
    }, { isolationLevel: 'ReadCommitted' });
  }

  async function gerarQr(usuarioId, id) {
    validar();
    return db.$transaction(async tx => {
      await bloquearAluno(tx, Number(usuarioId));
      const transacao = await buscarTransacao(tx, Number(usuarioId), id);
      if (!transacao) throw new ErroCheckout('Checkout não encontrado.', 404);
      if (transacao.status !== 'pending') throw new ErroCheckout('O checkout já foi concluído.', 409);
      const token = randomBytes(32).toString('base64url');
      const expiraEm = new Date(Date.now() + validadeQrMs);
      await tx.checkout_tentativas.update({
        where: { id },
        data: { qr_token_hash: hashQr(token), qr_expira_em: expiraEm },
      });
      return { token, expiraEm };
    }, { isolationLevel: 'ReadCommitted' });
  }

  async function confirmarQr(id, token) {
    validar();
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id) ||
        typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw qrInvalido();
    const hash = hashQr(token);
    return db.$transaction(async tx => {
      const tentativa = await tx.checkout_tentativas.findUnique({
        where: { id, qr_token_hash: hash },
        select: { usuario_id: true },
      });
      if (!tentativa) throw qrInvalido();
      await bloquearAluno(tx, tentativa.usuario_id);
      const consumido = await tx.checkout_tentativas.updateMany({
        where: { id, qr_token_hash: hash, qr_expira_em: { gt: new Date() }, status: 'pendente' },
        data: revogarQr,
      });
      if (consumido.count !== 1) throw qrInvalido();
      const transacao = await buscarTransacao(tx, tentativa.usuario_id, id);
      if (transacao?.status !== 'pending') throw qrInvalido();
      return aplicarDecisao(tx, transacao, 'aprovar');
    }, { isolationLevel: 'ReadCommitted' });
  }

  async function historico(usuarioId) {
    validar();
    return db.transacoes_pagamento.findMany({ where: { usuario_id: Number(usuarioId) }, select: camposHistoricoPagamento, orderBy: { criado_em: 'desc' }, take: 100 });
  }
  return { iniciar, consultar, decidir, historico, gerarQr, confirmarQr };
}
export const servicoDemo = criarServicoDemo();

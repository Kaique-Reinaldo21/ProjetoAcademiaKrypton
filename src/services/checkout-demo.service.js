import { randomUUID } from 'node:crypto';
import { accessSync, constants, statSync } from 'node:fs';
import path from 'node:path';
import prisma from '../lib/prisma.js';
import { ErroCheckout } from './checkout.service.js';
import { DESTINOS_DEMO_APROVADOS } from '../config/demo-hosts.js';

const planos = { basico: { nome: 'Básico', centavos: 8900 }, pro: { nome: 'Pro', centavos: 14900 }, elite: { nome: 'Elite', centavos: 24900 } };
export function validarModoDemo(env = process.env, destinosAprovados = DESTINOS_DEMO_APROVADOS) {
  const negar = codigo => { const erro = new ErroCheckout('Demonstração indisponível neste ambiente.', 403); erro.codigoConfiguracao = codigo; throw erro; };
  if (env.PAYMENT_MODE !== 'demo') return negar('PAYMENT_MODE_INVALIDO');
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { return negar('DATABASE_URL_INVALIDA'); }
  if (url.protocol !== 'mysql:' || url.hash) return negar('DATABASE_URL_PROTOCOLO_OU_FRAGMENTO');
  if (env.NODE_ENV === 'development' && url.hostname === '127.0.0.1' && url.port === '3307' && url.pathname === '/academia_kripton_checkout_test' && !url.search) return;
  if (env.NODE_ENV !== 'production') return negar('NODE_ENV_INVALIDO');
  if (env.DEMO_DEPLOYMENT !== 'academico_isolado') return negar('DEMO_DEPLOYMENT_INVALIDO');
  const host = url.hostname.toLowerCase();
  const permitido = (env.DEMO_DATABASE_HOST || '').toLowerCase();
  const banco = env.DEMO_DATABASE_NAME || '';
  if (!permitido || host !== permitido || host === 'localhost' || host === '127.0.0.1' || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host) || !host.includes('.')) return negar('HOST_INVALIDO');
  if (banco === 'b7ah1lmgd5imdjqu51eq' || !/^[A-Za-z0-9_]{1,64}$/.test(banco) || url.pathname !== '/' + banco) return negar('SCHEMA_INVALIDO');
  if (!destinosAprovados.some(destino => destino.host === host && destino.banco === banco && destino.porta === url.port)) return negar('DESTINO_OU_PORTA_NAO_APROVADO');
  const params = url.searchParams;
  if ([...params.keys()].some(p => !['sslcert', 'sslaccept'].includes(p))) return negar('PARAMETRO_NAO_PERMITIDO');
  if (params.getAll('sslcert').length > 1 || (params.has('sslcert') && !params.get('sslcert'))) return negar('SSLCERT_VAZIO_OU_DUPLICADO');
  if (params.get('sslaccept') !== 'strict' || params.getAll('sslaccept').length !== 1) return negar('SSLACCEPT_INVALIDO');
}

// Prisma resolve caminhos relativos de certificado a partir do diretório prisma/.
export function validarArquivoCaDemo(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const caminho = new URL(env.DATABASE_URL).searchParams.get('sslcert');
  if (caminho === null) return;
  try {
    const arquivo = path.resolve(process.cwd(), 'prisma', caminho);
    if (!statSync(arquivo).isFile()) throw new Error('CA inválida');
    accessSync(arquivo, constants.R_OK);
  }
  catch { const erro = new ErroCheckout('Demonstração indisponível neste ambiente.', 403); erro.codigoConfiguracao = 'CA_INACESSIVEL'; throw erro; }
}

export function criarServicoDemo(db = prisma, validar = validarModoDemo) {
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
      await tx.checkout_tentativas.create({ data: { id, usuario_id: aluno.id, tipo, unidade_id: unidade, status: 'pendente' } });
      await tx.transacoes_pagamento.create({ data: { mp_payment_id: 'demo_' + id, usuario_id: aluno.id, tentativa_id: id, valor_centavos: planos[tipo].centavos, moeda: 'BRL', status: 'pending', origem: 'demo' } });
    }, { isolationLevel: 'ReadCommitted' });
    return { url: '/checkout-demo.html?tentativa=' + encodeURIComponent(id), tentativaId: id };
  }
  async function consultar(usuarioId, id) {
    validar();
    const transacao = await db.transacoes_pagamento.findFirst({ where: { tentativa_id: id, usuario_id: Number(usuarioId), origem: 'demo' }, include: { tentativa: true } });
    if (!transacao) throw new ErroCheckout('Checkout não encontrado.', 404);
    const plano = planos[transacao.tentativa.tipo];
    return { tentativaId: id, plano: plano.nome, valor_centavos: transacao.valor_centavos, status: transacao.status };
  }
  async function decidir(usuarioId, id, acao) {
    validar();
    if (!['aprovar', 'pendente', 'recusar'].includes(acao)) throw new ErroCheckout('Ação inválida.');
    return db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${Number(usuarioId)} FOR UPDATE`;
      const transacao = await tx.transacoes_pagamento.findFirst({ where: { tentativa_id: id, usuario_id: Number(usuarioId), origem: 'demo' }, include: { tentativa: true } });
      if (!transacao) throw new ErroCheckout('Checkout não encontrado.', 404);
      if (transacao.status !== 'pending') return { status: transacao.status };
      if (acao === 'pendente') return { status: 'pending' };
      if (acao === 'recusar') {
        await tx.transacoes_pagamento.update({ where: { id: transacao.id }, data: { status: 'rejected', atualizado_em: new Date() } });
        await tx.checkout_tentativas.update({ where: { id }, data: { status: 'recusado' } });
        return { status: 'rejected' };
      }
      await tx.planos.updateMany({ where: { usuario_id: Number(usuarioId), ativo: true }, data: { ativo: false } });
      const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
      const vencimento = new Date(inicio); vencimento.setDate(vencimento.getDate() + 30);
      const plano = await tx.planos.create({ data: { usuario_id: Number(usuarioId), tipo: transacao.tentativa.tipo, unidade_id: transacao.tentativa.unidade_id, ativo: true, inicio, vencimento } });
      await tx.transacoes_pagamento.update({ where: { id: transacao.id }, data: { status: 'approved', plano_id: plano.id, atualizado_em: new Date() } });
      await tx.checkout_tentativas.update({ where: { id }, data: { status: 'confirmado' } });
      return { status: 'approved' };
    }, { isolationLevel: 'ReadCommitted' });
  }
  async function historico(usuarioId) {
    validar();
    return db.transacoes_pagamento.findMany({ where: { usuario_id: Number(usuarioId) }, select: { id: true, origem: true, status: true, valor_centavos: true, moeda: true, criado_em: true, tentativa: { select: { tipo: true } } }, orderBy: { criado_em: 'desc' }, take: 100 });
  }
  return { iniciar, consultar, decidir, historico };
}
export const servicoDemo = criarServicoDemo();

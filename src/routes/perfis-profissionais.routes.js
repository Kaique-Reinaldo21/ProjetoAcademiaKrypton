import { Router } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import prisma from '../lib/prisma.js';
import auth from '../middleware/auth.js';
import { permitirPapeis } from '../middleware/papeis-profissionais.js';
import { responder } from '../controllers/perfis-profissionais.controller.js';
import { criarServicoProfissionais, ErroProfissional, id } from '../services/perfis-profissionais.service.js';
import { criarServicoNotificacoes } from '../services/notificacoes.service.js';
import { criarServicoDocumentos } from '../services/documentos-profissionais.service.js';
import { servicoDemo } from '../services/checkout-demo.service.js';
import { ErroCheckout } from '../services/checkout.service.js';
import { checkoutMetodos } from '../services/checkout-metodos.service.js';
import { emTesteMercadoPago } from '../config/mercadopago-teste.js';
import { criarRotasDocumentos } from './documentos-profissionais.routes.js';
import { dataHojeAcademia, exigirPlanoAtivo } from '../services/elegibilidade-aluno.service.js';

const especialidades = ['personal', 'nutricionista'];
const agenda = ['aluno', 'recepcao', ...especialidades];
const todos = ['admin', ...agenda];

function serializarRevisao(operadorId, alunoId, tipoPlano, unidadeId, metodo) {
  return JSON.stringify({ operadorId, alunoId, tipoPlano, unidadeId, metodo, exp: Date.now() + 5 * 60_000 });
}
function assinarRevisao(conteudo) {
  if (!process.env.JWT_SECRET) throw new ErroCheckout('Revisão indisponível.');
  return createHmac('sha256', process.env.JWT_SECRET).update(conteudo).digest('base64url');
}
function validarTokenRevisao(token, esperado) {
  if (typeof token !== 'string' || token.length > 2048) return false;
  const [conteudo, assinatura, extra] = token.split('.');
  if (!conteudo || !assinatura || extra) return false;
  let payload;
  try { payload = JSON.parse(Buffer.from(conteudo, 'base64url').toString('utf8')); } catch { return false; }
  const atual = Buffer.from(assinatura);
  const correta = Buffer.from(assinarRevisao(conteudo));
  if (atual.length !== correta.length || !timingSafeEqual(atual, correta) || payload.exp <= Date.now()) return false;
  return payload.operadorId === esperado.operadorId && payload.alunoId === esperado.alunoId &&
    payload.tipoPlano === esperado.tipoPlano && payload.unidadeId === esperado.unidadeId && payload.metodo === esperado.metodo;
}

export function criarRotasProfissionais({ autenticar = auth, servico = criarServicoProfissionais(), notificacoes = criarServicoNotificacoes(), documentos = criarServicoDocumentos(), checkoutDemo = servicoDemo, metodosCheckout = checkoutMetodos, db = prisma } = {}) {
  const router = Router();
  router.use(autenticar);
  const exigirElite = exigirPlanoAtivo({ db, elite: true });
  router.post('/recepcao/matricula-simulada/revisar', permitirPapeis('recepcao'), (req, res, next) => {
    if (req.get('Origin') !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ erro: 'Origem da operação inválida.' });
    next();
  }, async (req, res) => {
    try {
      const body = req.body || {};
      if (process.env.PAYMENT_MODE !== 'demo' || emTesteMercadoPago()) throw new ErroCheckout('Matrícula simulada disponível somente no modo acadêmico demo.', 403);
      if (Object.keys(body).some(chave => !['aluno_id', 'tipoPlano', 'unidade_id', 'metodo'].includes(chave)) ||
          !['qr_krypton', 'mercadopago_simulado'].includes(body.metodo)) throw new ErroCheckout('Confira os dados da matrícula.');
      const alunoId = Number(body.aluno_id);
      if (!Number.isSafeInteger(alunoId) || alunoId < 1 || !['basico', 'pro', 'elite'].includes(body.tipoPlano)) throw new ErroCheckout('Selecione um aluno e um plano válidos.');
      const unidadeId = body.tipoPlano === 'basico' ? Number(body.unidade_id) : null;
      if (body.tipoPlano === 'basico' && (!Number.isSafeInteger(unidadeId) || unidadeId < 1)) throw new ErroCheckout('Selecione uma unidade válida.');
      const operador = await db.usuarios.findFirst({ where: { id: Number(req.usuario.id), role: 'recepcao', profissional_ativo: true }, select: { id: true } });
      if (!operador) throw new ErroCheckout('Operador não autorizado.', 403);
      if (!await db.usuarios.findFirst({ where: { id: alunoId, role: 'aluno' }, select: { id: true } })) throw new ErroCheckout('Aluno não encontrado.', 404);
      if (unidadeId && !await db.unidades.findUnique({ where: { id: unidadeId }, select: { id: true } })) throw new ErroCheckout('Unidade não encontrada.', 404);
      const hoje = dataHojeAcademia();
      const duplicada = await db.planos.findFirst({ where: { usuario_id: alunoId, tipo: body.tipoPlano, ativo: true,
        inicio: { lte: hoje }, OR: [{ vencimento: null }, { vencimento: { gte: hoje } }],
        ...(body.tipoPlano === 'basico' && { unidade_id: unidadeId }),
      }, select: { id: true } });
      if (duplicada) throw new ErroCheckout('O aluno já possui esta matrícula ativa.', 409);
      const conteudo = Buffer.from(serializarRevisao(operador.id, alunoId, body.tipoPlano, unidadeId, body.metodo)).toString('base64url');
      return res.json({ revisao: `${conteudo}.${assinarRevisao(conteudo)}`, resumo: metodosCheckout.resumo(body.tipoPlano) });
    } catch (erro) {
      if (erro instanceof ErroCheckout) return res.status(erro.status).json({ erro: erro.message });
      return res.status(500).json({ erro: 'Não foi possível revisar a contratação.' });
    }
  });
  router.get('/contas', permitirPapeis('admin'), responder(() => servico.listarProfissionais()));
  router.post('/contas', permitirPapeis('admin'), responder((_, body) => servico.criarProfissional(body), 201));
  router.patch('/contas/:id', permitirPapeis('admin'), responder((_, body, p) => servico.alterarProfissional(p.id, body)));
  router.put('/contas/:id/alunos/:aluno', permitirPapeis('admin'), responder((_, __, p) => servico.vinculo(p.id, p.aluno)));
  router.delete('/contas/:id/alunos/:aluno', permitirPapeis('admin'), responder((_, __, p) => servico.vinculo(p.id, p.aluno, true)));
  router.get('/alunos', permitirPapeis('admin', 'recepcao'), responder((_, __, ___, q) => servico.buscarAlunos(q.busca, q.vencendo === '30')));
  router.post('/recepcao/alunos', permitirPapeis('recepcao'), responder((_, body) => servico.cadastrarAlunoRecepcao(body), 201));
  router.post('/recepcao/matricula-simulada', permitirPapeis('recepcao'), (req, res, next) => {
    if (req.get('Origin') !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ erro: 'Origem da operação inválida.' });
    next();
  }, async (req, res) => {
    try {
      const body = req.body || {};
      if (process.env.PAYMENT_MODE !== 'demo' || emTesteMercadoPago()) throw new ErroCheckout('Matrícula simulada disponível somente no modo acadêmico demo.', 403);
      if (body.confirmacao !== true || !['qr_krypton', 'mercadopago_simulado'].includes(body.metodo)) throw new ErroCheckout('Revise e confirme a contratação e o método de pagamento simulado.');
      if (Object.keys(body).some(chave => !['aluno_id', 'tipoPlano', 'unidade_id', 'metodo', 'confirmacao', 'revisao'].includes(chave))) throw new ErroCheckout('Confira os dados da matrícula.');
      const usuarioId = Number(body.aluno_id);
      if (!Number.isSafeInteger(usuarioId) || usuarioId < 1 || !['basico', 'pro', 'elite'].includes(body.tipoPlano)) throw new ErroCheckout('Selecione um aluno e um plano válidos.');
      const unidadeId = body.tipoPlano === 'basico' ? Number(body.unidade_id) : null;
      if (body.tipoPlano === 'basico' && (!Number.isSafeInteger(unidadeId) || unidadeId < 1)) throw new ErroCheckout('Selecione uma unidade válida.');
      const operador = await db.usuarios.findFirst({ where: { id: Number(req.usuario.id), role: 'recepcao', profissional_ativo: true }, select: { id: true } });
      if (!operador) throw new ErroCheckout('Operador não autorizado.', 403);
      if (!validarTokenRevisao(body.revisao, { operadorId: operador.id, alunoId: usuarioId, tipoPlano: body.tipoPlano, unidadeId, metodo: body.metodo })) {
        throw new ErroCheckout('A revisão expirou ou os dados foram alterados. Revise e confirme novamente.', 409);
      }
      const aluno = await db.usuarios.findFirst({ where: { id: usuarioId, role: 'aluno' }, select: { id: true } });
      if (!aluno) throw new ErroCheckout('Aluno não encontrado.', 404);
      const hoje = dataHojeAcademia();
      const matriculaIgual = await db.planos.findFirst({ where: { usuario_id: usuarioId, tipo: body.tipoPlano, ativo: true,
        inicio: { lte: hoje }, OR: [{ vencimento: null }, { vencimento: { gte: hoje } }],
        ...(body.tipoPlano === 'basico' && { unidade_id: unidadeId }),
      }, select: { id: true } });
      if (matriculaIgual) throw new ErroCheckout('O aluno já possui esta matrícula ativa.', 409);
      const tentativa = await metodosCheckout.iniciar(usuarioId, body.tipoPlano, unidadeId, body.metodo);
      const codigoAuditoria = 'mat-' + tentativa.tentativaId.replaceAll('-', '');
      await db.auditoria_contas.create({ data: { autor_id: operador.id, usuario_id: usuarioId, evento: codigoAuditoria } });
      return res.status(201).json({ ...tentativa, status: 'pendente', origem: body.metodo === 'qr_krypton' ? 'demo' : 'demo_mercadopago' });
    }
    catch (erro) {
      if (erro instanceof ErroCheckout) return res.status(erro.status).json({ erro: erro.message });
      return res.status(500).json({ erro: 'Não foi possível concluir a matrícula simulada.' });
    }
  });
  router.get('/recepcao/matricula-simulada/pendentes', permitirPapeis('recepcao'), async (req, res) => {
    try {
      if (process.env.PAYMENT_MODE !== 'demo' || emTesteMercadoPago()) throw new ErroCheckout('Matrícula simulada disponível somente no modo acadêmico demo.', 403);
      const operador = await db.usuarios.findFirst({ where: { id: Number(req.usuario.id), role: 'recepcao', profissional_ativo: true }, select: { id: true } });
      if (!operador) throw new ErroCheckout('Operador não autorizado.', 403);
      const iniciadas = await db.auditoria_contas.findMany({ where: { autor_id: operador.id, evento: { startsWith: 'mat-' } },
        orderBy: { id: 'desc' }, take: 200, select: { usuario_id: true, evento: true } });
      const alunos = [...new Set(iniciadas.map(item => item.usuario_id))];
      const tentativas = alunos.length ? await db.checkout_tentativas.findMany({
        where: { usuario_id: { in: alunos }, metodo: { in: ['qr_krypton', 'mercadopago_simulado'] }, status: { in: ['pendente', 'aguardando'] } },
        orderBy: { created_at: 'desc' }, take: 100,
        select: { id: true, usuario_id: true, tipo: true, unidade_id: true, metodo: true, status: true, created_at: true,
          usuarios: { select: { nome: true } } },
      }) : [];
      const codigos = new Set(iniciadas.map(item => item.evento));
      const pendentes = tentativas.filter(item => codigos.has('mat-' + item.id.replaceAll('-', '')))
        .map(({ usuarios, ...item }) => ({ ...item, aluno: usuarios }));
      return res.json({ tentativas: pendentes });
    } catch (erro) {
      if (erro instanceof ErroCheckout) return res.status(erro.status).json({ erro: erro.message });
      return res.status(500).json({ erro: 'Não foi possível recuperar pagamentos pendentes.' });
    }
  });
  router.post('/recepcao/matricula-simulada/:id/confirmar', permitirPapeis('recepcao'), (req, res, next) => {
    if (req.get('Origin') !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ erro: 'Origem da operação inválida.' });
    next();
  }, async (req, res) => {
    try {
      const { acao, confirmacao } = req.body || {};
      if (process.env.PAYMENT_MODE !== 'demo' || emTesteMercadoPago()) throw new ErroCheckout('Matrícula simulada disponível somente no modo acadêmico demo.', 403);
      if (confirmacao !== true || !['aprovar', 'pendente', 'recusar'].includes(acao)) throw new ErroCheckout('Confirme uma resposta de pagamento simulado válida.');
      const tentativa = await db.checkout_tentativas.findUnique({ where: { id: req.params.id }, select: { id: true, usuario_id: true, metodo: true, status: true } });
      if (!tentativa || !['qr_krypton', 'mercadopago_simulado'].includes(tentativa.metodo)) throw new ErroCheckout('Tentativa de matrícula não encontrada.', 404);
      const operador = await db.usuarios.findFirst({ where: { id: Number(req.usuario.id), role: 'recepcao', profissional_ativo: true }, select: { id: true } });
      const codigoAuditoria = 'mat-' + tentativa.id.replaceAll('-', '');
      // A coluna evento é VARCHAR(40); o marcador compacto mantém o vínculo de auditoria dentro do limite.
      const codigoConcluido = 'mat-ok:' + tentativa.id.replaceAll('-', '');
      const iniciada = await db.auditoria_contas.findFirst({ where: { autor_id: operador?.id, usuario_id: tentativa.usuario_id, evento: { in: [codigoAuditoria, codigoConcluido] } }, select: { id: true, evento: true } });
      if (!operador || !iniciada) throw new ErroCheckout('Tentativa não iniciada por esta conta de recepção.', 403);
      let resultado;
      if (tentativa.metodo === 'qr_krypton') resultado = await checkoutDemo.decidir(tentativa.usuario_id, tentativa.id, acao);
      else resultado = await metodosCheckout.simularResposta(tentativa.usuario_id, tentativa.id, acao);
      if (acao !== 'pendente' && ['pendente', 'aguardando'].includes(tentativa.status)) {
        await db.auditoria_contas.updateMany({ where: { id: iniciada.id, evento: codigoAuditoria }, data: { evento: codigoConcluido } });
      }
      const status = resultado.status === 'approved' ? 'approved' : resultado.status === 'rejected' ? 'rejected' : 'pending';
      return res.json({ tentativaId: tentativa.id, status, origem: tentativa.metodo === 'qr_krypton' ? 'demo' : 'demo_mercadopago' });
    } catch (erro) {
      if (erro instanceof ErroCheckout) return res.status(erro.status).json({ erro: erro.message });
      return res.status(500).json({ erro: 'Não foi possível confirmar o pagamento simulado.' });
    }
  });
  router.get('/meus-alunos', permitirPapeis(...especialidades), responder(u => servico.meusAlunos(u)));
  router.get('/opcoes', permitirPapeis('aluno', 'recepcao'), exigirElite, responder((u, _, __, q) => servico.opcoes(u.role === 'aluno' ? u.id : id(q.aluno_id))));
  router.get('/unidades', permitirPapeis('aluno', 'recepcao'), responder(() => servico.unidades()));
  router.get('/agenda', permitirPapeis(...agenda), exigirElite, responder(u => servico.agenda(u)));
  router.post('/agenda', permitirPapeis('aluno', 'recepcao'), exigirElite, responder((u, b) => servico.agendar(u, b), 201));
  router.patch('/agenda/:id', permitirPapeis(...agenda), exigirElite, responder((u, b, p) => servico.atualizarAgenda(u, p.id, b)));
  router.get('/recepcao', permitirPapeis('recepcao'), responder((_, __, ___, q) => servico.resumoRecepcao(q)));
  router.post('/recepcao', permitirPapeis('recepcao'), responder((u, b) => servico.registrarAtendimento(u, b), 201));
  router.get('/fichas', permitirPapeis('aluno', ...especialidades), exigirElite, responder((u, _, __, q) => servico.listarFichas(u, q.tipo)));
  router.post('/fichas', permitirPapeis(...especialidades), responder((u, b) => servico.salvarFicha(u, b), 201));
  router.put('/fichas/:id', permitirPapeis(...especialidades), responder((u, b, p) => servico.salvarFicha(u, b, p.id)));
  router.get('/notificacoes', permitirPapeis(...todos), responder(u => notificacoes.listar(u.id)));
  router.patch('/notificacoes/lidas', permitirPapeis(...todos), responder(async u => ({ marcada: await notificacoes.marcar(u.id) })));
  router.patch('/notificacoes/:id', permitirPapeis(...todos), responder(async (u, _, p) => {
    if (!await notificacoes.marcar(u.id, id(p.id))) throw new ErroProfissional(404, 'Notificação não encontrada.');
    return { marcada: true };
  }));
  router.use('/documentos', criarRotasDocumentos({ servico: documentos }));
  return router;
}

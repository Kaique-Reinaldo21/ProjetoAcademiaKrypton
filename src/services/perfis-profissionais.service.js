import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import prisma from '../lib/prisma.js';
import { normalizarEmail } from './contas.service.js';
import { erroNovaSenha, gerarHashSenha } from './politica-senha.js';
import { enfileirar } from '../queues/notificacoes.queue.js';
import { criarServicoElegibilidadeAluno } from './elegibilidade-aluno.service.js';

export class ErroProfissional extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}
const recusar = (status, msg) => { throw new ErroProfissional(status, msg); };
const profissionais = ['personal', 'nutricionista', 'recepcao'];
const especialistas = ['personal', 'nutricionista'];
const pessoa = { id: true, nome: true, role: true, profissional_ativo: true };
const planoPublico = { tipo: true, ativo: true, vencimento: true, unidade_id: true };
const alunoPublico = { id: true, nome: true };
const agendaPublica = {
  id: true, usuario_id: true, profissional_id: true, unidade_id: true, tipo: true, data_hora: true, situacao: true,
  usuarios: { select: alunoPublico }, profissional: { select: pessoa }, unidade: { select: { id: true, nome: true } },
};

export function id(valor) {
  if (!['string', 'number'].includes(typeof valor) || !/^\d+$/.test(String(valor))) recusar(400, 'Identificador inválido.');
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 1 || numero > 4294967295) recusar(400, 'Identificador inválido.');
  return numero;
}
function texto(valor, max, opcional = false) {
  if (opcional && (valor == null || valor === '')) return null;
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > max) recusar(400, 'Confira os campos de texto e seus limites.');
  return valor.trim();
}
function dataFutura(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(valor)) recusar(400, 'Informe a data da consulta.');
  const data = new Date(valor);
  if (!Number.isFinite(data.valueOf()) || data.getTime() <= Date.now()) recusar(400, 'Informe uma data futura.');
  data.setUTCSeconds(0, 0);
  if (data.getTime() <= Date.now()) recusar(400, 'Informe um horário futuro.');
  return data;
}
function fichaEntrada(body, tipo) {
  if (!Array.isArray(body.itens) || body.itens.length < 1 || body.itens.length > 40) recusar(400, 'Informe de 1 a 40 itens.');
  const itens = body.itens.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) recusar(400, 'Item inválido.');
    if (tipo === 'personal') {
      const series = Number(item.series);
      if (!Number.isInteger(series) || series < 1 || series > 30) recusar(400, 'Informe de 1 a 30 séries.');
      return {
        divisao: texto(item.divisao, 60), nome: texto(item.nome, 100), series,
        repeticoes: texto(item.repeticoes, 40), carga: texto(item.carga, 40, true),
        descanso: texto(item.descanso, 40, true), orientacoes: texto(item.orientacoes, 300, true),
      };
    }
    const horario = texto(item.horario, 5);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) recusar(400, 'Horário da refeição inválido.');
    return {
      refeicao: texto(item.refeicao, 60), horario, alimentos: texto(item.alimentos, 300),
      quantidades: texto(item.quantidades, 200), orientacoes: texto(item.orientacoes, 300, true),
    };
  });
  return { titulo: texto(body.titulo, 120), itens, orientacoes: texto(body.orientacoes, 2000, true) };
}

export function criarServicoProfissionais(db = prisma) {
  const elegibilidade = criarServicoElegibilidadeAluno(db);
  async function aluno(tx, alunoId) {
    const encontrado = await tx.usuarios.findFirst({ where: { id: alunoId, role: 'aluno' }, select: alunoPublico });
    if (!encontrado) recusar(404, 'Aluno não encontrado.');
    return encontrado;
  }
  async function exigirElite(tx, alunoId) {
    const atual = await criarServicoElegibilidadeAluno(tx).exigirElite(alunoId);
    if (!atual) recusar(403, 'Disponível para alunos com plano Elite ativo e vigente.');
    return atual;
  }
  async function exigirVinculo(tx, alunoId, profissionalId, tipo) {
    const vinculo = await tx.vinculos_profissionais.findFirst({
      where: { aluno_id: alunoId, profissional_id: profissionalId, profissional: { role: tipo, profissional_ativo: true } },
      select: { profissional_id: true },
    });
    if (!vinculo) recusar(404, 'Vínculo profissional não encontrado.');
  }
  async function travarAluno(tx, alunoId) {
    const linhas = await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${alunoId} AND role = 'aluno' FOR UPDATE`;
    if (!linhas.length) recusar(404, 'Aluno não encontrado.');
  }
  async function notificarConsulta(tx, tipo, consulta) {
    const recepcao = await tx.usuarios.findMany({ where: { role: 'recepcao', profissional_ativo: true }, select: { id: true } });
    await enfileirar(tx, tipo, tipo + ':' + consulta.id + ':' + randomUUID(),
      [consulta.usuario_id, consulta.profissional_id, ...recepcao.map(u => u.id)].filter(Boolean));
  }

  return {
    async criarProfissional(body) {
      const email = normalizarEmail(body.email);
      if (!email || !profissionais.includes(body.role)) recusar(400, 'Informe e-mail e papel profissional válidos.');
      const nome = texto(body.nome, 120);
      const erro = erroNovaSenha(body.senha);
      if (erro) recusar(400, erro);
      const senha_hash = await gerarHashSenha(body.senha);
      return db.usuarios.create({ data: { email, nome, role: body.role, senha_hash }, select: pessoa });
    },
    listarProfissionais() {
      return db.usuarios.findMany({ where: { role: { in: profissionais } }, orderBy: { nome: 'asc' },
        select: { ...pessoa, email: true, vinculos_profissional: { select: { aluno: { select: alunoPublico } } } } });
    },
    async alterarProfissional(profissionalId, body) {
      const data = {};
      if (body.nome !== undefined) data.nome = texto(body.nome, 120);
      if (body.ativo !== undefined) {
        if (typeof body.ativo !== 'boolean') recusar(400, 'Situação inválida.');
        data.profissional_ativo = body.ativo;
      }
      if (body.senha !== undefined) {
        const erro = erroNovaSenha(body.senha);
        if (erro) recusar(400, erro);
        data.senha_hash = await gerarHashSenha(body.senha);
      }
      if (!Object.keys(data).length) recusar(400, 'Informe o que deseja alterar.');
      if (body.ativo !== undefined || body.senha !== undefined) data.versao_sessao = { increment: 1 };
      const alteracao = await db.usuarios.updateMany({ where: { id: id(profissionalId), role: { in: profissionais } }, data });
      if (!alteracao.count) recusar(404, 'Profissional não encontrado.');
      return { atualizado: true };
    },
    async vinculo(profissionalId, alunoId, remover = false) {
      profissionalId = id(profissionalId);
      alunoId = id(alunoId);
      return db.$transaction(async tx => {
        await travarAluno(tx, alunoId);
        if (remover) {
          await tx.vinculos_profissionais.deleteMany({ where: { aluno_id: alunoId, profissional_id: profissionalId } });
          return { vinculado: false };
        }
        if (!await tx.usuarios.findFirst({ where: { id: profissionalId, role: { in: especialistas }, profissional_ativo: true }, select: { id: true } })) recusar(404, 'Especialista indisponível.');
        const existente = await tx.vinculos_profissionais.findUnique({
          where: { aluno_id_profissional_id: { aluno_id: alunoId, profissional_id: profissionalId } }, select: { aluno_id: true },
        });
        await tx.vinculos_profissionais.upsert({
          where: { aluno_id_profissional_id: { aluno_id: alunoId, profissional_id: profissionalId } },
          create: { aluno_id: alunoId, profissional_id: profissionalId }, update: {},
        });
        return { vinculado: true, existente: Boolean(existente) };
      });
    },
    async buscarAlunos(busca, vencendo = false) {
      const filtro = typeof busca === 'string' ? busca.trim().slice(0, 120) : '';
      const agora = new Date();
      agora.setUTCHours(0, 0, 0, 0);
      const limite = new Date(agora);
      limite.setUTCDate(limite.getUTCDate() + 30);
      return db.usuarios.findMany({ where: { role: 'aluno', ...(filtro && { nome: { contains: filtro } }),
        ...(vencendo && { planos: { some: { ativo: true, vencimento: { gte: agora, lte: limite } } } }),
      },
        orderBy: [{ nome: 'asc' }, { id: 'asc' }], take: 50, select: {
          ...alunoPublico, planos: { where: { ativo: true }, take: 1, orderBy: { id: 'desc' }, select: planoPublico },
        } });
    },
    async cadastrarAlunoRecepcao(body) {
      const permitidos = ['nome', 'email', 'senha', 'data_nascimento'];
      if (!body || Object.keys(body).some(chave => !permitidos.includes(chave))) recusar(400, 'Confira os dados do cadastro.');
      const nome = texto(body.nome, 120);
      const email = normalizarEmail(body.email);
      if (!email) recusar(400, 'Informe um e-mail válido.');
      const erro = erroNovaSenha(body.senha, body.senha, 'aluno');
      if (erro) recusar(400, erro);
      if (typeof body.data_nascimento !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.data_nascimento)) {
        recusar(400, 'Informe uma data de nascimento válida.');
      }
      const nascimento = new Date(`${body.data_nascimento}T00:00:00.000Z`);
      if (!Number.isFinite(nascimento.valueOf()) || nascimento.toISOString().slice(0, 10) !== body.data_nascimento || nascimento > new Date()) {
        recusar(400, 'Informe uma data de nascimento válida.');
      }
      const senha_hash = await gerarHashSenha(body.senha);
      return db.usuarios.create({ data: { nome, email, senha_hash, data_nascimento: nascimento, role: 'aluno' },
        select: { id: true, nome: true, email: true, role: true } });
    },
    meusAlunos(ator) {
      return db.vinculos_profissionais.findMany({ where: { profissional_id: ator.id }, orderBy: { aluno_id: 'asc' },
        select: { aluno: { select: alunoPublico } } });
    },
    unidades() {
      return db.unidades.findMany({ select: { id: true, nome: true }, orderBy: { nome: 'asc' } });
    },
    async opcoes(alunoId) {
      const atual = await elegibilidade.exigirElite(alunoId);
      if (!atual) recusar(403, 'Disponível para alunos com plano Elite ativo e vigente.');
      return db.vinculos_profissionais.findMany({ where: {
        aluno_id: alunoId, profissional: { profissional_ativo: true, role: { in: especialistas } },
      }, select: { profissional: { select: pessoa } } });
    },
    agenda(ator) {
      const where = ator.role === 'aluno' ? { usuario_id: ator.id } :
        especialistas.includes(ator.role) ? { profissional_id: ator.id } : {};
      return db.agendamentos.findMany({ where, orderBy: [{ data_hora: 'desc' }, { id: 'desc' }], take: 100, select: agendaPublica });
    },
    async agendar(ator, body) {
      const alunoId = ator.role === 'aluno' ? ator.id : id(body.aluno_id);
      if (!especialistas.includes(body.tipo)) recusar(400, 'Tipo de consulta inválido.');
      const data_hora = dataFutura(body.data_hora);
      const unidadePedida = body.unidade_id == null || body.unidade_id === '' ? null : id(body.unidade_id);
      return db.$transaction(async tx => {
        await travarAluno(tx, alunoId);
        const atual = await exigirElite(tx, alunoId);
        let profissionalId;
        if (body.profissional_id == null || body.profissional_id === '') {
          const opcoes = await tx.vinculos_profissionais.findMany({ where: { aluno_id: alunoId,
            profissional: { role: body.tipo, profissional_ativo: true },
          }, take: 2, select: { profissional_id: true } });
          if (opcoes.length !== 1) recusar(400, 'Selecione um profissional vinculado.');
          profissionalId = opcoes[0].profissional_id;
        } else {
          profissionalId = id(body.profissional_id);
        }
        await exigirVinculo(tx, alunoId, profissionalId, body.tipo);
        const unidade_id = unidadePedida ?? atual.unidade_id;
        if (unidade_id && !await tx.unidades.findUnique({ where: { id: unidade_id }, select: { id: true } })) recusar(404, 'Unidade não encontrada.');
        const consulta = await tx.agendamentos.create({ data: {
          usuario_id: alunoId, profissional_id: profissionalId, unidade_id, tipo: body.tipo, data_hora,
          vaga: profissionalId + ':' + data_hora.toISOString(), observacao: texto(body.observacao, 500, true),
        }, select: agendaPublica });
        await notificarConsulta(tx, 'consulta_agendada', consulta);
        return consulta;
      });
    },
    async atualizarAgenda(ator, consultaId, body) {
      const consulta = id(consultaId);
      const acao = body.acao;
      if (!['confirmar', 'cancelar', 'reagendar', 'concluir'].includes(acao)) recusar(400, 'Ação inválida.');
      if (ator.role === 'aluno' && acao !== 'cancelar') recusar(403, 'Ação não autorizada.');
      return db.$transaction(async tx => {
        const antiga = await tx.agendamentos.findFirst({ where: { id: consulta,
          ...(ator.role === 'aluno' && { usuario_id: ator.id }),
          ...(especialistas.includes(ator.role) && { profissional_id: ator.id, tipo: ator.role }),
        }, select: agendaPublica });
        if (!antiga) recusar(404, 'Consulta não encontrada.');
        if (['cancelado', 'concluido'].includes(antiga.situacao)) recusar(409, 'A consulta já está encerrada.');
        if (acao === 'confirmar' && antiga.situacao !== 'agendado') recusar(409, 'A consulta já está confirmada.');
        if (acao === 'concluir' && antiga.situacao !== 'confirmado') recusar(409, 'Confirme a consulta antes de concluir.');
        const data = { situacao: { confirmar: 'confirmado', cancelar: 'cancelado', concluir: 'concluido', reagendar: 'agendado' }[acao] };
        if (acao === 'cancelar' || acao === 'concluir') data.vaga = null;
        if (acao === 'reagendar') {
          if (!antiga.profissional_id) recusar(409, 'Consulta legada sem profissional. Crie uma nova consulta vinculada.');
          await exigirElite(tx, antiga.usuario_id);
          await exigirVinculo(tx, antiga.usuario_id, antiga.profissional_id, antiga.tipo);
          data.data_hora = dataFutura(body.data_hora);
          if (+data.data_hora === +antiga.data_hora) recusar(400, 'Informe um novo horário.');
          data.vaga = antiga.profissional_id + ':' + data.data_hora.toISOString();
        }
        const alteracao = await tx.agendamentos.updateMany({
          where: { id: consulta, situacao: antiga.situacao, data_hora: antiga.data_hora }, data,
        });
        if (!alteracao.count) recusar(409, 'A consulta foi atualizada. Recarregue a agenda.');
        const atual = await tx.agendamentos.findUnique({ where: { id: consulta }, select: agendaPublica });
        const evento = { confirmar: 'consulta_confirmada', cancelar: 'consulta_cancelada', reagendar: 'consulta_reagendada' }[acao];
        if (evento) await notificarConsulta(tx, evento, atual);
        return atual;
      });
    },
    async registrarAtendimento(ator, body) {
      const alunoId = id(body.aluno_id);
      const unidade_id = body.unidade_id == null || body.unidade_id === '' ? null : id(body.unidade_id);
      await aluno(db, alunoId);
      if (unidade_id && !await db.unidades.findUnique({ where: { id: unidade_id }, select: { id: true } })) recusar(404, 'Unidade não encontrada.');
      return db.atendimentos_recepcao.create({ data: { aluno_id: alunoId, autor_id: ator.id, unidade_id, motivo: texto(body.motivo, 160) } });
    },
    async resumoRecepcao(filtros = {}) {
      const inicio = new Date();
      inicio.setUTCHours(0, 0, 0, 0);
      const hoje = await db.atendimentos_recepcao.count({ where: { criado_em: { gte: inicio } } });
      const consultas = await db.agendamentos.count({ where: { data_hora: { gte: new Date() }, situacao: { in: ['agendado', 'confirmado'] } } });
      const cadastrosRecentes = await db.usuarios.findMany({ where: { role: 'aluno' }, take: 10, orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        select: { id: true, nome: true, created_at: true } });
      const matriculasRecentes = await db.planos.findMany({ where: { usuarios: { role: 'aluno' } }, take: 10, orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
        select: { id: true, tipo: true, ativo: true, inicio: true, vencimento: true, unidade_id: true, usuarios: { select: alunoPublico } } });
      const busca = typeof filtros.busca === 'string' ? filtros.busca.trim().slice(0, 120) : '';
      const parseDia = valor => {
        if (!valor) return undefined;
        if (typeof valor !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(valor)) recusar(400, 'Período inválido.');
        const data = new Date(`${valor}T00:00:00.000Z`);
        if (!Number.isFinite(data.valueOf()) || data.toISOString().slice(0, 10) !== valor) recusar(400, 'Período inválido.');
        return data;
      };
      const de = parseDia(filtros.de), ate = parseDia(filtros.ate);
      if (de && ate && de > ate) recusar(400, 'O início do período deve anteceder o fim.');
      if (de) de.setUTCHours(0, 0, 0, 0);
      if (ate) ate.setUTCHours(23, 59, 59, 999);
      const ultimos = await db.atendimentos_recepcao.findMany({ take: 100, orderBy: { id: 'desc' },
        where: { ...(busca && { aluno: { nome: { contains: busca }, role: 'aluno' } }),
          ...((de || ate) && { criado_em: { ...(de && { gte: de }), ...(ate && { lte: ate }) } }) },
        select: { id: true, motivo: true, criado_em: true, aluno: { select: alunoPublico }, unidade: { select: { nome: true } } } });
      return { hoje, consultas, ultimos, cadastrosRecentes, matriculasRecentes };
    },
    async listarFichas(ator, tipo) {
      if (ator.role === 'aluno') {
        if (!especialistas.includes(tipo)) recusar(400, 'Tipo inválido.');
        if (!await elegibilidade.exigirElite(ator.id)) recusar(403, 'Fichas profissionais exigem plano Elite ativo e vigente.');
        return db.fichas_profissionais.findMany({ where: { aluno_id: ator.id, tipo }, orderBy: { atualizado_em: 'desc' }, take: 100,
          include: { profissional: { select: { nome: true } } } });
      }
      return db.fichas_profissionais.findMany({ where: { profissional_id: ator.id, tipo: ator.role,
        aluno: { vinculos_aluno: { some: { profissional_id: ator.id } } },
      }, orderBy: { atualizado_em: 'desc' }, take: 100, include: { profissional: { select: { nome: true } } } });
    },
    async salvarFicha(ator, body, fichaId) {
      const alunoId = id(body.aluno_id);
      const entrada = fichaEntrada(body, ator.role);
      return db.$transaction(async tx => {
        await travarAluno(tx, alunoId);
        await exigirVinculo(tx, alunoId, ator.id, ator.role);
        await exigirElite(tx, alunoId);
        let ficha;
        if (fichaId) {
          const where = { id: id(fichaId), aluno_id: alunoId, profissional_id: ator.id, tipo: ator.role };
          const anterior = await tx.fichas_profissionais.findFirst({ where });
          if (!anterior) recusar(404, 'Ficha não encontrada.');
          if (anterior.titulo === entrada.titulo && anterior.orientacoes === entrada.orientacoes &&
              isDeepStrictEqual(anterior.itens, entrada.itens)) return anterior;
          ficha = await tx.fichas_profissionais.update({ where, data: entrada });
        } else {
          const where = { aluno_id: alunoId, profissional_id: ator.id, tipo: ator.role };
          const candidatas = await tx.fichas_profissionais.findMany({ where: { ...where, titulo: entrada.titulo } });
          const duplicada = candidatas.find(a => a.orientacoes === entrada.orientacoes && isDeepStrictEqual(a.itens, entrada.itens));
          if (duplicada) return duplicada;
          ficha = await tx.fichas_profissionais.create({ data: { ...entrada, ...where } });
        }
        const tipo = ator.role === 'personal' ? (fichaId ? 'treino_atualizado' : 'treino_publicado') :
          (fichaId ? 'alimentacao_atualizada' : 'alimentacao_publicada');
        await enfileirar(tx, tipo, tipo + ':' + ficha.id + ':' + randomUUID(), [alunoId, ator.id]);
        return ficha;
      });
    },
  };
}

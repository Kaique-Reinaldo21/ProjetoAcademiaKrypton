import prisma from '../lib/prisma.js';

const formatoDia = new Intl.DateTimeFormat('en', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function dataHojeAcademia() {
  const partes = Object.fromEntries(formatoDia.formatToParts(new Date()).map(({ type, value }) => [type, value]));
  return new Date(Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day)));
}

/** Busca um plano ativo e vigente diretamente no banco, ignorando tentativas pendentes. */
export function criarServicoElegibilidadeAluno(db = prisma) {
  return {
    planoAtivo(alunoId) {
      const hoje = dataHojeAcademia();
      return db.planos.findFirst({
        where: {
          usuario_id: Number(alunoId),
          ativo: true,
          inicio: { lte: hoje },
          OR: [{ vencimento: null }, { vencimento: { gte: hoje } }],
        },
        orderBy: { id: 'desc' },
        select: { id: true, tipo: true, ativo: true, inicio: true, vencimento: true, unidade_id: true },
      });
    },
    async exigirAtivo(alunoId) {
      const plano = await this.planoAtivo(alunoId);
      return plano || null;
    },
    async exigirElite(alunoId) {
      const plano = await this.planoAtivo(alunoId);
      return plano?.tipo === 'elite' ? plano : null;
    },
  };
}

export function exigirPlanoAtivo({ db = prisma, elite = false } = {}) {
  const elegibilidade = criarServicoElegibilidadeAluno(db);
  return async (req, res, next) => {
    if (req.usuario?.role !== 'aluno') return next();
    try {
      const plano = elite
        ? await elegibilidade.exigirElite(req.usuario.id)
        : await elegibilidade.exigirAtivo(req.usuario.id);
      if (!plano) {
        return res.status(403).json({
          erro: elite
            ? 'Esta funcionalidade exige plano Elite ativo e vigente.'
            : 'É necessária uma matrícula ativa e vigente para acessar este serviço.',
        });
      }
      req.planoAluno = plano;
      return next();
    } catch {
      return res.status(503).json({ erro: 'Não foi possível validar a matrícula. Tente novamente.' });
    }
  };
}

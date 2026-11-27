import prisma from '../lib/prisma.js';

export function criarServicoNotificacoes(db = prisma) {
  const where = destinatario_id => ({ destinatario_id });
  return {
    async listar(usuario) {
      const itens = await db.notificacoes.findMany({
        where: where(usuario), orderBy: [{ criado_em: 'desc' }, { id: 'desc' }], take: 50,
        select: { id: true, categoria: true, titulo: true, mensagem: true, destino: true, criado_em: true, lida_em: true },
      });
      const nao_lidas = await db.notificacoes.count({ where: { ...where(usuario), lida_em: null } });
      return { itens, nao_lidas };
    },
    async marcar(usuario, id) {
      const filtro = { ...where(usuario), ...(id !== undefined && { id }) };
      const resultado = await db.notificacoes.updateMany({ where: { ...filtro, lida_em: null }, data: { lida_em: new Date() } });
      if (id === undefined || resultado.count) return true;
      return Boolean(await db.notificacoes.findFirst({ where: filtro, select: { id: true } }));
    },
  };
}

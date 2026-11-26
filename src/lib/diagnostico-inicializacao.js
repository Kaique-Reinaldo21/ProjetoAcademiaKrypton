// Nunca retorna mensagens, pilhas ou valores vindos da configuração.
export function diagnosticarInicializacao(erro) {
  const nomes = new Set(['PrismaClientInitializationError', 'PrismaClientKnownRequestError', 'PrismaClientUnknownRequestError', 'PrismaClientRustPanicError', 'PrismaClientValidationError', 'Error', 'TypeError']);
  const classe = nomes.has(erro?.name) ? erro.name : 'Desconhecida';
  const codigosRede = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN']);
  const permitido = valor => typeof valor === 'string' && (/^P[0-9]{4}$/.test(valor) || codigosRede.has(valor));
  const codigo = [erro?.errorCode, erro?.code].find(permitido) || 'INDISPONIVEL';
  const categorias = { P1000: 'autenticacao', P1001: 'servidor_inalcancavel', P1002: 'tempo_de_conexao_esgotado', P1011: 'tls', P2021: 'tabela_ausente', P2022: 'coluna_ausente', P2024: 'pool_esgotado', ECONNREFUSED: 'conexao_recusada', ECONNRESET: 'conexao_interrompida', ETIMEDOUT: 'tempo_de_conexao_esgotado', ENOTFOUND: 'dns', EAI_AGAIN: 'dns' };
  return { categoria: categorias[codigo] || (codigo.startsWith('P') ? 'prisma_outro' : 'desconhecida'), classe, codigo };
}

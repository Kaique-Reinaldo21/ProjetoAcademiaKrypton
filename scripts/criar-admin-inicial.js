import { readFileSync } from 'node:fs';
import prisma from '../src/lib/prisma.js';
import { normalizarEmail } from '../src/services/contas.service.js';
import { erroNovaSenha, gerarHashSenha } from '../src/services/politica-senha.js';

class ErroConfiguracao extends Error {}

async function criarAdmin() {
  if (!process.env.DATABASE_URL || process.env.ADMIN_INICIAL_CONFIRMACAO !== 'CRIAR_PRIMEIRO_ADMIN') {
    throw new ErroConfiguracao('Informe o banco explicitamente e confirme a operação.');
  }

  const email = normalizarEmail(process.env.ADMIN_INICIAL_EMAIL);
  const nome = process.env.ADMIN_INICIAL_NOME?.trim();
  const nascimento = process.env.ADMIN_INICIAL_NASCIMENTO || '';
  const data = new Date(nascimento + 'T00:00:00.000Z');
  if (!email || !nome || nome.length > 120 || !/^\d{4}-\d{2}-\d{2}$/.test(nascimento) ||
      !Number.isFinite(+data) || data.toISOString().slice(0, 10) !== nascimento || data > new Date()) {
    throw new ErroConfiguracao('Informe nome, e-mail e data de nascimento válidos.');
  }
  if (process.stdin.isTTY) throw new ErroConfiguracao('Envie a senha pela entrada padrão protegida.');
  const senha = readFileSync(0, 'utf8');
  const erro = erroNovaSenha(senha);
  if (erro) throw new ErroConfiguracao(erro);
  const senha_hash = await gerarHashSenha(senha);

  await prisma.$transaction(async tx => {
    const admins = await tx.$queryRaw`SELECT id FROM usuarios WHERE role = 'admin' FOR UPDATE`;
    if (admins.length) throw new ErroConfiguracao('Já existe administrador neste banco.');
    if (await tx.usuarios.findUnique({ where: { email }, select: { id: true } })) {
      throw new ErroConfiguracao('Já existe uma conta com o e-mail informado.');
    }
    const conta = await tx.usuarios.create({
      data: { email, nome, data_nascimento: data, role: 'admin', senha_hash },
      select: { id: true },
    });
    await tx.auditoria_contas.create({ data: { usuario_id: conta.id, evento: 'admin_inicial_criado' } });
  }, { isolationLevel: 'Serializable' });
  console.log('Administrador inicial criado.');
}

try {
  await criarAdmin();
} catch (erro) {
  console.error(erro instanceof ErroConfiguracao ? erro.message : 'Não foi possível criar o administrador inicial.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

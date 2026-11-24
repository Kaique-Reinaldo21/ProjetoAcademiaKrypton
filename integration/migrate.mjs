import { spawn } from 'node:child_process';
import { validarUrlTeste } from './mysql-guard.mjs';
const url = validarUrlTeste(process.env.DATABASE_URL);
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url } } });
try {
  const rows = await prisma.$queryRaw`SELECT DATABASE() AS db, VERSION() AS versao`;
  if (rows[0].db !== 'academia_kripton_checkout_test' || !/^8\./.test(rows[0].versao)) throw new Error('Banco ou versão MySQL inválidos.');
} finally { await prisma.$disconnect(); }
// A conexão prévia exige que o banco já exista; não cria bancos nem concede permissões.
const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });

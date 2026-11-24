// Execução manual apenas após provisionar e aprovar o banco acadêmico isolado.
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { validarModoDemo } from '../src/services/checkout-demo.service.js';
import { PrismaClient } from '@prisma/client';

if (process.env.NODE_ENV !== 'production') throw new Error('Este comando é exclusivo para demo hospedada.');
validarModoDemo();
const prisma = new PrismaClient();
try {
  await prisma.$transaction(async tx => {
    const [info] = await tx.$queryRaw`SELECT DATABASE() AS db, VERSION() AS versao`;
    const [tls] = await tx.$queryRaw`SHOW STATUS LIKE 'Ssl_cipher'`;
    if (info.db !== process.env.DEMO_DATABASE_NAME || !/^8\./.test(info.versao) || !tls?.Value) {
      throw new Error('Banco, versão MySQL ou conexão TLS incompatível.');
    }
  });
} finally { await prisma.$disconnect(); }
const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'inherit', env: process.env });
child.on('error', error => { console.error('Falha ao iniciar migrations:', error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });

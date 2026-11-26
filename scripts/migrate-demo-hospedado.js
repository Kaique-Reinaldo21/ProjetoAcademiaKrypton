// Execução manual para um único banco acadêmico explicitamente autorizado.
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { AVISO_TLS_DEMO, validarArquivoCaDemo, validarModoDemo } from '../src/services/checkout-demo.service.js';
import { destinoAcademico } from '../src/config/demo-hosts.js';
import { diagnosticarInicializacao } from '../src/lib/diagnostico-inicializacao.js';

function recusar(codigoConfiguracao) {
  throw Object.assign(new Error('Verificação do banco demo falhou.'), { codigoConfiguracao });
}

async function executar(args) {
  if (args.length !== 1 || !['--verificar', '--status', '--aplicar'].includes(args[0])) {
    recusar('ARGUMENTO_INVALIDO');
  }
  if (process.env.NODE_ENV !== 'production') recusar('NODE_ENV_INVALIDO');
  const sslaccept = validarModoDemo();
  validarArquivoCaDemo();
  if (sslaccept) console.warn(AVISO_TLS_DEMO);

  const destino = destinoAcademico(process.env.DEMO_DEPLOYMENT);
  const { default: prisma } = await import('../src/lib/prisma.js');
  try {
    await prisma.$transaction(async tx => {
      const [info] = await tx.$queryRaw`SELECT DATABASE() AS db, VERSION() AS versao`;
      const [tls] = await tx.$queryRaw`SHOW SESSION STATUS LIKE 'Ssl_cipher'`;
      if (info?.db !== destino.banco || !/^8\./.test(info.versao) || !tls?.Value) {
        recusar('BANCO_VERSAO_OU_TLS_INCOMPATIVEL');
      }
    });
    console.log('Schema acadêmico confirmado. MySQL 8 com cifra TLS negociada.');
  } finally {
    await prisma.$disconnect();
  }
  if (args[0] === '--verificar') return;

  const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', args[0] === '--status' ? 'status' : 'deploy'], { stdio: 'inherit', env: process.env });
  child.on('error', () => { console.error('Falha ao iniciar migrations.'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}

try {
  await executar(process.argv.slice(2));
} catch (error) {
  console.error('Verificação do banco demo falhou.', error.codigoConfiguracao ?? diagnosticarInicializacao(error));
  process.exitCode = 1;
}

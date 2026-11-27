import 'dotenv/config';
import { iniciarWorker, workerAutorizado } from '../src/workers/notificacoes.worker.js';

if (!workerAutorizado(process.env)) {
  console.warn('Worker de notificações desativado para este ambiente.');
  process.exitCode = 1;
} else {
  const { default: prisma } = await import('../src/lib/prisma.js');
  const parar = await iniciarWorker(prisma);
  if (!parar) {
    process.exitCode = 1;
    await prisma.$disconnect();
  } else {
    let encerrando = false;
    async function encerrar() {
      if (encerrando) return;
      encerrando = true;
      await parar();
      await prisma.$disconnect();
    }
    process.on('SIGTERM', encerrar);
    process.on('SIGINT', encerrar);
  }
}

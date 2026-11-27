import { exigeModoAcademico, exigeModoOficial } from '../config/demo-hosts.js';
import { validarTlsBanco } from '../services/checkout-demo.service.js';
import { processarNotificacao } from '../jobs/notificacoes.job.js';
import { adquirir, registrarFalha } from '../queues/notificacoes.queue.js';

export function workerAutorizado(env) {
  if (env.KRYPTON_WORKER_NOTIFICACOES !== '1') return false;
  if (env.NODE_ENV === 'production') return exigeModoOficial(env) && env.DEMO_DEPLOYMENT === 'academico_oficial';
  if (env.NODE_ENV !== 'development' || exigeModoAcademico(env) || env.RENDER || !URL.canParse(env.DATABASE_URL)) return false;
  const url = new URL(env.DATABASE_URL);
  return url.protocol === 'mysql:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.search && !url.hash;
}

export async function processarUmaVez(db, processar = processarNotificacao) {
  const job = await adquirir(db, 60_000);
  if (!job) return false;
  try {
    await processar(db, job);
  } catch {
    await registrarFalha(db, job);
  }
  return true;
}

export async function iniciarWorker(db, env = process.env) {
  if (!workerAutorizado(env)) return;
  if (env.NODE_ENV === 'production') validarTlsBanco(env);
  try {
    await db.jobs.findFirst({ select: { id: true, bloqueio: true } });
    await db.notificacoes.findFirst({ select: { id: true, job_id: true } });
  } catch {
    console.warn('Worker de notificações indisponível: verifique as migrations e o acesso ao banco.');
    return;
  }
  const intervalo = Number(env.KRYPTON_WORKER_INTERVALO_MS || 5000);
  const pausa = Number.isInteger(intervalo) && intervalo >= 1000 && intervalo <= 300000 ? intervalo : 5000;
  let ativo = true, timer, execucao;
  function agendar() {
    timer = setTimeout(() => {
      execucao = processarUmaVez(db).catch(() => console.warn('Worker de notificações: falha ao consultar a fila.'))
        .finally(() => { if (ativo) agendar(); });
    }, pausa);
  }
  agendar();
  return async () => {
    ativo = false;
    clearTimeout(timer);
    await execucao;
  };
}

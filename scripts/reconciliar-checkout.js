// Uso explícito por operador autorizado; nunca cria assinaturas nem aceita aprovação manual.
import { validarDestinoAdministrativo } from './reconciliar-checkout-guard.js';

let prisma;
try {
  const [comando, id, opcao, ...resto] = process.argv.slice(2);
  if (!((comando === 'listar' && !id) || (comando === 'verificar' && /^[a-f0-9-]{36}$/i.test(id || '') && (!opcao || opcao === '--dry-run') && resto.length === 0))) {
    throw new Error('Uso: node scripts/reconciliar-checkout.js listar | verificar <id-da-tentativa> [--dry-run]');
  }
  // Exige URL explícita antes de importar o gateway que carrega dotenv.
  validarDestinoAdministrativo(process.env.DATABASE_URL);
  ({ default: prisma } = await import('../src/lib/prisma.js'));
  if (comando === 'listar') {
    const tentativas = await prisma.checkout_tentativas.findMany({
      where: { status: { in: ['pendente', 'aguardando'] } },
      select: { id: true, usuario_id: true, tipo: true, status: true, mp_preapproval_id: true, created_at: true, updated_at: true },
      orderBy: { created_at: 'asc' }, take: 100,
    });
    console.log(JSON.stringify(tentativas, null, 2));
  } else {
    const { reconciliarCheckout } = await import('../src/services/checkout.service.js');
    console.log(JSON.stringify(await reconciliarCheckout(id, { dryRun: opcao === '--dry-run' })));
  }
} catch (error) {
  console.error('Reconciliação não concluída:', error.message);
  process.exitCode = 1;
} finally {
  if (prisma) await prisma.$disconnect();
}

// Apenas leitura: verifica conexao e contagem de registros.
import 'dotenv/config';
import { diagnosticarInicializacao } from '../src/lib/diagnostico-inicializacao.js';

let prisma;
try {
  ({ default: prisma } = await import('../src/lib/prisma.js'));
  await prisma.$queryRaw`SELECT 1 AS ok`;
  const [unidades, usuarios, planos] = await Promise.all([
    prisma.unidades.count(),
    prisma.usuarios.count(),
    prisma.planos.count(),
  ]);

  console.log('MySQL: conexao OK (consulta somente leitura).');
  console.log('Unidades cadastradas:', unidades);
  console.log('Usuarios cadastrados:', usuarios);
  console.log('Registros de planos:', planos);
  if (unidades === 0) {
    console.log('AVISO: a API /api/unidades retorna [] enquanto este banco nao tiver unidades.');
  }
} catch (erro) {
  console.error('Falha ao consultar o banco. Confira DATABASE_URL, rede e disponibilidade do MySQL.');
  console.error('Diagnóstico:', erro.codigoConfiguracao ?? diagnosticarInicializacao(erro));
  process.exitCode = 1;
} finally {
  await prisma?.$disconnect();
}

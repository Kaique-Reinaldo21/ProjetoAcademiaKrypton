// Apenas leitura: verifica conexao e contagem de registros.
import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

try {
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
  console.error('Tipo de erro:', erro.code || erro.name || 'desconhecido');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

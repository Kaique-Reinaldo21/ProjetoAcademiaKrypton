// Popula somente unidades demonstrativas no MySQL LOCAL.
// Nao executa o seed geral (que inclui usuarios com senhas previsiveis).
import { validarBancoLocal } from './local-db-guard.js';

try {
  const alvo = validarBancoLocal();
  const { default: prisma } = await import('../src/lib/prisma.js');

  // Exemplos ficticios para a demonstracao; nao representam unidades reais.
  const exemplos = [
    { nome: 'Unidade Centro', endereco: 'Rua Exemplo, 100 (DEMONSTRACAO)', cidade: 'Sao Paulo', telefone: '(11) 0000-0000', horario: 'Seg-Sex 06h-22h' },
    { nome: 'Unidade Zona Leste', endereco: 'Av. Modelo, 200 (DEMONSTRACAO)', cidade: 'Sao Paulo', telefone: '(11) 0000-0000', horario: 'Seg-Sex 06h-22h' },
    { nome: 'Unidade Vila Madalena', endereco: 'Rua Ficticia, 300 (DEMONSTRACAO)', cidade: 'Sao Paulo', telefone: '(11) 0000-0000', horario: 'Seg-Sex 06h-22h' },
  ];

  console.log('Banco LOCAL:', alvo.banco, '| Host:', alvo.host);
  try {
    for (const unidade of exemplos) {
      const existente = await prisma.unidades.findFirst({ where: { nome: unidade.nome }, select: { id: true } });
      if (existente) {
        console.log('Ja existe, sem alteracoes:', unidade.nome);
        continue;
      }
      await prisma.unidades.create({ data: unidade });
      console.log('Criada unidade ficticia:', unidade.nome);
    }
    console.log('Total de unidades:', await prisma.unidades.count());
  } finally {
    await prisma.$disconnect();
  }
} catch (erro) {
  console.error('Nao foi possivel cadastrar as unidades locais:', erro.message);
  process.exitCode = 1;
}

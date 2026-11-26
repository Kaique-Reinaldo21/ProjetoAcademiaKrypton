import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

const unidades = [
  {
    nome: 'Unidade Centro',
    endereco: 'Av. Paulista, 1000 — Centro',
    cidade: 'São Paulo',
    telefone: '(11) 3000-0001',
    horario: 'Seg–Sex 06h–22h | Sáb 08h–18h',
  },
  {
    nome: 'Unidade Zona Leste',
    endereco: 'Rua do Tatuapé, 450 — Tatuapé',
    cidade: 'São Paulo',
    telefone: '(11) 3000-0002',
    horario: 'Seg–Sex 06h–22h | Sáb 08h–18h',
  },
  {
    nome: 'Unidade Vila Madalena',
    endereco: 'Rua Harmonia, 200 — Vila Madalena',
    cidade: 'São Paulo',
    telefone: '(11) 3000-0003',
    horario: 'Seg–Sex 06h–22h | Sáb 08h–18h',
  },
];

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Seed bloqueado em ambiente de produção.');
    process.exitCode = 1;
    return;
  }
  for (const dados of unidades) {
    const unidade = await prisma.unidades.findFirst({ where: { nome: dados.nome } });
    if (unidade) await prisma.unidades.update({ where: { id: unidade.id }, data: dados });
    else await prisma.unidades.create({ data: dados });
  }
  console.log('Unidades locais criadas ou atualizadas.');
}

try {
  await seed();
} catch {
  console.error('Não foi possível executar o seed.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

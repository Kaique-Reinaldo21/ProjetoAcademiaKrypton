import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma.js';

// Evita executar seed acidentalmente em produção
if (process.env.NODE_ENV === 'production') {
  console.error(
    '❌ Seed bloqueado em ambiente de produção.'
  );

  process.exit(1);
}

function criarData(data) {
  return new Date(`${data}T12:00:00.000Z`);
}

// Cria ou atualiza uma unidade sem duplicar
async function criarOuAtualizarUnidade(dados) {
  const existente = await prisma.unidades.findFirst({
    where: {
      nome: dados.nome,
    },
  });

  if (existente) {
    return prisma.unidades.update({
      where: {
        id: existente.id,
      },

      data: {
        endereco: dados.endereco,
        cidade: dados.cidade,
        telefone: dados.telefone,
        horario: dados.horario,
      },
    });
  }

  return prisma.unidades.create({
    data: dados,
  });
}

async function seed() {
  console.log('🌱 Iniciando seed...\n');

  // ======================================================
  // UNIDADES
  // ======================================================

  const unidadeCentro =
  await criarOuAtualizarUnidade({
    nome: 'Unidade Centro',
    endereco: 'Av. Paulista, 1000 — Centro',
    cidade: 'São Paulo',
    telefone: '(11) 3000-0001',
    horario: 'Seg–Sex 06h–22h | Sáb 08h–18h',
  });

const unidadeZonaLeste =
  await criarOuAtualizarUnidade({
    nome: 'Unidade Zona Leste',
    endereco: 'Rua do Tatuapé, 450 — Tatuapé',
    cidade: 'São Paulo',
    telefone: '(11) 3000-0002',
    horario: 'Seg–Sex 06h–22h | Sáb 08h–18h',
  });

const unidadeVilaMadalena =
  await criarOuAtualizarUnidade({
    nome: 'Unidade Vila Madalena',
    endereco: 'Rua Harmonia, 200 — Vila Madalena',
    cidade: 'São Paulo',
    telefone: '(11) 3000-0003',
    horario: 'Seg–Sex 06h–22h | Sáb 08h–18h',
  });

  console.log('✅ Unidades criadas/atualizadas');

  // ======================================================
  // USUÁRIOS DE DESENVOLVIMENTO
  // ======================================================

  const usuarios = [
    {
      nome: 'João Silva',
      email: 'joao@exemplo.com',
      senha: '123456',
      nascimento: '2000-03-15',
      role: 'aluno',

      plano: {
        tipo: 'pro',
        ativo: true,
        unidade_id: null,
        vencimento: '2026-12-31',
      },
    },

    {
      nome: 'Maria Souza',
      email: 'maria@exemplo.com',
      senha: '123456',
      nascimento: '1995-07-22',
      role: 'aluno',

      plano: {
        tipo: 'elite',
        ativo: true,
        unidade_id: null,
        vencimento: '2026-12-31',
      },
    },

    {
      nome: 'Carlos Lima',
      email: 'carlos@exemplo.com',
      senha: '123456',
      nascimento: '2000-01-10',
      role: 'aluno',

      plano: {
        tipo: 'basico',
        ativo: true,
        unidade_id: unidadeCentro.id,
        vencimento: '2026-12-31',
      },
    },

    {
      nome: 'Admin Krypton',
      email: 'admin@exemplo.com',
      senha: '123456',
      nascimento: '1980-01-01',
      role: 'admin',
      plano: null,
    },
  ];

  // ======================================================
  // USUÁRIOS + PLANOS
  // ======================================================

  for (const dados of usuarios) {
  const senhaHash =
    await bcrypt.hash(dados.senha, 10);

  // email é UNIQUE, então podemos usar upsert
  const usuario =
    await prisma.usuarios.upsert({
      where: {
        email: dados.email,
      },

      update: {
        nome: dados.nome,
        senha_hash: senhaHash,
        data_nascimento:
          criarData(dados.nascimento),
        role: dados.role,
      },

      create: {
        nome: dados.nome,
        email: dados.email,
        senha_hash: senhaHash,
        data_nascimento:
          criarData(dados.nascimento),
        role: dados.role,
      },
    });

  // Só alunos possuem plano.
  if (dados.plano) {
    const planoExistente =
      await prisma.planos.findFirst({
        where: {
          usuario_id: usuario.id,
        },

        orderBy: {
          id: 'desc',
        },
      });

    if (planoExistente) {
      await prisma.planos.update({
        where: {
          id: planoExistente.id,
        },

        data: {
          tipo: dados.plano.tipo,
          ativo: dados.plano.ativo,
          unidade_id:
            dados.plano.unidade_id,

          vencimento:
            dados.plano.vencimento
              ? criarData(
                  dados.plano.vencimento
                )
              : null,
        },
      });
    } else {
      await prisma.planos.create({
        data: {
          usuario_id: usuario.id,
          tipo: dados.plano.tipo,
          ativo: dados.plano.ativo,
          unidade_id:
            dados.plano.unidade_id,

          vencimento:
            dados.plano.vencimento
              ? criarData(
                  dados.plano.vencimento
                )
              : null,
        },
      });
    }
  }

  console.log(
    dados.plano
      ? `✅ ${dados.nome} — plano ${dados.plano.tipo}`
      : `✅ ${dados.nome} — perfil ${dados.role}`
  );
}

// Fecha a função seed somente depois que todos os usuários forem processados
console.log('\n🎉 Seed concluído!');

console.log(
  '🔑 Senha dos usuários de desenvolvimento: 123456'
);

console.log('\n📍 Unidades disponíveis:');
console.log(`   ${unidadeCentro.nome}`);
console.log(`   ${unidadeZonaLeste.nome}`);
console.log(`   ${unidadeVilaMadalena.nome}`);
}

seed()
  .catch((error) => {
    console.error(
      '\n❌ Erro ao executar seed:',
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
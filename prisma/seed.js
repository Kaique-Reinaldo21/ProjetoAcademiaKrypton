import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma.js';

async function seed() {
  console.log('🌱 Populando banco de dados...\n');

  const unidadeCentro =
    await prisma.unidades.findFirst({
      where: {
        nome: {
          contains: 'Centro',
        },
      },

      select: {
        id: true,
      },
    });

  const usuarios = [
    {
      nome: 'João Silva',
      email: 'joao@exemplo.com',
      senha: '123456',
      nasc: '2000-03-15',
      role: 'aluno',

      plano: {
        tipo: 'pro',
        ativo: true,
        vencimento: '2025-12-31',
        unidade_id: null,
      },
    },

    {
      nome: 'Maria Souza',
      email: 'maria@exemplo.com',
      senha: '123456',
      nasc: '1995-07-22',
      role: 'aluno',

      plano: {
        tipo: 'elite',
        ativo: true,
        vencimento: null,
        unidade_id: null,
      },
    },

    {
      nome: 'Carlos Lima',
      email: 'carlos@exemplo.com',
      senha: '123456',
      nasc: '2008-01-10',
      role: 'aluno',

      plano: {
        tipo: 'basico',
        ativo: false,
        vencimento: '2024-01-01',
        unidade_id:
          unidadeCentro?.id ?? 1,
      },
    },

    {
      nome: 'Admin Krypton',
      email: 'admin@exemplo.com',
      senha: '123456',
      nasc: '1980-01-01',
      role: 'admin',

      plano: {
        tipo: 'elite',
        ativo: true,
        vencimento: null,
        unidade_id: null,
      },
    },
  ];

  for (const dados of usuarios) {
    const senhaHash =
      await bcrypt.hash(dados.senha, 10);

    const usuario =
      await prisma.usuarios.upsert({
        where: {
          email: dados.email,
        },

        update: {
          nome: dados.nome,
          senha_hash: senhaHash,
          data_nascimento:
            new Date(`${dados.nasc}T00:00:00`),
          role: dados.role,
        },

        create: {
          nome: dados.nome,
          email: dados.email,
          senha_hash: senhaHash,
          data_nascimento:
            new Date(`${dados.nasc}T00:00:00`),
          role: dados.role,
        },
      });

    const planoExistente =
      await prisma.planos.findFirst({
        where: {
          usuario_id: usuario.id,
        },

        select: {
          id: true,
        },
      });

    if (!planoExistente) {
      await prisma.planos.create({
        data: {
          usuario_id: usuario.id,
          tipo: dados.plano.tipo,
          ativo: dados.plano.ativo,
          unidade_id:
            dados.plano.unidade_id,

          vencimento:
            dados.plano.vencimento
              ? new Date(
                  `${dados.plano.vencimento}T00:00:00`
                )
              : null,
        },
      });
    }

    console.log(
      `✅ ${dados.nome} — plano ${dados.plano.tipo}`
    );
  }

  console.log(
    '\n🎉 Seed concluído! Senha dos usuários de teste: 123456'
  );
}

seed()
  .catch((err) => {
    console.error(
      'Erro ao executar seed:',
      err
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
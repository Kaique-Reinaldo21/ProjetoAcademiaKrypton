import { PrismaClient, usuarios_role, planos_tipo } from '@prisma/client';


const prisma = new PrismaClient();

async function main(): Promise<void> {
    console.log('Iniciando o povoamento do banco de dados (seed)...');

    // 1 - Aluno: plano básico
    const alunoBasico = await prisma.usuarios.upsert({
        where: { email: 'aluno@academia.com'},
        update: {},
        create: {
            nome: 'Camila Aluna',
            email: 'aluno@academia.com',
            senha_hash: 'aluno123',
            data_nascimento: new Date('2007-03-10'),
            role: usuarios_role.aluno
        }
    });

    // Aluno: plano pro
    const alunoPro = await prisma.usuarios.upsert({
        where: { email: 'alunopro@academia.com'},
        update: {},
        create: {
            nome: 'Carlos Aluno pro',
            email: 'alunopro@academia.com',
            senha_hash: 'pro123',
            data_nascimento: new Date('2005-02-01'),
            role: usuarios_role.aluno
        }
    });

    // Aluno: plano elite
    const alunoElite = await prisma.usuarios.upsert({
        where: { email: 'alunoelite@academia.com'},
        update: {},
        create: {
            nome: 'Sofia Aluna elite',
            email: 'alunoelite@academia.com',
            senha_hash: 'elite123',
            data_nascimento: new Date('1988-11-05'),
            role: usuarios_role.aluno
        }
    });

    // 2 - Administrador
    const admin = await prisma.usuarios.upsert({
        where: { email: 'admin@academia.com' },
        update: {},
        create: {
            nome: 'Administrador',
            email: 'admin@academia.com',
            senha_hash: 'admin123',
            data_nascimento: new Date('1990-01-01'),
            role: usuarios_role.admin
        }
    });

    // 3 - Personal Trainer
    const personalTrainer = await prisma.usuarios.upsert({
        where: { email: 'personal@academia.com' },
        update: {},
        create: {
            nome: 'Marcos Personal',
            email: 'personal@academia.com',
            senha_hash: 'personal123',
            data_nascimento: new Date('1985-05-15'),
            role: usuarios_role.personal
        }
    });

    // 4 - Nutricionista
    const nutricionista = await prisma.usuarios.upsert({
        where: { email: 'nutricionista@academia.com' },
        update: {},
        create: {
            nome: 'Ana Nutricionista',
            email: 'nutricionista@academia.com',
            senha_hash: 'nutricionista123',
            data_nascimento: new Date('2000-07-20'),
            role: usuarios_role.nutricionista
        }
    });

    // 5 - Unidade
    await prisma.unidades.createMany({
        skipDuplicates: true,
        data: [
            {
              nome: 'unidade 1', 
              endereco: 'Rua A, 123', 
              cidade: 'São Paulo', 
              telefone: '204718593',
            }
        ]
    });

    // 6 - Cadastro dos Planos 
    await prisma.planos.createMany({
        skipDuplicates: true,
        data: [
            {
                usuario_id: alunoBasico.id, 
                tipo: planos_tipo.basico
            },
            {
                usuario_id: alunoPro.id, 
                tipo: planos_tipo.pro
            },
            {
                usuario_id: alunoElite.id, 
                tipo: planos_tipo.elite
            }
        ]
    });

    console.log('Povoamento concluído com sucesso!');
} 

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
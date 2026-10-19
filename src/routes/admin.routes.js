import express from 'express';
import prisma from '../lib/prisma.js';
import authMiddleware from '../middleware/auth.js';
import adminMiddleware from '../middleware/admin.js';

const router = express.Router();

// Todas as rotas deste arquivo exigem login + admin
router.use(authMiddleware);
router.use(adminMiddleware);

// Preços atuais dos planos
const PRECOS = {
  basico: 89,
  pro: 149,
  elite: 249,
};

// Retorna uma data no início do dia
function inicioDoDia(data = new Date()) {
  return new Date(
    data.getFullYear(),
    data.getMonth(),
    data.getDate()
  );
}

// Formata YYYY-MM-DD usando a data local
function formatarDataLocal(data) {
  if (!data) return null;

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');

  return `${ano}-${mes}-${dia}`;
}

// ========================================================
// GET /api/admin/resumo
// ========================================================

router.get('/resumo', async (req, res) => {
  try {
    const hoje = inicioDoDia();

    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    const [
      totalAlunos,
      planos,
      loginsHoje,
    ] = await Promise.all([
      prisma.usuarios.count({
        where: {
          role: 'aluno',
        },
      }),

      prisma.planos.findMany({
        where: {
          ativo: true,

          usuarios: {
            role: 'aluno',
          },

          OR: [
            {
              vencimento: null,
            },
            {
              vencimento: {
                gte: hoje,
              },
            },
          ],
        },

        select: {
          tipo: true,
        },
      }),

      prisma.historico_logins.count({
        where: {
          data_login: {
            gte: hoje,
            lt: amanha,
          },
        },
      }),
    ]);

    const contagem = {
      basico: 0,
      pro: 0,
      elite: 0,
    };

    for (const plano of planos) {
      contagem[plano.tipo]++;
    }

    let planosAtivos = 0;
    let receitaEstimada = 0;

    const planosPorTipo = Object.entries(contagem)
      .filter(([, quantidade]) => quantidade > 0)
      .map(([tipo, quantidade]) => {
        const valorEstimado =
          quantidade * PRECOS[tipo];

        planosAtivos += quantidade;
        receitaEstimada += valorEstimado;

        return {
          tipo,
          quantidade,
          valor_estimado: valorEstimado,
        };
      });

    return res.json({
      total_alunos: totalAlunos,
      planos_ativos: planosAtivos,
      logins_hoje: loginsHoje,
      receita_estimada: receitaEstimada,
      planos_por_tipo: planosPorTipo,
      precos: PRECOS,
    });
  } catch (err) {
    console.error(
      'Erro ao carregar resumo administrativo:',
      err
    );

    return res.status(500).json({
      erro: 'Erro ao carregar dados administrativos.',
    });
  }
});

// ========================================================
// GET /api/admin/alunos
// ========================================================

router.get('/alunos', async (req, res) => {
  try {
    const usuarios = await prisma.usuarios.findMany({
      where: {
        role: 'aluno',
      },

      orderBy: {
        created_at: 'desc',
      },

      take: 10,

      select: {
        id: true,
        nome: true,
        email: true,
        created_at: true,

        planos: {
          orderBy: {
            id: 'desc',
          },

          take: 1,

          select: {
            tipo: true,
            ativo: true,
            vencimento: true,
          },
        },
      },
    });

    /*
      Mantemos o mesmo formato de resposta esperado
      pelo frontend.

      Aqui usamos o plano mais recente de cada aluno,
      evitando duplicar o aluno caso ele possua
      registros antigos de plano.
    */
    const alunos = usuarios.map((usuario) => {
      const planoAtual =
        usuario.planos.length > 0
          ? usuario.planos[0]
          : null;

      return {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        created_at: usuario.created_at,

        plano: planoAtual?.tipo ?? null,
        ativo: planoAtual?.ativo ?? null,
        vencimento:
          planoAtual?.vencimento ?? null,
      };
    });

    return res.json({
      alunos,
    });
  } catch (err) {
    console.error(
      'Erro ao listar alunos:',
      err
    );

    return res.status(500).json({
      erro: 'Erro ao carregar alunos.',
    });
  }
});

// ========================================================
// GET /api/admin/logins
// ========================================================

router.get('/logins', async (req, res) => {
  try {
    const registros =
      await prisma.historico_logins.findMany({
        orderBy: {
          data_login: 'desc',
        },

        take: 15,

        select: {
          id: true,
          data_login: true,
          ip: true,
          user_agent: true,

          usuarios: {
            select: {
              nome: true,
              email: true,
              role: true,
            },
          },
        },
      });

    const logins = registros.map((registro) => ({
      id: registro.id,
      data_login: registro.data_login,
      ip: registro.ip,
      user_agent: registro.user_agent,

      nome: registro.usuarios.nome,
      email: registro.usuarios.email,
      role: registro.usuarios.role,
    }));

    return res.json({
      logins,
    });
  } catch (err) {
    console.error(
      'Erro ao buscar histórico de login:',
      err
    );

    return res.status(500).json({
      erro: 'Erro ao carregar histórico de login.',
    });
  }
});

// ========================================================
// GET /api/admin/agendamentos-proximos
// ========================================================

router.get(
  '/agendamentos-proximos',
  async (req, res) => {
    try {
      const registros =
        await prisma.agendamentos.findMany({
          where: {
            data_hora: {
              gte: new Date(),
            },
          },

          orderBy: {
            data_hora: 'asc',
          },

          take: 6,

          select: {
            id: true,
            tipo: true,
            data_hora: true,
            observacao: true,

            usuarios: {
              select: {
                nome: true,
                email: true,
              },
            },
          },
        });

      const agendamentos = registros.map(
        (registro) => ({
          id: registro.id,
          tipo: registro.tipo,
          data_hora: registro.data_hora,
          observacao: registro.observacao,

          nome: registro.usuarios.nome,
          email: registro.usuarios.email,
        })
      );

      return res.json({
        agendamentos,
      });
    } catch (err) {
      console.error(
        'Erro ao carregar agendamentos:',
        err
      );

      return res.status(500).json({
        erro: 'Erro ao carregar agendamentos.',
      });
    }
  }
);

// ========================================================
// GET /api/admin/vencimentos
// ========================================================

router.get('/vencimentos', async (req, res) => {
  try {
    const hoje = inicioDoDia();

    const seteDias = new Date(hoje);
    seteDias.setDate(seteDias.getDate() + 7);

    const registros =
      await prisma.planos.findMany({
        where: {
          ativo: true,

          vencimento: {
            not: null,
            gte: hoje,
            lte: seteDias,
          },

          usuarios: {
            role: 'aluno',
          },
        },

        orderBy: {
          vencimento: 'asc',
        },

        take: 6,

        select: {
          tipo: true,
          vencimento: true,

          usuarios: {
            select: {
              nome: true,
              email: true,
            },
          },
        },
      });

    const vencimentos = registros.map(
      (registro) => ({
        nome: registro.usuarios.nome,
        email: registro.usuarios.email,
        tipo: registro.tipo,
        vencimento: registro.vencimento,
      })
    );

    return res.json({
      vencimentos,
    });
  } catch (err) {
    console.error(
      'Erro ao carregar vencimentos:',
      err
    );

    return res.status(500).json({
      erro: 'Erro ao carregar vencimentos.',
    });
  }
});

// ========================================================
// GET /api/admin/cadastros-semana
// ========================================================

router.get(
  '/cadastros-semana',
  async (req, res) => {
    try {
      const hoje = inicioDoDia();

      const seisDiasAtras = new Date(hoje);
      seisDiasAtras.setDate(
        seisDiasAtras.getDate() - 6
      );

      const usuarios =
        await prisma.usuarios.findMany({
          where: {
            role: 'aluno',

            created_at: {
              gte: seisDiasAtras,
            },
          },

          orderBy: {
            created_at: 'asc',
          },

          select: {
            created_at: true,
          },
        });

      /*
        O SQL antigo agrupava usando:

        GROUP BY DATE(created_at)

        Prisma não possui diretamente um DATE()
        equivalente no groupBy.

        Portanto, buscamos os registros e fazemos
        esse agrupamento em JavaScript.
      */
      const agrupados = {};

      for (const usuario of usuarios) {
        if (!usuario.created_at) continue;

        const data =
          formatarDataLocal(
            new Date(usuario.created_at)
          );

        if (!agrupados[data]) {
          agrupados[data] = 0;
        }

        agrupados[data]++;
      }

      const cadastros = Object.entries(
        agrupados
      ).map(([data, quantidade]) => ({
        data,
        quantidade,
      }));

      return res.json({
        cadastros,
      });
    } catch (err) {
      console.error(
        'Erro ao carregar cadastros:',
        err
      );

      return res.status(500).json({
        erro: 'Erro ao carregar cadastros.',
      });
    }
  }
);

export default router;
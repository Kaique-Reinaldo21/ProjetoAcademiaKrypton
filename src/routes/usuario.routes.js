import express from 'express';
import prisma from '../lib/prisma.js';
import authMiddleware from '../middleware/auth.js';
import adminMiddleware from '../middleware/admin.js';

const router = express.Router();

router.use(authMiddleware);

const PLANOS_INFO = {
  basico: {
    nome: 'Básico',
    beneficios: [
      'Acesso a 1 unidade exclusiva',
      'Musculação completa',
      'Área de cardio',
    ],
    mostra_unidade: true,
    mostra_todas_unidades: false,
    mostra_agendamento: false,
  },

  pro: {
    nome: 'Pro',
    beneficios: [
      'Acesso a todas as unidades',
      'Musculação e cardio ilimitados',
      'Lutas e artes marciais',
      'Quadras esportivas',
    ],
    mostra_unidade: false,
    mostra_todas_unidades: true,
    mostra_agendamento: false,
  },

  elite: {
    nome: 'Elite',
    beneficios: [
      'Acesso a todas as unidades',
      'Musculação, cardio e lutas',
      'Quadras esportivas',
      'Consultas com Nutricionista',
      'Treinos com Personal Trainer',
    ],
    mostra_unidade: false,
    mostra_todas_unidades: true,
    mostra_agendamento: true,
  },
};

const formatarData = (data) => {
  if (!data) return null;
  return new Date(data).toISOString().slice(0, 10);
};

// GET /api/usuario/perfil
router.get('/perfil', async (req, res) => {
  try {
    const usuario = await prisma.usuarios.findUnique({
      where: {
        id: req.usuario.id,
      },

      select: {
        id: true,
        nome: true,
        email: true,
        data_nascimento: true,
        created_at: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({
        erro: 'Usuário não encontrado.',
      });
    }

    return res.json({ usuario });
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);

    return res.status(500).json({
      erro: 'Erro ao buscar perfil.',
    });
  }
});

// GET /api/usuario/unidades
router.get('/unidades', async (req, res) => {
  try {
    const unidades = await prisma.unidades.findMany({
      orderBy: {
        id: 'asc',
      },

      select: {
        id: true,
        nome: true,
        endereco: true,
        cidade: true,
        telefone: true,
        horario: true,
      },
    });

    return res.json({ unidades });
  } catch (error) {
    console.error('Erro ao buscar unidades:', error);

    return res.status(500).json({
      erro: 'Erro ao buscar unidades.',
    });
  }
});

// POST /api/usuario/assinar-plano
router.post('/assinar-plano', async (req, res) => {
  try {
    const { tipo, unidade_id } = req.body;

    const tiposValidos = ['basico', 'pro', 'elite'];

    if (!tipo || !tiposValidos.includes(tipo)) {
      return res.status(400).json({
        erro: 'Tipo de plano inválido.',
      });
    }

    if (tipo === 'basico' && !unidade_id) {
      return res.status(400).json({
        erro: 'Selecione uma unidade para o plano Básico.',
      });
    }

    let unidadeSelecionada = null;

    if (tipo === 'basico') {
      unidadeSelecionada = Number(unidade_id);

      if (!Number.isInteger(unidadeSelecionada)) {
        return res.status(400).json({
          erro: 'Unidade inválida.',
        });
      }

      const unidadeExiste = await prisma.unidades.findUnique({
        where: {
          id: unidadeSelecionada,
        },

        select: {
          id: true,
        },
      });

      if (!unidadeExiste) {
        return res.status(404).json({
          erro: 'Unidade não encontrada.',
        });
      }
    }

    const planoAtivo = await prisma.planos.findFirst({
      where: {
        usuario_id: req.usuario.id,
        ativo: true,
      },

      select: {
        id: true,
      },
    });

    if (planoAtivo) {
      return res.status(409).json({
        erro: 'Você já possui um plano ativo.',
      });
    }

    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);

    const vencimento = new Date(inicio);
    vencimento.setDate(vencimento.getDate() + 30);

    const planoExistente = await prisma.planos.findFirst({
      where: {
        usuario_id: req.usuario.id,
      },

      orderBy: {
        id: 'desc',
      },

      select: {
        id: true,
      },
    });

    if (planoExistente) {
      await prisma.planos.update({
        where: {
          id: planoExistente.id,
        },

        data: {
          tipo,
          ativo: true,
          unidade_id: unidadeSelecionada,
          inicio,
          vencimento,
        },
      });
    } else {
      await prisma.planos.create({
        data: {
          usuario_id: req.usuario.id,
          tipo,
          ativo: true,
          unidade_id: unidadeSelecionada,
          inicio,
          vencimento,
        },
      });
    }

    return res.json({
      mensagem: 'Plano ativado com sucesso!',
      vencimento: formatarData(vencimento),
    });
  } catch (error) {
    console.error('Erro ao assinar plano:', error);

    return res.status(500).json({
      erro: 'Erro ao assinar plano.',
    });
  }
});

// GET /api/usuario/plano
router.get('/plano', async (req, res) => {
  try {
    const plano = await prisma.planos.findFirst({
      where: {
        usuario_id: req.usuario.id,
      },

      orderBy: {
        id: 'desc',
      },

      select: {
        id: true,
        tipo: true,
        ativo: true,
        inicio: true,
        vencimento: true,
        unidade_id: true,
      },
    });

    if (!plano) {
      return res.status(404).json({
        erro: 'Nenhum plano encontrado.',
      });
    }

    let status = 'ativo';

    if (!plano.ativo) {
      status = 'inativo';
    } else if (
      plano.vencimento &&
      new Date(plano.vencimento) < new Date()
    ) {
      status = 'vencido';

      await prisma.planos.update({
        where: {
          id: plano.id,
        },

        data: {
          ativo: false,
        },
      });
    }

    const info = PLANOS_INFO[plano.tipo];

    let unidade = null;

    /*
      O schema atual não possui uma relação Prisma entre
      planos.unidade_id e unidades.id.

      Por isso a unidade é consultada separadamente.
    */
    if (
      info.mostra_unidade &&
      plano.unidade_id
    ) {
      unidade = await prisma.unidades.findUnique({
        where: {
          id: plano.unidade_id,
        },

        select: {
          nome: true,
          endereco: true,
          cidade: true,
          telefone: true,
          horario: true,
        },
      });
    }

    let todasUnidades = [];

    if (info.mostra_todas_unidades) {
      todasUnidades = await prisma.unidades.findMany({
        orderBy: {
          id: 'asc',
        },

        select: {
          id: true,
          nome: true,
          endereco: true,
          cidade: true,
          telefone: true,
          horario: true,
        },
      });
    }

    return res.json({
      plano: {
        tipo: plano.tipo,
        nome: info.nome,
        status,
        inicio: formatarData(plano.inicio),
        vencimento: formatarData(plano.vencimento),
        beneficios: info.beneficios,
        mostra_agendamento: info.mostra_agendamento,
        mostra_todas_unidades:
          info.mostra_todas_unidades,

        unidade:
          info.mostra_unidade && plano.unidade_id
            ? unidade
            : null,

        todas_unidades: todasUnidades,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar plano:', error);

    return res.status(500).json({
      erro: 'Erro ao buscar plano.',
    });
  }
});

// POST /api/usuario/agendamento
router.post('/agendamento', async (req, res) => {
  try {
    const {
      tipo,
      data_hora,
      observacao,
    } = req.body;

    if (!tipo || !data_hora) {
      return res.status(400).json({
        erro: 'Tipo e data/hora são obrigatórios.',
      });
    }

    if (
      !['nutricionista', 'personal'].includes(tipo)
    ) {
      return res.status(400).json({
        erro: 'Tipo inválido.',
      });
    }

    const dataHora = new Date(data_hora);

    if (Number.isNaN(dataHora.getTime())) {
      return res.status(400).json({
        erro: 'Data/hora inválida.',
      });
    }

    const plano = await prisma.planos.findFirst({
      where: {
        usuario_id: req.usuario.id,
      },

      orderBy: {
        id: 'desc',
      },

      select: {
        tipo: true,
        ativo: true,
        vencimento: true,
      },
    });

    if (
      !plano ||
      plano.tipo !== 'elite' ||
      !plano.ativo
    ) {
      return res.status(403).json({
        erro:
          'Agendamentos são exclusivos para alunos com plano Elite ativo.',
      });
    }

    await prisma.agendamentos.create({
      data: {
        usuario_id: req.usuario.id,
        tipo,
        data_hora: dataHora,
        observacao: observacao || null,
      },
    });

    return res.status(201).json({
      mensagem:
        `Agendamento de ${tipo} realizado com sucesso!`,
    });
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);

    return res.status(500).json({
      erro: 'Erro ao realizar agendamento.',
    });
  }
});

// GET /api/usuario/agendamentos
router.get('/agendamentos', async (req, res) => {
  try {
    const agendamentos =
      await prisma.agendamentos.findMany({
        where: {
          usuario_id: req.usuario.id,
        },

        orderBy: {
          data_hora: 'asc',
        },

        select: {
          id: true,
          tipo: true,
          data_hora: true,
          observacao: true,
        },
      });

    return res.json({ agendamentos });
  } catch (error) {
    console.error(
      'Erro ao buscar agendamentos:',
      error
    );

    return res.status(500).json({
      erro: 'Erro ao buscar agendamentos.',
    });
  }
});

// PUT /api/usuario/:id/plano
router.put(
  '/:id/plano',
  adminMiddleware,
  async (req, res) => {
    try {
      const usuarioId = Number(req.params.id);

      if (!Number.isInteger(usuarioId)) {
        return res.status(400).json({
          erro: 'ID de usuário inválido.',
        });
      }

      const {
        tipo,
        ativo,
        vencimento,
        unidade_id,
      } = req.body;

      const tiposValidos = [
        'basico',
        'pro',
        'elite',
      ];

      if (
        tipo &&
        !tiposValidos.includes(tipo)
      ) {
        return res.status(400).json({
          erro: 'Tipo de plano inválido.',
        });
      }

      const planoAtual =
        await prisma.planos.findFirst({
          where: {
            usuario_id: usuarioId,
          },

          orderBy: {
            id: 'desc',
          },

          select: {
            id: true,
          },
        });

      if (!planoAtual) {
        return res.status(404).json({
          erro: 'Plano não encontrado.',
        });
      }

      const dadosAtualizacao = {};

      if (tipo !== undefined && tipo !== null) {
        dadosAtualizacao.tipo = tipo;
      }

      if (
        ativo !== undefined &&
        ativo !== null
      ) {
        dadosAtualizacao.ativo = Boolean(ativo);
      }

      if (
        vencimento !== undefined &&
        vencimento !== null
      ) {
        const novaData = new Date(vencimento);

        if (Number.isNaN(novaData.getTime())) {
          return res.status(400).json({
            erro: 'Data de vencimento inválida.',
          });
        }

        dadosAtualizacao.vencimento = novaData;
      }

      if (
        unidade_id !== undefined &&
        unidade_id !== null
      ) {
        const unidadeId = Number(unidade_id);

        if (!Number.isInteger(unidadeId)) {
          return res.status(400).json({
            erro: 'Unidade inválida.',
          });
        }

        dadosAtualizacao.unidade_id =
          unidadeId;
      }

      await prisma.planos.update({
        where: {
          id: planoAtual.id,
        },

        data: dadosAtualizacao,
      });

      return res.json({
        mensagem:
          'Plano atualizado com sucesso.',
      });
    } catch (error) {
      console.error(
        'Erro ao atualizar plano:',
        error
      );

      return res.status(500).json({
        erro: 'Erro ao atualizar plano.',
      });
    }
  }
);

export default router;
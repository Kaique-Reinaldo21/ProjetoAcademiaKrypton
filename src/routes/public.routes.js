import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

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

    return res.json({
      unidades,
    });

  } catch (error) {
    console.error(
      'Erro ao carregar unidades públicas:',
      error
    );

    return res.status(500).json({
      erro: 'Erro ao carregar unidades.',
    });
  }
});

export default router;
const express = require('express');
const prisma = require('../lib/prisma');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// GET /api/analistas — catalogo publico de analistas
router.get('/', async (req, res) => {
  try {
    const analistas = await prisma.analista.findMany({
      where: { status: 'APROVADO' },
      include: {
        user: { select: { nome: true } },
        _count: { select: { seguidores: { where: { ativo: true } } } },
      },
      orderBy: { stats_1u_win_rate: 'desc' },
    });

    return res.json({
      analistas: analistas.map((a) => ({
        id: a.id,
        nome: a.user.nome,
        bio: a.bio,
        especialidade: a.especialidade,
        foto_url: a.foto_url,
        seguidores_ativos: a._count.seguidores,
        stats: {
          '1u': {
            win_rate: a.stats_1u_win_rate,
            rendimento_mes: a.stats_1u_rendimento_mes,
            rendimento_total: a.stats_1u_rendimento_total,
            total_sinais: a.stats_1u_total_sinais,
          },
          '0.5u': {
            win_rate: a.stats_05u_win_rate,
            rendimento_mes: a.stats_05u_rendimento_mes,
            rendimento_total: a.stats_05u_rendimento_total,
            total_sinais: a.stats_05u_total_sinais,
          },
          '0.25u': {
            win_rate: a.stats_025u_win_rate,
            rendimento_mes: a.stats_025u_rendimento_mes,
            rendimento_total: a.stats_025u_rendimento_total,
            total_sinais: a.stats_025u_total_sinais,
          },
        },
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// GET /api/analistas/:id — perfil publico de um analista
router.get('/:id', async (req, res) => {
  try {
    const analista = await prisma.analista.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { nome: true } },
        sinais: {
          where: { status: 'ENCERRADO' },
          orderBy: { created_at: 'desc' },
          take: 20,
        },
        _count: { select: { seguidores: { where: { ativo: true } } } },
      },
    });

    if (!analista) return res.status(404).json({ erro: 'Analista nao encontrado' });

    return res.json({ analista });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// PATCH /api/analistas/perfil — analista atualiza seu perfil
router.patch('/perfil', autenticar, async (req, res) => {
  try {
    if (req.usuario.role !== 'ANALISTA') return res.status(403).json({ erro: 'Apenas analistas' });

    const { bio, especialidade, foto_url } = req.body;
    const analista = await prisma.analista.update({
      where: { user_id: req.usuario.id },
      data: { bio, especialidade, foto_url },
    });

    return res.json({ analista });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

module.exports = router;

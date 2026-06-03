const express = require('express');
const prisma = require('../lib/prisma');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// PATCH /api/seguidores/configurar — seguidor ajusta unidade e tipos aceitos
router.patch('/configurar', autenticar, async (req, res) => {
  try {
    const { unidade_valor, aceita_1u, aceita_0_5u, aceita_0_25u, analista_id } = req.body;

    const seguidor = await prisma.seguidor.findUnique({ where: { user_id: req.usuario.id } });
    if (!seguidor) return res.status(403).json({ erro: 'Apenas seguidores' });

    const dados = {};
    if (unidade_valor !== undefined) dados.unidade_valor = parseFloat(unidade_valor);
    if (aceita_1u !== undefined) dados.aceita_1u = aceita_1u;
    if (aceita_0_5u !== undefined) dados.aceita_0_5u = aceita_0_5u;
    if (aceita_0_25u !== undefined) dados.aceita_0_25u = aceita_0_25u;
    if (analista_id !== undefined) dados.analista_id = analista_id;

    const atualizado = await prisma.seguidor.update({
      where: { user_id: req.usuario.id },
      data: dados,
    });

    return res.json({ seguidor: atualizado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// GET /api/seguidores/historico — historico de execucoes do seguidor
router.get('/historico', autenticar, async (req, res) => {
  try {
    const seguidor = await prisma.seguidor.findUnique({ where: { user_id: req.usuario.id } });
    if (!seguidor) return res.status(403).json({ erro: 'Apenas seguidores' });

    const { periodo } = req.query; // hoje | 7d | 30d
    let dataInicio = null;
    const agora = new Date();

    if (periodo === 'hoje') {
      dataInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    } else if (periodo === '7d') {
      dataInicio = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (periodo === '30d') {
      dataInicio = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const where = { seguidor_id: seguidor.id };
    if (dataInicio) where.created_at = { gte: dataInicio };

    const execucoes = await prisma.execucao.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        sinal: {
          include: {
            analista: { include: { user: { select: { nome: true } } } },
          },
        },
      },
    });

    // Resumo do periodo
    const totalApostado = execucoes.reduce((s, e) => s + e.valor_apostado, 0);
    const wins = execucoes.filter((e) => e.lucro_prejuizo > 0).length;
    const losses = execucoes.filter((e) => e.lucro_prejuizo < 0).length;
    const saldo = execucoes.reduce((s, e) => s + (e.lucro_prejuizo || 0), 0);

    return res.json({
      execucoes: execucoes.map((e) => ({
        id: e.id,
        evento: e.sinal.evento,
        mercado: e.sinal.mercado,
        odd: e.sinal.odd,
        casa: e.sinal.casa,
        tipo_unidade: e.sinal.tipo_unidade,
        analista: e.sinal.analista.user.nome,
        valor_apostado: e.valor_apostado,
        resultado: e.sinal.resultado,
        lucro_prejuizo: e.lucro_prejuizo,
        status: e.status,
        data: e.created_at,
      })),
      resumo: {
        total_apostas: execucoes.length,
        total_apostado: parseFloat(totalApostado.toFixed(2)),
        wins,
        losses,
        saldo: parseFloat(saldo.toFixed(2)),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

module.exports = router;

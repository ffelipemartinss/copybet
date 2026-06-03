const express = require('express');
const prisma = require('../lib/prisma');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// POST /api/sinais — analista cria sinal e faz broadcast
router.post('/', autenticar, async (req, res) => {
  try {
    if (req.usuario.role !== 'ANALISTA') {
      return res.status(403).json({ erro: 'Apenas analistas podem criar sinais' });
    }

    const { casa, evento, mercado, odd, tipo_unidade } = req.body;
    if (!casa || !evento || !mercado || !odd || !tipo_unidade) {
      return res.status(400).json({ erro: 'Campos obrigatorios: casa, evento, mercado, odd, tipo_unidade' });
    }

    const analista = await prisma.analista.findUnique({
      where: { user_id: req.usuario.id },
    });
    if (!analista) return res.status(404).json({ erro: 'Analista nao encontrado' });

    // Busca seguidores ativos que aceitam esse tipo de unidade
    const campoAceita = {
      U1: 'aceita_1u',
      U05: 'aceita_0_5u',
      U025: 'aceita_0_25u',
    }[tipo_unidade];

    const seguidores = await prisma.seguidor.findMany({
      where: {
        analista_id: analista.id,
        ativo: true,
        [campoAceita]: true,
        user: { plano: { status: 'ATIVO' } },
      },
      include: { user: true },
    });

    // Multiplicador por tipo
    const multiplicadores = { U1: 1, U05: 0.5, U025: 0.25 };
    const multiplicador = multiplicadores[tipo_unidade];

    // Cria o sinal no banco
    const sinal = await prisma.sinal.create({
      data: {
        analista_id: analista.id,
        casa,
        evento,
        mercado,
        odd: parseFloat(odd),
        tipo_unidade,
        status: 'ATIVO',
      },
    });

    // Cria as execucoes pendentes para cada seguidor
    const execucoes = await Promise.all(
      seguidores.map((seg) =>
        prisma.execucao.create({
          data: {
            sinal_id: sinal.id,
            seguidor_id: seg.id,
            valor_apostado: parseFloat((seg.unidade_valor * multiplicador).toFixed(2)),
            status: 'PENDENTE',
          },
        })
      )
    );

    // Emite via WebSocket para cada seguidor conectado
    const io = req.app.get('io');
    const usuariosConectados = req.app.get('usuariosConectados');

    for (let i = 0; i < seguidores.length; i++) {
      const seg = seguidores[i];
      const socketId = usuariosConectados.get(seg.user_id);
      if (socketId) {
        io.to(socketId).emit('sinal', {
          sinal_id: sinal.id,
          execucao_id: execucoes[i].id,
          casa: sinal.casa,
          evento: sinal.evento,
          mercado: sinal.mercado,
          odd: sinal.odd,
          valor_apostado: execucoes[i].valor_apostado,
        });
      }
    }

    return res.status(201).json({
      sinal,
      seguidores_notificados: seguidores.length,
      seguidores_online: seguidores.filter((s) => usuariosConectados.has(s.user_id)).length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// PATCH /api/sinais/:id/resultado — encerra o sinal e atualiza stats
router.patch('/:id/resultado', autenticar, async (req, res) => {
  try {
    if (req.usuario.role !== 'ANALISTA') {
      return res.status(403).json({ erro: 'Apenas analistas podem encerrar sinais' });
    }

    const { resultado } = req.body; // GANHOU | PERDEU | VOID
    if (!['GANHOU', 'PERDEU', 'VOID'].includes(resultado)) {
      return res.status(400).json({ erro: 'Resultado invalido. Use: GANHOU, PERDEU ou VOID' });
    }

    const analista = await prisma.analista.findUnique({ where: { user_id: req.usuario.id } });
    const sinal = await prisma.sinal.findUnique({ where: { id: req.params.id } });

    if (!sinal) return res.status(404).json({ erro: 'Sinal nao encontrado' });
    if (sinal.analista_id !== analista.id) return res.status(403).json({ erro: 'Sinal nao pertence a voce' });
    if (sinal.status === 'ENCERRADO') return res.status(400).json({ erro: 'Sinal ja encerrado' });

    // Atualiza sinal
    await prisma.sinal.update({
      where: { id: sinal.id },
      data: { status: 'ENCERRADO', resultado },
    });

    // Atualiza execucoes
    const execucoes = await prisma.execucao.findMany({ where: { sinal_id: sinal.id } });

    await Promise.all(
      execucoes.map((exec) => {
        let lucro = 0;
        if (resultado === 'GANHOU') lucro = parseFloat(((sinal.odd - 1) * exec.valor_apostado).toFixed(2));
        if (resultado === 'PERDEU') lucro = -exec.valor_apostado;
        if (resultado === 'VOID') lucro = 0;

        return prisma.execucao.update({
          where: { id: exec.id },
          data: { status: 'SUCESSO', lucro_prejuizo: lucro },
        });
      })
    );

    // Recalcula stats do analista
    await recalcularStats(analista.id, sinal.tipo_unidade);

    return res.json({ ok: true, resultado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// PATCH /api/sinais/:execucaoId/status — extensao reporta resultado da execucao
router.patch('/:execucaoId/status', autenticar, async (req, res) => {
  try {
    const { status, erro_msg } = req.body;
    if (!['EXECUTANDO', 'SUCESSO', 'FALHA'].includes(status)) {
      return res.status(400).json({ erro: 'Status invalido' });
    }

    const execucao = await prisma.execucao.findUnique({ where: { id: req.params.execucaoId } });
    if (!execucao) return res.status(404).json({ erro: 'Execucao nao encontrada' });

    await prisma.execucao.update({
      where: { id: execucao.id },
      data: { status, erro_msg: erro_msg || null },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// GET /api/sinais/meus — analista lista seus sinais
router.get('/meus', autenticar, async (req, res) => {
  try {
    const analista = await prisma.analista.findUnique({ where: { user_id: req.usuario.id } });
    if (!analista) return res.status(403).json({ erro: 'Apenas analistas' });

    const sinais = await prisma.sinal.findMany({
      where: { analista_id: analista.id },
      orderBy: { created_at: 'desc' },
      take: 50,
      include: { _count: { select: { execucoes: true } } },
    });

    return res.json({ sinais });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// Recalcula stats do analista para um tipo de unidade
async function recalcularStats(analistaId, tipoUnidade) {
  const sinaisEncerrados = await prisma.sinal.findMany({
    where: { analista_id: analistaId, tipo_unidade: tipoUnidade, status: 'ENCERRADO', resultado: { not: 'VOID' } },
    include: { execucoes: true },
  });

  const total = sinaisEncerrados.length;
  if (total === 0) return;

  const ganhos = sinaisEncerrados.filter((s) => s.resultado === 'GANHOU').length;
  const winRate = parseFloat(((ganhos / total) * 100).toFixed(2));

  // Rendimento total em % da banca
  let totalApostado = 0;
  let totalLucro = 0;
  for (const s of sinaisEncerrados) {
    for (const e of s.execucoes) {
      totalApostado += e.valor_apostado;
      totalLucro += e.lucro_prejuizo || 0;
    }
  }
  const rendimentoTotal = totalApostado > 0 ? parseFloat(((totalLucro / totalApostado) * 100).toFixed(2)) : 0;

  const campos = {
    U1: { win: 'stats_1u_win_rate', rend_total: 'stats_1u_rendimento_total', total: 'stats_1u_total_sinais' },
    U05: { win: 'stats_05u_win_rate', rend_total: 'stats_05u_rendimento_total', total: 'stats_05u_total_sinais' },
    U025: { win: 'stats_025u_win_rate', rend_total: 'stats_025u_rendimento_total', total: 'stats_025u_total_sinais' },
  }[tipoUnidade];

  await prisma.analista.update({
    where: { id: analistaId },
    data: {
      [campos.win]: winRate,
      [campos.rend_total]: rendimentoTotal,
      [campos.total]: total,
    },
  });
}

module.exports = router;

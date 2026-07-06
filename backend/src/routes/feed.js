// routes/feed.js — Feed de tips do CopyBet no formato do BfBotManager.
//
// Cada seguidor recebe uma URL unica e secreta:
//   GET /api/feed/:feedToken/tips.csv
//
// O BfBotManager do seguidor e configurado para recarregar essa URL a cada
// poucos minutos ("Manage tips" -> "Tips auto loading"). Quando um sinal novo
// existe, o CSV traz a linha e o bot executa na conta Betfair do seguidor.
//
// Seguranca do token:
//  - feedToken e um segredo aleatorio de 32+ bytes por seguidor (nao e o id)
//  - gere com crypto.randomBytes(32).toString('base64url') ao ativar o seguidor
//  - guarde APENAS o hash sha256 no banco; a URL completa e mostrada ao
//    seguidor uma unica vez (como se faz com API keys)
//  - permita rotacionar (gerar novo token invalida o antigo)

const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// Janela de validade de um tip no feed: sinais mais antigos que isso nao sao
// mais servidos (evita o bot importar sinal velho se ficou horas offline).
const JANELA_MINUTOS = 60;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Escapa um valor para CSV
function csv(valor) {
  const s = String(valor ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/feed/:feedToken/tips.csv
router.get('/:feedToken/tips.csv', async (req, res) => {
  try {
    const seguidor = await prisma.seguidor.findUnique({
      where: { feed_token_hash: hashToken(req.params.feedToken) },
      include: { user: { include: { plano: true } } },
    });

    // Token invalido, seguidor inativo ou plano vencido -> 404 sem detalhes
    if (!seguidor || !seguidor.ativo || seguidor.user?.plano?.status !== 'ATIVO') {
      return res.status(404).send('Not found');
    }

    const desde = new Date(Date.now() - JANELA_MINUTOS * 60 * 1000);

    const execucoes = await prisma.execucao.findMany({
      where: {
        seguidor_id: seguidor.id,
        status: 'PENDENTE',
        sinal: { status: 'ATIVO', created_at: { gte: desde }, market_id: { not: null } },
      },
      include: { sinal: true },
      orderBy: { created_at: 'asc' },
    });

    const linhas = [
      'Provider,MarketId,SelectionId,SelectionName,MarketType,BetType,Price,Stake',
    ];

    for (const ex of execucoes) {
      const s = ex.sinal;
      linhas.push(
        [
          csv('CopyBet'),
          csv(s.market_id),
          csv(s.selection_id),
          csv(s.selection_nome),
          csv(s.market_type),
          csv(s.lado),
          csv(s.odd_pedida),
          csv(Number(ex.valor_apostado)),
        ].join(',')
      );
    }

    res
      .set('Content-Type', 'text/csv; charset=utf-8')
      .set('Cache-Control', 'no-store')
      .send(linhas.join('\r\n') + '\r\n');
  } catch (err) {
    console.error('feed:', err);
    res.status(500).send('Internal error');
  }
});

// POST /api/feed/gerar — gera/rotaciona o token do seguidor autenticado.
// Retorna a URL completa UMA vez; so o hash fica no banco.
router.post('/gerar', autenticar, async (req, res) => {
  try {
    if (req.usuario.role !== 'SEGUIDOR') {
      return res.status(403).json({ erro: 'Apenas seguidores possuem feed' });
    }
    const seguidor = await prisma.seguidor.findUnique({ where: { user_id: req.usuario.id } });
    if (!seguidor) return res.status(404).json({ erro: 'Perfil de seguidor nao encontrado' });

    const token = crypto.randomBytes(32).toString('base64url');
    await prisma.seguidor.update({
      where: { id: seguidor.id },
      data: { feed_token_hash: hashToken(token) },
    });

    const base = process.env.PUBLIC_API_URL || 'http://localhost:3001';
    return res.json({
      url: `${base}/api/feed/${token}/tips.csv`,
      aviso: 'Guarde esta URL: ela nao sera exibida novamente. Gerar de novo invalida a anterior.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

module.exports = router;

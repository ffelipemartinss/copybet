const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const prisma = require('../lib/prisma');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// POST /api/pagamentos/criar-sessao — redireciona para o Stripe Checkout
router.post('/criar-sessao', autenticar, async (req, res) => {
  try {
    if (req.usuario.role !== 'SEGUIDOR') {
      return res.status(403).json({ erro: 'Apenas seguidores podem assinar' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.usuario.id },
      include: { plano: true },
    });

    if (user.plano?.status === 'ATIVO') {
      return res.status(400).json({ erro: 'Plano ja esta ativo' });
    }

    const base = process.env.CLIENT_URL || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${base}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/seguidor`,
      metadata: { user_id: user.id },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao criar sessao de pagamento' });
  }
});

// GET /api/pagamentos/portal — abre o portal de gerenciamento da assinatura Stripe
router.get('/portal', autenticar, async (req, res) => {
  try {
    const plano = await prisma.plano.findUnique({ where: { user_id: req.usuario.id } });

    if (!plano?.stripe_subscription_id) {
      return res.status(400).json({ erro: 'Nenhuma assinatura ativa encontrada' });
    }

    const subscription = await stripe.subscriptions.retrieve(plano.stripe_subscription_id);
    const base = process.env.CLIENT_URL || 'http://localhost:5173';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.customer,
      return_url: `${base}/seguidor`,
    });

    return res.json({ url: portalSession.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao abrir portal de pagamento' });
  }
});

// POST /api/pagamentos/webhook — recebe eventos do Stripe
// O raw body e configurado no server.js antes do express.json()
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') break;

        const userId = session.metadata?.user_id;
        if (!userId) break;

        await prisma.plano.update({
          where: { user_id: userId },
          data: {
            status: 'ATIVO',
            stripe_subscription_id: session.subscription,
            data_inicio: new Date(),
          },
        });

        // Ativa o seguidor para receber sinais
        await prisma.seguidor.update({
          where: { user_id: userId },
          data: { ativo: true },
        });
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const plano = await prisma.plano.findFirst({
          where: { stripe_subscription_id: sub.id },
        });
        if (!plano) break;

        const novoStatus = sub.status === 'active' ? 'ATIVO' : 'INATIVO';
        const dataVencimento = sub.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : null;

        await prisma.plano.update({
          where: { id: plano.id },
          data: { status: novoStatus, data_vencimento: dataVencimento },
        });

        if (novoStatus !== 'ATIVO') {
          await prisma.seguidor.update({
            where: { user_id: plano.user_id },
            data: { ativo: false },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const plano = await prisma.plano.findFirst({
          where: { stripe_subscription_id: sub.id },
        });
        if (!plano) break;

        await prisma.plano.update({
          where: { id: plano.id },
          data: { status: 'CANCELADO' },
        });

        await prisma.seguidor.update({
          where: { user_id: plano.user_id },
          data: { ativo: false },
        });
        break;
      }
    }
  } catch (err) {
    console.error('Erro ao processar webhook:', err);
    return res.status(500).send('Internal error');
  }

  res.json({ received: true });
});

module.exports = router;

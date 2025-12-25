import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { checkBalanceAndReactivateIfNeeded } from '@/lib/billing/balance-check';

// Initialize Stripe - will be undefined if no key configured
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// POST /api/billing/stripe/webhook - Handle Stripe webhook events
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    // If Stripe is not configured, return error
    if (!stripe) {
      console.error('Stripe is not configured');
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      );
    }

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return NextResponse.json(
          { error: 'Webhook signature verification failed' },
          { status: 400 }
        );
      }
    } else {
      // For development/testing without webhook secret
      event = JSON.parse(body) as Stripe.Event;
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.error('Payment failed:', paymentIntent.id);
        // Could notify user here
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Handle completed checkout session
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const amount = session.amount_total ? session.amount_total / 100 : 0; // Convert cents to dollars

  if (!userId || amount <= 0) {
    console.error('Invalid checkout session:', { userId, amount });
    return;
  }

  await addCreditsToWallet(userId, amount, session.payment_intent as string, 'Wallet top-up via Stripe');
}

// Handle successful payment intent
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const userId = paymentIntent.metadata?.userId;
  const amount = paymentIntent.amount / 100; // Convert cents to dollars

  if (!userId || amount <= 0) {
    console.error('Invalid payment intent:', { userId, amount });
    return;
  }

  // Check if already processed (idempotency)
  const existing = await prisma.billingTransaction.findFirst({
    where: { stripePaymentId: paymentIntent.id },
  });

  if (existing) {
    console.log('Payment already processed:', paymentIntent.id);
    return;
  }

  await addCreditsToWallet(userId, amount, paymentIntent.id, 'Wallet top-up via Stripe');
}

// Add credits to wallet (shared logic)
async function addCreditsToWallet(
  userId: string,
  amount: number,
  stripePaymentId: string,
  description: string
) {
  // Get or create wallet
  let wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId, balance: 0 },
    });
  }

  const newBalance = wallet.balance + amount;

  // Update wallet and create transaction
  await prisma.wallet.update({
    where: { userId },
    data: {
      balance: newBalance,
      transactions: {
        create: {
          type: 'top_up',
          amount,
          balanceAfter: newBalance,
          description,
          stripePaymentId,
        },
      },
    },
  });

  console.log(`Added ${amount} to wallet for user ${userId}. New balance: ${newBalance}`);

  // Reactivate any agents that were paused due to zero balance
  await checkBalanceAndReactivateIfNeeded(userId);
}

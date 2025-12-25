import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkBalanceAndReactivateIfNeeded } from '@/lib/billing/balance-check';

// GET /api/billing/wallet - Get or create wallet for current user
export async function GET(request: NextRequest) {
  try {
    // TODO: Get userId from auth session
    // For now, use a query param or default
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Get or create wallet
    let wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!wallet) {
      // Create wallet with welcome bonus
      wallet = await prisma.wallet.create({
        data: {
          userId,
          balance: 5.00, // $5 welcome credit
          lowBalanceAt: 5.00,
          transactions: {
            create: {
              type: 'bonus',
              amount: 5.00,
              balanceAfter: 5.00,
              description: 'Welcome credit - Start making calls!',
            },
          },
        },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
    }

    // Calculate usage stats for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyUsage = await prisma.voiceUsage.aggregate({
      where: {
        userId,
        createdAt: { gte: startOfMonth },
      },
      _sum: {
        minutes: true,
        totalCost: true,
      },
    });

    return NextResponse.json({
      ...wallet,
      monthlyMinutes: monthlyUsage._sum.minutes || 0,
      monthlyCost: monthlyUsage._sum.totalCost || 0,
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet' },
      { status: 500 }
    );
  }
}

// POST /api/billing/wallet - Add credits to wallet (for testing/admin)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount, type = 'top_up', description } = body;

    if (!userId || !amount) {
      return NextResponse.json(
        { error: 'userId and amount are required' },
        { status: 400 }
      );
    }

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
    const updatedWallet = await prisma.wallet.update({
      where: { userId },
      data: {
        balance: newBalance,
        transactions: {
          create: {
            type,
            amount,
            balanceAfter: newBalance,
            description: description || `Added ${amount.toFixed(2)} to wallet`,
          },
        },
      },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    // Reactivate any agents that were paused due to zero balance
    await checkBalanceAndReactivateIfNeeded(userId);

    return NextResponse.json(updatedWallet);
  } catch (error) {
    console.error('Error updating wallet:', error);
    return NextResponse.json(
      { error: 'Failed to update wallet' },
      { status: 500 }
    );
  }
}

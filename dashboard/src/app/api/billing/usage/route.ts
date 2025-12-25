import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Pricing configuration
const PRICING = {
  costPerMinute: 0.10, // What we charge the user
  baseCostPerMinute: 0.04, // Our actual cost (LiveKit + AI)
};

// GET /api/billing/usage - Get usage history
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
    const period = request.nextUrl.searchParams.get('period') || 'month'; // 'day', 'week', 'month', 'all'

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Calculate date range
    let startDate: Date | undefined;
    const now = new Date();

    switch (period) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'all':
      default:
        startDate = undefined;
    }

    const whereClause: any = { userId };
    if (startDate) {
      whereClause.createdAt = { gte: startDate };
    }

    // Get usage records
    const usage = await prisma.voiceUsage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        call: {
          select: {
            id: true,
            phoneNumber: true,
            direction: true,
            outcome: true,
            startedAt: true,
            agent: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // Get aggregated stats
    const stats = await prisma.voiceUsage.aggregate({
      where: whereClause,
      _sum: {
        minutes: true,
        totalCost: true,
        margin: true,
      },
      _count: true,
    });

    // Get daily breakdown for charts (simplified - returns empty for now)
    // TODO: Implement proper daily aggregation when there's usage data
    const dailyUsage: any[] = [];

    return NextResponse.json({
      usage,
      stats: {
        totalMinutes: stats._sum.minutes || 0,
        totalCost: stats._sum.totalCost || 0,
        totalMargin: stats._sum.margin || 0,
        callCount: stats._count,
      },
      dailyUsage,
      pricing: PRICING,
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage' },
      { status: 500 }
    );
  }
}

// POST /api/billing/usage - Record usage and deduct from wallet (called after call ends)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, callId, durationSeconds } = body;

    if (!userId || !callId || durationSeconds === undefined) {
      return NextResponse.json(
        { error: 'userId, callId, and durationSeconds are required' },
        { status: 400 }
      );
    }

    // Check if usage already recorded for this call
    const existingUsage = await prisma.voiceUsage.findUnique({
      where: { callId },
    });

    if (existingUsage) {
      return NextResponse.json(
        { error: 'Usage already recorded for this call' },
        { status: 400 }
      );
    }

    // Calculate costs
    const minutes = durationSeconds / 60;
    const totalCost = minutes * PRICING.costPerMinute;
    const baseCost = minutes * PRICING.baseCostPerMinute;
    const margin = totalCost - baseCost;

    // Get wallet
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found. Please contact support.' },
        { status: 404 }
      );
    }

    // Check if sufficient balance
    if (wallet.balance < totalCost) {
      // Record usage but mark as unpaid (for tracking)
      await prisma.voiceUsage.create({
        data: {
          userId,
          callId,
          minutes,
          costRate: PRICING.costPerMinute,
          totalCost,
          baseCost,
          margin,
        },
      });

      return NextResponse.json(
        {
          error: 'Insufficient balance',
          balance: wallet.balance,
          required: totalCost,
          shortfall: totalCost - wallet.balance,
        },
        { status: 402 } // Payment Required
      );
    }

    // Deduct from wallet and record usage in a transaction
    const newBalance = wallet.balance - totalCost;

    const [usage, updatedWallet] = await prisma.$transaction([
      prisma.voiceUsage.create({
        data: {
          userId,
          callId,
          minutes,
          costRate: PRICING.costPerMinute,
          totalCost,
          baseCost,
          margin,
        },
      }),
      prisma.wallet.update({
        where: { userId },
        data: {
          balance: newBalance,
          transactions: {
            create: {
              type: 'usage_deduction',
              amount: -totalCost,
              balanceAfter: newBalance,
              description: `Voice call: ${minutes.toFixed(1)} minutes`,
              callId,
            },
          },
        },
      }),
    ]);

    // Check if low balance alert needed
    const lowBalance = newBalance < wallet.lowBalanceAt;

    return NextResponse.json({
      usage,
      wallet: {
        balance: newBalance,
        lowBalance,
        lowBalanceAt: wallet.lowBalanceAt,
      },
      charged: totalCost,
    });
  } catch (error) {
    console.error('Error recording usage:', error);
    return NextResponse.json(
      { error: 'Failed to record usage' },
      { status: 500 }
    );
  }
}

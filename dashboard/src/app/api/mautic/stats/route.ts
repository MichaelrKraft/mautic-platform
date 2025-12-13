/**
 * Mautic Stats API Route
 *
 * GET /api/mautic/stats - Get dashboard stats
 */

import { NextResponse } from 'next/server';
import { getMauticClient } from '@/lib/mautic-server';
import { getTokens } from '@/lib/token-store';

export async function GET() {
  try {
    const tokens = getTokens();
    if (!tokens) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect to Mautic first.' },
        { status: 401 }
      );
    }

    const client = getMauticClient();
    client.setTokens(tokens);

    const stats = await client.getStats();

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

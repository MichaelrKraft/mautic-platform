/**
 * Mautic Forms API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMauticClient } from '@/lib/mautic-server';
import { getTokens } from '@/lib/token-store';

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const params = {
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
    };

    const result = await client.getForms(params);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get forms error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch forms' },
      { status: 500 }
    );
  }
}

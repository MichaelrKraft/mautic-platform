/**
 * Mautic Campaigns API Route
 * 
 * GET /api/mautic/campaigns - List campaigns
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
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 30,
      published: searchParams.get('published') === 'true' ? true : 
                 searchParams.get('published') === 'false' ? false : undefined,
    };

    const result = await client.getCampaigns(params);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get campaigns error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

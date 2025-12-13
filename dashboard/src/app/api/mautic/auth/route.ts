/**
 * Mautic OAuth Authentication API Routes
 * 
 * GET /api/mautic/auth - Get authorization URL
 * POST /api/mautic/auth - Exchange code for tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMauticClient, getMauticConfig } from '@/lib/mautic-server';

// In-memory token storage (use database in production)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let storedTokens: {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
} | null = null;

export async function GET(request: NextRequest) {
  try {
    const config = getMauticConfig();
    const redirectUri = `${request.nextUrl.origin}/api/mautic/callback`;
    
    const client = getMauticClient();
    const authUrl = client.getAuthorizationUrl(redirectUri);

    return NextResponse.json({
      authUrl,
      redirectUri,
      clientId: config.clientId,
    });
  } catch (error) {
    console.error('Auth config error:', error);
    return NextResponse.json(
      { error: 'Failed to get auth configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { code, redirectUri } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    const client = getMauticClient();
    const tokens = await client.exchangeCodeForTokens(code, redirectUri);

    // Store tokens (use database in production)
    storedTokens = tokens;

    return NextResponse.json({
      success: true,
      expiresAt: tokens.expiresAt,
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json(
      { error: 'Failed to exchange authorization code' },
      { status: 500 }
    );
  }
}

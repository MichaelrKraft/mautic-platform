/**
 * Mautic OAuth Callback Handler
 * 
 * GET /api/mautic/callback - Handle OAuth redirect from Mautic
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMauticClient } from '@/lib/mautic-server';
import { setTokens } from '@/lib/token-store';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(error)}`, request.nextUrl.origin)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/?error=no_code', request.nextUrl.origin)
      );
    }

    const redirectUri = `${request.nextUrl.origin}/api/mautic/callback`;
    const client = getMauticClient();
    const tokens = await client.exchangeCodeForTokens(code, redirectUri);

    // Store tokens in shared store
    setTokens(tokens);

    // Redirect to dashboard with success
    return NextResponse.redirect(
      new URL('/?auth=success', request.nextUrl.origin)
    );
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.redirect(
      new URL('/?error=token_exchange_failed', request.nextUrl.origin)
    );
  }
}

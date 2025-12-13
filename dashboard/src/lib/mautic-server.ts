/**
 * Server-side Mautic client initialization
 * Uses environment variables for credentials
 */

import { MauticClient } from './mautic-client';

let cachedClient: MauticClient | null = null;

export function getMauticClient(): MauticClient {
  if (cachedClient) {
    return cachedClient;
  }

  const baseUrl = process.env.MAUTIC_URL;
  const clientId = process.env.MAUTIC_CLIENT_ID;
  const clientSecret = process.env.MAUTIC_CLIENT_SECRET;

  if (!baseUrl || !clientId || !clientSecret) {
    throw new Error(
      'Missing Mautic configuration. Please set MAUTIC_URL, MAUTIC_CLIENT_ID, and MAUTIC_CLIENT_SECRET in .env.local'
    );
  }

  cachedClient = new MauticClient({
    baseUrl,
    clientId,
    clientSecret,
  });

  return cachedClient;
}

/**
 * Get Mautic config for client-side OAuth redirect
 */
export function getMauticConfig() {
  return {
    baseUrl: process.env.MAUTIC_URL || '',
    clientId: process.env.MAUTIC_CLIENT_ID || '',
  };
}

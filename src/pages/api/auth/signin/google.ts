export const prerender = false;

import { env } from "cloudflare:workers";
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ redirect }) => {
  const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || '';
  const BASE_URL = env.BETTER_AUTH_URL || 'https://noteschatai.com';

  if (!GOOGLE_CLIENT_ID) {
    return redirect('/auth/login?error=google_not_configured');
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${BASE_URL}/api/auth/callback/google`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });

  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};
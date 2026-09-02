export const prerender = false;

import type { APIRoute } from 'astro';

async function getEnv() {
  try {
    const mod = await import('cloudflare:workers');
    return (mod as any).env ?? null;
  } catch {
    return null;
  }
}

export const GET: APIRoute = async ({ redirect, cookies }) => {
  const env = await getEnv();
  const GOOGLE_CLIENT_ID = env?.GOOGLE_CLIENT_ID || '';
  const BASE_URL = env?.BETTER_AUTH_URL || 'https://noteschatai.com';

  if (!GOOGLE_CLIENT_ID) {
    return redirect('/auth/login?error=google_not_configured');
  }

  // CSRF state: random token stored in cookie, verified on callback
  const { randomBytes } = await import('node:crypto');
  const state = randomBytes(32).toString('hex');
  cookies.set('oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${BASE_URL}/api/auth/callback/google`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};

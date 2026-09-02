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
  const GITHUB_CLIENT_ID = env?.GITHUB_CLIENT_ID || '';
  const BASE_URL = env?.BETTER_AUTH_URL || 'https://noteschatai.com';

  if (!GITHUB_CLIENT_ID) {
    return redirect('/auth/login?error=github_not_configured');
  }

  // CSRF state: random token stored in cookie, verified on callback
  const { randomBytes } = await import('node:crypto');
  const state = randomBytes(32).toString('hex');
  cookies.set('oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${BASE_URL}/api/auth/callback/github`,
    scope: 'read:user user:email',
    state,
  });

  return redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
};

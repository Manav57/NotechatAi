export const prerender = false;

import { env } from "cloudflare:workers";
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ redirect }) => {
  const GITHUB_CLIENT_ID = env.GITHUB_CLIENT_ID || '';
  const BASE_URL = env.BETTER_AUTH_URL || 'https://noteschatai.com';

  if (!GITHUB_CLIENT_ID) {
    return redirect('/auth/login?error=github_not_configured');
  }

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${BASE_URL}/api/auth/callback/github`,
    scope: 'read:user user:email',
  });

  return redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
};
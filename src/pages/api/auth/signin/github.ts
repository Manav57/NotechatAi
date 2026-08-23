export const prerender = false;

import type { APIRoute } from 'astro';

const GITHUB_CLIENT_ID = import.meta.env.GITHUB_CLIENT_ID || '';
const BASE_URL = import.meta.env.BETTER_AUTH_URL || 'http://localhost:4321';

export const GET: APIRoute = async ({ redirect }) => {
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

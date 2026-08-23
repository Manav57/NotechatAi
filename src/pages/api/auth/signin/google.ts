export const prerender = false;

import type { APIRoute } from 'astro';

const GOOGLE_CLIENT_ID = import.meta.env.GOOGLE_CLIENT_ID || '';
const BASE_URL = import.meta.env.BETTER_AUTH_URL || 'http://localhost:4321';

export const GET: APIRoute = async ({ redirect }) => {
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

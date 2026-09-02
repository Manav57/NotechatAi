export const prerender = false;

import type { APIRoute } from 'astro';
import { dbGetUserByEmail, dbCreateUser, dbCreateSession, dbUpsertOAuthAccount } from '../../../../lib/db-auth';
import { devCreateUser, devCreateSession, devGetUserByEmail } from '../../../../lib/dev-auth';

async function getEnv() {
  try {
    const mod = await import('cloudflare:workers');
    return (mod as any).env ?? null;
  } catch {
    return null;
  }
}

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  try {
    const env = await getEnv();
    const GOOGLE_CLIENT_ID = env?.GOOGLE_CLIENT_ID || '';
    const GOOGLE_CLIENT_SECRET = env?.GOOGLE_CLIENT_SECRET || '';

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error('Google OAuth: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured');
      return redirect('/auth/login?error=google_not_configured');
    }

    const code = url.searchParams.get('code');
    if (!code) {
      return redirect('/auth/login?error=missing_code');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${url.origin}/api/auth/callback/google`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Google token exchange failed:', await tokenResponse.text());
      return redirect('/auth/login?error=oauth_failed');
    }

    const tokens = await tokenResponse.json();

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResponse.ok) {
      return redirect('/auth/login?error=oauth_user_info_failed');
    }

    const googleUser = await userResponse.json();

    // Try D1 first, fall back to dev-auth
    let sessionToken: string;
    try {
      // D1 path
      let user = await dbGetUserByEmail(googleUser.email);
      if (!user) {
        user = await dbCreateUser(
          googleUser.name || googleUser.email.split('@')[0],
          googleUser.email,
          'oauth-no-password-' + Math.random().toString(36).slice(2),
        );
      }
      // Record OAuth account linkage
      await dbUpsertOAuthAccount(
        user.id,
        'google',
        googleUser.id,
        tokens.access_token,
        tokens.refresh_token,
        'openid email profile',
      );
      const session = await dbCreateSession(user.id);
      sessionToken = session.token;
    } catch (e) {
      console.error('D1 auth failed, falling back to dev-auth:', e);
      // D1 unavailable — fall back to in-memory dev-auth
      let user = devGetUserByEmail(googleUser.email);
      if (!user) {
        user = await devCreateUser(
          googleUser.name || googleUser.email.split('@')[0],
          googleUser.email,
          'oauth-no-password-' + Math.random().toString(36).slice(2),
        );
      }
      const session = devCreateSession(user.id);
      sessionToken = session.token;
    }

    cookies.set('session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });

    return redirect('/app');
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return redirect('/auth/login?error=network_error');
  }
};

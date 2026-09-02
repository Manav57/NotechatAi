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
    const GITHUB_CLIENT_ID = env?.GITHUB_CLIENT_ID || '';
    const GITHUB_CLIENT_SECRET = env?.GITHUB_CLIENT_SECRET || '';

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      console.error('GitHub OAuth: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not configured');
      return redirect('/auth/login?error=github_not_configured');
    }

    const code = url.searchParams.get('code');
    if (!code) {
      return redirect('/auth/login?error=missing_code');
    }

    // Exchange code for token.
    const BASE_URL = env?.BETTER_AUTH_URL || 'https://noteschatai.com';
    const redirectUri = `${BASE_URL}/api/auth/callback/github`;

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('GitHub token exchange failed:', tokenResponse.status, await tokenResponse.text());
      return redirect('/auth/login?error=oauth_failed');
    }

    const tokens = await tokenResponse.json();
    if (tokens.error) {
      console.error('GitHub token exchange error:', tokens.error, tokens.error_description || '');
      return redirect('/auth/login?error=oauth_failed');
    }

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!userResponse.ok) {
      console.error('GitHub user info failed:', userResponse.status, await userResponse.text());
      return redirect('/auth/login?error=oauth_user_info_failed');
    }

    const githubUser = await userResponse.json();

    // Get primary email
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!emailResponse.ok) {
      console.error('GitHub emails failed:', emailResponse.status, await emailResponse.text());
      return redirect('/auth/login?error=oauth_user_info_failed');
    }

    const emails = await emailResponse.json();
    const primaryEmail = emails?.find((e: { primary: boolean; verified: boolean }) => e.primary && e.verified)?.email
      || emails?.find((e: { verified: boolean }) => e.verified)?.email
      || githubUser.email;

    if (!primaryEmail) {
      return redirect('/auth/login?error=no_email');
    }

    // Try D1 first, fall back to dev-auth
    let sessionToken: string;
    try {
      // D1 path
      let user = await dbGetUserByEmail(primaryEmail);
      if (!user) {
        user = await dbCreateUser(
          githubUser.name || githubUser.login,
          primaryEmail,
          'oauth-no-password-' + Math.random().toString(36).slice(2),
        );
      }
      // Record OAuth account linkage
      await dbUpsertOAuthAccount(
        user.id,
        'github',
        String(githubUser.id),
        tokens.access_token,
        undefined,
        'read:user user:email',
      );
      const session = await dbCreateSession(user.id);
      sessionToken = session.token;
    } catch (e) {
      console.error('D1 auth failed, falling back to dev-auth:', e);
      // D1 unavailable — fall back to in-memory dev-auth
      let user = devGetUserByEmail(primaryEmail);
      if (!user) {
        user = await devCreateUser(
          githubUser.name || githubUser.login,
          primaryEmail,
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
    console.error('GitHub OAuth callback error:', error);
    return redirect('/auth/login?error=network_error');
  }
};

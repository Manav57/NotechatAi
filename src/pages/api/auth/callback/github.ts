export const prerender = false;

import type { APIRoute } from 'astro';
import { devCreateUser, devCreateSession, devGetUserByEmail } from '../../../../lib/dev-auth';

const GITHUB_CLIENT_ID = import.meta.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = import.meta.env.GITHUB_CLIENT_SECRET || '';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  try {
    const code = url.searchParams.get('code');
    if (!code) {
      return redirect('/auth/login?error=missing_code');
    }

    // Exchange code for token
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
      }),
    });

    if (!tokenResponse.ok) {
      return redirect('/auth/login?error=oauth_failed');
    }

    const tokens = await tokenResponse.json();
    if (tokens.error) {
      return redirect('/auth/login?error=oauth_failed');
    }

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: 'application/vnd.github.v2+json',
      },
    });

    if (!userResponse.ok) {
      return redirect('/auth/login?error=oauth_user_info_failed');
    }

    const githubUser = await userResponse.json();

    // Get primary email
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: 'application/vnd.github.v2+json',
      },
    });

    const emails = await emailResponse.json();
    const primaryEmail = emails?.find((e: { primary: boolean; verified: boolean }) => e.primary && e.verified)?.email
      || emails?.find((e: { verified: boolean }) => e.verified)?.email
      || githubUser.email;

    if (!primaryEmail) {
      return redirect('/auth/login?error=no_email');
    }

    // Find or create user
    let user = devGetUserByEmail(primaryEmail);
    if (!user) {
      user = devCreateUser(
        githubUser.name || githubUser.login,
        primaryEmail,
        'oauth-no-password-' + Math.random().toString(36).slice(2),
      );
    }

    // Create session
    const session = devCreateSession(user.id);
    cookies.set('session', session.token, {
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

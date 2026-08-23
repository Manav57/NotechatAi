export const prerender = false;

import type { APIRoute } from 'astro';
import { devCreateUser, devCreateSession, devGetUserByEmail } from '../../../../lib/dev-auth';

const GOOGLE_CLIENT_ID = import.meta.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = import.meta.env.GOOGLE_CLIENT_SECRET || '';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  try {
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

    // Find or create user
    let user = devGetUserByEmail(googleUser.email);
    if (!user) {
      user = devCreateUser(
        googleUser.name || googleUser.email.split('@')[0],
        googleUser.email,
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
    console.error('Google OAuth callback error:', error);
    return redirect('/auth/login?error=network_error');
  }
};

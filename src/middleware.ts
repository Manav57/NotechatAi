import { defineMiddleware } from 'astro:middleware';
import { getUser } from './lib/auth';

// Pages that don't require authentication
const publicPaths = [
  '/',
  '/features',
  '/pricing',
  '/blog',
  '/free-beta',
  '/about',
  '/terms',
  '/privacy',
  '/contact',
  '/status',
  '/docs',
  '/auth/login',
  '/auth/signup',
  '/api',
];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export const onRequest = defineMiddleware(async (context, next) => {
  try {
    const user = await getUser(context.cookies);
    context.locals.user = user;

    // For protected routes, redirect to login if not authenticated
    if (!isPublicPath(context.url.pathname)) {
      if (!user) {
        if (context.url.pathname.startsWith('/api/')) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return context.redirect('/auth/login');
      }
    }
  } catch {
    // During prerender, cookie access may fail — that's fine
    context.locals.user = null;
  }

  return next();
});

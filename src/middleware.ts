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
  '/sitemap-index.xml',
  '/sitemap.xml',
  '/robots.txt',
];

// Public API routes that don't require auth
const publicApiPrefixes = [
  '/api/auth/signin',
  '/api/auth/signup',
  '/api/auth/signout',
  '/api/auth/session',
  '/api/auth/signin/google',
  '/api/auth/signin/github',
  '/api/contact',
  '/api/newsletter',
];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isPublicApi(pathname: string): boolean {
  return publicApiPrefixes.some((p) => pathname.startsWith(p));
}

// Maximum request body size: 15 MB (allows base64 image OCR uploads)
const MAX_REQUEST_BODY_SIZE = 15 * 1024 * 1024;

export const onRequest = defineMiddleware(async (context, next) => {
  // ─── Security Headers ───
  const response = await (async () => {
    try {
      const user = await getUser(context.cookies);
      context.locals.user = user;

      const pathname = context.url.pathname;

      // For protected routes, redirect to login if not authenticated
      if (!isPublicPath(pathname)) {
        if (!user) {
          // API routes get JSON 401
          if (pathname.startsWith('/api/')) {
            if (isPublicApi(pathname)) {
              return next();
            }
            return new Response(
              JSON.stringify({ error: 'Unauthorized', message: 'Please log in to access this resource.' }),
              { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
          }
          // Page routes redirect to login with return URL
          const redirectUrl = `/auth/login?redirect=${encodeURIComponent(pathname)}`;
          return context.redirect(redirectUrl);
        }
      }
    } catch {
      // During prerender, cookie access may fail — that's fine
      context.locals.user = null;
    }

    return next();
  })();

  // ─── Add Security Headers ───
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // CSP — allow inline scripts (Astro requires it), Cloudflare insights,
  // and the full set of Google Analytics + AdSense origins (scripts, connections,
  // and iframes). Without these, Cloudflare Web Analytics is blocked and AdSense
  // quality/traffic checks fail.
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' " +
      "https://www.googletagmanager.com https://www.google-analytics.com " +
      "https://static.cloudflareinsights.com " +
      "https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com " +
      "https://adservice.google.com https://adservice.google.de https://ads.google.com " +
      "https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://*.adtrafficquality.google " +
      "https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https: blob:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://openrouter.ai " +
      "https://www.google-analytics.com https://www.googletagmanager.com " +
      "https://static.cloudflareinsights.com " +
      "https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com " +
      "https://adservice.google.com https://adservice.google.de " +
      "https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://*.adtrafficquality.google " +
      "https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com; " +
    "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com " +
      "https://pagead2.googlesyndication.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://*.adtrafficquality.google " +
      "https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );
  // HSTS for production (only on HTTPS)
  try {
    const proto = context.url?.protocol;
    if (proto === 'https:') {
      response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }
  } catch {} // prerender may not have full context

  return response;
});

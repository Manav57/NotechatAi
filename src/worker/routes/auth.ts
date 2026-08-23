import { Hono } from 'hono';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from '../db';

interface Env {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

const authRoutes = new Hono<{ Bindings: Env }>();

// Initialize Better Auth
function getAuth(env: Env) {
  return betterAuth({
    database: drizzleAdapter(getDb(env), {
      provider: 'sqlite',
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
      ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET ? {
        github: {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
        },
      } : {}),
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: ['https://noteschatai.com', 'http://localhost:4321'],
  });
}

// Mount Better Auth handlers
authRoutes.all('/*', async (c) => {
  const auth = getAuth(c.env);
  return auth.handler(c.req.raw);
});

// Additional auth endpoints
authRoutes.post('/signup', async (c) => {
  const auth = getAuth(c.env);
  const body = await c.req.json();
  const result = await auth.api.signUpEmail({
    body: {
      email: body.email,
      password: body.password,
      name: body.name,
    },
  });
  return c.json(result);
});

authRoutes.post('/signin', async (c) => {
  const auth = getAuth(c.env);
  const body = await c.req.json();
  const result = await auth.api.signInEmail({
    body: {
      email: body.email,
      password: body.password,
    },
  });
  return c.json(result);
});

authRoutes.post('/signout', async (c) => {
  const auth = getAuth(c.env);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (session) {
    await auth.api.signOut({
      headers: c.req.raw.headers,
    });
  }
  return c.json({ success: true });
});

authRoutes.get('/session', async (c) => {
  const auth = getAuth(c.env);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  return c.json({ session });
});

export default authRoutes;
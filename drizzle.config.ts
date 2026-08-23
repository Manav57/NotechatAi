import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/worker/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  driver: 'd1',
  dbCredentials: {
    wranglerConfigPath: './wrangler.toml',
    dbName: 'noteschatai-db',
  },
  verbose: true,
  strict: true,
});
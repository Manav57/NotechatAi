import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://noteschatai.com',
  integrations: [
    mdx(),
    sitemap({
      // Exclude authenticated/private routes from the public sitemap
      filter: (page) =>
        !page.includes('/app/') &&
        !page.includes('/auth/') &&
        !page.includes('/api/') &&
        !page.endsWith('/404') &&
        !page.endsWith('/500'),
    }),
  ],
  output: 'server',
  adapter: cloudflare(),
});
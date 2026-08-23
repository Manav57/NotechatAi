import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://noteschatai.com',
  integrations: [mdx(), sitemap()],
  output: 'static',
  adapter: node({
    mode: 'standalone',
  }),
});
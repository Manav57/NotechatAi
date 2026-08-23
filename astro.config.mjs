import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [],
  output: 'static',
  adapter: undefined,
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ['@cloudflare/workers-types'],
    },
  },
});
// @ts-check
import { defineConfig } from 'astro/config';
// import node from '@astrojs/node';   // standalone server — use for self-hosted/local Docker
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  // adapter: node({ mode: 'standalone' }),  // swap back for self-hosted deployment
  adapter: vercel(),
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
  ],
  vite: {
    define: {
      // 'process.env.API_BASE': JSON.stringify(process.env.API_BASE ?? 'http://localhost/api/v1'),
      'process.env.API_BASE': JSON.stringify(process.env.API_BASE ?? 'http://localhost:8000/api/v1'),
    },
    server: {
      proxy: {
        // In dev: bypass nginx, hit Django directly on its exposed port
        '/api':    { target: 'http://localhost:8000', changeOrigin: true },
        '/static': { target: 'http://localhost:8000', changeOrigin: true },
        '/media':  { target: 'http://localhost:8000', changeOrigin: true },
        '/ws':     { target: 'ws://localhost:8001',   changeOrigin: true, ws: true },
      },
    },
  },
});

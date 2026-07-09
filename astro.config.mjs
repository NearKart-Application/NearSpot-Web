// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
  ],
  vite: {
    define: {
      'process.env.API_BASE': JSON.stringify(process.env.API_BASE ?? 'http://localhost/api/v1'),
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

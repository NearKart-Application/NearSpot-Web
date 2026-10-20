// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
// import vercel from '@astrojs/vercel';  // swap in for Vercel deployment
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // adapter: vercel(),  // swap in for Vercel deployment
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
      allowedHosts: process.env.EXTRA_HOST ? [process.env.EXTRA_HOST, 'localhost'] : true,
      proxy: {
        // DJANGO_HOST: localhost (native), host.docker.internal (standalone Docker), django (full Docker stack)
        // WS_HOST: same as DJANGO_HOST unless overridden (daphne is a separate service in full Docker stack)
        '/api':    { target: `http://${process.env.DJANGO_HOST ?? 'localhost'}:8000`, changeOrigin: true },
        '/static': { target: `http://${process.env.DJANGO_HOST ?? 'localhost'}:8000`, changeOrigin: true },
        '/media':  { target: `http://${process.env.DJANGO_HOST ?? 'localhost'}:8000`, changeOrigin: true },
        '/ws':     { target: `ws://${process.env.WS_HOST ?? process.env.DJANGO_HOST ?? 'localhost'}:8001`, changeOrigin: true, ws: true },
      },
    },
  },
});

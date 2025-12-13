import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/maps-u-travel': {
        target: 'https://maps.u-travel.by',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/maps-u-travel/, ''),
      },
      '/api-u-travel': {
        target: 'https://api.u-travel.by',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-u-travel/, ''),
      },
      '/glyphs': {
        target: 'https://trailstash.github.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/glyphs/, ''),
      },
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { pwa } from './pwa.config.js';

// En local l'API est sur localhost:4000 ; dans docker-compose.dev.yml elle s'appelle "api".
const apiTarget = process.env.VITE_API_TARGET ?? 'http://localhost:4000';

// Docker Desktop sous Windows ne transmet pas les evenements de fichiers du disque
// hote au conteneur : on surveille alors par scrutation.
const usePolling = process.env.VITE_USE_POLLING === 'true';

export default defineConfig({
  plugins: [react(), tailwindcss(), pwa],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: process.env.VITE_HOST ?? 'localhost',
    port: 5173,
    strictPort: true,
    watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      // Le front appelle /api en relatif : pas de CORS en developpement.
      '/api': { target: apiTarget, changeOrigin: true },
      '/uploads': { target: apiTarget, changeOrigin: true },
    },
  },
});

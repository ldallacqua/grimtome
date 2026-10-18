/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Dev-server only: exposes the user's locally imported game-asset cache at
 * `/__game-assets/` so the UI can be designed in a normal browser with real
 * icons. It is never part of a production build (`apply: 'serve'`) and can be
 * disabled with GRIMTOME_DEV_ASSETS=0 (visual tests do this to stay asset-free).
 */
function localGameAssets(): Plugin {
  const cache = path.join(process.env.LOCALAPPDATA ?? '', 'Grimtome', 'assets', 'current');
  return {
    name: 'grimtome-local-game-assets',
    apply: 'serve',
    configureServer(server) {
      if (process.env.GRIMTOME_DEV_ASSETS === '0') return;
      server.middlewares.use('/__game-assets', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/').replace(/^\/+/, '');
        const file = path.resolve(cache, rel);
        if (!file.startsWith(cache) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', file.endsWith('.json') ? 'application/json' : 'image/png');
        res.setHeader('Cache-Control', 'no-cache');
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localGameAssets()],
  resolve: { alias: { '@': path.join(root, 'src') } },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**', '**/target/**', '**/.scratch/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: { main: path.join(root, 'index.html') },
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'jsdom',
          include: ['tests/integration/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/setup.ts'],
        },
      },
    ],
  },
});

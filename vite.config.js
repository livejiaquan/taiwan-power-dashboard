import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { powerApiPlugin } from './server/power-api.js';

// Production only: start fetching the published snapshot in parallel with the
// app bundle. The dev server has no static snapshot, so it is left out there.
function preloadSnapshot() {
  return {
    name: 'preload-snapshot',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'link', attrs: { rel: 'preload', href: 'api/power-data.json', as: 'fetch', crossorigin: 'anonymous' }, injectTo: 'head' }
    ]
  };
}

export default defineConfig({
  // Relative asset URLs so the same build works under the GitHub Pages
  // project path (/taiwan-power-dashboard/) and at a custom-domain root.
  base: './',
  plugins: [react(), tailwindcss(), powerApiPlugin(), preloadSnapshot()],
  server: {
    host: '127.0.0.1',
    port: 4173,
    fs: {
      // Only the app and its shared data modules are reachable in dev.
      allow: ['src', 'js', 'index.html', 'node_modules'],
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', 'server/**', 'scripts/**', 'tests/**', 'data/**']
    }
  },
  preview: {
    host: '127.0.0.1',
    port: 4173
  },
  build: {
    outDir: 'build/web',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200
  }
});

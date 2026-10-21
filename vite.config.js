import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { powerApiPlugin } from './server/power-api.js';

export default defineConfig({
  // Relative asset URLs so the same build works under the GitHub Pages
  // project path (/taiwan-power-dashboard/) and at a custom-domain root.
  base: './',
  plugins: [react(), tailwindcss(), powerApiPlugin()],
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

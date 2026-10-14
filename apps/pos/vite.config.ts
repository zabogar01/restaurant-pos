import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The server serves this package's dist/ at /pos/ (apps/server/src/http/bundles.ts).
export default defineConfig({
  plugins: [react()],
  base: '/pos/',
  // No asset is ever inlined as a data: URI; the server's policy has no data: source.
  build: { assetsInlineLimit: 0 },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});

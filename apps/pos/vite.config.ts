import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The server serves this package's dist/ at /pos/ (apps/server/src/http/bundles.ts).
//
// `__FIXTURE_SESSION__` is true for `serve` (the dev server, and vitest, which loads
// this same config) and false for `build`. It is keyed on the command and nothing
// else: `import.meta.env.DEV` follows NODE_ENV, so `NODE_ENV=development vite build`
// would leave it true in a bundle the server then serves (B-24, ARCH-014 question 3).
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: '/pos/',
  define: { __FIXTURE_SESSION__: JSON.stringify(command === 'serve') },
  // No asset is ever inlined as a data: URI; the server's policy has no data: source.
  build: { assetsInlineLimit: 0 },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
}));

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The server serves this package's dist/ at /back-office/ (apps/server/src/http/bundles.ts).
//
// `__FIXTURE_SESSION__` is true for `serve` (the dev server) and false for `build`.
// It is keyed on the command and nothing else: `import.meta.env.DEV` follows
// NODE_ENV, so `NODE_ENV=development vite build` would leave it true in a bundle the
// server then serves (B-24, ARCH-014 question 3). Vitest does not load this file, so
// under test the constant is undefined and means fixture mode (see session/source.ts).
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: '/back-office/',
  define: { __FIXTURE_SESSION__: JSON.stringify(command === 'serve') },
  // No asset is ever inlined as a data: URI; the server's policy has no data: source.
  build: { assetsInlineLimit: 0 },
  // Fixture work only, on its own port and with no proxy (ARCH-010, ARCH-014 question 3).
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
}));

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The plan's Task 11 builds into ../server/public/pos so the server can serve
// the bundle. The server side of that is paused, and this task does not touch
// apps/server, so the build stays in this package's own dist/ until it resumes.
export default defineConfig({
  plugins: [react()],
  base: '/pos/',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});

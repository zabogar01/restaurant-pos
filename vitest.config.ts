import { configDefaults, defineConfig } from 'vitest/config';
import { serverTestEnv } from './apps/server/test/support/env.js';

// Two projects. The server's tests share one PostgreSQL database, so its files
// run one at a time, after a global setup that serialises whole runs and
// provisions the test database. Everything else runs exactly as it did before
// there was a config file: default include, default parallelism.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'server',
          include: ['apps/server/test/**/*.test.ts'],
          fileParallelism: false,
          globalSetup: ['apps/server/test/support/global-setup.ts'],
          env: serverTestEnv(),
        },
      },
      {
        test: {
          name: 'client',
          exclude: [...configDefaults.exclude, 'apps/server/**'],
        },
      },
    ],
  },
});

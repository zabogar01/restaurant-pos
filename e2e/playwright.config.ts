import { defineConfig } from '@playwright/test';
import { E2E_ORIGIN, applyE2eEnv } from './support/env.js';

// The runner and every worker see the same environment, and none of it names
// the development database.
applyE2eEnv();

export default defineConfig({
  testDir: 'tests',
  globalSetup: './support/global-setup.ts',
  // One server, one database.
  workers: 1,
  fullyParallel: false,
  // A flaky test here is a finding, not noise.
  retries: 0,
  // Nothing Playwright writes may hold what a test typed (B-12): a PIN's digits
  // are the names of the buttons clicked, a password is the text of a fill.
  reporter: 'list',
  outputDir: 'test-results',
  use: {
    baseURL: E2E_ORIGIN,
    // The owner's own condition: the kit installs no trust, so the owner clicks
    // through the warning once per profile. The certificate itself is proved
    // by the server's own tests.
    ignoreHTTPSErrors: true,
    bypassCSP: false,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});

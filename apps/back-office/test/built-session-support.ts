import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FIXTURE_SESSION_MARKER } from '../src/session/fixtureSession.js';

// ARCH-014 question 3, mechanism 1: the fixture session is chosen by a constant
// from the Vite command, so it is absent from a build whatever NODE_ENV says. The
// two test files built-session.test.ts and built-session-development.test.ts each
// build the real config once, in a child process, into a temporary directory, and
// read the output; a `dist/` someone left behind is never read, and a failed build
// fails the test. They are two files because the built bundle is run in the test's
// own jsdom, and two bundles must not share one.
const backOffice = resolve(import.meta.dirname, '..');
const vite = resolve(import.meta.dirname, '../../../node_modules/vite/bin/vite.js');

// The fixture manager's name and username are fixture data from the Frost shell.
const FIXTURE_ONLY = ['M. Iqbal', 'm.iqbal', 'fixture-manager', FIXTURE_SESSION_MARKER];

export function builtSessionTests(nodeEnv: 'production' | 'development') {
  let out = '';
  const scripts = () =>
    readdirSync(join(out, 'assets')).filter((f) => f.endsWith('.js')).map((f) => join(out, 'assets', f));

  beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), `office-built-session-${nodeEnv}-`));
    // The child gets NODE_ENV from here, not from vitest's own.
    execFileSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir'], {
      cwd: backOffice,
      env: { ...process.env, NODE_ENV: nodeEnv },
      stdio: 'pipe',
    });
  }, 180_000);

  afterAll(() => {
    if (out) rmSync(out, { recursive: true, force: true });
  });

  describe(`the built back-office bundle, NODE_ENV=${nodeEnv}`, () => {
    it('17. holds none of the fixture session or the fixture manager', () => {
      expect(scripts().length).toBeGreaterThan(0);
      for (const file of scripts()) {
        const code = readFileSync(file, 'utf8');
        for (const needle of FIXTURE_ONLY) expect(code.includes(needle), `${needle} in ${file}`).toBe(false);
      }
    });

    it('17. every asset the page names is under /back-office/assets/, and none is a data: URI', () => {
      const html = readFileSync(join(out, 'index.html'), 'utf8');
      const urls = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]!);
      expect(urls.length).toBeGreaterThanOrEqual(2);
      for (const url of urls) expect(url.startsWith('/back-office/assets/'), url).toBe(true);
      expect(html).not.toContain('data:');
      const css = readdirSync(join(out, 'assets'))
        .filter((f) => f.endsWith('.css'))
        .map((f) => readFileSync(join(out, 'assets', f), 'utf8'))
        .join('');
      expect(css).not.toContain('data:');
      expect(html).toContain('<title>Back office</title>');
    });

    it('starts at the real session: one me read, BO-01, and no fixture manager', async () => {
      const code = readFileSync(scripts()[0]!, 'utf8');
      document.body.innerHTML = '<div id="root"></div>';
      window.history.replaceState(null, '', '/back-office/');
      const answer = { status: 401, text: async () => JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }) };
      const stub = vi.fn(async () => answer);
      Object.defineProperty(window, 'fetch', { value: stub, configurable: true });
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;

      // The entry chunk is a self-contained module with no imports of its own.
      (0, eval)(code);
      await vi.waitFor(() => expect(document.getElementById('root')!.getAttribute('data-session')).toBe('signed-out'));

      expect(document.querySelector('h1')!.textContent).toBe('Back office');
      expect(document.querySelector('.botop')).toBeNull();
      expect(stub).toHaveBeenCalledTimes(1);
      expect((stub.mock.calls[0] as unknown as [string])[0]).toBe('/api/back-office/auth/me');
    });
  });
}

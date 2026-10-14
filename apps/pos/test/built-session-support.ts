import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FIXTURE_SESSION_MARKER } from '../src/session/fixtureSession.js';

// ARCH-014 question 3, mechanism 1: the fixture session is chosen by a constant
// from the Vite command, so it is absent from a build whatever NODE_ENV says. The
// two test files built-session.test.ts and built-session-development.test.ts each
// build the real config once, in a child process, and read the output. They are
// two files because the built bundle is run in the test's own jsdom, and two
// bundles must not share one.
const pos = resolve(import.meta.dirname, '..');
const vite = resolve(import.meta.dirname, '../../../node_modules/vite/bin/vite.js');

const FIXTURE_ONLY = ['Ana R. · Cashier', 'Sign-in locked for 4 min 12 s', 'LOGIN cooldown', FIXTURE_SESSION_MARKER];

export function builtSessionTests(nodeEnv: 'production' | 'development') {
  let out = '';
  const scripts = () =>
    readdirSync(join(out, 'assets')).filter((f) => f.endsWith('.js')).map((f) => join(out, 'assets', f));

  beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), `pos-built-session-${nodeEnv}-`));
    // The child gets NODE_ENV from here, not from vitest's own.
    execFileSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir'], {
      cwd: pos,
      env: { ...process.env, NODE_ENV: nodeEnv },
      stdio: 'pipe',
    });
  }, 180_000);

  afterAll(() => {
    if (out) rmSync(out, { recursive: true, force: true });
  });

  describe(`the built POS bundle, NODE_ENV=${nodeEnv}`, () => {
    it('27. holds none of the fixture session, the fixture cashier or POS-01’s fixture pictures', () => {
      expect(scripts().length).toBeGreaterThan(0);
      for (const file of scripts()) {
        const code = readFileSync(file, 'utf8');
        for (const needle of FIXTURE_ONLY) expect(code.includes(needle), `${needle} in ${file}`).toBe(false);
      }
    });

    it('27. ?state=throttled on the built lock screen draws no notice', async () => {
      const code = readFileSync(scripts()[0]!, 'utf8');
      document.body.innerHTML = '<div id="root"></div>';
      window.history.replaceState(null, '', '/pos/?state=throttled');
      const answer = { status: 401, text: async () => JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }) };
      const stub = vi.fn(async () => answer);
      Object.defineProperty(window, 'fetch', { value: stub, configurable: true });
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;

      // The entry chunk is a self-contained module with no imports of its own.
      (0, eval)(code);
      await vi.waitFor(() => expect(document.querySelector('[data-lock-state]')).not.toBeNull());

      expect(document.querySelector('[data-lock-state]')!.getAttribute('data-lock-state')).toBe('resting');
      expect(document.querySelector('.notice')).toBeNull();
      expect(document.getElementById('root')!.getAttribute('data-session')).toBe('signed-out');
      expect(stub).toHaveBeenCalledTimes(1);
    });
  });
}

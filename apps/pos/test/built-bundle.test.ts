import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The server's content-security policy (apps/server/src/http/bundles.ts) has no
// unsafe-inline, no nonce and no data: source. This builds the real POS config
// into a temporary directory, in a child process so vitest's NODE_ENV does not
// leak into it, and reads the output. It never reads a dist/ someone left behind
// and it fails, never skips, when the build fails.
const pos = fileURLToPath(new URL('..', import.meta.url));
const vite = fileURLToPath(new URL('../../../node_modules/vite/bin/vite.js', import.meta.url));

let out: string;
let html: string;
let files: string[];

beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), 'pos-built-bundle-'));
  const { NODE_ENV: _dropped, ...env } = process.env;
  execFileSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir'], {
    cwd: pos,
    env: { ...env, NODE_ENV: 'production' },
    stdio: 'pipe',
  });
  html = readFileSync(join(out, 'index.html'), 'utf8');
  files = readdirSync(out, { recursive: true, encoding: 'utf8' })
    .filter((f) => !f.includes('\0'))
    .map((f) => join(out, f));
}, 180_000);

afterAll(() => {
  rmSync(out, { recursive: true, force: true });
});

describe('the built POS bundle', () => {
  it('18. index.html has no inline script, no inline style and no event-handler attribute', () => {
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, attributes, body] of scripts) {
      expect(attributes).toMatch(/\ssrc="/);
      expect(body!.trim()).toBe('');
    }
    expect(html).not.toMatch(/<style\b/i);
    expect(html).not.toMatch(/\sstyle\s*=/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  it('18. every src and href begins /pos/assets/', () => {
    const urls = [...html.matchAll(/\b(?:src|href)="([^"]*)"/gi)].map((m) => m[1]!);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url.startsWith('/pos/assets/'), url).toBe(true);
  });

  it('18. no emitted file contains a data: URI', () => {
    const emitted = files.filter((f) => /\.(html|js|css|svg|json|webmanifest)$/.test(f));
    expect(emitted.length).toBeGreaterThan(1);
    const hits = emitted.filter((f) => /data:[a-z]+\/[a-z0-9.+-]+[;,]/i.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});

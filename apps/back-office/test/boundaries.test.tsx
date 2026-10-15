// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTES } from '@pos/api-client';
import { ROUTE_TABLE } from '@pos/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OfficeApi } from '../src/session/api.js';
import { officeApi } from '../src/session/api.js';
import {
  ACTIVITY, HEALTH, LOGIN, LOGOUT, ME, VIEW,
  button, field, makeHarness, mount, noContent, ok, press, type,
} from './session-harness.js';
import { act } from 'react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const here = dirname(fileURLToPath(import.meta.url));
const apps = resolve(here, '../..');
const backOffice = resolve(apps, 'back-office');
const pos = resolve(apps, 'pos');

const walk = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.(tsx?|css|html|json)$/.test(f) && !f.split('/').some((p) => ['node_modules', 'dist'].includes(p)))
    .map((f) => join(dir, f));

const specifiers = (text: string): string[] =>
  [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|@import\s+url\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]!);

/** Every import specifier in `dir` that reaches `other` by name or by resolved path. */
function reaches(dir: string, other: string, names: RegExp): string[] {
  const hits: string[] = [];
  for (const file of walk(dir).filter((f) => /\.tsx?$/.test(f))) {
    for (const spec of specifiers(readFileSync(file, 'utf8'))) {
      const resolved = spec.startsWith('.') ? resolve(dirname(file), spec) : spec;
      if (names.test(spec) || (spec.startsWith('.') && relative(other, resolved).split('/')[0] !== '..')) {
        hits.push(`${relative(dir, file)}: ${spec}`);
      }
    }
  }
  return hits;
}

describe('case 16. NFR-5: two independently bootstrapped clients', () => {
  it('no file under apps/back-office imports from apps/pos', () => {
    expect(reaches(backOffice, pos, /apps\/pos|@pos\/pos-client/)).toEqual([]);
  });

  it('no file under apps/pos imports from apps/back-office', () => {
    expect(reaches(pos, backOffice, /apps\/back-office|@pos\/back-office-client/)).toEqual([]);
  });

  it('the scan finds the imports it is looking for (a self-test of the helper)', () => {
    // Built with the quote as a value, so that this file holds no import specifier of its own.
    const q = "'";
    const sample = `import x from ${q}../../pos/src/PinPad.js${q}; export * from ${q}@pos/pos-client${q};`;
    expect(specifiers(sample)).toEqual(['../../pos/src/PinPad.js', '@pos/pos-client']);
    expect(walk(backOffice).length).toBeGreaterThan(10);
  });
});

describe('case 14. no request goes to a path under /api/pos', () => {
  it('the API module has exactly the back-office routes and health, and every one is in the table', () => {
    const wanted = ROUTE_TABLE.map((r) => r.path as string)
      .filter((p) => p === '/api/health' || p.startsWith('/api/back-office/'))
      .sort();
    const api = officeApi({} as never);
    expect(Object.keys(api).sort()).toEqual(wanted);
    expect(wanted).toContain(ROUTES.backOfficeReauthenticate.path);
  });

  it('the type has no way to name a POS route', () => {
    const api = {} as OfficeApi;
    // @ts-expect-error: FR-A2c, the back office's API type has no entry for a POS route.
    void api['/api/pos/auth/me'];
    // @ts-expect-error: not the POS login either.
    void api['/api/pos/auth/login'];
    expect(true).toBe(true);
  });

  it('the source never names a POS path or a POS route', () => {
    const offenders = walk(resolve(backOffice, 'src'))
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => /\/api\/pos|posLogin|posMe|posActivity|posRelease/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  describe('over a whole session', () => {
    let h: ReturnType<typeof makeHarness>;
    let view: ReturnType<typeof mount> | undefined;
    beforeEach(() => {
      h = makeHarness();
    });
    afterEach(() => {
      view?.unmount();
      view = undefined;
    });

    it('sign-in, me, activity and logout touch only /api/back-office and /api/health, relative and with no query', async () => {
      h.reply(HEALTH, ok({ status: 'ok' }));
      h.reply(ME, { status: 401, body: { error: { code: 'UNAUTHENTICATED' } } });
      h.reply(LOGIN, ok(VIEW));
      h.reply(ACTIVITY, noContent);
      h.reply(LOGOUT, { status: 500, body: { error: { code: 'INTERNAL' } } });
      view = mount(h.store);
      await h.settle();
      type(field(view.host, 'Username'), 'm.iqbal');
      type(field(view.host, 'Password'), 'pw');
      act(() => button(view!.host, 'Sign in').click());
      await h.settle();
      press();
      await h.settle();
      act(() => button(view!.host, 'Log out').click());
      await h.settle();

      expect(h.calls.length).toBeGreaterThan(4);
      for (const call of h.calls) {
        expect(call.url).toMatch(/^\/api\/(health$|back-office\/auth\/[a-z]+$)/);
        expect(call.url).not.toContain('?');
      }
    });
  });
});

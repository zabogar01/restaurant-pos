// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfficeApp } from '../src/OfficeApp.js';
import { Screens } from '../src/Screens.js';
import { createFixtureSession } from '../src/session/fixtureSession.js';
import { SessionProvider } from '../src/session/useSession.js';
import { button, field, makeHarness, type } from './session-harness.js';
import { named, tap } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// AC 2 and AC 12: a screen reaches the configuration routes and no others, and in fixture
// mode BO-05 draws its failed-to-load state and sends nothing.

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AC 2. a screen cannot name an /auth/ route through config', () => {
  const { store } = makeHarness();

  it('the type has the configuration routes only', () => {
    // @ts-expect-error: sign-in is not a configuration route.
    void store.config['/api/back-office/auth/login'];
    // @ts-expect-error: nor is the activity route, which only the input listener sends.
    void store.config['/api/back-office/auth/activity'];
    // @ts-expect-error: nor logout.
    void store.config['/api/back-office/auth/logout'];
    // @ts-expect-error: nor re-authentication.
    void store.config['/api/back-office/auth/reauthenticate'];
    // @ts-expect-error: nor the session read.
    void store.config['/api/back-office/auth/me'];
    // @ts-expect-error: nor health.
    void store.config['/api/health'];
    expect(true).toBe(true);
  });

  it('holds the five table routes, the two settings routes, the five tender-methods routes and the eleven catalog routes at run time, and nothing under /auth/', () => {
    expect(Object.keys(store.config).sort()).toEqual([
      '/api/back-office/config/catalog',
      '/api/back-office/config/catalog/categories/archive',
      '/api/back-office/config/catalog/categories/create',
      '/api/back-office/config/catalog/categories/reorder',
      '/api/back-office/config/catalog/categories/restore',
      '/api/back-office/config/catalog/categories/update',
      '/api/back-office/config/catalog/items/archive',
      '/api/back-office/config/catalog/items/create',
      '/api/back-office/config/catalog/items/reorder',
      '/api/back-office/config/catalog/items/restore',
      '/api/back-office/config/catalog/items/update',
      '/api/back-office/config/settings',
      '/api/back-office/config/settings/save',
      '/api/back-office/config/tables',
      '/api/back-office/config/tables/create',
      '/api/back-office/config/tables/deactivate',
      '/api/back-office/config/tables/reactivate',
      '/api/back-office/config/tables/update',
      '/api/back-office/config/tender-methods',
      '/api/back-office/config/tender-methods/create',
      '/api/back-office/config/tender-methods/deactivate',
      '/api/back-office/config/tender-methods/reactivate',
      '/api/back-office/config/tender-methods/update',
    ]);
  });

  it('the tender-methods routes are typed on the configuration surface', () => {
    void store.config['/api/back-office/config/tender-methods'];
    void store.config['/api/back-office/config/tender-methods/create'];
    void store.config['/api/back-office/config/tender-methods/update'];
    void store.config['/api/back-office/config/tender-methods/deactivate'];
    void store.config['/api/back-office/config/tender-methods/reactivate'];
    // @ts-expect-error: a route that does not exist is not on the surface.
    void store.config['/api/back-office/config/tender-methods/delete'];
    expect(true).toBe(true);
  });

  it('the catalog routes are typed on the configuration surface', () => {
    void store.config['/api/back-office/config/catalog'];
    void store.config['/api/back-office/config/catalog/categories/create'];
    void store.config['/api/back-office/config/catalog/categories/update'];
    void store.config['/api/back-office/config/catalog/categories/reorder'];
    void store.config['/api/back-office/config/catalog/categories/archive'];
    void store.config['/api/back-office/config/catalog/categories/restore'];
    void store.config['/api/back-office/config/catalog/items/create'];
    void store.config['/api/back-office/config/catalog/items/update'];
    void store.config['/api/back-office/config/catalog/items/reorder'];
    void store.config['/api/back-office/config/catalog/items/archive'];
    void store.config['/api/back-office/config/catalog/items/restore'];
    // @ts-expect-error: a route that does not exist is not on the surface.
    void store.config['/api/back-office/config/catalog/items/delete'];
    expect(true).toBe(true);
  });

  it('no module outside session/ names a session route or the API module', () => {
    const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
    const offenders = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((f) => /\.tsx?$/.test(f) && !f.startsWith('session'))
      .filter((f) => /\/api\/back-office\/auth|\/api\/health|officeApi|createApiClient/.test(readFileSync(join(src, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('AC 12. fixture mode', () => {
  it('shows the rail and BO-05’s failed-to-load state, and makes no request', async () => {
    const stub = vi.fn();
    Object.defineProperty(window, 'fetch', { value: stub, configurable: true });
    window.history.pushState(null, '', '/back-office/tables');
    const host = document.createElement('div');
    host.id = 'root';
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <SessionProvider store={createFixtureSession()}>
          <OfficeApp>
            <Screens />
          </OfficeApp>
        </SessionProvider>
      )
    );
    type(field(host, 'Username'), 'anyone');
    type(field(host, 'Password'), 'anything');
    act(() => button(host, 'Sign in').click());
    await act(async () => {});

    expect(host.getAttribute('data-session')).toBe('signed-in');
    expect(named(host.querySelector<HTMLElement>('.bonav')!, 'Tables')).toBeTruthy();
    expect(host.querySelector('h1')!.textContent).toBe('Tables');
    expect(host.querySelector('[role="alert"]')!.textContent).toBe(
      'Tables could not be loadedTry again to read the table list.Try again'
    );
    // Try again asks the fixture again, and the fixture says unavailable again.
    tap(named(host, 'Try again'));
    await act(async () => {});
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(stub).not.toHaveBeenCalled();
    act(() => root.unmount());
    host.remove();
  });
});

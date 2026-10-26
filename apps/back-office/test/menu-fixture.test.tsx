// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfficeApp } from '../src/OfficeApp.js';
import { Screens } from '../src/Screens.js';
import { createFixtureSession } from '../src/session/fixtureSession.js';
import { SessionProvider } from '../src/session/useSession.js';
import { button, field, type } from './session-harness.js';
import { named, tap } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// PHASE1-S4c1 ruling 16, criterion 15: in fixture mode every catalog path answers `unavailable`
// and sends nothing, so BO-03 draws its designed read failure. There is no fixture menu to
// seed: an in-memory fake of the catalog would reimplement the version rule and the unique
// names in a second place (consult C2 section 7).

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fixture mode, BO-03', () => {
  it('shows the rail and BO-03’s failed-to-load state, with no count and both reorders off, and makes no request', async () => {
    const stub = vi.fn();
    Object.defineProperty(window, 'fetch', { value: stub, configurable: true });
    window.history.pushState(null, '', '/back-office/menu');
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
    expect(host.querySelector('.bonav')!.textContent).toBe('ConfigurationMenuTablesSettings');
    expect(host.querySelector('h1')!.textContent).toBe('Menu');
    expect(host.querySelector('[role="alert"]')!.textContent).toBe('Menu could not be loadedTry again to read the menu.Try again');
    expect(host.querySelector('#menu-count')).toBeNull();
    expect(named(host, 'Reorder categories').getAttribute('aria-disabled')).toBe('true');
    // Try again asks the fixture again, and the fixture says unavailable again.
    tap(named(host, 'Try again'));
    await act(async () => {});
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(stub).not.toHaveBeenCalled();
    act(() => root.unmount());
    host.remove();
  });
});

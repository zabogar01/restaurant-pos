// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfficeApp } from '../src/OfficeApp.js';
import { Screens } from '../src/Screens.js';
import { createFixtureSession } from '../src/session/fixtureSession.js';
import { SessionProvider } from '../src/session/useSession.js';
import { installDialogShim } from './dialog-shim.js';
import { button, field, text, type } from './session-harness.js';
import { named, tap } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// PHASE1-S6b criterion 15. In fixture mode the five preset routes answer `unavailable` and send
// nothing, so BO-07 draws its read failure. There is no fixture preset list: an in-memory fake of
// the unique-name rule would reimplement it in a second place (consult C2 section 7). The marker
// of the fixture module is absent from the built bundle (built-session.test.ts).

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AC 15. fixture mode serves BO-07 with its read failure', () => {
  it('draws “Discount presets could not be loaded”, withholds the facts and the list, and makes no request', async () => {
    installDialogShim();
    const stub = vi.fn();
    Object.defineProperty(window, 'fetch', { value: stub, configurable: true });
    window.history.pushState(null, '', '/back-office/presets');
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

    expect(host.querySelector('h1')!.textContent).toBe('Discount presets');
    expect(text(host.querySelector('#read-state [role="alert"]'))).toBe(
      'Discount presets could not be loadedTry again to read the discount presets.Try again'
    );
    expect(host.querySelector('#presets-list')).toBeNull();
    expect(host.querySelector('#list-facts')).toBeNull();
    expect(named(host, 'New preset').getAttribute('aria-disabled')).toBe('true');

    // Try again asks the fixture again, and the fixture says unavailable again.
    tap(named(host, 'Try again'));
    await act(async () => {});
    expect(host.querySelector('#read-state [role="alert"]')).not.toBeNull();
    expect(stub).not.toHaveBeenCalled();
    act(() => root.unmount());
    host.remove();
  });
});

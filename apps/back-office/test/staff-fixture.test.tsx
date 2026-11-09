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

// PHASE1-S8c1 criterion 3. In fixture mode the nine users routes answer `unavailable` and send
// nothing, so BO-06 draws its read failure. There is no fixture staff list: an in-memory fake of
// the unique-PIN and unique-username rules would reimplement them in a second place (consult C2
// section 7).

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fixture mode serves BO-06 with its read failure', () => {
  it('draws “Staff could not be loaded”, withholds the counts and the list, and makes no request', async () => {
    installDialogShim();
    const stub = vi.fn();
    Object.defineProperty(window, 'fetch', { value: stub, configurable: true });
    window.history.pushState(null, '', '/back-office/staff');
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

    expect(host.querySelector('h1')!.textContent).toBe('Staff');
    expect(text(host.querySelector('#read-state [role="alert"]'))).toBe(
      'Staff could not be loadedTry again to read the staff list.Try again'
    );
    expect(host.querySelector('#staff-list')).toBeNull();
    expect(host.querySelector('#list-facts')).toBeNull();
    expect(named(host, 'Add person').getAttribute('aria-disabled')).toBe('true');

    // Try again asks the fixture again, and the fixture says unavailable again.
    tap(named(host, 'Try again'));
    await act(async () => {});
    expect(host.querySelector('#read-state [role="alert"]')).not.toBeNull();
    expect(stub).not.toHaveBeenCalled();
    act(() => root.unmount());
    host.remove();
  });
});

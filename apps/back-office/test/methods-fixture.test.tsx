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

// PHASE1-S3b criterion 10. In fixture mode the five tender-methods routes answer `unavailable`
// and send nothing, so BO-08 draws the fixture settings with the methods read failure beneath
// them. There is no fixture method list: an in-memory fake of the unique-name rule would
// reimplement it in a second place (consult C2 section 7).

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AC 10. fixture mode serves BO-08 with the methods read failure', () => {
  it('draws the settings read view, then “Payment methods could not be loaded”, and makes no request', async () => {
    installDialogShim();
    const stub = vi.fn();
    Object.defineProperty(window, 'fetch', { value: stub, configurable: true });
    window.history.pushState(null, '', '/back-office/settings');
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

    expect(host.querySelector('#version-facts')!.textContent).toMatch(/^Version 4 /);
    expect(text(host.querySelector('#methods-read [role="alert"]'))).toBe(
      'Payment methods could not be loadedTry again to read the payment methods.Try again'
    );
    expect(host.querySelector('#methods-list')).toBeNull();
    expect(host.querySelector('#method-count')).toBeNull();
    expect(named(host, 'New payment method').getAttribute('aria-disabled')).toBe('true');

    // Try again asks the fixture again, and the fixture says unavailable again.
    tap(named(host.querySelector<HTMLElement>('#methods-part')!, 'Try again'));
    await act(async () => {});
    expect(host.querySelector('#methods-read [role="alert"]')).not.toBeNull();
    expect(stub).not.toHaveBeenCalled();
    act(() => root.unmount());
    host.remove();
  });
});

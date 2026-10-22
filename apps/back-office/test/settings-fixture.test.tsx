// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfficeApp } from '../src/OfficeApp.js';
import { Screens } from '../src/Screens.js';
import { createFixtureSession } from '../src/session/fixtureSession.js';
import { SessionProvider } from '../src/session/useSession.js';
import { installDialogShim } from './dialog-shim.js';
import { button, field, type } from './session-harness.js';
import { box } from './settings-support.js';
import { named, tap } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// AC 12. In fixture mode the settings screen reads one fixture version, so the dev server
// draws BO-08, and nothing is sent: the fixture session never touches the network. A save
// answers `unavailable` like the table commands, which the screen draws as an unknown outcome.

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AC 12. fixture mode serves BO-08', () => {
  it('draws the read view from the fixture version, and a save sends nothing', async () => {
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

    expect(host.querySelector('h1')!.textContent).toBe('Settings');
    expect(host.querySelector('#version-facts')!.textContent).toMatch(/^Version 4 · In force since \d{1,2} \w{3} 2026, \d\d:\d\d · Saved by M\. Iqbal$/);
    expect(host.querySelector('#settings-view')!.textContent).toContain('Warung Sederhana');

    tap(named(host, 'Change phone'));
    tap(named(host, 'Save'));
    await act(async () => {});
    expect(host.querySelector('#settings-notice strong')!.textContent).toBe('Outcome not confirmed');
    expect(box(host, 'Phone').value).toBe('021 555 0134');
    expect(stub).not.toHaveBeenCalled();
    act(() => root.unmount());
    host.remove();
  });
});

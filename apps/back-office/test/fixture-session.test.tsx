// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfficeApp } from '../src/OfficeApp.js';
import { createFixtureSession } from '../src/session/fixtureSession.js';
import { createSessionStore } from '../src/session/source.js';
import { SessionProvider } from '../src/session/useSession.js';
import { button, field, type } from './session-harness.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Question 3, mechanism 2: the fixture session never reaches the network. Vitest
// does not load the app's Vite config, so under test the switch means fixture mode.

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fixture mode', () => {
  it('the switch gives the fixture session under test', () => {
    expect(createSessionStore().kind).toBe('fixture');
  });

  it('a sign-in and a logout make zero fetch calls and start at BO-01', async () => {
    const stub = vi.fn();
    Object.defineProperty(window, 'fetch', { value: stub, configurable: true });
    const host = document.createElement('div');
    host.id = 'root';
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <SessionProvider store={createFixtureSession()}>
          <OfficeApp />
        </SessionProvider>
      )
    );
    expect(host.getAttribute('data-session')).toBe('signed-out');
    expect(host.querySelector('.botop')).toBeNull();

    type(field(host, 'Username'), 'anyone');
    type(field(host, 'Password'), 'anything');
    act(() => button(host, 'Sign in').click());
    expect(host.getAttribute('data-session')).toBe('signed-in');
    expect(host.querySelector('.office-actor')!.textContent).toBe('M. Iqbal');

    act(() => button(host, 'Log out').click());
    expect(host.getAttribute('data-session')).toBe('signed-out');
    expect(stub).not.toHaveBeenCalled();
    act(() => root.unmount());
    host.remove();
  });

  it('the fixture module does not import the request module', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const text = readFileSync(resolve(import.meta.dirname, '../src/session/fixtureSession.ts'), 'utf8');
    expect(text).not.toMatch(/api-client|api\.js|realSession/);
  });
});

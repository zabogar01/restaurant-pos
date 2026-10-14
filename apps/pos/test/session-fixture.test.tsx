// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFixtureSession } from '../src/session/fixtureSession.js';
import { key, lockState, mount, typeDigits } from './session-harness.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let view: ReturnType<typeof mount> | undefined;
afterEach(() => {
  view?.unmount();
  view = undefined;
  vi.unstubAllGlobals();
});

describe('25. fixture mode makes no request', () => {
  it('a sign-in, a touch and a Release make zero fetch calls, and the fixture cashier is drawn', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    Object.defineProperty(window, 'fetch', { value: spy, configurable: true });
    const store = createFixtureSession();
    view = mount(store, '/pos/floor');
    const { host } = view;

    expect(host.querySelector('.floor-actor')!.textContent).toBe('Ana R. · Cashier90sRelease');
    act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));

    // The button itself, not the store: Release is drawn in the actor group.
    const release = [...host.querySelectorAll<HTMLButtonElement>('.floor-actor button')].find((b) => b.textContent === 'Release')!;
    act(() => release.click());
    expect(lockState(host)).toBe('resting');
    typeDigits(host, '123456');
    act(() => key(host, 'Continue').click());
    expect(host.querySelector('.floor-actor')!.textContent).toBe('Ana R. · Cashier90sRelease');
    act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));

    expect(spy).not.toHaveBeenCalled();
  });

  it('/pos/ still walks POS-01’s pictures, and ?state= picks one', () => {
    view = mount(createFixtureSession(), '/pos/?state=throttled');
    expect(view.host.textContent).toContain('Sign-in locked for 4 min 12 s');
    expect(window.location.pathname).toBe('/pos/');
  });
});

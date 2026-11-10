// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderScreen } from '../src/OrderPanel.js';
import { createFixtureSession } from '../src/session/fixtureSession.js';
import { createRoot, type Root } from 'react-dom/client';
import { RELEASE, VIEW, ME, HEALTH, key, lockState, makeHarness, mount, noContent, ok, refusal, typeDigits } from './session-harness.js';
import { SessionProvider } from '../src/session/useSession.js';

// PHASE1-S9: POS-03, routed, draws the actor group and Release as the floor, POS-05 and POS-06 do.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dom = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
for (const name of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, name, { value: dom[name], configurable: true });
}

let view: ReturnType<typeof mount> | undefined;
afterEach(() => {
  view?.unmount();
  view = undefined;
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/pos/order');
});

const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
const press = (el: Element) => act(() => (el as HTMLElement).click());
const bar = (host: HTMLElement) => host.querySelector<HTMLElement>('.order-screen__bar')!;
const releaseButtons = (host: HTMLElement) => [...bar(host).querySelectorAll<HTMLButtonElement>('button')].filter((b) => text(b) === 'Release');
const tile = (host: HTMLElement, n: number) => host.querySelector<HTMLAnchorElement>(`[data-table="${n}"]`)!;
const lines = (host: HTMLElement) => [...host.querySelectorAll('.order-line')].map(text);

function signInFixture(host: HTMLElement) {
  typeDigits(host, '123456');
  act(() => key(host, 'Continue').click());
}

/** Floor → Table 1 → Settle → ← Order: a payment session is active and POS-03 is locked by it. */
async function payTable1AndReturn(host: HTMLElement) {
  press(tile(host, 1));
  press(host.querySelector('.order-actions [data-action="settle"]')!);
  const popped = new Promise<void>((done) => window.addEventListener('popstate', () => done(), { once: true }));
  press([...host.querySelectorAll('button')].find((b) => text(b) === '← Order')!);
  await act(async () => popped);
}

const GROUP = 'Ana R. · Cashier90sRelease';

describe('1. the group is drawn', () => {
  it.each([
    ['the default order', '/pos/order'],
    ['a quick sale', '/pos/order?state=quick-new'],
    ['a fixture-locked order', '/pos/order?state=lock-draft'],
  ])('%s: the bar holds the actor group and exactly one Release', (_name, url) => {
    view = mount(createFixtureSession(), url);
    const { host } = view;
    expect(text(bar(host).querySelector('.floor-actor')!)).toBe(GROUP);
    expect(releaseButtons(host)).toHaveLength(1);
    expect(bar(host).querySelectorAll('button')).toHaveLength(1);
  });

  it('an order locked by this tab’s payment session draws it too', async () => {
    view = mount(createFixtureSession(), '/pos/floor');
    const { host } = view;
    await payTable1AndReturn(host);
    expect(host.querySelector('.order-panel')!.getAttribute('data-lock')).toBe('draft');
    expect(text(bar(host).querySelector('.floor-actor')!)).toBe(GROUP);
    expect(releaseButtons(host)).toHaveLength(1);
  });
});

describe('2. Release goes to POS-01 whatever the answer', () => {
  let h: ReturnType<typeof makeHarness>;
  beforeEach(() => {
    h = makeHarness();
    h.reply(HEALTH, ok({ status: 'ok' }));
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it.each([
    ['204', noContent],
    ['500', refusal('INTERNAL', undefined, 500)],
    ['no answer', 'hang' as const],
  ])('sends one request and rests POS-01 at once, for %s', async (_name, reply) => {
    h.reply(ME, ok(VIEW));
    view = mount(h.store, '/pos/order');
    await h.settle();
    const { host } = view;
    expect(releaseButtons(host)).toHaveLength(1);
    h.reply(RELEASE, reply);
    press(releaseButtons(host)[0]!);
    expect(lockState(host)).toBe('resting'); // before the answer is awaited
    expect(host.querySelector('.order-screen__bar')).toBeNull(); // the button is gone: no second press
    await h.settle();
    expect(lockState(host)).toBe('resting');
    expect(h.count(RELEASE)).toBe(1);
    expect(window.location.pathname).toBe('/pos/order');
  });
});

describe('3. the order survives, as after the idle lock', () => {
  it('a pending line is there after Release and a sign-in, on the same URL', async () => {
    view = mount(createFixtureSession(), '/pos/floor');
    const { host } = view;
    press(tile(host, 2));
    press(host.querySelector('[data-item="burger"]')!);
    press([...host.querySelectorAll('button')].find((b) => b.textContent === 'Add to order')!);
    const before = lines(host);
    expect(before).toHaveLength(1);
    const url = `${window.location.pathname}${window.location.search}`;
    expect(url).toContain('/pos/order');
    press(releaseButtons(host)[0]!);
    expect(lockState(host)).toBe('resting');
    expect(`${window.location.pathname}${window.location.search}`).toBe(url);
    signInFixture(host);
    expect(`${window.location.pathname}${window.location.search}`).toBe(url);
    expect(lines(host)).toEqual(before);
  });

  it('a payment session survives it, and POS-01 shows the draft notice in between', async () => {
    view = mount(createFixtureSession(), '/pos/floor');
    const { host } = view;
    await payTable1AndReturn(host);
    const url = `${window.location.pathname}${window.location.search}`;
    const before = lines(host);
    expect(before.length).toBeGreaterThan(0);
    press(releaseButtons(host)[0]!);
    expect(lockState(host)).toBe('draft');
    expect(`${window.location.pathname}${window.location.search}`).toBe(url);
    signInFixture(host);
    expect(`${window.location.pathname}${window.location.search}`).toBe(url);
    expect(host.querySelector('.order-panel')!.getAttribute('data-lock')).toBe('draft');
    expect(lines(host)).toEqual(before);
  });
});

describe('4. inert under a sheet', () => {
  it.each([
    ['M-2 for an item', '/pos/order?state=sheet-item-burger'],
    ['the approval prompt', '/pos/order?state=approval'],
  ])('with %s open, Release is inside an inert region', (_name, url) => {
    view = mount(createFixtureSession(), url);
    const release = releaseButtons(view.host)[0]!;
    expect(release.closest('[inert]')).not.toBeNull();
  });

  it('with nothing open, Release is not inert', () => {
    view = mount(createFixtureSession(), '/pos/order');
    expect(releaseButtons(view.host)[0]!.closest('[inert]')).toBeNull();
  });
});

describe('5. the standalone bar is unchanged', () => {
  it('OrderScreen draws the bare aria-hidden bar: no actor text and no button, with the fixture cashier signed in', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root: Root = createRoot(host);
    act(() => root.render(<SessionProvider store={createFixtureSession()}><OrderScreen /></SessionProvider>));
    const standalone = host.querySelector('.order-screen__bar')!;
    expect(standalone.getAttribute('aria-hidden')).toBe('true');
    expect(text(standalone)).toBe('');
    expect(standalone.querySelectorAll('button')).toHaveLength(0);
    act(() => root.unmount());
    host.remove();
  });
});

describe('6. fixture mode makes no request', () => {
  it('a Release on POS-03 makes zero fetch calls', () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    Object.defineProperty(window, 'fetch', { value: spy, configurable: true });
    view = mount(createFixtureSession(), '/pos/order');
    press(releaseButtons(view.host)[0]!);
    expect(lockState(view.host)).toBe('resting');
    expect(spy).not.toHaveBeenCalled();
  });
});

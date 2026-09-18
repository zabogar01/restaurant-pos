// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.js';
import { LOCK_STATES } from '../src/fixtures.js';
import { OrderScreen } from '../src/OrderPanel.js';

// B-12: no PIN value in any log, error message, DOM attribute or stored value.
// The pad is driven the way a finger drives it — clicks on the rendered keys —
// and the evidence is read from the page, the console and storage. Both pads
// that exist, the lock screen's and the manager approval prompt's, are held to
// the same tests below.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Node 25 ships its own experimental `localStorage` global, which shadows
// jsdom's under vitest. Put jsdom's storage back so a write from the app would
// land somewhere this file can see it.
const dom = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
for (const name of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, name, { value: dom[name], configurable: true });
}

let host: HTMLDivElement;
let root: Root;

function render(state: (typeof LOCK_STATES)[number]['id'] = 'default') {
  act(() => root.render(<App state={state} />));
}

function key(label: string): HTMLButtonElement {
  const found = [...host.querySelectorAll<HTMLButtonElement>('button.key')].find(
    (b) => (b.getAttribute('aria-label') ?? b.textContent) === label
  );
  if (!found) throw new Error(`no key labelled ${label}`);
  return found;
}

function type(sequence: string) {
  for (const d of sequence) act(() => key(d).click());
}

function filledDots() {
  return host.querySelectorAll('.pin-dot--filled').length;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('PIN pad geometry', () => {
  it('lays out ten digits, delete and continue as a 3-column grid of twelve keys', () => {
    render();
    const keys = [...host.querySelectorAll('.keypad > button.key')];
    expect(keys.map((k) => k.getAttribute('aria-label') ?? k.textContent)).toEqual([
      '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Delete last digit', '0', 'Continue',
    ]);
  });
});

describe('entry display', () => {
  it('shows how many digits were entered, capped at six', () => {
    render();
    type('12');
    expect(filledDots()).toBe(2);
    type('34567');
    expect(filledDots()).toBe(6);
    act(() => key('Delete last digit').click());
    expect(filledDots()).toBe(5);
    act(() => key('Continue').click());
    expect(filledDots()).toBe(0);
  });

  it('withdraws the keypad while verifying', () => {
    render('loading');
    expect(host.querySelector('.keypad')).toBeNull();
  });

  it('keeps Continue inert during the LOGIN cooldown', () => {
    render('throttled');
    type('123');
    act(() => key('Continue').click());
    expect(key('Continue').getAttribute('aria-disabled')).toBe('true');
    expect(filledDots()).toBe(3);
  });
});

// B-12 is one test over both pads. The lock screen's pad (POS-01) and the
// manager approval prompt's (M-1) are the same component at two geometries, so
// each block below runs against each, mounted the way a cashier meets it.
type Pad = {
  name: string;
  mount: () => void;
  /** Where the page is after Continue: the lock screen stays, the approval prompt lands on the order. */
  afterSubmit: string;
};

let mounts = 0;
const PADS: ReadonlyArray<Pad> = [
  {
    name: 'the lock screen (POS-01)',
    mount: () => {
      window.history.replaceState(null, '', '/pos/');
      act(() => root.render(<App key={++mounts} state="incident" />));
    },
    afterSubmit: '/pos/',
  },
  {
    name: 'the manager approval prompt (M-1)',
    mount: () => {
      window.history.replaceState(null, '', '/pos/order?state=approval');
      act(() => root.render(<OrderScreen key={++mounts} view={{ state: 'approval' }} />));
    },
    afterSubmit: '/pos/order?state=default',
  },
];

describe('both pads are the one pad', () => {
  it('each mount finds exactly one keypad of twelve keys, in the same order', () => {
    const layouts = PADS.map((pad) => {
      pad.mount();
      expect(host.querySelectorAll('.keypad')).toHaveLength(1);
      return [...host.querySelectorAll('.keypad > button.key')].map((k) => k.getAttribute('aria-label') ?? k.textContent);
    });
    expect(layouts[0]).toHaveLength(12);
    expect(layouts[1]).toEqual(layouts[0]);
  });
});

describe.each(PADS)('B-12 on $name: the PIN never leaves the pad', ({ mount, afterSubmit }) => {
  it('renders byte-identical markup for different PINs of the same length', () => {
    mount();
    type('123456');
    const first = host.innerHTML;
    act(() => key('Continue').click());

    act(() => root.unmount());
    root = createRoot(host);
    mount();
    type('987650');
    expect(host.innerHTML).toBe(first);
  });

  it('renders byte-identical markup for different PINs at every partial length', () => {
    // Partially masked is still a leak: a last digit shown for a moment, a
    // length hint beyond the dots. Compared after each digit, not only at six.
    const snapshots = (pin: string) => {
      mount();
      const out = [...pin].map((d) => {
        act(() => key(d).click());
        return host.innerHTML;
      });
      act(() => root.unmount());
      root = createRoot(host);
      return out;
    };
    expect(snapshots('240613')).toEqual(snapshots('759382'));
  });

  it('puts no entered digit into any attribute or into the entry display', () => {
    mount();
    // Attributes that carry a numeral at rest: tabindex, SVG geometry, the count.
    const withDigits = () => attributeValues().filter((v) => /\d/.test(v));
    const atRest = withDigits();
    expect(atRest).toContain('aria-label=0 of 6 digits entered');
    type('480719');
    // After six digits the only one that changed is the count.
    expect(withDigits()).toEqual(
      atRest.map((v) => (v === 'aria-label=0 of 6 digits entered' ? 'aria-label=6 of 6 digits entered' : v))
    );
    expect(host.querySelector('.pin-dots')!.textContent).toBe('');
  });

  it('writes nothing to the console, storage, cookies or the title, and the URL carries no digit of it', () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug', 'trace'] as const).map((m) =>
      vi.spyOn(console, m)
    );
    mount();
    type('531264');
    act(() => key('Continue').click());
    if (host.querySelector('.keypad')) type('9');

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
    expect(window.location.pathname + window.location.search).toBe(afterSubmit);
    expect(window.location.hash).toBe('');
    expect(document.title).not.toMatch(/\d/);
  });
});

function attributeValues(): string[] {
  return [host, ...host.querySelectorAll('*')].flatMap((el) =>
    [...el.attributes].map((a) => `${a.name}=${a.value}`)
  );
}

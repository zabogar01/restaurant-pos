import type { ApiResult } from '@pos/api-client';
import type { PosMenuResponse } from '@pos/contracts';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createRealCatalog } from '../src/catalog/catalogStore.js';
import type { CatalogReads, CatalogStore } from '../src/catalog/types.js';
import { CatalogProvider } from '../src/catalog/useCatalog.js';
import { OrderScreen } from '../src/OrderPanel.js';
import type { OrderView } from '../src/orderFixtures.js';

// A served-mode harness (S7b1). The catalog store is the real one, handed a stub of its two read
// functions and a manual timer, and provided to the screen through `CatalogProvider`; the fixture
// session and the fixture `?state=` pictures stay what a test run makes them, so a test can also
// prove that `?state=` chooses nothing about a served menu. Nothing here touches the network.

export type Reply<T> = ApiResult<T> | 'hang' | { held: Promise<ApiResult<T>> };

export const FAILED = { kind: 'failed' } as const;
export const UNAVAILABLE = { kind: 'unavailable' } as const;
export const REFUSED = { kind: 'refused', body: { error: { code: 'FORBIDDEN' } } } as unknown as ApiResult<never>;

export type ServedItem = {
  id: string;
  category: string;
  name: string;
  price?: string;
  available?: boolean;
};

export function menuOf(
  version: number,
  categories: ReadonlyArray<{ id: string; name: string }>,
  items: ReadonlyArray<ServedItem>
): PosMenuResponse {
  return {
    version,
    categories: categories.map((c) => ({ categoryId: c.id, name: c.name })),
    items: items.map((i) => ({
      itemId: i.id,
      categoryId: i.category,
      name: i.name,
      basePrice: i.price ?? '45000',
      isAvailable: i.available ?? true,
      variants: [],
      modifiers: [],
    })),
    presets: [],
  };
}

export const ok = <T,>(value: T): ApiResult<T> => ({ kind: 'ok', value });

export const MEALS = [
  { id: 'meals', name: 'Meals' },
  { id: 'drinks', name: 'Drinks' },
];

export const NASI: ServedItem = { id: 'nasi', category: 'meals', name: 'Nasi Goreng', price: '45000' };
export const SATE: ServedItem = { id: 'sate', category: 'meals', name: 'Sate Ayam', price: '38000' };
export const TEA: ServedItem = { id: 'tea', category: 'drinks', name: 'Jasmine Tea', price: '18000' };

export function makeCatalogHarness(first: PosMenuResponse | null = menuOf(1, MEALS, [NASI, SATE, TEA])) {
  let now = 0;
  let visible = true;
  const timers = new Set<{ at: number; fire: () => void }>();
  const calls: string[] = [];
  // What each read answers next. A queue's last entry repeats; a `held` one waits for `deliver`.
  const queues: { revision: Array<Reply<{ version: number }>>; menu: Array<Reply<PosMenuResponse>> } = {
    revision: [ok({ version: first?.version ?? 0 })],
    menu: first ? [ok(first)] : [FAILED],
  };

  const answer = async <T,>(queue: Array<Reply<T>>): Promise<ApiResult<T>> => {
    const next = queue.length > 1 ? queue.shift()! : queue[0]!;
    if (next === 'hang') return new Promise(() => {});
    if ('held' in next) return next.held;
    return next;
  };

  const reads: CatalogReads = {
    revision: () => {
      calls.push('revision');
      return answer(queues.revision);
    },
    menu: () => {
      calls.push('menu');
      return answer(queues.menu);
    },
  };

  const store: CatalogStore = createRealCatalog(reads, {
    setTimer: (fire, ms) => {
      const entry = { at: now + ms, fire };
      timers.add(entry);
      return () => {
        timers.delete(entry);
      };
    },
    isVisible: () => visible,
  });

  /** Lets resolved promises settle, inside `act` so a mounted screen redraws. */
  const settle = async () => {
    for (let i = 0; i < 8; i += 1) await act(async () => {});
  };

  /** Moves the manual clock, firing each timer at its own moment. */
  async function advance(ms: number) {
    const target = now + ms;
    for (;;) {
      const due = [...timers].filter((e) => e.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      timers.delete(due);
      now = Math.max(now, due.at);
      await act(async () => due.fire());
      await settle();
    }
    now = target;
    await settle();
  }

  /** The next revision answers; the version it names is the poll's, not the menu's. */
  const revision = (...replies: Array<Reply<{ version: number }>>) => {
    queues.revision = replies;
  };
  const menu = (...replies: Array<Reply<PosMenuResponse>>) => {
    queues.menu = replies;
  };
  const hold = <T,>(): { held: Promise<ApiResult<T>>; deliver: (answer: ApiResult<T>) => void } => {
    let deliver!: (answer: ApiResult<T>) => void;
    const held = new Promise<ApiResult<T>>((resolve) => {
      deliver = resolve;
    });
    return { held, deliver };
  };
  const count = (read: 'revision' | 'menu') => calls.filter((c) => c === read).length;

  return {
    store,
    reads,
    calls,
    count,
    revision,
    menu,
    hold,
    settle,
    advance,
    timers: () => timers.size,
    setVisible(next: boolean) {
      visible = next;
    },
  };
}

export type CatalogHarness = ReturnType<typeof makeCatalogHarness>;

/** The order screen over a served catalog, started as POS signs in. */
export function mountServed(h: CatalogHarness, view: OrderView = { state: 'default' }, key = 0) {
  window.history.replaceState(null, '', `/pos/order?state=${view.state}`);
  const host = document.createElement('div');
  document.body.append(host);
  const root: Root = createRoot(host);
  const stop = h.store.start();
  act(() =>
    root.render(
      <CatalogProvider store={h.store}>
        <OrderScreen key={key} view={view} />
      </CatalogProvider>
    )
  );
  return {
    host,
    unmount() {
      stop();
      act(() => root.unmount());
      host.remove();
    },
  };
}

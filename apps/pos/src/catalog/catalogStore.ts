import type { PosMenuResponse } from '@pos/contracts';
import { decodeMoney, decodeRate } from '@pos/money';
import type { CatalogMenu, CatalogReads, CatalogSnapshot, CatalogStore } from './types.js';

// The served catalog (ARCH-021 consult C4 items 3 and 10). A store with no React,
// modelled on session/realSession.ts, with its timer injected. It sits above the
// routes and is handed exactly the two read functions, so it has no way to reach
// `activity` (FR-A2b): a poll is never a person's input and extends nothing.

type Deps = {
  /** Starts a timer and returns its canceller. Defaults to the platform's. */
  setTimer?: (fire: () => void, ms: number) => () => void;
  /** Whether the tab is visible. A hidden tab pauses the poll. Defaults to the document's. */
  isVisible?: () => boolean;
};

/** Two seconds after the previous cycle settled: the cycle, not an interval. */
export const POLL_MS = 2000;

const defaultSetTimer = (fire: () => void, ms: number): (() => void) => {
  const handle = setTimeout(fire, ms);
  return () => clearTimeout(handle);
};

const defaultIsVisible = (): boolean => document.visibilityState === 'visible';

/** Money and rates cross the wire as canonical strings and are decoded here, once (B-1). */
function toMenu(response: PosMenuResponse): CatalogMenu {
  return {
    version: response.version,
    categories: response.categories.map((c) => ({ id: c.categoryId, name: c.name })),
    items: response.items.map((i) => ({
      id: i.itemId,
      categoryId: i.categoryId,
      name: i.name,
      price: decodeMoney(i.basePrice),
      available: i.isAvailable,
      variants: i.variants.map((v) => ({ id: v.variantId, name: v.name, delta: decodeMoney(v.priceDelta) })),
      modifiers: i.modifiers.map((m) => ({ id: m.modifierId, name: m.name, delta: decodeMoney(m.priceDelta) })),
    })),
    presets: response.presets.map((p) => ({
      id: p.presetId,
      name: p.name,
      value:
        p.value.kind === 'PERCENTAGE'
          ? { kind: 'PERCENTAGE', rate: decodeRate(p.value.ratePpm) }
          : { kind: 'FIXED', amount: decodeMoney(p.value.amount) },
    })),
  };
}

/** Whether an item present in both menus changed its availability: the one change announced. */
function availabilityDiffers(held: CatalogMenu | null, next: CatalogMenu): boolean {
  if (held === null) return false;
  const was = new Map(held.items.map((i) => [i.id, i.available]));
  return next.items.some((i) => was.has(i.id) && was.get(i.id) !== i.available);
}

type Check =
  | { kind: 'current' }
  | { kind: 'adopted'; menu: CatalogMenu }
  | { kind: 'failed'; unavailable: boolean }
  /** A stop or a restart came first: nothing more is sent and nothing is applied. */
  | { kind: 'dropped' };

export function createRealCatalog(reads: CatalogReads, deps: Deps = {}): CatalogStore {
  const setTimer = deps.setTimer ?? defaultSetTimer;
  const isVisible = deps.isVisible ?? defaultIsVisible;

  let snapshot: CatalogSnapshot = { menu: null, read: 'loading', failure: null, outOfDate: false, availabilityChanges: 0 };
  const listeners = new Set<() => void>();
  // Advances on every stop and every start. An answer is applied only if the epoch it
  // was sent under is still current, so one that settles after a lock changes nothing.
  let epoch = 0;
  let running = false;
  // The epoch of the cycle in flight, or null: one cycle at a time.
  let inFlight: number | null = null;
  let cancelTimer: (() => void) | null = null;
  let failedChecks = 0;
  let detach: Array<() => void> = [];

  const commit = (next: Partial<CatalogSnapshot>): void => {
    const merged = { ...snapshot, ...next };
    const same = (Object.keys(merged) as Array<keyof CatalogSnapshot>).every((k) => merged[k] === snapshot[k]);
    if (same) return;
    snapshot = merged;
    for (const listener of [...listeners]) listener();
  };

  // A check: the revision, and the menu if it differs or none is held. With nothing held
  // the revision is not asked: the menu is read at once. The version kept is the menu
  // read's own, in the same body as its contents, never the revision the poll last saw
  // (ADR-012 rule 11). Whatever a read answers is adopted, even a lower number: a restored
  // database. Every non-ok result is alike "not a check that succeeded"; no code is read.
  async function check(mine: number): Promise<Check> {
    const held = snapshot.menu;
    if (held !== null) {
      const revision = await reads.revision();
      if (mine !== epoch) return { kind: 'dropped' };
      if (revision.kind !== 'ok') return { kind: 'failed', unavailable: revision.kind === 'unavailable' };
      if (revision.value.version === held.version) return { kind: 'current' };
    }
    const read = await reads.menu();
    if (mine !== epoch) return { kind: 'dropped' };
    if (read.kind !== 'ok') return { kind: 'failed', unavailable: read.kind === 'unavailable' };
    try {
      return { kind: 'adopted', menu: toMenu(read.value) };
    } catch {
      return { kind: 'failed', unavailable: false };
    }
  }

  function schedule(): void {
    cancelTimer?.();
    cancelTimer = null;
    if (!running || !isVisible()) return;
    cancelTimer = setTimer(() => {
      cancelTimer = null;
      void cycle();
    }, POLL_MS);
  }

  async function cycle(): Promise<void> {
    // A refresh requested during a cycle joins that cycle.
    if (!running || inFlight === epoch) return;
    cancelTimer?.();
    cancelTimer = null;
    const mine = epoch;
    inFlight = mine;
    let result: Check;
    try {
      result = await check(mine);
    } catch {
      result = { kind: 'failed', unavailable: false };
    }
    if (inFlight === mine) inFlight = null;
    // A stop or a restart happened while this was in flight: it changes nothing, not even the timer.
    if (mine !== epoch || result.kind === 'dropped') return;

    switch (result.kind) {
      case 'current':
        failedChecks = 0;
        commit({ outOfDate: false });
        break;
      case 'adopted': {
        failedChecks = 0;
        const changed = availabilityDiffers(snapshot.menu, result.menu);
        commit({
          menu: result.menu,
          read: 'ready',
          failure: null,
          outOfDate: false,
          availabilityChanges: snapshot.availabilityChanges + (changed ? 1 : 0),
        });
        break;
      }
      case 'failed':
        failedChecks += 1;
        if (snapshot.menu === null) {
          // One unsuccessful first read enters failure, and a later retry does not return to loading.
          commit({ read: 'failed', failure: result.unavailable ? 'unavailable' : 'failed' });
        } else if (failedChecks >= 2) {
          commit({ outOfDate: true });
        }
        break;
    }
    schedule();
  }

  /** An immediate cycle: a sign-in, a focus, becoming visible, *Try again*. */
  const refreshNow = (): void => {
    if (running && isVisible()) void cycle();
  };

  const onVisibility = (): void => {
    if (isVisible()) {
      refreshNow();
    } else {
      cancelTimer?.();
      cancelTimer = null;
    }
  };

  return {
    kind: 'real',
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      epoch += 1;
      running = true;
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('focus', refreshNow);
      detach = [
        () => document.removeEventListener('visibilitychange', onVisibility),
        () => window.removeEventListener('focus', refreshNow),
      ];
      refreshNow();
      return () => {
        epoch += 1;
        running = false;
        cancelTimer?.();
        cancelTimer = null;
        for (const off of detach) off();
        detach = [];
      };
    },
    retry() {
      // Only the first read has a *Try again*, and it repeats only the read.
      if (snapshot.menu !== null) return;
      commit({ read: 'loading' });
      refreshNow();
    },
  };
}

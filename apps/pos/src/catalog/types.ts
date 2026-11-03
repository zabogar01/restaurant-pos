import type { ApiResult } from '@pos/api-client';
import type { PosMenuResponse } from '@pos/contracts';
import type { Money, Rate } from '@pos/money';
import type { MenuFixture } from '../menuFixtures.js';
import type { OrderState, OrderView } from '../orderFixtures.js';
import type { ItemSheetFixture } from '../sheetFixtures.js';

// The menu as the POS screens hold it (ARCH-021 consult C4, items 3, 5 and 10).
// Both sources, the fixture store and the served one, give a screen exactly this
// shape, with money already decoded by `decodeMoney` at the one point the wire
// enters. A screen reads it and does not know which source it came from.

export type CatalogOption = { id: string; name: string; delta: Money };

export type CatalogCategory = { id: string; name: string };

export type CatalogItem = {
  id: string;
  categoryId: string;
  name: string;
  /** The base price: tax-inclusive, as the back office stores it. */
  price: Money;
  /** false = 86'd: still on the grid, disabled in place. */
  available: boolean;
  variants: ReadonlyArray<CatalogOption>;
  modifiers: ReadonlyArray<CatalogOption>;
};

export type CatalogPreset = {
  id: string;
  name: string;
  value: { kind: 'PERCENTAGE'; rate: Rate } | { kind: 'FIXED'; amount: Money };
};

/**
 * One immutable object, replaced whole (C4 item 10). `version` is the one the
 * menu read answered in the same body as the rest, never the revision the poll
 * last saw: that can be newer than the contents on screen (ADR-012 rule 11).
 * No line or order carries it.
 */
export type CatalogMenu = {
  readonly version: number;
  readonly categories: ReadonlyArray<CatalogCategory>;
  /** One flat array, grouped by category in the categories' order. */
  readonly items: ReadonlyArray<CatalogItem>;
  readonly presets: ReadonlyArray<CatalogPreset>;
};

export type CatalogSnapshot = {
  /** The held menu, or null before a first read has answered. */
  menu: CatalogMenu | null;
  /**
   * `loading`: the first read, or an explicit *Try again*, is in flight.
   * `failed`: the first read failed and nothing is held. `ready`: a menu is held.
   */
  read: 'loading' | 'failed' | 'ready';
  /** Which of the shared general failure's two variants the last failed first read was. */
  failure: 'unavailable' | 'failed' | null;
  /** Two checks in a row did not leave the client current. */
  outOfDate: boolean;
  /** Advances once for each accepted menu in which an item's availability changed. */
  availabilityChanges: number;
};

export interface CatalogStore {
  /** Which source this is. A screen may differ in what it draws, never in what it asks. */
  readonly kind: 'fixture' | 'real';
  getSnapshot(): CatalogSnapshot;
  subscribe(listener: () => void): () => void;
  /** The cashier is signed in: reads at once and keeps the menu current. Returns the stop. */
  start(): () => void;
  /** *Try again*: shows the first read loading and repeats only the read. */
  retry(): void;
}

/** The only two reads the served store can make (FR-A2b: it has no way to reach `activity`). */
export type CatalogReads = {
  revision: () => Promise<ApiResult<{ version: number }>>;
  menu: () => Promise<ApiResult<PosMenuResponse>>;
};

/**
 * What the fixture source adds to the screen path: POS-03's `?state=` pictures
 * of the menu, the fixture items' item sheets and their prices. `null` in a
 * build (session/source.ts), so a served screen can draw none of it (B-24).
 */
export type FixtureMenuFacts = {
  /** The menu region's picture for the state a view draws (an item sheet draws the state it was opened from). */
  pictureFor(view: OrderView): MenuFixture;
  /** The items the fixture 86s in that picture. */
  eightySixedFor(view: OrderView): ReadonlyArray<string>;
  /** A tile's destination: its own item's configuration sheet. */
  itemDestination(itemId: string, from?: OrderState): string;
  /** The item sheet a `sheet-item…` state draws. */
  itemSheet(state: OrderState): ItemSheetFixture | undefined;
  /** The price a fixture item adds at. Throws for an item the fixture does not hold. */
  priceOf(itemId: string): Money;
};

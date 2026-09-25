import type { Money } from '@pos/money';
import { orderTotals, type DiscountSnapshot } from './discount.js';
import { COMP, OTHER_15, OTHER_15_NOTE, STAFF_MEAL, STAFF_MEAL_NOTE } from './discountFixtures.js';

// POS-03's order panel as fixtures, selected by ?state= as the reviewed
// artifact selects them (docs/design/visual-directions/frost/pos/order.html,
// on agent/design-direction). Lines, figures and copy are the artifact's.
// Nothing is computed here: every total is the artifact's own figure, written
// down as a bigint, because pricing is the server's and this slice has none.
//
// F2a built the panel and its six states. F2b adds three states that change
// only the menu region (eightysix, loading, catalog); the panel draws the table
// order in each, see ORDER_FIXTURES. The menu region's own fixtures are in
// menuFixtures.ts. F2c adds three sheet states, drawn over the table order;
// the sheets' own fixtures are in sheetFixtures.ts. F2g adds the manager
// approval prompt's four states, drawn over the table order; its fixtures are
// in approvalFixtures.ts. F2i adds the discount sheets and zero; the sheets'
// own fixtures are in discountFixtures.ts. Two of its states draw an order the
// artifact never figured — this order comped, and this order carrying a
// free-form discount — so their totals are computed by orderTotals from the
// discount they carry, the arithmetic test/discount.test.tsx holds to the
// artifact's own figures. F2j adds the three void sheets; their own fixtures
// are in voidFixtures.ts. F2h adds the three fire and rejection states —
// fireblocked, error, fireerror — and pays off the two corrections F2b and F2c
// deferred: the 86 tag on a PENDING line, and the panel's loading skeleton. Its
// rule lives in fire.ts, beside discount.ts and void.ts.

export type LineStatus = 'pending' | 'fired' | 'voided';

export type Modifier = { name: string; delta?: Money };

export type OrderLine = {
  id: string;
  quantity: number;
  name: string;
  /**
   * The menu item this line is for (`MENU_ITEMS`), which is what makes the
   * line's availability knowable: FR-E4 blocks the fire on a PENDING line
   * "holding an item that is 86'd", and the unavailability fact lives on the
   * menu (`MENU_FIXTURES[state].eightySixed`). fire.ts reads the two together.
   *
   * The identification is the artifact's own — its grid prices Steak at
   * 240.000 and its pending line is a Steak at 240.000 — so nothing is
   * invented here.
   *
   * **Optional, because not every line has a tile.** `overflow` holds a
   * Cheesecake line with no `itemId` (historical fixture data, not the
   * Desserts tile's item). A line without one can never block a
   * fire and never takes the 86 tag: an item nobody can identify is not an
   * item anybody has 86'd.
   */
  itemId?: string;
  modifiers?: ReadonlyArray<Modifier>;
  /** A voided line's record: when, and who approved it. */
  note?: string;
  amount: Money;
  /**
   * The resolved unit price, snapshotted when the line was added (B-8,
   * FR-D4): `max(0, base + chosen deltas)`. A quantity edit reprices from this,
   * never from today's menu. Optional because a fixture line predates it and
   * falls back to the menu.
   */
  unitPrice?: Money;
  status: LineStatus;
};

/**
 * Where a fired round's kitchen ticket stands (FR-E3, ARCHITECTURE.md:250,
 * :317-321). `queued`: committed, delivery not yet known — the only outcome a
 * fire made in this client can honestly claim. `unknown`: the bytes *may* have
 * reached the printer, so it is never "not printed" (B-16).
 */
export type Delivery = 'queued' | 'printed' | 'failed' | 'unknown';

export type RoundGroup =
  // `delivery: null` — the drawing states no outcome for this round (`overflow`'s rounds), so its heading carries no delivery word.
  | { kind: 'fired'; round: number; firedAt: string; delivery: Delivery | null; lines: ReadonlyArray<OrderLine> }
  | { kind: 'pending'; lines: ReadonlyArray<OrderLine> };

export type Adjustment = { label: string; amount: Money };

export type Totals = {
  subtotal: Money;
  discount?: Adjustment;
  serviceCharge?: Adjustment;
  total: Money;
  taxIncluded?: Adjustment;
};

/** FR-G12 (this tab's tender draft) or FR-G13 (another client's lease). */
export type SettlementLock = 'draft' | 'lease';

/**
 * FR-E3's persistent emergency incident, as the screen above the order draws
 * it. The copy is the artifact's. This is the signed-in variant of the banner
 * FE-001 built for POS-01 (EmergencyBanner.tsx): FR-E3b withholds *detail*
 * before sign-in, and POS-03 is behind the PIN, so here it names the table and
 * the round.
 *
 * **Open incidents goes to POS-07**, *Print incidents* (`/pos/incidents`, FE-025).
 * The EmergencyBanner intercepts a plain click and navigates client-side, so
 * the order store outlives the trip and browser Back returns to it.
 *
 * It genuinely leaves POS-03, so it is an anchor, and it is the only anchor
 * this screen carries outside a lock notice.
 */
export type EmergencyIncident = { title: string; detail: string; action: { label: string; href: string } };

export const FIRE_INCIDENT: EmergencyIncident = {
  title: 'Kitchen ticket did not print — Table 1, round 2',
  detail: 'The order is unaffected. The kitchen has not seen this work.',
  action: { label: 'Open incidents', href: '/pos/incidents' },
};

/**
 * FE-022: the same emergency for the round a fire just made. FAILED and UNKNOWN
 * share the banner class and the route to POS-07 (FR-E3); the copy is DESIGN-007's,
 * and UNKNOWN's tells the cashier to check with the kitchen, never that nothing printed.
 */
export const FIRE_INCIDENT_FAILED: EmergencyIncident = {
  title: 'Kitchen ticket FAILED — Table 1, round 3',
  detail: 'Ticket did not print. Open incidents to reprint; the order is unaffected.',
  action: { label: 'Open incidents', href: '/pos/incidents' },
};

export const FIRE_INCIDENT_UNKNOWN: EmergencyIncident = {
  title: 'Kitchen ticket UNKNOWN — Table 1, round 3',
  detail: 'Ticket may have printed. Check with the kitchen before reprinting.',
  action: { label: 'Open incidents', href: '/pos/incidents' },
};

/**
 * FR-D2, the PRD's own vocabulary (`docs/PRD.md:40`): "One bill. Type is
 * `table` or `quick_sale`." F2d reads this, not `?state=`, to decide the
 * count string, the pending group's heading, the close bar's shape and the
 * line editor's form — four consequences of one fact rather than four places
 * that ask `view.state`.
 *
 * Optional, defaulting to `table`: the two dozen fixtures already committed
 * as table orders are not touched to spell out what they already are (every
 * consumer reads it through `orderVariant`, below). `quick` and `quick-line`
 * are the only fixtures that set it.
 */
export type OrderVariant = 'table' | 'quick_sale';

/** An `OrderFixture`'s variant, defaulted. The one place `?? 'table'` lives. */
export function orderVariant(fixture: Pick<OrderFixture, 'type'>): OrderVariant {
  return fixture.type ?? 'table';
}

/**
 * The panel's item count, in the artifact's own words: a quick sale adds
 * "· not yet sent" because nothing on it has gone to the kitchen yet
 * (FR-E5); a table order's count says only how many lines it holds. Derived
 * from the variant, not from which state produced it — a pure function
 * proves as much by taking `type` as a parameter rather than reading a
 * fixture.
 */
export function orderCountLabel(type: OrderVariant, count: number): string {
  const items = count === 1 ? '1 item' : `${count} items`;
  return type === 'quick_sale' ? `${items} · not yet sent` : items;
}

/**
 * What a round's heading says about its ticket. The wording is the artifact's
 * (DESIGN-007 Part C). **UNKNOWN has its own and never claims that nothing
 * printed**: the bytes may have reached the printer, and a cashier who reads
 * "not printed" asks the kitchen to cook it again (B-16). `null` says nothing.
 */
export const DELIVERY_WORDING: Record<Delivery, string> = {
  queued: 'sending · unconfirmed',
  printed: 'printed',
  failed: 'FAILED · not printed',
  unknown: 'UNKNOWN · may have printed',
};

/** `Round 3 · fired 20:14 · sending · unconfirmed`; a round that states no outcome ends at its time. */
export function roundHeading(group: Extract<RoundGroup, { kind: 'fired' }>): string {
  const head = `Round ${group.round} · fired ${group.firedAt}`;
  return group.delivery === null ? head : `${head} · ${DELIVERY_WORDING[group.delivery]}`;
}

/**
 * The pending group's heading. On a table order it answers "did this go to
 * the kitchen?" (I-7) about one round among others; on a quick sale nothing
 * has, ever, until close (FR-E5), so the artifact's heading is a statement
 * about the whole order rather than about a round.
 */
export function pendingGroupHeading(type: OrderVariant): string {
  return type === 'quick_sale' ? 'Not sent to the kitchen yet' : 'Pending · not sent to the kitchen';
}

export type OrderFixture = {
  title: string;
  /** FR-D2. Optional; read through `orderVariant`, never compared directly. */
  type?: OrderVariant;
  groups: ReadonlyArray<RoundGroup>;
  totals: Totals;
  /**
   * The discount the order carries, snapshotted (FR-F4, B-8). `totals.discount`
   * is the same discount as the panel prints it — a label and an amount — and
   * carries no `source`, which is the one fact FR-F8's gate reads. The sheets
   * read this; test/discount.test.tsx holds the two to each other.
   */
  applied?: DiscountSnapshot;
  /**
   * Who applied that discount, when, and on what authority — the change
   * sheet's line under it. **Tied to the application it describes, never
   * derived**: the artifact attaches its actor and time to Staff meal on this
   * order (frost/pos/order.html:529-531) and to nothing else, and reusing the
   * sentence for another application asserts a fact nobody established. An
   * order whose discount has no reviewed application history carries none, and
   * the sheet draws the gap (see `zero`).
   */
  appliedNote?: string;
  lock?: SettlementLock;
  /**
   * An unresolved kitchen print incident, drawn above the screen (FR-E3).
   * Application-wide and never actor-scoped, so it is not a state of the order
   * — but with no server it is the fixture that says which state shows it.
   */
  incident?: EmergencyIncident;
  /** The FIRED line drawn held down, because a fixture cannot hold a finger. */
  pressedLineId?: string;
  /** The artifact's figures after removing one PENDING line, by line id. */
  totalsWithout?: Readonly<Record<string, Totals>>;
};

export type OrderState =
  | 'default'
  | 'empty'
  | 'overflow'
  | 'pressed'
  | 'lock-draft'
  | 'lock-lease'
  | 'eightysix'
  | 'loading'
  | 'catalog'
  | 'sheet-item'
  | 'sheet-item86'
  | 'sheet-item-burger'
  | 'sheet-item-wings'
  | 'sheet-item-steak'
  | 'sheet-item-fish'
  | 'sheet-item-salad'
  | 'sheet-item-soup'
  | 'sheet-item-fries'
  | 'sheet-item-rings'
  | 'sheet-item-soda'
  | 'sheet-item-water'
  | 'sheet-item-coffee'
  | 'sheet-item-beer'
  | 'sheet-item-wine'
  | 'sheet-item-cheesecake'
  | 'sheet-line'
  | 'approval'
  | 'approval-error'
  | 'approval-throttled'
  | 'approval-denied'
  | 'sheet-discount'
  | 'sheet-freeform'
  | 'sheet-remove'
  | 'sheet-remove-freeform'
  | 'zero'
  | 'other-discount'
  | 'sheet-voidline'
  | 'sheet-voidorder'
  | 'sheet-voidorder-fired'
  | 'fireblocked'
  | 'fireblocked-overflow'
  | 'error'
  | 'fireerror'
  | 'fire-ready'
  | 'fire-queued'
  | 'fire-printed'
  | 'fire-failed'
  | 'fire-unknown'
  | 'fire-then-add'
  | 'fire-heading-width'
  | 'quick'
  | 'quick-line'
  | 'settle-error'
  | 'settle-ceiling';

export const ORDER_STATES: ReadonlyArray<{ id: OrderState; label: string }> = [
  { id: 'default', label: 'Two rounds fired, one line pending' },
  { id: 'empty', label: 'No lines' },
  { id: 'overflow', label: 'Overflow — long order' },
  { id: 'pressed', label: 'Pressed — fired line held' },
  { id: 'lock-draft', label: 'Locked — your payment' },
  { id: 'lock-lease', label: 'Locked — another client' },
  { id: 'eightysix', label: 'Item 86’d — disabled in place' },
  { id: 'loading', label: 'Loading the menu' },
  { id: 'catalog', label: 'Menu changed while ordering' },
  { id: 'sheet-item', label: 'Sheet — item configuration' },
  { id: 'sheet-item86', label: 'Sheet — item 86’d mid-choice' },
  { id: 'sheet-item-burger', label: 'Sheet — item: Burger' },
  { id: 'sheet-item-wings', label: 'Sheet — item: Chicken Wings' },
  { id: 'sheet-item-steak', label: 'Sheet — item: Steak' },
  { id: 'sheet-item-fish', label: 'Sheet — item: Fish & Chips' },
  { id: 'sheet-item-salad', label: 'Sheet — item: Caesar Salad' },
  { id: 'sheet-item-soup', label: 'Sheet — item: Soup of the Day' },
  { id: 'sheet-item-fries', label: 'Sheet — item: Fries' },
  { id: 'sheet-item-rings', label: 'Sheet — item: Onion Rings' },
  { id: 'sheet-item-soda', label: 'Sheet — item: Soda' },
  { id: 'sheet-item-water', label: 'Sheet — item: Mineral Water' },
  { id: 'sheet-item-coffee', label: 'Sheet — item: Coffee' },
  { id: 'sheet-item-beer', label: 'Sheet — item: Beer' },
  { id: 'sheet-item-wine', label: 'Sheet — item: House Wine' },
  { id: 'sheet-item-cheesecake', label: 'Sheet — item: Cheesecake' },
  { id: 'sheet-line', label: 'Sheet — line editor' },
  { id: 'approval', label: 'Modal — manager approval' },
  { id: 'approval-error', label: 'Modal — wrong PIN' },
  { id: 'approval-throttled', label: 'Modal — approval cooldown' },
  { id: 'approval-denied', label: 'Modal — cashier PIN refused' },
  { id: 'sheet-discount', label: 'Sheet — preset picker' },
  { id: 'sheet-freeform', label: 'Sheet — free-form discount' },
  { id: 'sheet-remove', label: 'Sheet — remove/replace discount' },
  { id: 'sheet-remove-freeform', label: 'Sheet — remove/replace a free-form discount' },
  { id: 'zero', label: 'Zero total (100% comp)' },
  { id: 'other-discount', label: 'Free-form discount applied' },
  { id: 'sheet-voidline', label: 'Sheet — void fired line' },
  { id: 'sheet-voidorder', label: 'Sheet — void order (unfired)' },
  { id: 'sheet-voidorder-fired', label: 'Sheet — void order (holds fired)' },
  { id: 'fireblocked', label: 'Fire blocked — 86’d pending line' },
  { id: 'fireblocked-overflow', label: 'Fire blocked — one of three pending lines' },
  { id: 'error', label: 'Command rejected' },
  { id: 'fireerror', label: 'Fire printed FAILED' },
  { id: 'fire-ready', label: 'Fire — ready, 2 pending lines' },
  { id: 'fire-queued', label: 'Fire — sending, unconfirmed' },
  { id: 'fire-printed', label: 'Fire — printed' },
  { id: 'fire-failed', label: 'Fire — FAILED' },
  { id: 'fire-unknown', label: 'Fire — UNKNOWN' },
  { id: 'fire-then-add', label: 'Fire — next pending group' },
  { id: 'fire-heading-width', label: 'Fire — Round 12, UNKNOWN' },
  { id: 'quick', label: 'Quick sale' },
  { id: 'quick-line', label: 'Quick sale — line editor' },
];

// ruling C-5: the two locks never share a string.
export const LOCK_TAG: Record<SettlementLock, string> = {
  draft: 'FINISH PAYMENT FIRST',
  lease: 'ANOTHER CLIENT',
};

export const FIRED_TAG = 'MANAGER TO VOID';
export const PENDING_TAG = 'REMOVE FREELY';

// Neither row body names a state. A PENDING row body opens the line editor
// (F2c) for its own line, and a FIRED row body the void sheet (FR-H4, F2j) for
// its own line: both as component state over the order on screen
// (OrderPanel.tsx), so a tap can only ever act on the line that was tapped.
// ?state=sheet-line still draws the artifact's own editor for review.

const serviceAndTax = (subtotal: Money, service: Money, total: Money, tax: Money, discount?: Adjustment): Totals => ({
  subtotal,
  ...(discount && { discount }),
  serviceCharge: { label: 'Service charge 5%', amount: service },
  total,
  taxIncluded: { label: 'Includes tax 10%', amount: tax },
});

// Rounds 1 and 2 and the pending Steak are the artifact's locked-state order;
// its default state is the same order with the Steak removed, which is why
// removing it lands on the artifact's default figures.
const tableOrder: ReadonlyArray<RoundGroup> = [
  {
    kind: 'fired',
    round: 1,
    firedAt: '19:42',
    delivery: 'printed',
    lines: [
      {
        id: 'burger',
        quantity: 1,
        name: 'Burger',
        itemId: 'burger',
        modifiers: [
          { name: 'Large', delta: 20_000n },
          { name: 'Extra cheese', delta: 15_000n },
        ],
        amount: 135_000n,
        status: 'fired',
      },
    ],
  },
  {
    kind: 'fired',
    round: 2,
    firedAt: '19:58',
    delivery: 'printed',
    lines: [{ id: 'soda', quantity: 1, name: 'Soda', itemId: 'soda', amount: 30_000n, status: 'fired' }],
  },
  {
    kind: 'pending',
    lines: [
      {
        id: 'steak',
        quantity: 1,
        name: 'Steak',
        itemId: 'steak',
        modifiers: [{ name: 'Medium rare' }],
        amount: 240_000n,
        status: 'pending',
      },
    ],
  },
];

const tableTotals = serviceAndTax(405_000n, 18_225n, 382_725n, 33_136n, {
  label: 'Staff meal 10%',
  amount: -40_500n,
});

// The same three lines before anything was sent to the kitchen, for the one
// sheet that is only true of such an order: voiding an order with nothing
// fired (FR-H3). The artifact draws that sheet beside its two fired rounds,
// which contradicts the sheet's own notice; see the FE-008 handoff. Same
// lines, same figures: firing changes no price.
const unfiredTableOrder: ReadonlyArray<RoundGroup> = [
  {
    kind: 'pending',
    lines: tableOrder.flatMap((g) => g.lines).map((l) => ({ ...l, status: 'pending' as const })),
  },
];

// FR-E3's failure, over the order a fire leaves behind. **No pending line**,
// and that is a requirement rather than a layout choice: FR-E1 has a fire
// collect *every* PENDING line, so an order whose round 2 has just been fired
// has none left from before it. The artifact agrees — its fireerror draws the
// two fired rounds, its own default totals and nothing pending.
//
// **Round 2 reads `not printed`, and that is a deliberate correction to the
// artifact.** The artifact serves fireerror from one round group shared with
// every other unlocked state, so its round 2 header says `printed` while the
// banner a few pixels above says the ticket did not print. I-7 makes that
// header the cashier's answer to "did this go to the kitchen?", and in this
// state the honest answer is no. FE-022 gave the round a `delivery` outcome and
// this round `failed`. Raised in the FE-011 handoff as a finding for the design
// branch, where it is the fourth instance of one heuristic — a control or a
// string shared across states hides the one state in which it is wrong.
const fireErrorOrder: ReadonlyArray<RoundGroup> = tableOrder
  .filter((g): g is Extract<RoundGroup, { kind: 'fired' }> => g.kind === 'fired')
  .map((g) => (g.round === 2 ? { ...g, delivery: 'failed' as const } : g));

// FE-022's fire states (DESIGN-007 Part C): rounds 1 and 2, then the pending
// Steak × 1 and Fries × 2 that one press sends. The arithmetic is the design's:
// 135.000 + 30.000 + 240.000 + 2 × 40.000 = 485.000, which orderTotals takes to
// 458.325 under Staff meal 10%. Firing changes no price, so every round-3
// composition below carries the same lines and the same figures.
const fireLines: ReadonlyArray<OrderLine> = [
  {
    id: 'fire-steak',
    quantity: 1,
    name: 'Steak',
    itemId: 'steak',
    modifiers: [{ name: 'Medium rare' }],
    amount: 240_000n,
    status: 'pending',
  },
  { id: 'fire-fries', quantity: 2, name: 'Fries', itemId: 'fries', amount: 80_000n, status: 'pending' },
];

const firedRounds = tableOrder.filter((g): g is Extract<RoundGroup, { kind: 'fired' }> => g.kind === 'fired');

const fireReadyOrder: ReadonlyArray<RoundGroup> = [...firedRounds, { kind: 'pending', lines: fireLines }];

/** Round 3 as a fixture: the same lines fired, with the delivery outcome the state draws. A live press only ever produces `queued`. */
const fireRound3 = (delivery: Delivery): ReadonlyArray<RoundGroup> => [
  ...firedRounds,
  { kind: 'fired', round: 3, firedAt: '20:14', delivery, lines: fireLines.map((l) => ({ ...l, status: 'fired' as const })) },
];

// The longest heading (DESIGN-007 item 8): Burger in round 1, a Soda in each of
// rounds 2-11, and round 12 holding Steak + Fries × 2 with UNKNOWN delivery.
// 135.000 + 10 × 30.000 + 240.000 + 80.000 = 755.000, which orderTotals takes to 713.475.
const fireWidthOrder: ReadonlyArray<RoundGroup> = [
  firedRounds[0]!,
  ...Array.from({ length: 10 }, (_, i): RoundGroup => ({
    kind: 'fired',
    round: i + 2,
    firedAt: '23:00',
    delivery: 'printed',
    lines: [{ id: `width-soda-${i + 2}`, quantity: 1, name: 'Soda', itemId: 'soda', amount: 30_000n, status: 'fired' }],
  })),
  { kind: 'fired', round: 12, firedAt: '23:59', delivery: 'unknown', lines: fireLines.map((l) => ({ ...l, status: 'fired' as const })) },
];

const fireThenAddOrder: ReadonlyArray<RoundGroup> = [
  ...fireRound3('queued'),
  { kind: 'pending', lines: [{ id: 'fire-coffee', quantity: 1, name: 'Coffee', itemId: 'coffee', amount: 35_000n, status: 'pending' }] },
];

const tableTotalsWithout = {
  steak: serviceAndTax(165_000n, 7_425n, 155_925n, 13_500n, { label: 'Staff meal 10%', amount: -16_500n }),
};

// F3c's settlement `error` fixture (B-20, DESIGN-004): the order the artifact
// draws for a rejected close is the table order without the Steak — same as
// `default`'s `gone=steak` — but with a Fries also fired into round 2 (the
// artifact's 205.000 subtotal is 165.000 plus one Fries at the grid's own
// 40.000). Fried, not pending: a pending line would trip rule 2's FR-G10 check
// and put a second refusal on a state whose artifact shows only one. No
// pending group at all, because there is nothing left to be pending — the
// Steak that was is gone, same as `default`'s own `gone=steak`. Built off
// `tableOrder`'s own fired rounds, not `fireErrorOrder`'s — that order's
// round 2 is deliberately marked `not printed` for the ticket-failure banner
// (FE-011), a fact this rejected-close state does not carry.
const errorSettlementOrder: ReadonlyArray<RoundGroup> = tableOrder
  .filter((g): g is Extract<RoundGroup, { kind: 'fired' }> => g.kind === 'fired')
  .map((g) =>
    g.round === 2
      ? { ...g, lines: [...g.lines, { id: 'fries', quantity: 1, name: 'Fries', itemId: 'fries', amount: 40_000n, status: 'fired' as const }] }
      : g
  );

// F3's `ceiling-single` seed (FE-020): one fired 100.000.000 line under Staff
// meal 10%, so `orderTotals` — never a typed figure — yields the artifact's
// 94.500.000 balance, the one that binds the single-tender cap instead of the
// change limit. Fired, not pending, for the same reason as `error`'s Fries.
const ceilingSettlementOrder: ReadonlyArray<RoundGroup> = [
  {
    kind: 'fired',
    round: 1,
    firedAt: '19:40',
    delivery: 'printed',
    lines: [{ id: 'banquet', quantity: 1, name: 'Banquet', amount: 100_000_000n, status: 'fired' }],
  },
];

const errorSettlementSubtotal = errorSettlementOrder
  .flatMap((g) => g.lines)
  .reduce((sum, line) => sum + line.amount, 0n);

// The long order (F2a's overflow), lifted out of its fixture unchanged so that
// fireblocked-overflow can hold the same order: same lines, same ids, same
// figures. Nothing about overflow itself changed.
const overflowOrder: ReadonlyArray<RoundGroup> = [
    {
      kind: 'fired',
      round: 1,
      firedAt: '19:42',
      delivery: null,
      lines: [
        {
          id: 'of-burger',
          quantity: 2,
          name: 'Burger',
          itemId: 'burger',
          modifiers: [{ name: 'Large' }, { name: 'Extra cheese' }],
          amount: 270_000n,
          status: 'fired',
        },
        { id: 'of-fish', quantity: 1, name: 'Fish & Chips', itemId: 'fish', amount: 140_000n, status: 'fired' },
        { id: 'of-soda', quantity: 4, name: 'Soda', itemId: 'soda', amount: 120_000n, status: 'fired' },
        {
          id: 'of-salad',
          quantity: 1,
          name: 'Caesar Salad',
          itemId: 'salad',
          note: 'Voided 19:51 · approved by M. Iqbal',
          amount: 75_000n,
          status: 'voided',
        },
      ],
    },
    {
      kind: 'fired',
      round: 2,
      firedAt: '19:58',
      delivery: null,
      lines: [
        { id: 'of-wings', quantity: 3, name: 'Chicken Wings', itemId: 'wings', amount: 270_000n, status: 'fired' },
        { id: 'of-beer', quantity: 2, name: 'Beer', itemId: 'beer', amount: 130_000n, status: 'fired' },
        { id: 'of-rings', quantity: 1, name: 'Onion Rings', itemId: 'rings', amount: 45_000n, status: 'fired' },
      ],
    },
    {
      kind: 'pending',
      lines: [
        { id: 'of-coffee', quantity: 2, name: 'Coffee', itemId: 'coffee', amount: 70_000n, status: 'pending' },
        { id: 'of-cheese', quantity: 1, name: 'Cheesecake', amount: 60_000n, status: 'pending' },
        { id: 'of-wine', quantity: 1, name: 'House Wine', itemId: 'wine', amount: 80_000n, status: 'pending' },
      ],
    },
];

const overflowTotals = serviceAndTax(1_185_000n, 59_250n, 1_244_250n, 107_727n);

const overflowTotalsWithout = {
  'of-coffee': serviceAndTax(1_115_000n, 55_750n, 1_170_750n, 101_364n),
  'of-cheese': serviceAndTax(1_125_000n, 56_250n, 1_181_250n, 102_273n),
  'of-wine': serviceAndTax(1_105_000n, 55_250n, 1_160_250n, 100_455n),
};

// F2d's counter order (FR-D2). One pending group — nothing on a quick sale is
// ever fired before close (FR-E5), so it never has a round to group by. Same
// Burger and Soda the table order carries, same itemIds, at the artifact's
// own quick-sale prices (no size or cheese delta named here — the artifact's
// quick grid draws Burger at its base modifiers, matching order.html's
// q-burger line).
const quickOrder: ReadonlyArray<RoundGroup> = [
  {
    kind: 'pending',
    lines: [
      {
        id: 'q-burger',
        quantity: 1,
        name: 'Burger',
        itemId: 'burger',
        modifiers: [
          { name: 'Large', delta: 20_000n },
          { name: 'Extra cheese', delta: 15_000n },
        ],
        amount: 135_000n,
        status: 'pending',
      },
      { id: 'q-soda', quantity: 1, name: 'Soda', itemId: 'soda', amount: 30_000n, status: 'pending' },
    ],
  },
];

const quickTotals = serviceAndTax(165_000n, 8_250n, 173_250n, 15_000n);

const quickTotalsWithout = {
  'q-burger': serviceAndTax(30_000n, 1_500n, 31_500n, 2_727n),
  'q-soda': serviceAndTax(135_000n, 6_750n, 141_750n, 12_273n),
};

export const ORDER_FIXTURES: Record<OrderState, OrderFixture> = {
  default: { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },

  empty: { title: 'Order · T1', groups: [], totals: { subtotal: 0n, total: 0n } },

  overflow: { title: 'Order · T1', groups: overflowOrder, totals: overflowTotals, totalsWithout: overflowTotalsWithout },

  pressed: {
    title: 'Order · T1',
    groups: tableOrder,
    totals: tableTotals,
    applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE,
    totalsWithout: tableTotalsWithout,
    pressedLineId: 'soda',
  },

  'lock-draft': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, lock: 'draft' },

  'lock-lease': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, lock: 'lease' },

  // F2b's states change the menu region. The panel draws the table order, as
  // the artifact's catalog state does. eightysix's pending Steak now carries
  // the 86 tag and loading now draws the panel's skeleton — both deferred out
  // of F2b as panel markup, both paid off in F2h. Neither is a fixture flag:
  // the tag is read off this order's lines against the menu's 86'd items
  // (fire.ts), and the skeleton is read off the menu fixture's own loading.
  eightysix: { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  loading: { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  catalog: { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },

  // F2c's sheets open over the table order, as the artifact draws them: the
  // panel beside a sheet is the order the cashier is acting on. sheet-item86's
  // menu fixture 86s Steak, so its pending Steak line carries the 86 tag too —
  // the same one fact, which is what makes that a correction to committed work
  // rather than a new state.
  'sheet-item': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-item86': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-item-burger': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-item-wings': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-item-steak': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-item-fish': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-item-salad': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-item-soup': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-item-fries': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-item-rings': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-item-soda': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-item-water': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-item-coffee': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-item-beer': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-item-wine': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-item-cheesecake': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-line': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },

  // F2g's approval prompt opens over the table order: the artifact's request
  // is to void its fired Burger.
  approval: { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'approval-error': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'approval-throttled': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'approval-denied': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },

  // F2i's sheets open over the table order and its Staff meal preset, as the
  // artifact draws them.
  'sheet-discount': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-freeform': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-remove': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },

  // The state FE-007 adds: the same order carrying a free-form discount, so the
  // panel beside the change sheet shows the discount the sheet says is applied.
  'sheet-remove-freeform': {
    title: 'Order · T1',
    groups: tableOrder,
    totals: orderTotals(405_000n, OTHER_15),
    applied: OTHER_15,
    appliedNote: OTHER_15_NOTE,
    totalsWithout: { steak: orderTotals(165_000n, OTHER_15) },
  },

  // The comp the picker's Comp lands on, over the order it was chosen on. The
  // artifact figures its own two-line order (165.000); this is the same
  // arithmetic over the table order the picker sits beside.
  //
  // **No appliedNote, deliberately.** The artifact gives this Comp no
  // application history: nothing says who comped this order or when, and
  // borrowing Staff meal's actor and time would assert a different event's
  // facts. Ruled 2026-09-21 — draw the gap rather than fill it, as A7's four
  // designed tokens carry an explicit null source rather than a plausible one.
  // **The composition is owed to a designer:** the artifact draws no change
  // sheet without the note.
  zero: {
    title: 'Order · T1',
    groups: tableOrder,
    totals: orderTotals(405_000n, COMP),
    applied: COMP,
    totalsWithout: { steak: orderTotals(165_000n, COMP) },
  },

  // The state F2k adds, and the only non-sheet order that carries a free-form
  // discount: exactly what sheet-remove-freeform draws, without the sheet. It
  // exists because the gate's answer only differs from a fixture's here —
  // FR-F8 gates the whole transition off a free-form discount, so from this
  // order every preset and the removal need a manager, and from every other
  // reachable order they do not. Same lines, same figures, same snapshot.
  'other-discount': {
    title: 'Order · T1',
    groups: tableOrder,
    totals: orderTotals(405_000n, OTHER_15),
    applied: OTHER_15,
    appliedNote: OTHER_15_NOTE,
    totalsWithout: { steak: orderTotals(165_000n, OTHER_15) },
  },

  // F2j's void sheets. The fired-line void and the order holding fired work
  // open over the table order, as every other sheet does; the unfired order's
  // void opens over that order with nothing yet sent.
  'sheet-voidline': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-voidorder': { title: 'Order · T1', groups: unfiredTableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-voidorder-fired': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },

  // F2h's four states.
  //
  // fireblocked is the table order with its menu fixture 86'ing Steak
  // (menuFixtures.ts), which is the whole of the state: the panel reads that
  // one fact and fire.ts answers from the order's own lines, so nothing here
  // says "the fire is blocked". It keeps totalsWithout, because the refusal
  // must resolve — ?state=fireblocked&gone=steak voids the offending line.
  fireblocked: { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },

  // **The long order with one of its three pending lines 86'd, and the reason
  // it exists is that no other state can show FR-E4's second half.**
  //
  // "Firing is blocked ... *until that line is voided or the item is
  // restored*" needs an order where voiding the offending line leaves work
  // still to send. On fireblocked the Steak is the only PENDING line, so
  // voiding it clears the block and empties the order in the same press, and
  // Send to kitchen stays unavailable for the *other* reason — true, but it
  // hides the requirement. Here Coffee is one of three, so the block clears
  // while Cheesecake and House Wine are still pending and the control comes
  // back for the reason FR-E4 actually gives.
  //
  // Nothing is invented: the same long order, the grid's own Coffee at 35.000
  // against a 2 × 35.000 line, C-3's greyed tile in place, the singular
  // refusal copy, and totalsWithout['of-coffee'] which F2a already figured. A
  // state on an existing screen is not a node (DESIGN-002's precedent), and
  // F2k's other-discount is the precedent for adding one precisely so a rule's
  // answer can differ from every other state's.
  'fireblocked-overflow': { title: 'Order · T1', groups: overflowOrder, totals: overflowTotals, totalsWithout: overflowTotalsWithout },

  // B-20: a rejected command leaves the order exactly as it was, so this is
  // the order every other state draws, unchanged. The notice is the menu
  // region's (menuFixtures.ts), over a live grid — adding the line again is
  // the point of the state.
  error: { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },

  // The artifact's own fireerror figures: its default two-line order, which is
  // this order with the Steak fired away. No totalsWithout, because there is
  // no PENDING line to remove.
  fireerror: {
    title: 'Order · T1',
    groups: fireErrorOrder,
    totals: tableTotalsWithout.steak,
    applied: STAFF_MEAL,
    appliedNote: STAFF_MEAL_NOTE,
    incident: FIRE_INCIDENT,
  },

  // FE-022. fire-ready is the state a press acts on; fire-queued is what a live
  // press leaves; printed, failed and unknown exist only as fixtures — a live
  // fire is never anything but queued (ARCH-002 §2.3).
  'fire-ready': { title: 'Order · T1', groups: fireReadyOrder, totals: orderTotals(485_000n, STAFF_MEAL), applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE },
  'fire-queued': { title: 'Order · T1', groups: fireRound3('queued'), totals: orderTotals(485_000n, STAFF_MEAL), applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE },
  'fire-printed': { title: 'Order · T1', groups: fireRound3('printed'), totals: orderTotals(485_000n, STAFF_MEAL), applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE },
  'fire-failed': {
    title: 'Order · T1',
    groups: fireRound3('failed'),
    totals: orderTotals(485_000n, STAFF_MEAL),
    applied: STAFF_MEAL,
    appliedNote: STAFF_MEAL_NOTE,
    incident: FIRE_INCIDENT_FAILED,
  },
  'fire-unknown': {
    title: 'Order · T1',
    groups: fireRound3('unknown'),
    totals: orderTotals(485_000n, STAFF_MEAL),
    applied: STAFF_MEAL,
    appliedNote: STAFF_MEAL_NOTE,
    incident: FIRE_INCIDENT_UNKNOWN,
  },
  'fire-heading-width': {
    title: 'Order · T1',
    groups: fireWidthOrder,
    totals: orderTotals(755_000n, STAFF_MEAL),
    applied: STAFF_MEAL,
    appliedNote: STAFF_MEAL_NOTE,
    incident: { ...FIRE_INCIDENT_UNKNOWN, title: 'Kitchen ticket UNKNOWN — Table 1, round 12' },
  },
  'fire-then-add': { title: 'Order · T1', groups: fireThenAddOrder, totals: orderTotals(520_000n, STAFF_MEAL), applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE },

  // F2d's two states. quick draws the counter order; quick-line is the line
  // editor's quick form (M-5, SCREEN-INVENTORY), opened statically over the
  // same order for review — the panel behind a sheet is the order the sheet
  // was opened over (the same rule as sheet-line and every other F2c/F2i/F2j
  // sheet).
  quick: { title: 'Order · counter', type: 'quick_sale', groups: quickOrder, totals: quickTotals, totalsWithout: quickTotalsWithout },
  'quick-line': {
    title: 'Order · counter',
    type: 'quick_sale',
    groups: quickOrder,
    totals: quickTotals,
    totalsWithout: quickTotalsWithout,
  },

  // F3c's settlement `error` seed only (PosRoutes.tsx). Not one of
  // `ORDER_STATES`, so it never appears in POS-03's fixture nav and
  // `orderViewFrom` never resolves a URL to it — it exists solely for
  // `useOrderStore({ state: 'settle-error' })` to seed the order a rejected
  // close leaves behind.
  'settle-error': {
    title: 'Order · T1',
    groups: errorSettlementOrder,
    totals: orderTotals(errorSettlementSubtotal, STAFF_MEAL),
    applied: STAFF_MEAL,
    appliedNote: STAFF_MEAL_NOTE,
  },

  // FE-020's `ceiling-single` seed (PosRoutes.tsx); not one of `ORDER_STATES`, like `settle-error`.
  'settle-ceiling': {
    title: 'Order · T1',
    groups: ceilingSettlementOrder,
    totals: orderTotals(100_000_000n, STAFF_MEAL),
    applied: STAFF_MEAL,
    appliedNote: STAFF_MEAL_NOTE,
  },
};

/**
 * FE-021: the states an item sheet may be opened from — an allow-list, by this
 * rule: a workspace state in which a menu tile is actually pressable. Never an
 * overlay (a sheet, the approval prompt: drawn over a place, not a place) and
 * never a state whose grid is inert (a lock, the loading skeleton). A `from`
 * outside it parses as no origin, because the URL is the boundary and can be
 * bookmarked or edited.
 *
 * The value says what leaving the sheet does with the origin:
 * - `keeps` — a persistent condition of the order or the menu that neither
 *   Cancel nor a successful Add changes: 86 availability and the FE-011
 *   refusal, the incident banner, and the order's own context (long, comped,
 *   discounted, quick). Both return to the origin.
 * - `clears-on-add` — a transient notice or draw that is still true when the
 *   sheet is cancelled but that a successful Add makes false ("nothing was
 *   added", "the order is exactly as it was", an empty order). Cancel returns
 *   to the origin; Add goes to `default`, the order kept.
 * - `clears` — a transient interaction that has already ended by the time the
 *   sheet closes (a held tap). Neither Cancel nor Add restores it: both go to
 *   `default`.
 */
export const ITEM_SHEET_ORIGINS: Partial<Record<OrderState, 'keeps' | 'clears-on-add' | 'clears'>> = {
  default: 'keeps',
  overflow: 'keeps',
  zero: 'keeps',
  'other-discount': 'keeps',
  quick: 'keeps',
  eightysix: 'keeps',
  fireblocked: 'keeps',
  'fireblocked-overflow': 'keeps',
  fireerror: 'keeps',
  'fire-ready': 'keeps',
  'fire-queued': 'keeps',
  'fire-printed': 'keeps',
  'fire-failed': 'keeps',
  'fire-unknown': 'keeps',
  'fire-then-add': 'keeps',
  'fire-heading-width': 'keeps',
  empty: 'clears-on-add',
  catalog: 'clears-on-add',
  error: 'clears-on-add',
  pressed: 'clears',
};

/**
 * What POS-03 is showing: which fixture order, and which PENDING line the
 * remove control took away. A removal is an [INLINE] state of the screen
 * (SITEMAP §1), so reaching it replaces the history entry rather than pushing
 * one.
 *
 * **The rail's category is deliberately not here.** A category press is an
 * [INLINE] change that leaves the URL and history alone, so the selection
 * lives beside the order store (`useOrderStore`), not in the view (FE-023,
 * superseding the ruling of 2026-09-21 that the selection did not move). A
 * ?category= would be a second source for it.
 */
export type OrderView = {
  state: OrderState;
  gone?: string;
  /**
   * FE-021: set only on an item sheet (`sheet-item-<id>`) — the state the tile
   * was pressed on. The sheet returns there on Cancel and Add, and the menu
   * and panel behind it keep that state's availability, so opening a sheet
   * never un-86's a held line (B-17). Absent means `default`.
   */
  from?: OrderState;
};

/** The query string that selects a view: the inverse of orderViewFrom. */
export function viewSearch({ state, gone, from }: OrderView): string {
  const base = gone ? `?state=${state}&gone=${encodeURIComponent(gone)}` : `?state=${state}`;
  return from ? `${base}&from=${from}` : base;
}

/** ?state= picks the fixture; ?gone= is a PENDING line the remove control took away. */
export function orderViewFrom(search: string): OrderView {
  const params = new URLSearchParams(search);
  const state = ORDER_STATES.find((s) => s.id === params.get('state'))?.id ?? 'default';
  const gone = params.get('gone');
  // `from` means something only on an item sheet, and only a place a tile can be pressed.
  const asked = params.get('from') as OrderState | null;
  const from = state.startsWith('sheet-item-') && asked && asked in ITEM_SHEET_ORIGINS ? asked : undefined;
  return { state, ...(gone && { gone }), ...(from && { from }) };
}

import { formatAmount } from '../money.js';
import type { SettlementLock } from '../orderFixtures.js';

// The words POS-03's menu region says, and nothing that is data. This module is
// in every bundle: the lock notices and the loading label are the screen's own
// copy, whichever source the menu comes from. The fixture menu itself is not
// here (menuFixtures.ts, reached only through session/source.ts).

export type LockNotice = {
  title: string;
  body: string;
  action: { label: string; href: string };
  /** notice--soft: the cashier's own doing, on this tab (ruling C-5). */
  soft: boolean;
};

// Ruling C-5: the two locks never share a string, and each names its own route
// out. The artifact links to settlement.html?state=pending and ?state=takeover.
// FE-015 reconciles the artifact's placeholder state names onto POS-04's real
// route. The state remains in the query so later slices can supply the pending
// and takeover compositions without another routing change.
export const LOCK_NOTICE: Record<SettlementLock, LockNotice> = {
  draft: {
    title: 'Finish this payment first',
    body:
      'You are collecting payment for this order on this tab. Adding items, changing the discount, firing, and ' +
      'voiding — including removing a line you have not sent yet — are unavailable until you finish or cancel ' +
      'it. You can still read the order.',
    action: { label: 'Back to payment', href: '/pos/settlement?state=settle-pending' },
    soft: true,
  },
  lease: {
    title: 'Another client is settling this order',
    body:
      'Payment was started elsewhere and may involve a card charge already in progress. You cannot add items, ' +
      'discount, fire, or void this order — and that includes removing a line you have not sent yet. Reading ' +
      'it is still fine.',
    action: { label: 'Manager: take over payment', href: '/pos/settlement?state=settle-takeover' },
    soft: false,
  },
};

export const CATALOG_NOTICE = {
  title: 'The menu changed while you were ordering',
  body: 'Nothing was added. Prices have been refreshed — check the item and add it again.',
};

/**
 * B-20, the `error` state: a command the server rejected. The copy is the
 * artifact's. **The whole claim is that nothing happened** — so the notice
 * carries no undo, no retry of the command, and nothing that touches the
 * order; its one control clears the notice and leaves the cashier on the order
 * they were already on, with the live grid to add the line again.
 *
 * `role="alert"`, not `role="status"`: this is the answer to something the
 * cashier just did, and F2e ruled that a failure a screen-reader user is never
 * told about is a real defect. CATALOG_NOTICE is the other shape — a standing
 * condition of the screen — and keeps `role="status"`.
 */
export const REJECTED_NOTICE = {
  title: 'Could not add that line',
  body: 'The order is exactly as it was. Nothing was half-applied.',
  action: 'Try again',
};

export const LOADING_LABEL = 'LOADING MENU';

// DESIGN-021's copy table, word for word (ADR-011 rule 24). The served states
// of the menu region: the first read failing, an empty catalog, an empty
// category, and the two polite statuses at the menu's bottom edge.

/** The shared general failure's two variants: the core says `unavailable`, or anything else. */
export const READ_FAILURE = {
  unavailable: { title: 'The system is unavailable', body: 'Wait a moment, then try again.' },
  failed: { title: 'Something went wrong', body: 'Try again. If the problem continues, ask a manager for help.' },
  retry: 'Try again',
} as const;

export const EMPTY_CATALOG = {
  title: 'No menu items yet',
  body: 'There is nothing to add yet. A manager adds the menu in the back office.',
} as const;

/** The empty order's panel, while no menu is held (loading, failed, or an empty catalog). */
export const NO_MENU_ORDER = {
  title: 'No items yet',
  body: 'Add an item when the menu is available.',
} as const;

export const EMPTY_CATEGORY = 'No items in this category yet.';

export const STALE_STATUS = 'The menu may be out of date. You can keep taking orders.';
export const AVAILABILITY_STATUS = 'Menu availability updated.';

/** Why Discount, Void order, Send and Settle are inert on an empty order. */
export const ACTION_REASON = {
  menuHeld: 'Add an item first.',
  noMenu: 'No items on this order yet.',
} as const;

// DESIGN-021's copy for M-2 over a served item, word for word (ADR-011 rule 24): the reasons Add is off,
// the two money ceilings, and the notices the open sheet raises when the item changes under it. Braces in
// the design table are the functions' arguments.

/** The two fixed group labels. A list with nothing in it draws no heading. */
export const SERVED_GROUPS = {
  variant: { id: 'variant', name: 'Variant' },
  modifiers: { id: 'modifiers', name: 'Modifiers' },
} as const;

/** The commit reason (`served-add-reason`) by cause. The sheet shows the first that holds, in this order. */
export const ADD_REASON = {
  gone: 'This item is no longer on the menu.',
  unavailable: 'This item is unavailable.',
  variant: 'Choose a variant before adding this item.',
} as const;

/** FR-M5's ceilings, in the amounts' own formatting. No computed excess is ever quoted. */
export const CEILING_REASON = (limit: bigint) => ({
  line: `Line total cannot exceed ${formatAmount(limit)}.`,
  order: `Order total cannot exceed ${formatAmount(limit)}.`,
});

/** The bound line when the next quantity would pass a money ceiling. */
export const cannotIncrease = (ceilingSentence: string) => `Cannot increase quantity. ${ceilingSentence}`;

export const UNAVAILABLE_NOTICE = (name: string) =>
  `${name} is no longer available. A manager marked it 86. Your choices are kept, but it cannot be added.`;
export const GONE_NOTICE = (name: string) => `${name} is no longer on the menu. Your choices are kept, but it cannot be added.`;

/**
 * One notice for whatever changed: the sentence below, or, when exactly ONE chosen option went, the reviewed
 * sentence naming it. DESIGN-021 draws no wording for several removed options, and the builder invents none
 * (ADR-011 rule 24), so two or more removals use the generic sentence. A drawn plural is the designer's.
 */
export const CHANGED_NOTICE = 'This item changed while you were choosing. Check the updated choices and prices before adding.';
export const REMOVED_NOTICE = (name: string) => `This item changed while you were choosing. ${name} was removed and deselected.`;

// DESIGN-021's copy for M-3 over the served presets, word for word (ADR-011 rule 24). The read failure's title,
// body and action are the menu's own (READ_FAILURE): the presets are read with the menu, so a failed preset
// read is the menu's failed first read and says the same words.

export const PRESET_LOADING_LABEL = 'LOADING PRESETS';
export const PRESET_NONE = 'No active presets. A manager can add or activate a preset in the back office.';
export const PRESET_GROUP = 'Presets — no approval needed';
export const PRESET_ANYTHING_ELSE = 'Anything else';

/** The served fire refusal's one recovery control (DESIGN-021's copy table), which focuses the first blocking line. */
export const SHOW_BLOCKED = 'Show unavailable lines';

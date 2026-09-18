import type { Money } from '@pos/money';
import type { Notice } from './fixtures.js';
import type { OrderState, OrderView } from './orderFixtures.js';

// M-1, the manager approval prompt (F2g), as fixtures selected by the same
// ?state= as the order screen. Copy is the reviewed artifact's, verbatim
// (docs/design/visual-directions/frost/pos/order.html, the
// data-when="approval approval-error approval-throttled approval-denied"
// block, on agent/design-direction).
//
// B-14 shapes what is *not* here. A fixture carries the one action being
// approved and nothing about who is at the terminal: no actor, no role, no
// session, no audience, no approver, no expiry. There is no input by which a
// manager's existing session — back office or POS — could stand in for the
// PIN (FR-A2c, AC-27), because the prompt is never told one exists. The
// approval itself is never represented at all: it lives only inside the one
// protected command that carries the PIN (docs/ARCHITECTURE.md §7.1), and
// this slice sends no command.

/** FR-H4 (a FIRED line, or an order holding one) and FR-H5: a reason is required. */
export type ReasonedAction = 'void-fired-line' | 'void-fired-order' | 'refund';

/** FR-F3, FR-F8, FR-G14: gated, and the PRD asks for no reason. */
export type UnreasonedAction = 'free-form-discount' | 'discount-change' | 'lease-takeover';

type Described = {
  /** What is being approved, in the caller's words: "Void a fired line". */
  description: string;
  /** The thing it acts on, where there is one. */
  subject?: { name: string; amount: Money };
};

/**
 * The one action the prompt authorises, given to it by the sheet that raised
 * it. The prompt displays this; it never collects it. The reason is captured
 * upstream, before the PIN, and where the PRD requires one the type does too.
 */
export type ApprovalRequest =
  | (Described & { action: ReasonedAction; reason: string })
  | (Described & { action: UnreasonedAction; reason?: string });

export type ApprovalFixture = {
  request: ApprovalRequest;
  /** Why the last entry did not approve anything. Static pictures of server answers. */
  notice?: Notice;
  /** The MANAGER_APPROVAL cooldown (FR-A5): the confirm key is drawn inert. */
  throttled?: boolean;
  /** The control that began the gated path, which takes focus back when the prompt closes. */
  opener: string;
  cancel: OrderView;
  approve: OrderView;
};

export const CANCEL_NOTE = 'Cancelling changes nothing on the order.';

// The artifact's one drawn request. It lower-cases the reason in running
// text; the void sheet it came from offers "Customer changed their mind".
const voidBurger: ApprovalRequest = {
  action: 'void-fired-line',
  description: 'Void a fired line',
  subject: { name: 'Burger', amount: 135_000n },
  reason: 'customer changed their mind',
};

// The artifact routes Cancel to order.html and the confirm key to
// ?state=default; both land on the default state. The sheet that raised the
// prompt does not exist yet (F2j), so focus goes back to the fired Burger row,
// the first FIRED row body, where the void path began.
const base = {
  request: voidBurger,
  opener: '.order-line[data-line-status="fired"] > .order-line__target',
  cancel: { state: 'default' },
  approve: { state: 'default' },
} satisfies Omit<ApprovalFixture, 'notice' | 'throttled'>;

export const APPROVAL_FIXTURES: Partial<Record<OrderState, ApprovalFixture>> = {
  approval: base,

  // A wrong credential.
  'approval-error': {
    ...base,
    notice: {
      title: 'PIN not recognised',
      body: '3 attempts remaining before manager approvals are locked for five minutes.',
      failure: true,
    },
  },

  // The throttle's countdown is drawn; it times the cooldown, never an approval.
  'approval-throttled': {
    ...base,
    throttled: true,
    notice: {
      title: 'Manager approvals locked for 4 min 38 s',
      body: 'Five failed approval attempts. Signing in as a cashier does not clear this.',
      failure: true,
    },
  },

  // A valid credential of the wrong authority. Not the same failure as a wrong PIN.
  'approval-denied': {
    ...base,
    notice: {
      title: 'That PIN is not a manager',
      body: 'This action needs a manager. The attempt has been recorded.',
      failure: true,
    },
  },
};

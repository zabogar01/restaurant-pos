import type { Money } from '@pos/money';
import { useEffect, useRef, useState } from 'react';
import { closeRefusal, type CloseRefusal } from './close.js';
import { formatAmount } from './money.js';
import { TotalsView } from './OrderPanel.js';
import type { OrderStore } from './orderStore.js';
import { usePaymentSession, type DraftTender, type PaymentSession } from './paymentSession.js';
import { PinPad } from './PinPad.js';
import {
  CASH_CHANGE_LIMIT,
  cashChangeLimitedMaximum,
  cashCeilingBoundByChangeLimit,
  mayAddTender,
  settlementPosition,
  tenderMaximum,
  type TenderMethod,
} from './tender.js';

export const SETTLEMENT_STATES = [
  'empty',
  'pressed',
  'partial',
  'exact',
  'overflow',
  'card',
  'cardsplit',
  'cashover',
  'change',
  'cardover',
  'ceiling',
  'ceiling-single',
  'exactcash',
  'exactsplit',
  'pending',
  'zero',
  'loading',
  'error',
  // F3d's four identity-and-lease states (FR-G9, FR-G12–G14, I-5).
  'reauth',
  'leaselost',
  'settle-takeover',
] as const;
export type SettlementState = (typeof SETTLEMENT_STATES)[number];

/** A keyed-by-hand amount that a direct fixture visit seeds before any Add. */
const KEYED_SEED: Partial<Record<SettlementState, string>> = {
  cardsplit: '100000',
  cashover: '200000',
  cardover: '200000',
  ceiling: '99999999',
  // FE-020: the artifact's 100.000.000 keyed against the 94.500.000 balance.
  'ceiling-single': '100000000',
};

const CARD_SELECTED_STATES: ReadonlySet<SettlementState> = new Set(['card', 'cardsplit', 'cardover']);

/**
 * `leaselost` and `settle-takeover` (rules 9, 10) are lease/identity
 * fixtures, never this cashier's own payment — visiting them must never open
 * the draft session, or the own-tab lock they leave behind on POS-03 would
 * draw `draft`'s words over what is actually another client's lease
 * (rule 3). `reauth` is the opposite: its whole point (rule 8, AC-9) is that
 * the draft survives the round trip, so it opens the session like any live
 * visit.
 */
export function beginsSession(state: SettlementState): boolean {
  return state !== 'leaselost' && state !== 'settle-takeover';
}

export function settlementStateFrom(search: string): SettlementState {
  const state = new URLSearchParams(search).get('state');
  return SETTLEMENT_STATES.find((candidate) => candidate === state) ?? 'empty';
}

/** Seeds the session's drafts the first time a state is visited (rule 1). */
export function initialDrafts(state: SettlementState, total: Money): ReadonlyArray<DraftTender> {
  const card = (id: string, amount: Money) => ({ id, label: 'Card', amount });
  const cash = (id: string, amount: Money) => ({ id, label: 'Cash', amount });

  if (state === 'partial') return [card('fixture-card', 100_000n)];
  if (state === 'exact') return [card('fixture-card', total)];
  if (state === 'exactcash') return [cash('fixture-cash', total)];
  if (state === 'exactsplit') return [card('fixture-card', 100_000n), cash('fixture-cash', total - 100_000n)];
  if (state === 'change') return [cash('fixture-cash', 200_000n)];
  if (state === 'ceiling') return [card('fixture-card', 100_000n)];
  // `loading`, `error` and `reauth` all draft the artifact's own Card
  // 155.925 — a fixture figure, fixed regardless of what the live order
  // totals to. It is the number `error`'s balance (rule 8) is derived
  // *against*: the seeded draft never moves, only the balance the order's
  // live total leaves.
  if (state === 'loading' || state === 'error' || state === 'reauth') return [card('fixture-card', 155_925n)];
  if (state !== 'overflow') return [];

  const fixed = [
    { id: 'fixture-card-1', label: 'Card', amount: 40_000n },
    { id: 'fixture-card-2', label: 'Card', amount: 30_000n },
    { id: 'fixture-voucher', label: 'Meal voucher', amount: 20_000n },
    { id: 'fixture-card-3', label: 'Card', amount: 10_000n },
    { id: 'fixture-account', label: 'Staff account', amount: 20_000n },
  ];
  const remainder = total - fixed.reduce((sum, draft) => sum + draft.amount, 0n);
  return [...fixed, { id: 'fixture-cash', label: 'Cash', amount: remainder }];
}

const methodLabel = (method: TenderMethod) => (method === 'cash' ? 'Cash' : 'Card');
const paymentTitle = (title: string) => title.replace(/^Order · T(\d+)$/, 'Table $1').replace(/^Order · /, '');

/** The muted sentence under the field. Cash and card never share one (SCREEN-INVENTORY I-13). */
function tenderCaption(args: {
  method: TenderMethod;
  balance: Money;
  amount: Money;
  keyed: boolean;
  mayAdd: boolean;
  max: Money;
  ceilingBound: boolean;
  total: Money;
}) {
  const { method, balance, amount, keyed, mayAdd, max, ceilingBound, total } = args;
  if (balance === 0n) return null;

  if (!keyed) {
    return method === 'card' ? (
      <>
        The whole balance, already filled in — and the <b>most</b> card can take. Key a smaller amount to split the
        bill; whatever is left stays on the balance.
      </>
    ) : (
      <>
        The whole balance, already filled in. Cash <b>may</b> be more than this — key what the customer handed over
        and the change is worked out.
      </>
    );
  }

  if (!mayAdd) {
    if (method === 'card') {
      return (
        <>
          Card is capped at the remaining balance, so this cannot be added. Clear it and key {formatAmount(max)} or
          less — or take the excess in cash.
        </>
      );
    }
    if (ceilingBound) {
      return (
        <>
          Cash <b>may</b> be more than the balance, but not more than the restaurant can give change for, so this
          cannot be added.
        </>
      );
    }
    // The single-tender cap binds instead of the change limit (FE-020): the
    // change-limit copy above would be false here. Only an over-max amount
    // gets this — a keyed 0 is not "over" anything.
    if (amount <= max) return null;
    return (
      <>
        The {formatAmount(balance)} balance plus the {formatAmount(CASH_CHANGE_LIMIT)} change limit is{' '}
        {formatAmount(cashChangeLimitedMaximum(balance))}. The lower, single-tender cap applies: key{' '}
        <b>{formatAmount(max)} or less</b>.
      </>
    );
  }

  if (amount < balance) {
    const rest = balance - amount;
    return (
      <>
        {formatAmount(amount)} of the {formatAmount(balance)} owing. Adding this leaves{' '}
        <b>{formatAmount(rest)} on the balance</b> for the next method. That is the whole of splitting a bill — there
        is no mode to enter.
      </>
    );
  }

  if (method === 'cash' && amount > balance) {
    const hypotheticalChange = amount - balance;
    return (
      <>
        More than the {formatAmount(balance)} owing, which cash is allowed to be. Adding this gives{' '}
        <b>{formatAmount(hypotheticalChange)} change</b>; the recorded takings are still {formatAmount(total)}.
      </>
    );
  }

  return null;
}

/** The refusal notice. Card-over, change-limit-bound cash and single-tender-bound cash draw one. */
function tenderNotice(args: {
  method: TenderMethod;
  keyed: boolean;
  mayAdd: boolean;
  balance: Money;
  amount: Money;
  max: Money;
  ceilingBound: boolean;
}) {
  const { method, keyed, mayAdd, balance, amount, max, ceilingBound } = args;
  if (!keyed || mayAdd || balance === 0n) return null;

  if (method === 'card') {
    return {
      title: 'Card cannot be more than the balance',
      body: (
        <>
          You entered {formatAmount(amount)}. The most you can take on card is <b>{formatAmount(max)}</b> — which is
          what was already filled in. Cash is the only method that may exceed the balance.
        </>
      ),
    };
  }

  if (!ceilingBound) {
    if (amount <= max) return null;
    return {
      title: 'Cash exceeds the single-tender limit',
      body: (
        <>
          You entered {formatAmount(amount)}. One payment line can hold at most <b>{formatAmount(max)}</b>, even when the
          change would be within {formatAmount(CASH_CHANGE_LIMIT)}. Nothing has been recorded; the draft is unchanged.
        </>
      ),
    };
  }

  return {
    title: 'Too much cash to give change for',
    body: (
      <>
        The most cash this sale can accept is <b>{formatAmount(max)}</b> — the {formatAmount(balance)} still owing plus
        the 9.999.999 change limit. Nothing has been recorded and the drafted payment lines are unchanged.
      </>
    ),
  };
}

const PENDING_NOTICE_ID = 'close-pending-notice';
// What an off Add points at (FE-024): whichever of these the screen draws. The
// caption is entry help, not a reason, so it is never one.
const TENDER_MESSAGE_ID = 'tender-field-message';
const TENDER_NOTICE_ID = 'tender-refusal-notice';

/** Bold names joined the way English lists them: "Steak", "Steak and Fries", "Steak, Fries and Coffee". */
function boldNames(names: ReadonlyArray<string>) {
  return names.map((name, i) => (
    <span key={name}>
      {i > 0 && (i === names.length - 1 ? ' and ' : ', ')}
      <b>{name}</b>
    </span>
  ));
}

/**
 * The sentence the pending notice and the cancel modal share about what
 * cancelling throws away: none omits it, one names it ("the Cash 382.725
 * draft", the artifact's own), two or more count them the way the cancel
 * modal does (FE-020, the lead's ruling on plurals).
 */
function discardSentence(drafts: ReadonlyArray<DraftTender>): string | null {
  if (drafts.length === 0) return null;
  if (drafts.length === 1) return `Cancelling discards the ${drafts[0]!.label} ${formatAmount(drafts[0]!.amount)} draft.`;
  return `Cancelling discards ${drafts.length} drafted payment lines.`;
}

/**
 * The pending-close notice (FR-G10, rule 7), copied from the artifact and
 * pluralised the way `fireRefusal` (fire.ts) pluralises its own — the artifact
 * never drew two blocking lines either, so the plurals are PROVISIONAL COPY
 * for a designer, exactly as fire.ts's is. Its action opens the live cancel
 * modal (FE-020, DESIGN-006 finding 4): *Back to the order* landed on a
 * locked POS-03, where send and void are blocked, so it pointed nowhere.
 */
function PendingCloseNotice({
  lines,
  drafts,
  onCancelPayment,
}: {
  lines: ReadonlyArray<{ name: string }>;
  drafts: ReadonlyArray<DraftTender>;
  onCancelPayment: () => void;
}) {
  const one = lines.length === 1;
  const discards = discardSentence(drafts);
  return (
    <div className="notice" id={PENDING_NOTICE_ID}>
      <div className="notice__title">
        Cannot close — {lines.length} item{one ? '' : 's'} {one ? 'has' : 'have'} not been sent to the kitchen
      </div>
      <div>
        {boldNames(lines.map((l) => l.name))} {one ? 'is' : 'are'} still pending. Cancel payment before sending or
        voiding {one ? 'it' : 'them'}; payment in progress blocks both.
        {discards && ` ${discards}`}{' '}
        <button type="button" className="settlement-back" data-action="cancel-payment-from-notice" onClick={onCancelPayment}>
          Cancel payment to edit the order
        </button>
      </div>
    </div>
  );
}

/** FR-G11's notice (rule 4): the order carries nothing to tender. */
function ZeroCloseNotice() {
  return (
    <div className="notice">
      <div className="notice__title">Nothing to collect</div>
      <div>
        This order is fully discounted. Closing it records zero revenue and still prints a receipt. No payment lines
        are stored.
      </div>
    </div>
  );
}

/** The zero-total tender column (rule 4): no field, no keypad, no Add — there is nothing to key. */
function ZeroTenderEmpty() {
  return (
    <div className="tender-empty">
      <div className="tender-empty__title">No payment to take</div>
      <div>Close the order to print the receipt.</div>
    </div>
  );
}

/**
 * `error`'s rejected-close notice (B-20, DESIGN-004, rule 8). The figures are
 * the live order's, never a seeded literal — the red case this guards is a
 * changed order total that the notice fails to follow.
 */
function ErrorCloseNotice({ total, balance }: { total: Money; balance: Money }) {
  return (
    <div className="notice">
      <div className="notice__title">Close was rejected</div>
      <div>
        The order changed while you were collecting payment. The total is now <b>{formatAmount(total)}</b> and{' '}
        <b>{formatAmount(balance)} is still owing</b>. Your drafted payment lines are still here — add the rest, or
        remove them and start again. Nothing was recorded.
      </div>
    </div>
  );
}

/** `loading`'s fixture-only composition (rule 9): nothing live ever sets this state. */
function ClosingSkeleton() {
  return (
    <div className="settlement-loading" aria-busy="true">
      <div className="menu-loading__label">CLOSING ORDER</div>
      <div className="skel-bar skel-bar--80" aria-hidden="true" />
      <div className="skel-bar skel-bar--40" aria-hidden="true" />
    </div>
  );
}

/** rule 6, the lead's ruling: "0 drafted payment lines" is copy nobody drew, so zero omits the sentence. */
function draftCountSentence(count: number): string | null {
  if (count === 0) return null;
  const noun = count === 1 ? 'payment line' : 'payment lines';
  return `${count === 1 ? 'One' : count} drafted ${noun} will be discarded.`;
}

/**
 * Rule 5, I-5: the confirm-before-discard modal, copied verbatim from the
 * artifact's `cancel` state. Ungated — no PIN, no manager, no approval — and
 * unlike the manager approval prompt (Approval.tsx) it authorises nothing; it
 * only asks whether to throw away what is on screen.
 */
function CancelPaymentModal({
  drafts,
  change,
  onKeep,
  onCancel,
}: {
  drafts: ReadonlyArray<DraftTender>;
  change: Money;
  onKeep: () => void;
  onCancel: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => box.current?.focus(), []);
  const sentence = draftCountSentence(drafts.length);

  return (
    <>
      <div className="modal-scrim" aria-hidden="true" />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cancel-payment-title" tabIndex={-1} ref={box}>
        <div className="modal__head">
          <h2 id="cancel-payment-title" className="modal__title">
            Cancel this payment?
          </h2>
        </div>
        <div className="modal__body">
          <p>
            <b>Nothing has been recorded.</b> No payment line exists on the server until the order closes, so
            cancelling discards the draft and the order goes back to being editable straight away.
          </p>
          <p className="settlement-cancel__note">
            If a card was already put through on a terminal, that charge is outside this system and has to be
            settled with the customer. This screen cannot know either way.
          </p>
          {sentence && <p className="settlement-cancel__note">{sentence}</p>}
          {/* Read-only: the rows the cashier is about to lose, with no Remove. A Change given row is shown, never counted. */}
          {drafts.length > 0 && (
            <div className="cancel-drafts" aria-label="Draft being discarded">
              {drafts.map((draft) => (
                <div className="cancel-drafts__row" key={draft.id}>
                  <span>{draft.label}</span>
                  <span>{formatAmount(draft.amount)}</span>
                </div>
              ))}
              {change > 0n && (
                <div className="cancel-drafts__row">
                  <span>Change given</span>
                  <span>−{formatAmount(change)}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal__foot">
          <button type="button" className="action" onClick={onKeep}>
            Keep collecting
          </button>
          <button type="button" className="action action--primary" onClick={onCancel}>
            Cancel payment
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Rule 8: `reauth`'s modal, fixture-only — no idle timer exists, so nothing
 * live ever opens this. The PIN pad is FE-001's and F2g's (PinPad.tsx),
 * reused with B-12's guarantee intact: `seed` only ever sets a *count*, never
 * a digit, so no real value crosses into this fixture. Submit verifies
 * nothing (no server); *Leave payment* keeps the draft and lands on POS-03
 * locked, exactly like ← Order — the artifact's own href goes to an unlocked
 * order and contradicts its own caption, so this slice does not follow it
 * (the lead's ruling, rule 8).
 */
function ReauthModal({ onLeave }: { onLeave: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => box.current?.focus(), []);

  return (
    <>
      <div className="modal-scrim" aria-hidden="true" />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="reauth-title" tabIndex={-1} ref={box}>
        <div className="modal__head">
          <h2 id="reauth-title" className="modal__title">
            Sign in to finish this payment
          </h2>
          <div className="modal__request">Your session timed out. The drafted payment lines are still here.</div>
        </div>
        <div className="modal__body">
          <PinPad geometry="approval" seed={2} onSubmit={() => {}} />
        </div>
        <div className="modal__foot">
          <button type="button" className="action" onClick={onLeave}>
            Leave payment
          </button>
          <span className="modal__note">The draft stays in this tab.</span>
        </div>
      </div>
    </>
  );
}

/** Rule 9: `leaselost`, reached only by a direct visit — no server exists to displace anyone. No drafts, no Cancel payment. */
function LeaseLostModal({ onBackToFloor }: { onBackToFloor: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => box.current?.focus(), []);

  return (
    <>
      <div className="modal-scrim" aria-hidden="true" />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="leaselost-title" tabIndex={-1} ref={box}>
        <div className="modal__head">
          <h2 id="leaselost-title" className="modal__title">
            A manager took over this payment
          </h2>
        </div>
        <div className="modal__body">
          <p>This order is now being settled elsewhere. Your drafted payment lines were never recorded and cannot be closed from here.</p>
          <p className="settlement-cancel__note">If you had already taken a card payment, tell the manager now.</p>
        </div>
        <div className="modal__foot" style={{ gridTemplateColumns: '1fr' }}>
          <button type="button" className="action action--primary" onClick={onBackToFloor}>
            Back to floor
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Rule 10: `settle-takeover`, reached for real from POS-03's `lock-lease`
 * action. FR-G14 and FR-J3 want the risk acknowledged *before* the PIN, and
 * the review rejected folding it into Continue (FE-020, DESIGN-006), so this
 * is two steps in component state: the warning and *I understand*, then the
 * M-1 PIN pad. The design's `?ack=1` is a fixture device; the step here is
 * state, so a remount starts again at step one. Continue verifies nothing —
 * no server exists — on FE-001's and F3d's precedent, and B-12 holds because
 * the pad's digits never leave its ref. No Cancel payment.
 */
function TakeoverModal({ onCancel }: { onCancel: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => box.current?.focus(), []);
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <>
      <div className="modal-scrim" aria-hidden="true" />
      <div className="modal takeover-modal" role="dialog" aria-modal="true" aria-labelledby="takeover-title" tabIndex={-1} ref={box}>
        <div className="modal__head">
          <h2 id="takeover-title" className="modal__title">
            Take over this payment
          </h2>
          <span className="settlement-tag">MANAGER REQUIRED</span>
        </div>
        <div className="modal__body">
          <div className="notice">
            <div className="notice__title">A card charge may already be in progress</div>
            <div>
              Another client started collecting payment for Table 1 at 20:14. Taking over rejects their close. Check
              with them before you continue. Acknowledge this risk before entering your PIN.
            </div>
          </div>
          {acknowledged && (
            <div className="takeover-pin">
              <span className="tender-field__label">Manager PIN</span>
              <PinPad geometry="approval" onSubmit={() => {}} />
            </div>
          )}
        </div>
        <div className="modal__foot">
          <button type="button" className="action" onClick={onCancel}>
            Cancel
          </button>
          {acknowledged ? (
            <span className="modal__note">Risk acknowledged. Continue submits the manager PIN for this takeover only.</span>
          ) : (
            <button type="button" className="action action--primary" data-action="acknowledge-takeover" onClick={() => setAcknowledged(true)}>
              I understand
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * The thin wrapper (FE-019, review finding 1): owns exactly one payment
 * session (`usePaymentSession`) and seeds it itself, since no `PosRoutes`
 * sits above it to have done so already. Renders {@link ControlledSettlementScreen}
 * with it. `store` is unchanged — every caller, routed or direct, has always
 * supplied it, so there was never a second store to discard here.
 */
export function SettlementScreen({
  store,
  addRule = mayAddTender,
  closeRule = closeRefusal,
}: {
  store: OrderStore;
  /** Test seam for proving the component has no second tender-validity rule. */
  addRule?: typeof mayAddTender;
  /** Test seam for proving the component has no second close-validity rule (rule 1, criterion 10). */
  closeRule?: typeof closeRefusal;
}) {
  const state = settlementStateFrom(window.location.search);
  const session = usePaymentSession();
  // Render-time, not an effect (paymentSession.ts): the first paint already
  // carries the seeded drafts. `PosRoutes` does the equivalent seeding for the
  // controlled screen before it ever mounts (rule 1).
  if (!session.active && beginsSession(state)) {
    session.activate(initialDrafts(state, store.order.totals.total), state === 'error');
  }
  return <ControlledSettlementScreen store={store} session={session} addRule={addRule} closeRule={closeRule} />;
}

/**
 * The controlled component (FE-019, review finding 1): takes its store and
 * its session as props and owns neither — no `suppliedSession ?? localSession`.
 * `PosRoutes` renders this directly, already having activated (or, rules
 * 9/10, deliberately not activated) the session it hands down.
 */
export function ControlledSettlementScreen({
  store,
  session,
  addRule = mayAddTender,
  closeRule = closeRefusal,
}: {
  store: OrderStore;
  session: PaymentSession;
  addRule?: typeof mayAddTender;
  closeRule?: typeof closeRefusal;
}) {
  const state = settlementStateFrom(window.location.search);
  const total = store.order.totals.total;
  const [method, setMethod] = useState<TenderMethod>(() => (CARD_SELECTED_STATES.has(state) ? 'card' : 'cash'));
  const drafts = session.drafts;
  const [cancelOpen, setCancelOpen] = useState(false);
  const { balance, change, tendered } = settlementPosition(
    total,
    drafts.map((draft) => draft.amount)
  );
  const [amountText, setAmountText] = useState(() => KEYED_SEED[state] ?? balance.toString());
  const [keyed, setKeyed] = useState(() => state in KEYED_SEED);
  const amount = amountText === '' ? 0n : BigInt(amountText);
  const mayAdd = addRule(method, amount, balance);
  const invalid = keyed && !mayAdd;
  // At zero balance nothing can be added by any method (rule 4), and the
  // field must draw exactly what exact/change already draw — no invalid
  // style, no message. `invalid` above still gates Add's inert state.
  const invalidDisplay = invalid && balance !== 0n;
  const pressed = state === 'pressed';
  const max = tenderMaximum(method, balance);
  const ceilingBound = cashCeilingBoundByChangeLimit(balance);

  const prefill = (nextBalance: Money) => {
    setAmountText(nextBalance.toString());
    setKeyed(false);
  };

  const chooseMethod = (next: TenderMethod) => {
    setMethod(next);
    prefill(balance);
  };

  const keyDigit = (digit: string) => {
    setAmountText((current) => (!keyed || current === '0' ? digit : `${current}${digit}`));
    setKeyed(true);
  };

  const deleteDigit = () => {
    setAmountText((current) => (keyed ? current.slice(0, -1) : ''));
    setKeyed(true);
  };

  const addDraft = () => {
    if (!addRule(method, amount, balance)) return;
    const next = [...drafts, { id: 'pending', label: methodLabel(method), amount }];
    const nextBalance = settlementPosition(
      total,
      next.map((draft) => draft.amount)
    ).balance;
    session.addDraft(methodLabel(method), amount);
    // Rule 8, finding 3: a corrected balance answers the rejection once and
    // for all — the session's `rejected` fact clears here, not by reading
    // `state === 'error'`, so a partial Add (still owing) leaves it standing
    // and it never comes back once a later Remove reopens the balance.
    if (nextBalance === 0n) session.clearRejection();
    prefill(nextBalance);
    window.history.replaceState(null, '', '/pos/settlement');
  };

  const removeDraft = (id: string) => {
    const next = drafts.filter((draft) => draft.id !== id);
    const nextBalance = settlementPosition(
      total,
      next.map((draft) => draft.amount)
    ).balance;
    session.removeDraft(id);
    prefill(nextBalance);
    window.history.replaceState(null, '', '/pos/settlement');
  };

  // Rule 5, I-5: ungated, no PIN, no manager. Rule 7: replaceState, not
  // pushState — the current settlement entry (whichever one it is) is
  // overwritten rather than kept, so browser Back from the unlocked POS-03
  // this lands on cannot walk forward again into a settlement screen showing
  // the discarded drafts. Session and location change in the same handler, so
  // React batches them: PosRoutes re-renders once, already reading the new
  // path off `window.location`.
  const cancelPayment = () => {
    window.history.replaceState(null, '', '/pos/order');
    session.cancel();
  };

  const leavePayment = () => window.history.back();

  // FE-027: Close. The store answers whether it closed (`closeOrder` owns every
  // refusal), so a refused press leaves the drafts and this screen exactly as they
  // were (B-20), and a double press closes once. The session ends with the close —
  // its drafts are now the order's tenders (FR-G9) — and the floor replaces this
  // entry, so Back cannot return to a settlement that is over. Nothing here
  // mentions a receipt: there is no printer, and a receipt never gates a close (B-15).
  const closeNow = () => {
    if (!store.close?.(new Date().toISOString(), drafts)) return;
    window.history.replaceState(null, '', '/pos/floor');
    session.cancel();
  };

  /**
   * Rule 9/10's two dead ends: neither carries a live session to end
   * (`beginsSession` never opened one for either), so there is nothing for a
   * state update to piggyback re-render on — PosRoutes' own popstate listener
   * is told directly, the same signal a real Back does.
   */
  const navigateAway = (destination: string) => {
    window.history.pushState(null, '', destination);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const keypad = (
    <div className="tender-keypad" aria-label="Tender amount keypad">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
        <button
          key={digit}
          type="button"
          className={pressed && digit === '5' ? 'tender-key is-pressed' : 'tender-key'}
          data-digit={digit}
          onClick={() => keyDigit(digit)}
        >
          {digit}
        </button>
      ))}
      <span className="tender-key tender-key--blank" aria-hidden="true" />
      <button type="button" className="tender-key" data-digit="0" onClick={() => keyDigit('0')}>
        0
      </button>
      <button type="button" className="tender-key" aria-label="Delete last digit" onClick={deleteDigit}>
        ←
      </button>
    </div>
  );

  const notice = tenderNotice({ method, keyed, mayAdd, balance, amount, max, ceilingBound });
  const caption = tenderCaption({ method, balance, amount, keyed, mayAdd, max, ceilingBound, total });
  const addReasonIds = [
    invalidDisplay && TENDER_MESSAGE_ID,
    notice && TENDER_NOTICE_ID,
  ].filter((id): id is string => typeof id === 'string');

  // Rule 1: whether the order may close, and why not, is this module's answer
  // alone — the component decides nothing about closing itself. Rule 4: the
  // trigger is the live order's total, never the `zero` state name, so a
  // table order emptied by hand on POS-03 draws the same composition
  // (criterion 6). `loading` is fixture-only (rule 9) and overrides every
  // live answer with its own inert "Closing…".
  const refusal: CloseRefusal | undefined = closeRule(store.order, { balance });
  const isZeroTotal = total === 0n;
  const pendingRefusal = refusal?.reason === 'pending' ? refusal : undefined;
  // Rule 8, finding 3: the rejection is a fact about this payment session
  // (`session.rejected`), never `state === 'error'` — a same-session partial
  // Add rewrites the URL to bare `/pos/settlement`, which must not silence a
  // notice whose balance is still owing. It shows only while a balance is
  // still owing — once the cashier covers it, it would be asserting a figure
  // that is no longer true, so `addDraft` clears the fact itself and Close
  // follows the usual rule.
  const showErrorNotice = session.rejected && balance > 0n;
  const isLoading = state === 'loading';
  // Rule 9/10: no Cancel payment behind either lease fixture. Rules 8–10: a
  // modal from any of the four is up, so the screen behind it goes inert
  // (React has no `inert` prop; the empty-string attribute renders bare, as
  // OrderScreen's own overlays do).
  const showCancelSection = state !== 'leaselost' && state !== 'settle-takeover';
  const overlayOpen = state === 'reauth' || state === 'leaselost' || state === 'settle-takeover' || cancelOpen;
  const inert = overlayOpen ? { inert: '' } : {};

  return (
    <>
      <div className="pos-device">
        <header className="settlement-bar" {...inert}>
          <button type="button" className="settlement-back" onClick={() => window.history.back()}>
            ← Order
          </button>
          <h1>Payment — {paymentTitle(store.order.title)}</h1>
          {/* Rule 4: a zero-total order records nothing, so nothing is "not yet recorded" either. */}
          {!isZeroTotal && <span className="settlement-tag">NOTHING RECORDED YET</span>}
          <div className="settlement-actor">
            {state === 'reauth' ? (
              <span className="settlement-tag">SIGNED OUT</span>
            ) : (
              <>
                <span>Ana R. · Cashier</span>
                <span className="settlement-idle">90s</span>
              </>
            )}
          </div>
        </header>

        <main className="settlement-screen" {...inert}>
          <section className="settlement-summary" aria-label="Payment summary">
            <div className="settlement-totals" aria-label="Order total">
              <TotalsView totals={store.order.totals} />
            </div>

          <div className="settlement-balance">
            <span>Balance</span>
            <strong className="settlement-balance__amount">{formatAmount(balance)}</strong>
          </div>

          {change > 0n && (
            <div className="settlement-change">
              <div className="settlement-change__row">
                <span>Change due</span>
                <strong className="settlement-change__amount">{formatAmount(change)}</strong>
              </div>
              <p className="settlement-change__note">
                Recorded revenue is the order total, {formatAmount(total)} — not the {formatAmount(tendered)} handed
                over.
              </p>
            </div>
          )}

          <div className="drafts-region">
            {/* rule 4, criterion 6: keyed on the live total, not the `zero` state name. */}
            {isZeroTotal && <ZeroCloseNotice />}
            {/* rule 5: where a zero total and a pending line meet, the pending notice sits below the zero one. */}
            {pendingRefusal && (
              <PendingCloseNotice lines={pendingRefusal.lines} drafts={drafts} onCancelPayment={() => setCancelOpen(true)} />
            )}
            {showErrorNotice && <ErrorCloseNotice total={total} balance={balance} />}
            {isLoading && <ClosingSkeleton />}
            {!isZeroTotal && (
              <>
                <div className="drafts-heading">
                  <span>Drafted payment lines</span>
                  <span className="settlement-tag">NOTHING RECORDED YET</span>
                </div>
                <div className="drafts-list">
                  {drafts.length === 0 ? (
                    <div className="drafts-empty">Nothing drafted yet</div>
                  ) : (
                    drafts.map((draft) => (
                      <div className="draft-tender" key={draft.id}>
                        <span className="draft-tender__method">{draft.label}</span>
                        <span className="draft-tender__amount">{formatAmount(draft.amount)}</span>
                        <button type="button" className="draft-tender__remove" onClick={() => removeDraft(draft.id)}>
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                  {change > 0n && (
                    <div className="draft-change">
                      <span className="draft-change__method">Change given</span>
                      <span className="draft-change__amount">−{formatAmount(change)}</span>
                    </div>
                  )}
                  {state === 'overflow' && (
                    <p className="drafts-scroll-note">List scrolls. Total, balance and close stay visible.</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Rule 5, I-5: ungated — no PIN, no manager, no approval. Rules 9/10: absent behind either lease fixture. */}
          {showCancelSection && (
            <div className="settlement-cancel">
              <button type="button" className="action action--compact" onClick={() => setCancelOpen(true)}>
                Cancel payment
              </button>
              <p className="settlement-cancel__note">Releases the order so it can be edited again. Nothing has been recorded here.</p>
            </div>
          )}
          </section>

          <section className="tender-entry" aria-label="Draft a payment">
          <div className="tender-methods" aria-label="Payment method">
            {(['cash', 'card'] as const).map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={[
                  'tender-method',
                  candidate === method && 'tender-method--selected',
                  pressed && candidate === 'cash' && 'is-pressed',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-method={candidate}
                aria-pressed={candidate === method}
                onClick={() => chooseMethod(candidate)}
              >
                {methodLabel(candidate)}
              </button>
            ))}
          </div>

          <div className="tender-entry__body">
            {/* rule 4, criterion 7: a zero-total order has nothing to tender — no field, no keypad, no Add. */}
            {isZeroTotal ? (
              <ZeroTenderEmpty />
            ) : (
              <>
                <div className="tender-control">
                  <div className="tender-field">
                    <div className="tender-field__heading">
                      <span className="tender-field__label">Amount</span>
                      <span className="settlement-tag">
                        {keyed
                          ? 'KEYED BY HAND'
                          : balance === 0n
                            ? 'FULLY ALLOCATED'
                            : 'ALREADY FILLED IN — WHOLE BALANCE'}
                      </span>
                    </div>
                    <div
                      className={
                        invalidDisplay
                          ? 'tender-amount tender-amount--invalid'
                          : keyed
                            ? 'tender-amount tender-amount--keyed'
                            : 'tender-amount'
                      }
                    >
                      {formatAmount(amount)}
                    </div>
                    {invalidDisplay && (
                      <span className="tender-field__message" id={TENDER_MESSAGE_ID}>
                        {methodLabel(method)} maximum {formatAmount(max)}
                      </span>
                    )}
                  </div>
                  {mayAdd ? (
                    <button
                      type="button"
                      className={pressed ? 'tender-add is-pressed' : 'tender-add'}
                      data-action="add-tender"
                      onClick={addDraft}
                    >
                      Add {methodLabel(method).toLowerCase()}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="tender-add tender-add--off"
                      data-action="add-tender"
                      aria-disabled="true"
                      aria-describedby={addReasonIds.length > 0 ? addReasonIds.join(' ') : undefined}
                      onClick={() => {}}
                    >
                      {balance === 0n ? 'Nothing left' : invalid ? 'Over the limit — cannot add' : 'Cannot add'}
                    </button>
                  )}
                </div>

                {/* DESIGN-006: in a refusal the keypad sits beside the notice, so the Delete row is never pushed under Close. */}
                {notice ? (
                  <div className="tender-refusal">
                    {keypad}
                    <div className="tender-guidance">
                      <div className="notice" id={TENDER_NOTICE_ID}>
                        <div className="notice__title">{notice.title}</div>
                        <div>{notice.body}</div>
                      </div>
                      {caption && (
                        <p className="tender-help">{caption}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {caption && <p className="tender-help">{caption}</p>}
                    {keypad}
                  </>
                )}
              </>
            )}
          </div>

          <footer className="settlement-close">
            {/* Rule 8: reauth overrides whatever the live refusal rule would otherwise say — signing in comes first. */}
            {state === 'reauth' ? (
              <button type="button" className="settlement-close__action" data-action="close-order" onClick={() => {}}>
                Sign in to close
              </button>
            ) : isLoading ? (
              <button
                type="button"
                className="settlement-close__action settlement-close__action--off"
                data-action="close-order"
                aria-disabled="true"
                onClick={() => {}}
              >
                Closing…
              </button>
            ) : refusal === undefined ? (
              <button type="button" className="settlement-close__action" data-action="close-order" onClick={closeNow}>
                Close order & print receipt
              </button>
            ) : (
              <button
                type="button"
                className="settlement-close__action settlement-close__action--off"
                data-action="close-order"
                aria-disabled="true"
                onClick={() => {}}
                {...(refusal.reason === 'pending' && { 'aria-describedby': PENDING_NOTICE_ID })}
              >
                {refusal.reason === 'pending' ? 'Close order & print receipt' : 'Close order — balance outstanding'}
              </button>
            )}
          </footer>
          </section>
        </main>
        {/* Inside the device, not beside it: the modal centres on the 800px frame, as the artifact's does, so its footer cannot fall below it. */}
        {state === 'settle-takeover' && <TakeoverModal onCancel={() => navigateAway('/pos/order?state=lock-lease')} />}
      </div>
      {state === 'reauth' && <ReauthModal onLeave={leavePayment} />}
      {state === 'leaselost' && <LeaseLostModal onBackToFloor={() => navigateAway('/pos/floor')} />}
      {cancelOpen && (
        <CancelPaymentModal drafts={drafts} change={change} onKeep={() => setCancelOpen(false)} onCancel={cancelPayment} />
      )}
      {import.meta.env.DEV && <SettlementFixtureStates current={state} />}
    </>
  );
}

function SettlementFixtureStates({ current }: { current: SettlementState }) {
  return (
    <nav className="fixture-states" aria-label="Settlement fixture states">
      {SETTLEMENT_STATES.map((state) => (
        <a
          key={state}
          href={`/pos/settlement?state=${state}`}
          aria-current={state === current ? 'page' : undefined}
        >
          {state}
        </a>
      ))}
    </nav>
  );
}

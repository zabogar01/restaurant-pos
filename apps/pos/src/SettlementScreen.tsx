import type { Money } from '@pos/money';
import { useRef, useState } from 'react';
import { closeRefusal, type CloseRefusal } from './close.js';
import { formatAmount } from './money.js';
import { TotalsView } from './OrderPanel.js';
import type { OrderStore } from './orderStore.js';
import { cashCeilingBoundByChangeLimit, mayAddTender, settlementPosition, tenderMaximum, type TenderMethod } from './tender.js';

const SETTLEMENT_STATES = [
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
  'exactcash',
  'exactsplit',
  'pending',
  'zero',
  'loading',
  'error',
] as const;
export type SettlementState = (typeof SETTLEMENT_STATES)[number];

type DraftTender = { id: string; label: string; amount: Money };

/** A keyed-by-hand amount that a direct fixture visit seeds before any Add. */
const KEYED_SEED: Partial<Record<SettlementState, string>> = {
  cardsplit: '100000',
  cashover: '200000',
  cardover: '200000',
  ceiling: '99999999',
};

const CARD_SELECTED_STATES: ReadonlySet<SettlementState> = new Set(['card', 'cardsplit', 'cardover']);

export function settlementStateFrom(search: string): SettlementState {
  const state = new URLSearchParams(search).get('state');
  return SETTLEMENT_STATES.find((candidate) => candidate === state) ?? 'empty';
}

function initialDrafts(state: SettlementState, total: Money): ReadonlyArray<DraftTender> {
  const card = (id: string, amount: Money) => ({ id, label: 'Card', amount });
  const cash = (id: string, amount: Money) => ({ id, label: 'Cash', amount });

  if (state === 'partial') return [card('fixture-card', 100_000n)];
  if (state === 'exact') return [card('fixture-card', total)];
  if (state === 'exactcash') return [cash('fixture-cash', total)];
  if (state === 'exactsplit') return [card('fixture-card', 100_000n), cash('fixture-cash', total - 100_000n)];
  if (state === 'change') return [cash('fixture-cash', 200_000n)];
  if (state === 'ceiling') return [card('fixture-card', 100_000n)];
  // `loading` and `error` both draft the artifact's own Card 155.925 — a
  // fixture figure, fixed regardless of what the live order totals to. It is
  // the number `error`'s balance (rule 8) is derived *against*: the seeded
  // draft never moves, only the balance the order's live total leaves.
  if (state === 'loading' || state === 'error') return [card('fixture-card', 155_925n)];
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
    // The single-tender cap binds instead of the change limit (lead ruling: no
    // composition drawn for this case). Both the notice and this caption talk
    // about change, which would be false here, so neither is drawn.
    return null;
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

/** The notice block above the field. Only card-over and change-limit-bound cash draw one. */
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

  if (ceilingBound) {
    return {
      title: 'Too much cash to give change for',
      body: (
        <>
          The most cash this sale can accept is <b>{formatAmount(max)}</b> — the {formatAmount(balance)} still owing
          plus the 9.999.999 change limit. Nothing has been recorded and the drafted payment lines are unchanged.
        </>
      ),
    };
  }

  return null;
}

const PENDING_NOTICE_ID = 'close-pending-notice';

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
 * The pending-close notice (FR-G10, rule 7), copied from the artifact's
 * singular sentence and pluralised the way `fireRefusal` (fire.ts) pluralises
 * its own — the artifact never drew two blocking lines either, so both
 * plurals are PROVISIONAL COPY for a designer, exactly as fire.ts's is.
 * *Back to the order* behaves exactly like the bar's own `← Order`.
 */
function PendingCloseNotice({ lines }: { lines: ReadonlyArray<{ name: string }> }) {
  const one = lines.length === 1;
  return (
    <div className="notice" id={PENDING_NOTICE_ID}>
      <div className="notice__title">
        Cannot close — {lines.length} item{one ? '' : 's'} {one ? 'has' : 'have'} not been sent to the kitchen
      </div>
      <div>
        {boldNames(lines.map((l) => l.name))} {one ? 'is' : 'are'} still pending. Send {one ? 'it' : 'them'} or void{' '}
        {one ? 'it' : 'them'} first — which means leaving this payment, because a draft blocks both.{' '}
        <button type="button" className="settlement-back" onClick={() => window.history.back()}>
          Back to the order
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
  const total = store.order.totals.total;
  const [method, setMethod] = useState<TenderMethod>(() => (CARD_SELECTED_STATES.has(state) ? 'card' : 'cash'));
  const [drafts, setDrafts] = useState<ReadonlyArray<DraftTender>>(() => initialDrafts(state, total));
  const { balance, change, tendered } = settlementPosition(
    total,
    drafts.map((draft) => draft.amount)
  );
  const [amountText, setAmountText] = useState(() => KEYED_SEED[state] ?? balance.toString());
  const [keyed, setKeyed] = useState(() => state in KEYED_SEED);
  const nextDraft = useRef(0);
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
    const next = [...drafts, { id: `draft-${++nextDraft.current}`, label: methodLabel(method), amount }];
    const nextBalance = settlementPosition(
      total,
      next.map((draft) => draft.amount)
    ).balance;
    setDrafts(next);
    prefill(nextBalance);
    window.history.replaceState(null, '', '/pos/settlement');
  };

  const removeDraft = (id: string) => {
    const next = drafts.filter((draft) => draft.id !== id);
    const nextBalance = settlementPosition(
      total,
      next.map((draft) => draft.amount)
    ).balance;
    setDrafts(next);
    prefill(nextBalance);
    window.history.replaceState(null, '', '/pos/settlement');
  };

  const notice = tenderNotice({ method, keyed, mayAdd, balance, amount, max, ceilingBound });
  const caption = tenderCaption({ method, balance, amount, keyed, mayAdd, max, ceilingBound, total });

  // Rule 1: whether the order may close, and why not, is this module's answer
  // alone — the component decides nothing about closing itself. Rule 4: the
  // trigger is the live order's total, never the `zero` state name, so a
  // table order emptied by hand on POS-03 draws the same composition
  // (criterion 6). `loading` is fixture-only (rule 9) and overrides every
  // live answer with its own inert "Closing…".
  const refusal: CloseRefusal | undefined = closeRule(store.order, { balance });
  const isZeroTotal = total === 0n;
  const pendingRefusal = refusal?.reason === 'pending' ? refusal : undefined;
  // Rule 8's ruling: the rejected-close notice shows only while a balance is
  // still owing — once the cashier covers it, it would be asserting a figure
  // that is no longer true, so it goes and Close follows the usual rule.
  const showErrorNotice = state === 'error' && balance > 0n;
  const isLoading = state === 'loading';

  return (
    <>
      <div className="pos-device">
        <header className="settlement-bar">
          <button type="button" className="settlement-back" onClick={() => window.history.back()}>
            ← Order
          </button>
          <h1>Payment — {paymentTitle(store.order.title)}</h1>
          {/* Rule 4: a zero-total order records nothing, so nothing is "not yet recorded" either. */}
          {!isZeroTotal && <span className="settlement-tag">NOTHING RECORDED YET</span>}
          <div className="settlement-actor">
            <span>Ana R. · Cashier</span>
            <span className="settlement-idle">90s</span>
          </div>
        </header>

        <main className="settlement-screen">
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
            {pendingRefusal && <PendingCloseNotice lines={pendingRefusal.lines} />}
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
                {notice && (
                  <div className="notice">
                    <div className="notice__title">{notice.title}</div>
                    <div>{notice.body}</div>
                  </div>
                )}

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
                      <span className="tender-field__message">
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
                    <span className="tender-add tender-add--off" data-action="add-tender" aria-disabled="true">
                      {balance === 0n ? 'Nothing left' : invalid ? 'Over the limit — cannot add' : 'Cannot add'}
                    </span>
                  )}
                </div>

                {caption && <p className="tender-help">{caption}</p>}

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
              </>
            )}
          </div>

          <footer className="settlement-close">
            {isLoading ? (
              <span className="settlement-close__action settlement-close__action--off" data-action="close-order" aria-disabled="true">
                Closing…
              </span>
            ) : refusal === undefined ? (
              <button type="button" className="settlement-close__action" data-action="close-order">
                Close order & print receipt
              </button>
            ) : (
              <span
                className="settlement-close__action settlement-close__action--off"
                data-action="close-order"
                aria-disabled="true"
                {...(refusal.reason === 'pending' && { 'aria-describedby': PENDING_NOTICE_ID })}
              >
                {refusal.reason === 'pending' ? 'Close order & print receipt' : 'Close order — balance outstanding'}
              </span>
            )}
          </footer>
          </section>
        </main>
      </div>
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

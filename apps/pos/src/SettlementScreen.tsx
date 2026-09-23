import type { Money } from '@pos/money';
import { useRef, useState } from 'react';
import { formatAmount } from './money.js';
import { TotalsView } from './OrderPanel.js';
import type { OrderStore } from './orderStore.js';
import { mayAddTender, type TenderMethod } from './tender.js';

const SETTLEMENT_STATES = ['empty', 'pressed', 'partial', 'exact', 'overflow'] as const;
export type SettlementState = (typeof SETTLEMENT_STATES)[number];

type DraftTender = { id: string; label: string; amount: Money };

export function settlementStateFrom(search: string): SettlementState {
  const state = new URLSearchParams(search).get('state');
  return SETTLEMENT_STATES.find((candidate) => candidate === state) ?? 'empty';
}

function initialDrafts(state: SettlementState, total: Money): ReadonlyArray<DraftTender> {
  if (state === 'partial') return [{ id: 'fixture-card', label: 'Card', amount: 100_000n }];
  if (state === 'exact') return [{ id: 'fixture-card', label: 'Card', amount: total }];
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
const draftedTotal = (drafts: ReadonlyArray<DraftTender>) => drafts.reduce((sum, draft) => sum + draft.amount, 0n);
const paymentTitle = (title: string) => title.replace(/^Order · T(\d+)$/, 'Table $1').replace(/^Order · /, '');

export function SettlementScreen({
  store,
  addRule = mayAddTender,
}: {
  store: OrderStore;
  /** Test seam for proving the component has no second tender-validity rule. */
  addRule?: typeof mayAddTender;
}) {
  const state = settlementStateFrom(window.location.search);
  const total = store.order.totals.total;
  const [method, setMethod] = useState<TenderMethod>('cash');
  const [drafts, setDrafts] = useState<ReadonlyArray<DraftTender>>(() => initialDrafts(state, total));
  const balance = total - draftedTotal(drafts);
  const [amountText, setAmountText] = useState(() => balance.toString());
  const [keyed, setKeyed] = useState(false);
  const nextDraft = useRef(0);
  const amount = amountText === '' ? 0n : BigInt(amountText);
  const mayAdd = addRule(method, amount, balance);
  const invalid = keyed && !mayAdd;
  const pressed = state === 'pressed';

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
    const nextBalance = total - draftedTotal(next);
    setDrafts(next);
    prefill(nextBalance);
    window.history.replaceState(null, '', `?state=${nextBalance === 0n ? 'exact' : 'partial'}`);
  };

  const removeDraft = (id: string) => {
    const next = drafts.filter((draft) => draft.id !== id);
    setDrafts(next);
    prefill(total - draftedTotal(next));
    window.history.replaceState(null, '', `?state=${next.length === 0 ? 'empty' : 'partial'}`);
  };

  return (
    <>
      <div className="pos-device">
        <header className="settlement-bar">
          <button type="button" className="settlement-back" onClick={() => window.history.back()}>
            ← Order
          </button>
          <h1>Payment — {paymentTitle(store.order.title)}</h1>
          <span className="settlement-tag">NOTHING RECORDED YET</span>
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

          <div className="drafts-region">
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
              {state === 'overflow' && <p className="drafts-scroll-note">List scrolls. Total, balance and close stay visible.</p>}
            </div>
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
            <div className="tender-control">
              <div className="tender-field">
                <div className="tender-field__heading">
                  <span className="tender-field__label">Amount</span>
                  <span className="settlement-tag">
                    {keyed ? 'KEYED BY HAND' : balance === 0n ? 'FULLY ALLOCATED' : 'ALREADY FILLED IN — WHOLE BALANCE'}
                  </span>
                </div>
                <div
                  className={
                    invalid
                      ? 'tender-amount tender-amount--invalid'
                      : keyed
                        ? 'tender-amount tender-amount--keyed'
                        : 'tender-amount'
                  }
                >
                  {formatAmount(amount)}
                </div>
                {invalid && (
                  <span className="tender-field__message">This {methodLabel(method).toLowerCase()} amount cannot be added.</span>
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
                  {balance === 0n ? 'Nothing left' : 'Cannot add'}
                </span>
              )}
            </div>

            <p className="tender-help">
              The whole balance, already filled in. Key a smaller amount to split the bill; whatever is left stays on the balance.
            </p>

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
          </div>

          <footer className="settlement-close">
            {balance === 0n ? (
              <button type="button" className="settlement-close__action" data-action="close-order">
                Close order & print receipt
              </button>
            ) : (
              <span className="settlement-close__action settlement-close__action--off" data-action="close-order" aria-disabled="true">
                Close order — balance outstanding
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

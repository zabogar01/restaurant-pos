import { useEffect, useRef, useState } from 'react';
import { cashContribution } from './closedOrders.js';
import {
  DETAIL_COPY as COPY,
  DETAIL_STATES,
  bookDetail,
  chargedHead,
  detailRequestFrom,
  fixtureDetail,
  noticesFor,
  note,
  refundable,
  reprintResultOf,
  type ClosedDetail,
  type DetailNotice,
  type FixtureRefund,
  type RefundOutcome,
  type ReprintResult,
  type ScreenState,
} from './closedOrderDetail.js';
import { FLOOR_COPY } from './floorFixtures.js';
import { formatAmount } from './money.js';
import { followClientSide } from './navigation.js';
import { modifierText } from './OrderPanel.js';
import type { OrderBook } from './orderStore.js';
import type { RefundRefusal } from './refund.js';
import { REFUND_COPY, REFUND_STATES, startingDraft, startingFlow, type Draft, type Flow } from './refundDraft.js';
import { RefundApproval, RefundSheet } from './RefundSheet.js';

// POS-06, the closed order a POS-05 row leads to (FE-031, FE-032): what was
// charged and the original payment, never a receipt (B-8, ruling I-1), and the
// one place a closed order is refunded, whole and once (FR-H5, FR-H6).
//
// The refund is a command, never a status. The screen hands the book the order's
// id, the allocations and the reason, and then draws the order from the book; it
// keeps no `refunded` flag of its own for a book order. A fixture address
// (anything with a `state`) is the artifact's picture: confirming one shows the
// REFUNDED composition in screen state and writes nothing (rule 13). No void
// control (B-19), and no Release (FR-A).
//
// A reprint creates no incident and writes nothing: the client has no print job
// to follow. *Reprint sent* claims no time and no print (FR-G7, B-16), and
// leaves every other notice on the screen as it was.

/** The refusals a correctly built sheet cannot reach on a book order: the request itself was wrong, so the draft is kept for a new attempt (rule 12). */
const REQUEST_REFUSALS: ReadonlyArray<RefundRefusal> = ['no-reason', 'not-a-tender', 'invalid-amount', 'sum-mismatch'];

type Outcome = { kind: 'failed'; draft?: Draft } | { kind: 'day-refused' };

export function ClosedOrderScreen({ search, book }: { search: string; book: OrderBook }) {
  const request = detailRequestFrom(search);
  const fixture = request.source === 'fixture';
  const [state, setState] = useState<ScreenState>(request.source === 'fixture' ? request.state : 'default');
  const [result, setResult] = useState<ReprintResult | undefined>(() => reprintResultOf(state));
  // Retry reads the book again: the book is read on every render, so a retry only has to render.
  const [, reread] = useState(0);
  // Whether the business day is closed for this order: the picture's fact, or a refusal's.
  const [closedDay, setClosedDay] = useState(request.source === 'fixture' && (request.state === 'dayclosed' || request.state === 'day-refusal'));
  // A refund the cashier approved on a fixture address. Screen state; a book order has none.
  const [confirmed, setConfirmed] = useState<FixtureRefund>();

  // What each fixture state pictures, read once: the edit, the reason, the overlay open.
  const [starting] = useState(() => {
    if (request.source !== 'fixture') return undefined;
    const picture = fixtureDetail(request, { closedDay: request.state === 'dayclosed' || request.state === 'day-refusal' });
    return startingFlow(request.state, picture.tenders, picture.total, refundable(picture));
  });
  // One owner for the overlay: the sheet with its draft and panel, or the approval with the draft it authorises.
  const [flow, setFlow] = useState<Flow | undefined>(() =>
    starting?.overlay === 'sheet'
      ? { kind: 'sheet', draft: starting.draft, panel: starting.panel }
      : starting?.overlay === 'approval'
        ? { kind: 'approval', draft: starting.draft }
        : undefined
  );
  // What the last attempt left: a failure (with the draft kept for *Review refund*) or the day's refusal.
  const [outcome, setOutcome] = useState<Outcome | undefined>(() =>
    starting?.failed ? { kind: 'failed', draft: starting.draft } : starting?.dayRefused ? { kind: 'day-refused' } : undefined
  );
  // The control that opened the overlay takes focus back when it closes.
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (flow || !opener.current) return;
    if (opener.current.isConnected) opener.current.focus();
    opener.current = null;
  }, [flow]);

  // A fixture address is the artifact's picture. A book address is read from the book alone,
  // and one it does not hold is the `error` composition, never a fixture's order.
  const base: ClosedDetail | undefined =
    request.source === 'book'
      ? bookDetail(book, request.id)
      : state === 'loading' || state === 'error'
        ? undefined
        : fixtureDetail(request, { closedDay, ...(confirmed && { confirmed }) });
  const detail = base && request.source === 'book' && closedDay ? { ...base, closedDay: true } : base;
  const shown = request.source === 'book' ? (detail ? 'default' : 'error') : state;

  const toClosedDay = closedDay || (fixture && request.newDay);
  const back = toClosedDay ? '/pos/closed-orders?state=dayclosed' : '/pos/closed-orders';

  const retry = () => (fixture ? setState('default') : reread((n) => n + 1));

  const offer = (kept: Draft | undefined, from: HTMLElement) => {
    if (!detail) return;
    opener.current = from;
    setFlow({ kind: 'sheet', draft: kept ?? startingDraft(detail.tenders, detail.total), panel: { kind: 'list' } });
  };

  // The approval authorises the draft it was mounted with (B-14); nothing is written until it is confirmed.
  function confirm() {
    if (flow?.kind !== 'approval' || !detail) return;
    const { draft } = flow;
    // Confirm stands for the server accepting the protected command. The digits are
    // never read, compared, kept or passed on, and nothing is verified here: six
    // digits is input completeness, not a credential check (B-12, O5).
    if (request.source === 'fixture') {
      setConfirmed(draft);
      setState('refunded');
      setFlow(undefined);
      setOutcome(undefined);
      return;
    }
    // The command: the order, the allocations above zero (O3) and the reason. The order's status is the book's answer, never set here.
    const answer = book.refund(
      request.id,
      { allocations: draft.amounts.flatMap((amount, position) => (amount > 0n ? [{ position, amount }] : [])), reason: draft.reason },
      new Date().toISOString()
    );
    setFlow(undefined);
    if (!answer.refused) setOutcome(undefined);
    else if (answer.refused === 'day-closed') {
      setClosedDay(true);
      setOutcome({ kind: 'day-refused' });
    } else setOutcome({ kind: 'failed', ...(REQUEST_REFUSALS.includes(answer.refused) && { draft }) });
  }

  const onAction = (id: 'review-refund' | 'return-to-order', from: HTMLElement) => {
    if (id === 'review-refund') {
      if (outcome?.kind === 'failed') offer(outcome.draft, from);
      return;
    }
    // The standing closed-day picture, never a retry (B-9, FR-H7).
    setOutcome(undefined);
    if (fixture) setState('dayclosed');
  };

  const refundOutcome: RefundOutcome | undefined = !outcome ? undefined : outcome.kind === 'day-refused' ? 'day-refused' : outcome.draft ? 'failed' : 'failed-final';
  const dim = flow ? { inert: '' } : {};

  return (
    <>
      <div className="pos-device closed closed-order" data-closed-state={shown}>
        <header className="closed-head" {...dim}>
          <a className="closed-back" href={back} onClick={(e) => followClientSide(e, back)}>
            {COPY.back}
          </a>
          <h1>{detail ? detail.name : COPY.unavailableTitle}</h1>
          {detail && <span className="closed-tag">{detail.refund ? COPY.refundedTag : COPY.closedTag}</span>}
          <div className="floor-actor">
            <span>{FLOOR_COPY.actor}</span>
            <span className="floor-idle">{FLOOR_COPY.idle}</span>
          </div>
        </header>
        {detail ? (
          <Body
            detail={detail}
            result={result}
            outcome={refundOutcome}
            dim={dim}
            onReprint={() => setResult('reprint-sent')}
            onRefund={(from) => offer(undefined, from)}
            onAction={onAction}
          />
        ) : (
          <Unavailable loading={shown === 'loading'} onRetry={retry} />
        )}
        {detail && flow?.kind === 'sheet' && (
          <RefundSheet
            tenders={detail.tenders}
            total={detail.total}
            sheet={flow}
            onChange={(next) => setFlow({ kind: 'sheet', ...next })}
            onCancel={() => setFlow(undefined)}
            onContinue={() => setFlow({ kind: 'approval', draft: flow.draft })}
          />
        )}
        {detail && flow?.kind === 'approval' && (
          <RefundApproval
            name={detail.name}
            tenders={detail.tenders}
            total={detail.total}
            draft={flow.draft}
            onSubmit={confirm}
            onCancel={() => setFlow({ kind: 'sheet', draft: flow.draft, panel: { kind: 'list' } })}
          />
        )}
      </div>
      {import.meta.env.DEV && (
        <>
          <nav className="fixture-states" aria-label="Fixture states">
            {DETAIL_STATES.map((s) => (
              <a key={s.id} href={`?state=${s.id}`} aria-current={fixture && s.id === request.state ? 'page' : undefined}>
                {s.label}
              </a>
            ))}
          </nav>
          <nav className="refund-states" aria-label="Refund fixture states">
            {REFUND_STATES.map((s) => (
              <a key={s.id} href={`?state=${s.id}`} aria-current={fixture && s.id === request.state ? 'page' : undefined}>
                {s.label}
              </a>
            ))}
          </nav>
        </>
      )}
    </>
  );
}

function Unavailable({ loading, onRetry }: { loading: boolean; onRetry: () => void }) {
  const message = loading ? COPY.loading : COPY.error;
  return (
    <div className="closed-empty" aria-live={loading ? 'polite' : undefined}>
      <h2>{message.title}</h2>
      <p>{message.body}</p>
      {!loading && (
        <button type="button" className="closed-button" data-action="retry-load" onClick={onRetry}>
          {COPY.error.action}
        </button>
      )}
    </div>
  );
}

function Notice({ notice, onAction }: { notice: DetailNotice; onAction: (id: 'review-refund' | 'return-to-order', from: HTMLElement) => void }) {
  return (
    <div className={notice.warn ? 'closed-notice' : 'closed-notice closed-notice--plain'} role="status" data-notice={notice.key}>
      <strong>{notice.title}</strong>
      {(notice.body || notice.link || notice.action) && (
        <p>
          {notice.body}
          {notice.link && (
            <>
              {' '}
              <a className="closed-button" href={notice.link.href} onClick={(e) => followClientSide(e, notice.link!.href)}>
                {notice.link.label}
              </a>
            </>
          )}
          {notice.action && (
            <>
              {' '}
              <button type="button" className="closed-button" data-action={notice.action.id} onClick={(e) => onAction(notice.action!.id, e.currentTarget)}>
                {notice.action.label}
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}

function Body({
  detail,
  result,
  outcome,
  dim,
  onReprint,
  onRefund,
  onAction,
}: {
  detail: ClosedDetail;
  result: ReprintResult | undefined;
  outcome: RefundOutcome | undefined;
  dim: { inert?: string };
  onReprint: () => void;
  onRefund: (from: HTMLElement) => void;
  onAction: (id: 'review-refund' | 'return-to-order', from: HTMLElement) => void;
}) {
  const { figures } = detail;
  // Where a refund is not offered the control is absent, never disabled (FR-H5b, ruling C-1), and a note says why.
  const offered = refundable(detail);
  const why = detail.zero ? COPY.why.zero : detail.refund ? COPY.why.refunded : detail.closedDay ? COPY.why.dayclosed : undefined;
  return (
    <div className="closed-body" {...dim}>
      {/* Nothing in this column takes a z-index: a sticky or stacked head would paint over a sheet (FE-030 round 1). */}
      <div className="closed-scroll closed-content" tabIndex={0} role="region" aria-label={COPY.contentLabel}>
        <div className="closed-note">{note(detail.time, detail.day)}</div>
        {noticesFor(detail, result, outcome).map((n) => (
          <Notice key={n.key} notice={n} onAction={onAction} />
        ))}
        <div className="closed-group">{chargedHead(detail.lines.length)}</div>
        {detail.lines.map((line) => (
          <div className="closed-line" key={line.key}>
            <span className="closed-quantity">{line.quantity}</span>
            <div>
              {line.name}
              {line.modifiers && <span className="closed-muted">{line.modifiers.map(modifierText).join(' · ')}</span>}
            </div>
            <span>{formatAmount(line.amount)}</span>
          </div>
        ))}
        <div className="closed-group">{COPY.payment}</div>
        {detail.zero && <div className="closed-line">{COPY.noPayment}</div>}
        {detail.tenders.map((t, i) => (
          <div className="closed-line" key={i}>
            <span>{t.label}</span>
            <span>{formatAmount(t.amount)}</span>
          </div>
        ))}
        {detail.change > 0n && (
          <>
            <div className="closed-line">
              <span>{COPY.changeGiven}</span>
              <span>{formatAmount(-detail.change)}</span>
            </div>
            <div className="closed-line">
              <span>{COPY.cashContribution}</span>
              <span>{formatAmount(cashContribution(detail.tenders, detail.change))}</span>
            </div>
          </>
        )}
        {detail.refund && (
          <>
            <div className="closed-group">{COPY.returned}</div>
            {detail.refund.returned.map((t, i) => (
              <div className="closed-line" key={i}>
                <span>{t.label}</span>
                <span>{formatAmount(t.amount)}</span>
              </div>
            ))}
          </>
        )}
      </div>
      <aside className="closed-summary" aria-label={COPY.summary}>
        <div className="closed-figures">
          <h2>{COPY.summary}</h2>
          <dl>
            <Figure label={COPY.subtotal} value={formatAmount(figures.subtotal)} />
            {figures.discount && <Figure label={figures.discount.label} value={formatAmount(figures.discount.amount)} />}
            {figures.service && <Figure label={figures.service.label} value={formatAmount(figures.service.amount)} />}
            <Figure label={COPY.total} value={formatAmount(figures.total)} grand />
          </dl>
          <p className="closed-muted">{COPY.stored}</p>
        </div>
        <div className="closed-actions">
          <button type="button" className="closed-button closed-button--large" data-action="reprint" onClick={onReprint}>
            {COPY.reprint}
          </button>
          {offered && (
            <button
              type="button"
              className="closed-button closed-button--large closed-button--destructive"
              data-action="refund"
              onClick={(e) => onRefund(e.currentTarget)}
            >
              {REFUND_COPY.refund}
            </button>
          )}
          {why && <p className="closed-muted">{why}</p>}
        </div>
      </aside>
    </div>
  );
}

function Figure({ label, value, grand }: { label: string; value: string; grand?: boolean }) {
  return (
    <div className={grand ? 'closed-totalrow closed-grand' : 'closed-totalrow'}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

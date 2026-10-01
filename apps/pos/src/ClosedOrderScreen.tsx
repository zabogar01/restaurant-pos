import { useState } from 'react';
import { cashContribution } from './closedOrders.js';
import {
  DETAIL_COPY as COPY,
  DETAIL_STATES,
  bookDetail,
  chargedHead,
  detailRequestFrom,
  fixtureDetail,
  moneyReturned,
  noticesFor,
  note,
  reprintResultOf,
  type ClosedDetail,
  type DetailNotice,
  type DetailState,
  type ReprintResult,
} from './closedOrderDetail.js';
import { FLOOR_COPY } from './floorFixtures.js';
import { formatAmount } from './money.js';
import { followClientSide } from './navigation.js';
import { modifierText } from './OrderPanel.js';
import type { OrderBook } from './orderStore.js';

// POS-06, the closed order a POS-05 row leads to (FE-031). Read-only: what was
// charged and the original payment, never a receipt (B-8, ruling I-1). Nothing
// here changes the book or any order, so there is no Refund control in any state
// (FE-032 adds it), no void control (B-19), and no Release (FR-A). The three
// reasons a refund is not offered are drawn as the artifact has them.
//
// A reprint creates no incident and writes nothing: the client has no print job
// to follow. *Reprint sent* claims no time and no print (FR-G7, B-16), and
// leaves every other notice on the screen as it was.

export function ClosedOrderScreen({ search, book }: { search: string; book: OrderBook }) {
  const request = detailRequestFrom(search);
  const [state, setState] = useState<DetailState>(request.source === 'fixture' ? request.state : 'default');
  const [result, setResult] = useState<ReprintResult | undefined>(() => reprintResultOf(state));
  // Retry reads the book again: the book is read on every render, so a retry only has to render.
  const [, reread] = useState(0);

  // A fixture address is the artifact's picture. A book address is read from the book alone,
  // and one it does not hold is the `error` composition, never a fixture's order.
  const fixture = request.source === 'fixture';
  const detail: ClosedDetail | undefined =
    request.source === 'book' ? bookDetail(book, request.id) : state === 'loading' || state === 'error' ? undefined : fixtureDetail(request);
  const shown = request.source === 'book' ? (detail ? 'default' : 'error') : state;

  const toClosedDay = fixture && (state === 'dayclosed' || request.newDay);
  const back = toClosedDay ? '/pos/closed-orders?state=dayclosed' : '/pos/closed-orders';

  const retry = () => (fixture ? setState('default') : reread((n) => n + 1));

  return (
    <>
      <div className="pos-device closed closed-order" data-closed-state={shown}>
        <header className="closed-head">
          <a className="closed-back" href={back} onClick={(e) => followClientSide(e, back)}>
            {COPY.back}
          </a>
          <h1>{detail ? detail.name : COPY.unavailableTitle}</h1>
          {detail && <span className="closed-tag">{detail.refunded ? COPY.refundedTag : COPY.closedTag}</span>}
          <div className="floor-actor">
            <span>{FLOOR_COPY.actor}</span>
            <span className="floor-idle">{FLOOR_COPY.idle}</span>
          </div>
        </header>
        {detail ? (
          <Body detail={detail} result={result} onReprint={() => setResult('reprint-sent')} />
        ) : (
          <Unavailable loading={shown === 'loading'} onRetry={retry} />
        )}
      </div>
      {import.meta.env.DEV && (
        <nav className="fixture-states" aria-label="Fixture states">
          {DETAIL_STATES.map((s) => (
            <a key={s.id} href={`?state=${s.id}`} aria-current={fixture && s.id === request.state ? 'page' : undefined}>
              {s.label}
            </a>
          ))}
        </nav>
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

function Notice({ notice }: { notice: DetailNotice }) {
  return (
    <div className={notice.warn ? 'closed-notice' : 'closed-notice closed-notice--plain'} role="status" data-notice={notice.key}>
      <strong>{notice.title}</strong>
      {(notice.body || notice.link) && (
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
        </p>
      )}
    </div>
  );
}

function Body({ detail, result, onReprint }: { detail: ClosedDetail; result: ReprintResult | undefined; onReprint: () => void }) {
  const { figures } = detail;
  const why = detail.zero ? COPY.why.zero : detail.refunded ? COPY.why.refunded : detail.closedDay ? COPY.why.dayclosed : undefined;
  return (
    <div className="closed-body">
      {/* Nothing in this column takes a z-index: a sticky or stacked head would paint over a sheet (FE-030 round 1). */}
      <div className="closed-scroll closed-content" tabIndex={0} role="region" aria-label={COPY.contentLabel}>
        <div className="closed-note">{note(detail.time, detail.day)}</div>
        {noticesFor(detail, result).map((n) => (
          <Notice key={n.key} notice={n} />
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
        {detail.refunded && (
          <>
            <div className="closed-group">{COPY.returned}</div>
            {moneyReturned(detail.tenders, detail.change).map((t, i) => (
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

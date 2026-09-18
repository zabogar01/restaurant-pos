import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ApprovalPrompt } from './Approval.js';
import { APPROVAL_FIXTURES } from './approvalFixtures.js';
import { DISCOUNT_FIXTURES } from './discountFixtures.js';
import { DiscountSheet } from './DiscountSheets.js';
import { Icon } from './icons.js';
import { MenuRegion } from './MenuRegion.js';
import { formatAmount } from './money.js';
import {
  EDIT_LINE_HREF,
  FIRED_TAG,
  LOCK_TAG,
  ORDER_FIXTURES,
  ORDER_STATES,
  PENDING_TAG,
  VOID_LINE_HREF,
  orderViewFrom,
  viewSearch,
  type Modifier,
  type OrderLine,
  type OrderState,
  type OrderView,
  type RoundGroup,
  type SettlementLock,
  type Totals,
} from './orderFixtures.js';
import { SHEET_FIXTURES } from './sheetFixtures.js';
import { SheetView } from './Sheets.js';

// POS-03: the running order panel (F2a) beside the menu region (F2b), with a
// sheet (F2c) over them when one is open. The header bar is not built yet; it
// is held empty at the artifact's height so the panel sits where the artifact
// puts it on the 1280×800 frame.
//
// A sheet's buttons act in place: they change the view and the URL without
// reloading, so that closing a sheet can hand focus back to the control that
// opened it. While a sheet is open everything else on the frame is inert —
// the panel stays legible and cannot be operated. That is what keeps the
// panel's void paths (a fired row body, Void order) out of reach from a sheet
// a cashier opened to do something ungated; test/sheets.test.tsx proves it.
//
// The discount sheets (F2i) are one family: they move between themselves and
// raise the manager prompt as their own component state, so no approval is
// ever a URL (DiscountSheets.tsx).
export function OrderScreen({ view: initial = orderViewFrom(window.location.search) }: { view?: OrderView }) {
  const [view, setView] = useState(initial);
  const device = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<string | undefined>(undefined);
  const sheet = SHEET_FIXTURES[view.state];
  const approval = APPROVAL_FIXTURES[view.state];
  const discount = DISCOUNT_FIXTURES[view.state];

  function go(next: OrderView) {
    returnFocusTo.current = (sheet ?? approval ?? discount)?.opener;
    // A modal is not back-stackable (SITEMAP §1): leaving the approval prompt
    // replaces its history entry, so Back never re-opens an approval.
    if (approval) window.history.replaceState(null, '', viewSearch(next));
    else window.history.pushState(null, '', viewSearch(next));
    setView(next);
  }

  useEffect(() => {
    const onPop = () => setView(orderViewFrom(window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useLayoutEffect(() => {
    if (!returnFocusTo.current) return;
    device.current?.querySelector<HTMLElement>(returnFocusTo.current)?.focus();
    returnFocusTo.current = undefined;
  }, [view]);

  // React 18 has no inert prop; an empty string renders the bare attribute.
  const inert = sheet || approval || discount ? { inert: '' } : {};

  return (
    <>
      <div className="pos-device" ref={device}>
        <div className="order-screen__bar" aria-hidden="true" {...inert} />
        <div className="order-screen__body" {...inert}>
          <MenuRegion state={view.state} />
          <OrderPanel view={view} />
        </div>
        {sheet && <SheetView key={view.state} sheet={sheet} go={go} />}
        {approval && <ApprovalPrompt key={view.state} approval={approval} go={go} />}
        {discount && <DiscountSheet key={view.state} fixture={discount} go={go} />}
      </div>
      {import.meta.env.DEV && <OrderFixtureStates current={view.state} />}
    </>
  );
}

export function OrderPanel({ view }: { view: OrderView }) {
  const fixture = ORDER_FIXTURES[view.state];
  const { lock, pressedLineId } = fixture;

  // A removal is only honoured where the artifact has figures for it, and never
  // under a lock: removing a PENDING line is a void (FR-H1, AC-3).
  const gone = !lock && view.gone && fixture.totalsWithout?.[view.gone] ? view.gone : undefined;
  const totals = gone ? fixture.totalsWithout![gone]! : fixture.totals;
  const groups = fixture.groups
    .map((g) => ({ ...g, lines: g.lines.filter((l) => l.id !== gone) }))
    .filter((g) => g.lines.length > 0);

  const count = groups.flatMap((g) => g.lines).filter((l) => l.status !== 'voided').length;
  const empty = groups.length === 0;

  return (
    <section className="order-panel" aria-labelledby="order-title" data-lock={lock}>
      <header className="order-panel__head">
        <h2 id="order-title" className="order-panel__title">
          {fixture.title}
        </h2>
        <span className="order-panel__count">{empty ? 'Empty' : count === 1 ? '1 item' : `${count} items`}</span>
      </header>

      <div className="order-lines">
        {empty && (
          <div className="order-empty">
            <div className="order-empty__title">No items yet</div>
            <div>Tap an item on the left to start.</div>
          </div>
        )}
        {groups.map((group) => (
          <RoundGroupView
            key={group.kind === 'fired' ? `round-${group.round}` : 'pending'}
            group={group}
            state={view.state}
            lock={lock}
            pressedLineId={pressedLineId}
          />
        ))}
      </div>

      <TotalsView totals={totals} />
      <OrderActions off={empty || lock !== undefined} />
    </section>
  );
}

function RoundGroupView({
  group,
  state,
  lock,
  pressedLineId,
}: {
  group: RoundGroup;
  state: OrderState;
  lock: SettlementLock | undefined;
  pressedLineId: string | undefined;
}) {
  // I-7: the header answers "did this go to the kitchen?". The tag is the only
  // statement of what a tap on the rows below will do, because a fired row's
  // slot is deliberately empty (I-12); under a lock it names the lock instead.
  const heading =
    group.kind === 'fired'
      ? `Round ${group.round} · fired ${group.firedAt} · ${group.printed ? 'printed' : 'not printed'}`
      : 'Pending · not sent to the kitchen';
  const tag = lock ? LOCK_TAG[lock] : group.kind === 'fired' ? FIRED_TAG : PENDING_TAG;

  return (
    <section className="round-group" aria-label={heading}>
      <h3 className="round-head">
        <span className="round-head__label">{heading}</span>
        <span className="round-head__tag">{tag}</span>
      </h3>
      <ul className="round-lines">
        {group.lines.map((line) => (
          <LineRow key={line.id} line={line} state={state} locked={lock !== undefined} pressed={line.id === pressedLineId} />
        ))}
      </ul>
    </section>
  );
}

// Ruling I-12. A row's trailing slot carries exactly one meaning, "removable
// now". PENDING: a remove control, one tap, no prompt, nothing written (FR-H2).
// FIRED: the same slot, reserved and empty — absent, not disabled — with the
// void reached through the row body (FR-H4). VOIDED: struck through, inert.
// Under either settlement lock every slot is empty and no row is a control:
// void, line removal included, is blocked (FR-G12, FR-G13, FR-H1).
//
// The slot is always the tap target's SIBLING, never inside it. A fired row
// drawn as one anchor would swallow the slot, and the coordinates that remove
// freely on a pending row would open a PIN-gated void on a fired one.
// test/order-panel.test.tsx guards the markup.
function LineRow({
  line,
  state,
  locked,
  pressed,
}: {
  line: OrderLine;
  state: OrderState;
  locked: boolean;
  pressed: boolean;
}) {
  const content = <LineContent line={line} />;
  const href = locked || line.status === 'voided' ? undefined : line.status === 'fired' ? VOID_LINE_HREF : EDIT_LINE_HREF;
  const removable = !locked && line.status === 'pending';

  return (
    <li className={line.status === 'voided' ? 'order-line order-line--voided' : 'order-line'} data-line-status={line.status}>
      {href ? (
        <a className={pressed ? 'order-line__target is-pressed' : 'order-line__target'} href={href}>
          {content}
        </a>
      ) : (
        <div className="order-line__target">{content}</div>
      )}
      <div className="order-line__slot">
        {removable && (
          <a
            className="order-line__remove"
            href={`?state=${state}&gone=${encodeURIComponent(line.id)}`}
            aria-label={`Remove ${line.name}`}
          >
            <Icon name="close" />
          </a>
        )}
      </div>
    </li>
  );
}

function LineContent({ line }: { line: OrderLine }) {
  const detail = line.note ?? (line.modifiers && line.modifiers.map(modifierText).join(' · '));
  return (
    <>
      <div className="order-line__quantity">{line.quantity}</div>
      <div className="order-line__body">
        <div className="order-line__name">{line.name}</div>
        {detail && <div className="order-line__detail">{detail}</div>}
      </div>
      <div className="order-line__amount">{formatAmount(line.amount)}</div>
    </>
  );
}

function modifierText({ name, delta }: Modifier): string {
  if (delta === undefined) return name;
  return delta < 0n ? `${name} (${formatAmount(delta)})` : `${name} (+${formatAmount(delta)})`;
}

function TotalsView({ totals }: { totals: Totals }) {
  return (
    <dl className="totals">
      <div className="totals__row">
        <dt>Subtotal</dt>
        <dd>{formatAmount(totals.subtotal)}</dd>
      </div>
      {totals.discount && (
        <div className="totals__row">
          <dt>{totals.discount.label}</dt>
          <dd>{formatAmount(totals.discount.amount)}</dd>
        </div>
      )}
      {totals.serviceCharge && (
        <div className="totals__row">
          <dt>{totals.serviceCharge.label}</dt>
          <dd>{formatAmount(totals.serviceCharge.amount)}</dd>
        </div>
      )}
      <div className="totals__row totals__row--grand">
        <dt>Total</dt>
        <dd>{formatAmount(totals.total)}</dd>
      </div>
      {totals.taxIncluded && (
        <div className="totals__row totals__row--included">
          <dt>{totals.taxIncluded.label}</dt>
          <dd>{formatAmount(totals.taxIncluded.amount)}</dd>
        </div>
      )}
    </dl>
  );
}

// The close bar. Every destination is a sheet (F2c) or settlement (F3), none of
// which exists yet, so each names the artifact's fixture state and today
// resolves to the default state. Under a lock, and on an empty order, all four
// are drawn unavailable in place.
const ACTIONS = [
  { label: 'Discount', href: '?state=sheet-discount' },
  { label: 'Void order', href: '?state=sheet-voidorder' },
  { label: 'Send to kitchen', href: '?state=fireerror' },
  { label: 'Settle', href: '?state=settle', primary: true },
] as const;

function OrderActions({ off }: { off: boolean }) {
  return (
    <div className="order-actions">
      {ACTIONS.map((a) =>
        off ? (
          <span key={a.label} className="action action--off" aria-disabled="true">
            {a.label}
          </span>
        ) : (
          <a key={a.label} className={'primary' in a ? 'action action--primary' : 'action'} href={a.href}>
            {a.label}
          </a>
        )
      )}
    </div>
  );
}

// Development-only review aid, outside the 1280×800 frame.
function OrderFixtureStates({ current }: { current: OrderState }) {
  return (
    <nav className="fixture-states" aria-label="Fixture states">
      {ORDER_STATES.map((s) => (
        <a key={s.id} href={`?state=${s.id}`} aria-current={s.id === current ? 'page' : undefined}>
          {s.label}
        </a>
      ))}
    </nav>
  );
}

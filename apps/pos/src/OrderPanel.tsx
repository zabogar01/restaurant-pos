import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ApprovalPrompt } from './Approval.js';
import { APPROVAL_FIXTURES } from './approvalFixtures.js';
import { DISCOUNT_ACTION, DISCOUNT_FIXTURES, panelDiscount } from './discountFixtures.js';
import { DiscountSheet } from './DiscountSheets.js';
import { Icon } from './icons.js';
import { MenuRegion } from './MenuRegion.js';
import { formatAmount } from './money.js';
import {
  FIRED_TAG,
  LOCK_TAG,
  ORDER_FIXTURES,
  ORDER_STATES,
  PENDING_TAG,
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
import { SHEET_FIXTURES, panelLine } from './sheetFixtures.js';
import { SheetView } from './Sheets.js';
import { VOID_FIXTURES, VOID_ORDER_ACTION, panelVoid, shownOrder, type VoidSheetFixture } from './voidFixtures.js';
import { VoidSheet } from './VoidSheets.js';

// POS-03: the running order panel (F2a) beside the menu region (F2b), with a
// sheet (F2c) over them when one is open. The header bar is not built yet; it
// is held empty at the artifact's height so the panel sits where the artifact
// puts it on the 1280×800 frame.
//
// Every control on the screen that acts on the order is a <button> and acts in
// place: it changes the view and the URL without reloading, so that closing a
// sheet can hand focus back to the control that opened it (ruling of
// 2026-09-17: an anchor is for leaving the screen). While a sheet is open
// everything else on the frame is inert — the panel stays legible and cannot
// be operated. That is what keeps the panel's void paths (a fired row body,
// Void order) out of reach from a sheet a cashier opened to do something
// ungated; test/sheets.test.tsx proves it.
//
// A [SHEET] or [MODAL] is neither a route nor back-stackable (SITEMAP §1), so
// opening or leaving one replaces the current history entry rather than
// pushing one, and Back never re-opens a sheet or a prompt.
//
// The discount sheets (F2i) are one family: they move between themselves and
// raise the manager prompt as their own component state, so no approval is
// ever a URL (DiscountSheets.tsx). The void sheets (F2j) do the same, and read
// the order the panel shows beside them (VoidSheets.tsx).
//
// Every sheet a control on the panel opens is component state (F2e, F2k). It
// is handed the very line, order and figures the cashier is looking at, never
// a fixture's: a tap on one fired row can only ever offer to void that row
// (B-16), a tap on one pending row can only ever edit that row, and the gate
// on a discount change reads the discount this order carries (FR-F8). None of
// them writes a URL or a history entry.
export function OrderScreen({ view: initial = orderViewFrom(window.location.search) }: { view?: OrderView }) {
  const [view, setView] = useState(initial);
  const [voidOpened, setVoidOpened] = useState<VoidSheetFixture['target']>();
  const [lineOpened, setLineOpened] = useState<string>();
  const [discountOpened, setDiscountOpened] = useState(false);
  const device = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<string | undefined>(undefined);
  const order = shownOrder(view);
  const sheet = SHEET_FIXTURES[view.state] ?? (lineOpened !== undefined ? panelLine(lineOpened, view, order) : undefined);
  const approval = APPROVAL_FIXTURES[view.state];
  const discount = DISCOUNT_FIXTURES[view.state] ?? (discountOpened ? panelDiscount(view, order) : undefined);
  const voiding = VOID_FIXTURES[view.state] ?? (voidOpened && panelVoid(voidOpened, view));

  const closeOpened = () => {
    setVoidOpened(undefined);
    setLineOpened(undefined);
    setDiscountOpened(false);
  };

  /**
   * SITEMAP §1: a [SHEET], a [MODAL] and an [INLINE] state are none of them
   * back-stackable, so a change that stays on POS-03 replaces the history
   * entry. **Only Settle pushes**, because POS-04 is the only [SCREEN] this
   * screen leaves for — "its own route, not a sheet over POS-03". Firing does
   * not leave: SITEMAP §2 puts the fire result under POS-03 as an [INLINE]
   * state (corrected 2026-09-21 after review; F2k first shipped Fire as a
   * departure, following a task file that was wrong). Back after removing a
   * line therefore leaves the screen rather than putting the line back (the
   * ruling of 2026-09-18).
   */
  function navigate(search: string, leaves = false) {
    const next = orderViewFrom(search);
    const open = sheet ?? approval ?? discount ?? voiding;
    returnFocusTo.current = open?.opener;
    if (leaves && !open && !overlayAt(next.state)) window.history.pushState(null, '', search);
    else window.history.replaceState(null, '', search);
    closeOpened();
    setView(next);
  }

  const go = (next: OrderView) => navigate(viewSearch(next));

  useEffect(() => {
    const onPop = () => {
      closeOpened();
      setView(orderViewFrom(window.location.search));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useLayoutEffect(() => {
    if (!returnFocusTo.current) return;
    device.current?.querySelector<HTMLElement>(returnFocusTo.current)?.focus();
    returnFocusTo.current = undefined;
  }, [view]);

  // React 18 has no inert prop; an empty string renders the bare attribute.
  const inert = sheet || approval || discount || voiding ? { inert: '' } : {};
  // A sheet opened over a particular line or order is remounted when that
  // target changes, so tapping a second row draws the second row's sheet.
  const voidKey = voidOpened ? `opened-${voidOpened.kind === 'line' ? voidOpened.lineId : 'order'}` : view.state;
  const lineKey = lineOpened !== undefined ? `opened-${lineOpened}` : view.state;

  return (
    <>
      <div className="pos-device" ref={device}>
        <div className="order-screen__bar" aria-hidden="true" {...inert} />
        <div className="order-screen__body" {...inert}>
          <MenuRegion view={view} navigate={navigate} />
          <OrderPanel
            view={view}
            actions={{ navigate, openVoid: setVoidOpened, openLine: setLineOpened, openDiscount: () => setDiscountOpened(true) }}
          />
        </div>
        {sheet && <SheetView key={lineKey} sheet={sheet} go={go} />}
        {approval && <ApprovalPrompt key={view.state} approval={approval} go={go} />}
        {discount && <DiscountSheet key={discountOpened ? 'opened' : view.state} fixture={discount} go={go} />}
        {voiding && <VoidSheet key={voidKey} fixture={voiding} order={order} go={go} />}
      </div>
      {import.meta.env.DEV && <OrderFixtureStates current={view.state} />}
    </>
  );
}

/** Whether a state draws a sheet or the prompt over the order: an overlay, not a place (SITEMAP §1). */
const overlayAt = (state: OrderState) =>
  Boolean(SHEET_FIXTURES[state] ?? APPROVAL_FIXTURES[state] ?? DISCOUNT_FIXTURES[state] ?? VOID_FIXTURES[state]);

/**
 * What the panel's controls do. navigate moves the screen to a ?state= view,
 * and says whether it leaves POS-03; the three openers open a sheet over the
 * order on screen, for the line, order or discount the cashier tapped. Drawn
 * on its own, as its tests draw it, the panel's controls do nothing.
 */
export type PanelActions = {
  navigate: (search: string, leaves?: boolean) => void;
  openVoid: (target: VoidSheetFixture['target']) => void;
  openLine: (lineId: string) => void;
  openDiscount: () => void;
};

const NO_ACTIONS: PanelActions = { navigate: () => {}, openVoid: () => {}, openLine: () => {}, openDiscount: () => {} };

export function OrderPanel({ view, actions = NO_ACTIONS }: { view: OrderView; actions?: PanelActions }) {
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
            view={view}
            lock={lock}
            pressedLineId={pressedLineId}
            actions={actions}
          />
        ))}
      </div>

      <TotalsView totals={totals} />
      <OrderActions off={empty || lock !== undefined} actions={actions} />
    </section>
  );
}

function RoundGroupView({
  group,
  view,
  lock,
  pressedLineId,
  actions,
}: {
  group: RoundGroup;
  view: OrderView;
  lock: SettlementLock | undefined;
  pressedLineId: string | undefined;
  actions: PanelActions;
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
          <LineRow
            key={line.id}
            line={line}
            view={view}
            locked={lock !== undefined}
            pressed={line.id === pressedLineId}
            actions={actions}
          />
        ))}
      </ul>
    </section>
  );
}

// Ruling I-12. A row's trailing slot carries exactly one meaning, "removable
// now". PENDING: a remove control, one tap, no prompt, nothing written (FR-H2).
// FIRED: the same slot, reserved and empty — absent, not disabled — with the
// void reached through the row body (FR-H4), which opens the void sheet for
// this line and no other. VOIDED: struck through, inert. Under either
// settlement lock every slot is empty and no row is a control: void, line
// removal included, is blocked (FR-G12, FR-G13, FR-H1).
//
// The slot is always the tap target's SIBLING, never inside it. A fired row
// drawn as one control would swallow the slot, and the coordinates that remove
// freely on a pending row would open a PIN-gated void on a fired one.
// test/order-panel.test.tsx guards the markup.
function LineRow({
  line,
  view,
  locked,
  pressed,
  actions,
}: {
  line: OrderLine;
  view: OrderView;
  locked: boolean;
  pressed: boolean;
  actions: PanelActions;
}) {
  const content = <LineContent line={line} />;
  const act =
    locked || line.status === 'voided'
      ? undefined
      : line.status === 'fired'
        ? () => actions.openVoid({ kind: 'line', lineId: line.id })
        : () => actions.openLine(line.id);
  const removable = !locked && line.status === 'pending';

  return (
    <li
      className={line.status === 'voided' ? 'order-line order-line--voided' : 'order-line'}
      data-line-status={line.status}
      data-line-id={line.id}
    >
      {act ? (
        <button type="button" className={pressed ? 'order-line__target is-pressed' : 'order-line__target'} onClick={act}>
          {content}
        </button>
      ) : (
        <div className="order-line__target">{content}</div>
      )}
      <div className="order-line__slot">
        {removable && (
          <button
            type="button"
            className="order-line__remove"
            aria-label={`Remove ${line.name}`}
            onClick={() => actions.navigate(viewSearch({ ...view, gone: line.id }))}
          >
            <Icon name="close" />
          </button>
        )}
      </div>
    </li>
  );
}

// Spans, not divs: the content sits inside a <button> on a live row, which
// holds phrasing content only.
function LineContent({ line }: { line: OrderLine }) {
  const detail = line.note ?? (line.modifiers && line.modifiers.map(modifierText).join(' · '));
  return (
    <>
      <span className="order-line__quantity">{line.quantity}</span>
      <span className="order-line__body">
        <span className="order-line__name">{line.name}</span>
        {detail && <span className="order-line__detail">{detail}</span>}
      </span>
      <span className="order-line__amount">{formatAmount(line.amount)}</span>
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

// The close bar. Discount and Void order open a sheet over the order on
// screen, and each sheet's gate reads that order (DiscountSheets.tsx,
// VoidSheets.tsx): neither names a state. Send to kitchen and Settle name
// states that do not exist yet (F2h, F3) and today resolve to the default
// state. Under a lock, and on an empty order, all four are drawn unavailable
// in place.
//
// `leaves` marks the one control that leaves POS-03, and so the only one that
// pushes a history entry: Settle, for POS-04, which SITEMAP §2 gives its own
// route. Firing stays here — the fire result is an [INLINE] state of this
// screen (SITEMAP §2, FR-E3), so it replaces like every other inline change.
const ACTIONS = [
  { id: DISCOUNT_ACTION, label: 'Discount' },
  { id: VOID_ORDER_ACTION, label: 'Void order' },
  { id: 'fire', label: 'Send to kitchen', search: '?state=fireerror' },
  { id: 'settle', label: 'Settle', search: '?state=settle', leaves: true, primary: true },
] as const;

function OrderActions({ off, actions }: { off: boolean; actions: PanelActions }) {
  return (
    <div className="order-actions">
      {ACTIONS.map((a) =>
        off ? (
          <span key={a.id} className="action action--off" aria-disabled="true">
            {a.label}
          </span>
        ) : (
          <button
            key={a.id}
            type="button"
            className={'primary' in a ? 'action action--primary' : 'action'}
            data-action={a.id}
            onClick={() =>
              'search' in a
                ? actions.navigate(a.search, 'leaves' in a)
                : a.id === DISCOUNT_ACTION
                  ? actions.openDiscount()
                  : actions.openVoid({ kind: 'order' })
            }
          >
            {a.label}
          </button>
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

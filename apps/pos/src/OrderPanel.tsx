import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ApprovalPrompt } from './Approval.js';
import { APPROVAL_FIXTURES } from './approvalFixtures.js';
import { DISCOUNT_ACTION, DISCOUNT_FIXTURES, panelDiscount } from './discountFixtures.js';
import { DiscountSheet } from './DiscountSheets.js';
import { EmergencyBanner } from './EmergencyBanner.js';
import { FIRE_ACTION, blockingLines, fireRefusal, holdsUnavailable, sendableLines, type FireRefusal } from './fire.js';
import { Icon } from './icons.js';
import { MENU_FIXTURES } from './menuFixtures.js';
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
        {/*
          FR-E3: a FAILED kitchen ticket is a persistent emergency incident,
          application-wide, shown on both clients. It sits above everything,
          which is why it is here and not in the panel. It is inert with the
          rest of the frame while a sheet is open: a sheet owns the screen, and
          the incident is still there behind it.
        */}
        {ORDER_FIXTURES[view.state].incident && (
          <EmergencyBanner {...ORDER_FIXTURES[view.state].incident!} inert={inert} />
        )}
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

  // FR-E4, B-17. **One fact, read off the order that is on screen.** The items
  // a manager has 86'd live on the menu fixture, because that is where the
  // back office's toggle lands (FR-C6); which of this order's lines that makes
  // unfireable is fire.ts's answer, not this component's.
  //
  // Reading the lines rather than a per-state flag is what makes the refusal
  // *resolve*: the notice tells the cashier to void the offending line, the
  // line's remove control is that void (AC-3, FR-H2), and once `gone` has
  // dropped it there is nothing left to block — so the notice goes and Send to
  // kitchen comes back, with nothing anywhere saying so.
  //
  // **DEVIATION FROM THE ARTIFACT, and a deliberate one.** The artifact draws
  // this notice in `fireblocked` only, and leaves Send to kitchen live in
  // `eightysix` and `sheet-item86` — which hold the same pending Steak and 86
  // the same Steak. B-17 is a boundary ("a pending line holding one blocks the
  // fire"), so the fire is blocked in all three, and the rule says so in all
  // three. Scoping the notice back to one state would be the per-state flag
  // again, and would let a cashier fire an 86'd Steak from `eightysix`.
  // test/fire.test.tsx pins it; raised in the FE-011 handoff.
  const unavailable = MENU_FIXTURES[view.state].eightySixed ?? [];
  const lines = groups.flatMap((g) => g.lines);
  const refusal = fireRefusal(blockingLines(lines, unavailable));
  // The order's other answer to "what can this send?": nothing, because every
  // line is already FIRED (FR-E1, FR-E2, B-16). Unavailable in place like the
  // refusal, but silent — it is not a refusal, it is an order that is not
  // fireable yet, and adding a line makes it fireable again.
  const nothingToSend = sendableLines(lines).length === 0;
  const loading = MENU_FIXTURES[view.state].loading ?? false;

  return (
    <section className="order-panel" aria-labelledby="order-title" data-lock={lock}>
      <header className="order-panel__head">
        <h2 id="order-title" className="order-panel__title">
          {fixture.title}
        </h2>
        <span className="order-panel__count">{empty ? 'Empty' : count === 1 ? '1 item' : `${count} items`}</span>
      </header>

      <div className="order-lines">
        {loading ? (
          <PanelSkeleton widths={['80', '60', '80']} />
        ) : (
          <>
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
                unavailable={unavailable}
                pressedLineId={pressedLineId}
                actions={actions}
              />
            ))}
          </>
        )}
      </div>

      {refusal && <FireRefusalNotice refusal={refusal} />}

      {loading ? <PanelSkeleton widths={['60', '40']} /> : <TotalsView totals={totals} />}
      <OrderActions
        off={empty || lock !== undefined}
        fireOff={refusal !== undefined || nothingToSend}
        fireDescribedBy={refusal ? FIRE_REFUSAL_ID : undefined}
        actions={actions}
      />
    </section>
  );
}

/**
 * The artifact replaces the panel's lines and its totals with skeleton bars
 * while the menu loads, in the same widths the menu region's own skeleton uses
 * (`w80 w60 w80` for the lines, `w60 w40` for the totals). The bars are the
 * existing `.skel-bar`, renamed out of `.menu-loading__bar` in F2h so both
 * places can share it; no new length is written.
 */
function PanelSkeleton({ widths }: { widths: ReadonlyArray<'80' | '60' | '40'> }) {
  return (
    <div className="panel-skeleton" aria-busy="true">
      {widths.map((w, i) => (
        <div key={i} className={`skel-bar skel-bar--${w}`} aria-hidden="true" />
      ))}
    </div>
  );
}

/**
 * FR-E4's refusal, between the lines and the totals as the artifact puts it.
 *
 * `role="status"`: a standing condition of the order, true before anyone
 * pressed anything — the same shape as CATALOG_NOTICE, and the opposite of the
 * rejection notice (`role="alert"`), which is the answer to something the
 * cashier just did.
 *
 * The count and the named line come from fire.ts, so the notice cannot outlive
 * the line it names. Its id is what the unavailable *Send to kitchen*
 * describes itself by.
 */
const FIRE_REFUSAL_ID = 'fire-refusal';

function FireRefusalNotice({ refusal }: { refusal: FireRefusal }) {
  return (
    <div className="notice order-notice" role="status" id={FIRE_REFUSAL_ID}>
      <div className="notice__title">{refusal.title}</div>
      <div>
        {refusal.lead}{' '}
        {refusal.names.map((name, i) => (
          <span key={name}>
            {i > 0 && ', '}
            <b>{name}</b>
          </span>
        ))}
        . {refusal.resolution}
      </div>
    </div>
  );
}

function RoundGroupView({
  group,
  view,
  lock,
  unavailable,
  pressedLineId,
  actions,
}: {
  group: RoundGroup;
  view: OrderView;
  lock: SettlementLock | undefined;
  unavailable: ReadonlyArray<string>;
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
            unavailable={unavailable}
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
  unavailable,
  pressed,
  actions,
}: {
  line: OrderLine;
  view: OrderView;
  locked: boolean;
  unavailable: ReadonlyArray<string>;
  pressed: boolean;
  actions: PanelActions;
}) {
  const content = <LineContent line={line} tagged={holdsUnavailable(line, unavailable)} />;
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
//
// **The 86 tag goes on the name, inside the row body — never in the trailing
// slot (I-12).** The slot carries exactly one meaning, "removable now", and an
// 86'd PENDING line is still removable: the remove control stays, and it is
// the resolution FR-E4 names. `tagged` is the same fact that refuses the fire
// (fire.ts), so the tag and the refusal can never disagree, and a FIRED line
// never takes it — work already in the kitchen does not become unavailable.
function LineContent({ line, tagged }: { line: OrderLine; tagged: boolean }) {
  const detail = line.note ?? (line.modifiers && line.modifiers.map(modifierText).join(' · '));
  return (
    <>
      <span className="order-line__quantity">{line.quantity}</span>
      <span className="order-line__body">
        <span className="order-line__name">
          {line.name}
          {tagged && (
            <>
              {' '}
              <span className="tag-86">86</span>
            </>
          )}
        </span>
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
// VoidSheets.tsx): neither names a state. Settle names a state that does not
// exist yet (F3) and today resolves to the default state. Under a lock, and on
// an empty order, all four are drawn unavailable in place.
//
// `leaves` marks the one control that leaves POS-03, and so the only one that
// pushes a history entry: Settle, for POS-04, which SITEMAP §2 gives its own
// route. Firing stays here — the fire result is an [INLINE] state of this
// screen (SITEMAP §2, FR-E3).
//
// **Send to kitchen names no state and produces no result, deliberately.** It
// used to carry `?state=fireerror`, which was harmless only while fireerror
// was not a state: once it is one, pressing Send to kitchen from `overflow` or
// `other-discount` swaps the cashier's order for the fire-error fixture's —
// F2k's opener defect in a fifth place.
//
// It does nothing instead of doing something plausible, because the result of
// firing *this* order is a new fired round holding the lines that were
// pending, with a time and a delivery outcome, and **the artifact draws no
// such composition while this app has no clock**: every round header's time is
// a literal of the artifact's (19:42, 19:58), so minting one for a round
// nobody fired would invent data. The artifact's own Send to kitchen is
// inconsistent with its own default state for the same reason — it lands on an
// order whose pending Steak has vanished rather than been fired.
//
// This is FE-001's PIN again, which "is compared against nothing and goes
// nowhere": a fixture control with no reviewed result and no server does
// nothing, visibly and deliberately, rather than lying about where it went.
// **What firing shows on POS-03 is owed to a designer.**
const ACTIONS = [
  { id: DISCOUNT_ACTION, label: 'Discount' },
  { id: VOID_ORDER_ACTION, label: 'Void order' },
  { id: FIRE_ACTION, label: 'Send to kitchen' },
  { id: 'settle', label: 'Settle', search: '?state=settle', leaves: true, primary: true },
] as const;

/**
 * Firing takes **one** control off while the other three stay live, for either
 * of the two reasons fire.ts knows about: the order is refused (FR-E4) or it
 * has nothing to send (FR-E1, FR-E2, B-16). Discounting, voiding and settling
 * such an order are all still the cashier's to do — `B-15` in particular means
 * a print failure never blocks the sale. Under either lock, and on an empty
 * order, all four go off together exactly as before.
 *
 * `fireDescribedBy` is set only when there is a notice to point at, which is
 * only the refusal. A control that is inert with no announced reason is the
 * defect F2e ruled on when both PIN pads gained `role="alert"` — but an order
 * with nothing pending is not a refusal and has nothing to announce, so
 * pointing at a notice that is not drawn would be worse than pointing at
 * nothing.
 */
function OrderActions({
  off,
  fireOff,
  fireDescribedBy,
  actions,
}: {
  off: boolean;
  fireOff: boolean;
  fireDescribedBy: string | undefined;
  actions: PanelActions;
}) {
  return (
    <div className="order-actions">
      {ACTIONS.map((a) =>
        off || (fireOff && a.id === FIRE_ACTION) ? (
          <span
            key={a.id}
            className="action action--off"
            aria-disabled="true"
            data-action={a.id}
            aria-describedby={!off && a.id === FIRE_ACTION ? fireDescribedBy : undefined}
          >
            {a.label}
          </span>
        ) : (
          <button
            key={a.id}
            type="button"
            className={'primary' in a ? 'action action--primary' : 'action'}
            data-action={a.id}
            onClick={() => {
              if ('search' in a) actions.navigate(a.search, 'leaves' in a);
              else if (a.id === DISCOUNT_ACTION) actions.openDiscount();
              else if (a.id === VOID_ORDER_ACTION) actions.openVoid({ kind: 'order' });
              // Send to kitchen: nothing. See above — no reviewed result, no
              // clock, and no fixture to land on. It must not move the order,
              // the URL or the history.
            }}
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

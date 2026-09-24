import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ApprovalPrompt } from './Approval.js';
import { APPROVAL_FIXTURES } from './approvalFixtures.js';
import { DISCOUNT_ACTION, DISCOUNT_FIXTURES, panelDiscount } from './discountFixtures.js';
import { DiscountSheet } from './DiscountSheets.js';
import { EmergencyBanner } from './EmergencyBanner.js';
import { FIRE_ACTION, blockingLines, fireRefusal, holdsUnavailable, sendableLines, type FireRefusal } from './fire.js';
import { Icon } from './icons.js';
import { MENU_FIXTURES, menuFixtureFor, originFacts } from './menuFixtures.js';
import { MenuRegion } from './MenuRegion.js';
import { formatAmount } from './money.js';
import { useOrderStore, type OrderStore } from './orderStore.js';
import {
  FIRED_TAG,
  LOCK_TAG,
  ORDER_FIXTURES,
  ITEM_SHEET_ORIGINS,
  ORDER_STATES,
  PENDING_TAG,
  orderCountLabel,
  orderVariant,
  orderViewFrom,
  pendingGroupHeading,
  roundHeading,
  viewSearch,
  type Modifier,
  type OrderLine,
  type OrderState,
  type OrderVariant,
  type OrderView,
  type RoundGroup,
  type SettlementLock,
  type Totals,
} from './orderFixtures.js';
import { SHEET_FIXTURES, panelLine } from './sheetFixtures.js';
import { SheetView } from './Sheets.js';
import { VOID_FIXTURES, VOID_ORDER_ACTION, panelVoid, shownOrder, type ShownOrder, type VoidSheetFixture } from './voidFixtures.js';
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
/**
 * The thin wrapper (FE-019, review finding 1): owns exactly one `view` (via
 * `useState`, from the URL at mount) and its own `popstate` listener, and
 * renders {@link ControlledOrderScreen} with it. Exists so the ~30 direct
 * component tests that mount `OrderScreen` standalone keep rendering what
 * they render today. The routed app never uses this: `PosRoutes` renders
 * {@link ControlledOrderScreen} directly, supplying the view it derives from
 * the URL on every render and on every `popstate` itself — one owner, not
 * two.
 */
export function OrderScreen({
  view: initial = orderViewFrom(window.location.search),
  clock,
}: {
  view?: OrderView;
  clock?: Clock;
}) {
  const [view, setView] = useState(initial);
  const store = useOrderStore(view, false);

  useEffect(() => {
    const onPop = () => setView(orderViewFrom(window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const onLocationChange = () => setView(orderViewFrom(window.location.search));

  return <ControlledOrderScreen view={view} store={store} onLocationChange={onLocationChange} {...(clock && { clock })} />;
}

/**
 * The controlled component (FE-019, review finding 1): takes its view, its
 * store and its navigate-notification callback as props, and owns none of
 * them — no `useState(initial)`, no `suppliedStore ?? localStore`. `PosRoutes`
 * renders this directly for the routed app; {@link OrderScreen} renders it for
 * every direct component test.
 */
export function ControlledOrderScreen({
  view,
  store,
  locked = false,
  onLocationChange,
  clock = browserClock,
}: {
  view: OrderView;
  store: OrderStore;
  /** The time a fire is stamped with, injected (ARCH-002 §2.2). Tests pass a fixed one. */
  clock?: Clock;
  /** F3d, FR-G12: a payment session is active in this tab — POS-03's own-tab lock, derived, never read from `?state=`. */
  locked?: boolean;
  /** Told on every navigate — same-screen or leaving — so the one owner of `view` above this component re-reads the URL (see `navigate` below). */
  onLocationChange: () => void;
}) {
  const [voidOpened, setVoidOpened] = useState<VoidSheetFixture['target']>();
  const [lineOpened, setLineOpened] = useState<string>();
  const [discountOpened, setDiscountOpened] = useState(false);
  // FE-022: the round a press just made. `after` is the highest round before
  // it, so the effect below can tell the fire's own round from any other.
  const [firing, setFiring] = useState<{ after: number }>();
  const [sentRound, setSentRound] = useState<number>();
  // The groups as the fire left them: the status belongs to the press, so any
  // later change to the order ends it (never a render condition like "nothing is pending").
  const sentGroups = useRef<ReadonlyArray<RoundGroup>>();
  const justAdded = useRef(false);
  const device = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<string | undefined>(undefined);

  const closeOpened = () => {
    setVoidOpened(undefined);
    setLineOpened(undefined);
    setDiscountOpened(false);
  };

  // A location change this component did not itself cause — browser
  // Back/Forward — arrives as a new `view` prop from whichever component owns
  // it (the wrapper below, or `PosRoutes`). Closing any open sheet is a render-
  // time state adjustment (React's documented "adjust state while rendering"
  // pattern, the same one paymentSession.ts and PosRoutes.tsx use), so there is
  // no extra render showing the old sheet over the new view.
  //
  // Compared by value, not identity: `PosRoutes` recomputes `view` fresh from
  // `window.location.search` on every one of its renders — including one the
  // order store's own state triggers, with the URL unchanged — and a fresh
  // object there must not read as a navigation and close a sheet mid-edit.
  const viewKey = viewSearch(view);
  const previousViewKey = useRef(viewKey);
  if (previousViewKey.current !== viewKey) {
    previousViewKey.current = viewKey;
    closeOpened();
  }

  // The sheets and the void sheet still read the fixture-only derivation
  // (FE-014's correction to this task): none of them are wired to the store.
  const order = shownOrder(view);

  // After a fire the pressed control is inert in place, so focus would fall to
  // the document. It goes to the new round's heading instead (DESIGN-007), and a
  // polite status line says what happened. Both wait for the round to exist in
  // the store's groups, which is why this is an effect and not the handler.
  const lastRound = latestRound(store.order.groups);
  useLayoutEffect(() => {
    if (!firing || lastRound <= firing.after) return;
    setFiring(undefined);
    sentGroups.current = store.order.groups;
    setSentRound(lastRound);
  }, [firing, lastRound, store.order.groups]);
  useLayoutEffect(() => {
    if (sentRound !== undefined && store.order.groups !== sentGroups.current) setSentRound(undefined);
  }, [sentRound, store.order.groups]);
  // Focus and scroll wait for the status text to be drawn, so the space it takes
  // is already gone from the list: the last row cannot end up under it.
  useLayoutEffect(() => {
    if (sentRound === undefined) return;
    const heading = device.current?.querySelector<HTMLElement>(`[data-round="${sentRound}"]`);
    if (!heading) return;
    // Made focusable only now: a heading is not a control, and no other state of
    // this screen has a tabindex on the order's lines.
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    // The whole round, as far as the list allows: the last line first, then the
    // heading, so a round taller than the list shows its heading and its top.
    const rows = heading.closest('.round-group')?.querySelectorAll<HTMLElement>('.order-line');
    reveal(rows?.[rows.length - 1]);
    reveal(heading);
  }, [sentRound]);
  // The line an item sheet's Add just made, brought into view (FE-021 follow-up).
  useLayoutEffect(() => {
    if (!justAdded.current) return;
    justAdded.current = false;
    const pending = store.order.groups.find((g) => g.kind === 'pending');
    const last = pending?.lines[pending.lines.length - 1];
    if (last) reveal(device.current?.querySelector<HTMLElement>(`[data-line-id="${last.id}"]`));
  }, [store.order.groups]);
  // A line editor is for a line on the order the cashier is looking at — the
  // store's, which holds lines added since the fixture was drawn (FE-021).
  const fixtureSheet = SHEET_FIXTURES[view.state] ?? (lineOpened !== undefined ? panelLine(lineOpened, view, store.order) : undefined);
  // An item sheet opened from a tile returns to where the tile was pressed.
  // What Cancel and a successful Add return to is the origin's own policy
  // (ITEM_SHEET_ORIGINS): a persistent condition returns to both, a notice
  // only to Cancel, and a finished interaction to neither.
  const policy = view.from ? ITEM_SHEET_ORIGINS[view.from] : undefined;
  const cancelTo: OrderView = { state: view.from && policy !== 'clears' ? view.from : 'default' };
  const addTo: OrderView = { state: view.from && policy === 'keeps' ? view.from : 'default' };
  const sheet =
    fixtureSheet?.kind === 'item' && view.state.startsWith('sheet-item-') ? { ...fixtureSheet, cancel: cancelTo, add: addTo } : fixtureSheet;
  const approval = APPROVAL_FIXTURES[view.state];
  const discount = DISCOUNT_FIXTURES[view.state] ?? (discountOpened ? panelDiscount(view, order) : undefined);
  const voiding = VOID_FIXTURES[view.state] ?? (voidOpened && panelVoid(voidOpened, view));

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
    const destination = leaves && search === '?state=settle' ? `/pos/settlement${search}` : search;
    const next = orderViewFrom(new URL(destination, window.location.href).search);
    const open = sheet ?? approval ?? discount ?? voiding;
    returnFocusTo.current = open?.opener;
    if (leaves && !open && !overlayAt(next.state)) window.history.pushState(null, '', destination);
    else window.history.replaceState(null, '', search);
    closeOpened();
    // FE-019 finding 1: `view` is a prop now — the wrapper or `PosRoutes`
    // above this component owns it and re-reads the URL. F3c's fix still
    // applies: every navigate must tell that owner, not only the ones that
    // leave the screen, or a same-screen mutation (a pending row's ×) never
    // reaches the store the owner passes down.
    onLocationChange();
  }

  const go = (next: OrderView) => navigate(viewSearch(next));

  useLayoutEffect(() => {
    if (!returnFocusTo.current) return;
    device.current?.querySelector<HTMLElement>(returnFocusTo.current)?.focus();
    returnFocusTo.current = undefined;
  }, [view]);

  // React 18 has no inert prop; an empty string renders the bare attribute.
  const { incident } = originFacts(view);
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
        {incident && <EmergencyBanner {...incident} inert={inert} />}
        <div className="order-screen__bar" aria-hidden="true" {...inert} />
        <div className="order-screen__body" {...inert}>
          <MenuRegion view={view} category={store.category} selectCategory={store.selectCategory} navigate={navigate} locked={locked} />
          <OrderPanel
            view={view}
            order={store.order}
            locked={locked}
            sentRound={sentRound}
            actions={{
              navigate,
              openVoid: setVoidOpened,
              openLine: setLineOpened,
              openDiscount: () => setDiscountOpened(true),
              fire: () => {
                setFiring({ after: latestRound(store.order.groups) });
                store.fire(clock());
              },
            }}
          />
        </div>
        {sheet && (
          <SheetView
            key={lineKey}
            sheet={sheet}
            go={go}
            addLine={(line) => {
              justAdded.current = true;
              store.addLine(line);
            }}
            setQuantity={store.setQuantity}
            order={store.order}
            renderTotals={(totals) => <TotalsView totals={totals} />}
          />
        )}
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
  /** Send to kitchen: one press, no confirmation (ARCH-002). Stamped with the injected clock by the screen. */
  fire: () => void;
};

const NO_ACTIONS: PanelActions = { navigate: () => {}, openVoid: () => {}, openLine: () => {}, openDiscount: () => {}, fire: () => {} };

/** Where a fire gets its time. The one place this screen reads a clock (ARCH-002 §2.2). */
export type Clock = () => string;

/** The browser's local time at the press, as `HH:MM` like the fixtures' `19:42`. The zone is still an open owner decision (PRD §9). */
const browserClock: Clock = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

/** Brings a row or heading into view with the least scrolling. jsdom has no scrollIntoView. */
function reveal(el: Element | null | undefined) {
  el?.scrollIntoView?.({ block: 'nearest' });
}

function latestRound(groups: ReadonlyArray<RoundGroup>): number {
  return groups.reduce((max, g) => (g.kind === 'fired' ? Math.max(max, g.round) : max), 0);
}

export function OrderPanel({
  view,
  order = shownOrder(view),
  locked = false,
  sentRound,
  actions = NO_ACTIONS,
}: {
  view: OrderView;
  order?: ShownOrder;
  /** The round the cashier's last press sent; the status line reads it while nothing is pending again. */
  sentRound?: number | undefined;
  /** F3d rule 2: a session-derived lock overrides whatever the fixture says, and always reads as `draft` (rule 3). */
  locked?: boolean;
  actions?: PanelActions;
}) {
  // lock, pressedLineId and incident are view-level facts, never part of a
  // ShownOrder (FE-014's correction): a lock and a held-down row are drawn
  // over whichever order is on screen, not carried by the order itself.
  const fixture = ORDER_FIXTURES[view.state];
  const { pressedLineId } = fixture;
  // The place's own lock, through the same accessor the store's fire reads.
  const lock = locked ? 'draft' : originFacts(view).lock;
  const type = orderVariant(order);
  const { totals, groups } = order;

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
  const unavailable = menuFixtureFor(view).eightySixed ?? [];
  const lines = groups.flatMap((g) => g.lines);
  // FR-E5, ruling C-2: a quick sale has no fire control at all, so it has
  // nothing to refuse and nothing that is "not sendable yet" either — both
  // questions presuppose a control that does not exist on this order.
  const refusal = type === 'table' ? fireRefusal(blockingLines(lines, unavailable)) : undefined;
  // The order's other answer to "what can this send?": nothing, because every
  // line is already FIRED (FR-E1, FR-E2, B-16). Unavailable in place like the
  // refusal, but silent — it is not a refusal, it is an order that is not
  // fireable yet, and adding a line makes it fireable again.
  const sending = sendableLines(lines);
  const nothingToSend = type === 'table' && sending.length === 0;
  const panel = useRef<HTMLElement>(null);
  const blocking = blockingLines(lines, unavailable);
  // DESIGN-007 fireblocked: the offending row is scrolled into view when the state is first drawn.
  const firstBlocked = blocking[0]?.id;
  useLayoutEffect(() => {
    if (firstBlocked) reveal(panel.current?.querySelector<HTMLElement>(`[data-line-id="${firstBlocked}"]`));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first draw only
  }, []);
  const loading = MENU_FIXTURES[view.state].loading ?? false;
  // While the menu loads the panel draws a skeleton, not the lines (F2h). A live
  // Send there would fire an order the cashier cannot see, and the pending group
  // on screen is the whole confirmation (ARCH-002 §1.2). So it is inert in place,
  // and it names no count for lines that are not drawn. Under a lock or on an
  // empty order it is inert for a reason the count would only contradict: the
  // bare label, as DESIGN-007 leaves the lock states. A refusal (FR-E4) keeps the
  // count, because the order still holds those lines and the notice names them.
  const fireCount = loading || empty || lock !== undefined ? 0 : sending.length;

  return (
    <section className="order-panel" aria-labelledby="order-title" data-lock={lock} ref={panel}>
      <header className="order-panel__head">
        <h2 id="order-title" className="order-panel__title">
          {order.title}
        </h2>
        <span className="order-panel__count">{empty ? 'Empty' : orderCountLabel(type, count)}</span>
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
                type={type}
                lock={lock}
                unavailable={unavailable}
                pressedLineId={pressedLineId}
                actions={actions}
              />
            ))}
          </>
        )}
      </div>

      {refusal && (
        <FireRefusalNotice
          refusal={refusal}
          onShow={(lineId) => {
            reveal(panel.current?.querySelector<HTMLElement>(`[data-line-id="${lineId}"]`));
            panel.current?.querySelector<HTMLElement>(`[data-line-id="${lineId}"] .order-line__target`)?.focus({ preventScroll: true });
          }}
          blocking={blocking}
        />
      )}
      {type === 'table' && (
        <div className="order-sent" role="status" aria-live="polite">
          {sentRound !== undefined ? `Round ${sentRound} sent to the kitchen` : ''}
        </div>
      )}

      {loading ? <PanelSkeleton widths={['60', '40']} /> : <TotalsView totals={totals} />}
      <OrderActions
        type={type}
        off={empty || lock !== undefined}
        fireOff={refusal !== undefined || nothingToSend || loading}
        fireCount={fireCount}
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

function FireRefusalNotice({
  refusal,
  blocking,
  onShow,
}: {
  refusal: FireRefusal;
  blocking: ReadonlyArray<OrderLine>;
  onShow: (lineId: string) => void;
}) {
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
      {/* POS-03 question 10: the named line can be scrolled out of view, so each one has a way back to it. */}
      {blocking.map((line) => (
        <button key={line.id} type="button" className="notice__show" onClick={() => onShow(line.id)}>
          Show {line.name}
        </button>
      ))}
    </div>
  );
}

function RoundGroupView({
  group,
  view,
  type,
  lock,
  unavailable,
  pressedLineId,
  actions,
}: {
  group: RoundGroup;
  view: OrderView;
  type: OrderVariant;
  lock: SettlementLock | undefined;
  unavailable: ReadonlyArray<string>;
  pressedLineId: string | undefined;
  actions: PanelActions;
}) {
  // I-7: the header answers "did this go to the kitchen?". The tag is the only
  // statement of what a tap on the rows below will do, because a fired row's
  // slot is deliberately empty (I-12); under a lock it names the lock instead.
  // A quick sale never has a fired group (FR-E5), so pendingGroupHeading's own
  // branch on `type` is the only place this differs from a table order.
  const heading = group.kind === 'fired' ? roundHeading(group) : pendingGroupHeading(type);
  const tag = lock ? LOCK_TAG[lock] : group.kind === 'fired' ? FIRED_TAG : PENDING_TAG;

  return (
    <section className="round-group" aria-label={heading}>
      <h3 className="round-head" {...(group.kind === 'fired' && { 'data-round': group.round })}>
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

export function TotalsView({ totals }: { totals: Totals }) {
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
// VoidSheets.tsx): neither names a state. Settle's action definition keeps the
// historical query name that the panel tests exercise; OrderScreen resolves it
// onto POS-04's real route. Under a lock, and on an empty order, all four are
// drawn unavailable in place.
//
// `leaves` marks the one control that leaves POS-03, and so the only one that
// pushes a history entry: Settle, for POS-04, which SITEMAP §2 gives its own
// route. Firing stays here — the fire result is an [INLINE] state of this
// screen (SITEMAP §2, FR-E3).
//
// **Send to kitchen names no state.** It used to carry `?state=fireerror`,
// which swapped the cashier's order for a fixture's the moment fireerror became
// a state (F2k's opener defect in a fifth place). FE-022 gives it its real
// result: it calls `store.fire`, which folds the pending lines into one `queued`
// round through `fireOrder` (fire.ts). The result is an [INLINE] change of this
// screen, so it writes no `?state=` and no history entry, and the press asks no
// confirmation: the pending group on screen is the confirmation and the count on
// the control says how many (ARCH-002).
//
// F2d, FR-E5, ruling C-2: a quick sale presents **no fire control at all** —
// not this control gone off, the entry absent from the array below — and
// Settle carries the fire meaning instead, in the artifact's own width and
// words. `actionsFor` reads the order's variant, never `view.state`.
type ActionDef = { id: string; label: string; search?: string; leaves?: boolean; primary?: boolean; wide?: boolean };

const DISCOUNT_BTN: ActionDef = { id: DISCOUNT_ACTION, label: 'Discount' };
const VOID_ORDER_BTN: ActionDef = { id: VOID_ORDER_ACTION, label: 'Void order' };
const FIRE_BTN: ActionDef = { id: FIRE_ACTION, label: 'Send to kitchen' };

/** The fire control's words: how many lines it will send (DESIGN-007 — lines, not units), or the bare label when there are none. */
export const fireLabel = (count: number) => (count > 0 ? `Send ${count} to kitchen` : FIRE_BTN.label);
const SETTLE_BTN: ActionDef = { id: 'settle', label: 'Settle', search: '?state=settle', leaves: true, primary: true };
const SETTLE_WIDE_BTN: ActionDef = {
  id: 'settle',
  label: 'Settle — sends the order to the kitchen',
  search: '?state=settle',
  leaves: true,
  primary: true,
  wide: true,
};

/** Exported for test/quick-sale.test.tsx's proof that the close bar derives from the order's variant, not `view.state`. */
export function actionsFor(type: OrderVariant): ReadonlyArray<ActionDef> {
  return type === 'quick_sale'
    ? [DISCOUNT_BTN, VOID_ORDER_BTN, SETTLE_WIDE_BTN]
    : [DISCOUNT_BTN, VOID_ORDER_BTN, FIRE_BTN, SETTLE_BTN];
}

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
  type,
  off,
  fireOff,
  fireDescribedBy,
  fireCount,
  actions,
}: {
  type: OrderVariant;
  off: boolean;
  fireOff: boolean;
  fireCount: number;
  fireDescribedBy: string | undefined;
  actions: PanelActions;
}) {
  return (
    <div className="order-actions">
      {actionsFor(type).map((a) =>
        off || (fireOff && a.id === FIRE_ACTION) ? (
          <button
            key={a.id}
            type="button"
            className="action action--off"
            aria-disabled="true"
            data-action={a.id}
            aria-describedby={!off && a.id === FIRE_ACTION ? fireDescribedBy : undefined}
            onClick={() => {}}
          >
            {a.id === FIRE_ACTION ? fireLabel(fireCount) : a.label}
          </button>
        ) : (
          <button
            key={a.id}
            type="button"
            className={['action', a.primary && 'action--primary', a.wide && 'action--wide'].filter(Boolean).join(' ')}
            data-action={a.id}
            onClick={() => {
              if (a.search) actions.navigate(a.search, a.leaves ?? false);
              else if (a.id === DISCOUNT_ACTION) actions.openDiscount();
              else if (a.id === VOID_ORDER_ACTION) actions.openVoid({ kind: 'order' });
              else if (a.id === FIRE_ACTION) actions.fire();
            }}
          >
            {a.id === FIRE_ACTION ? fireLabel(fireCount) : a.label}
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

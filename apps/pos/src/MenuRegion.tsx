import { useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  AVAILABILITY_STATUS,
  CATALOG_NOTICE,
  EMPTY_CATALOG,
  EMPTY_CATEGORY,
  LOADING_LABEL,
  LOCK_NOTICE,
  READ_FAILURE,
  REJECTED_NOTICE,
  STALE_STATUS,
} from './catalog/menuCopy.js';
import type { CatalogItem } from './catalog/types.js';
import { useCatalog } from './catalog/useCatalog.js';
import { formatAmount } from './money.js';
import { originFacts, viewSearch, type OrderState, type OrderView, type SettlementLock } from './orderFixtures.js';

// POS-03, F2b: the menu region left of the order panel — the category rail and
// the tile grid, or, under a settlement lock, the notice that carries the route
// out of it. A tile and a category act on the order screen, so each is a
// <button>; the route out leaves it for settlement, so it is the one anchor
// (ruling of 2026-09-17).
//
// A category press is an [INLINE] change of this screen (SITEMAP §1): it
// selects that category and the grid shows its items (FE-023, the owner's
// ruling of 2026-09-24). It writes no URL and no history entry, and the order
// is untouched. The selection lives beside the order store, so it survives an
// item sheet opening and closing. This supersedes the ruling of 2026-09-21
// that the selection did not move, which existed only because the artifact
// drew one grid.
//
// F2h adds one notice here: B-20's rejected command. It is drawn over a live
// rail and grid, because the claim it makes is that nothing happened and the
// way to act on it is to add the line again.
export function MenuRegion({
  view,
  category,
  selectCategory,
  navigate = () => {},
  locked = false,
}: {
  view: OrderView;
  /** The id the order store holds; `undefined` on a fresh mount. The region resolves it against the menu it holds. */
  category: string | undefined;
  selectCategory: (category: string) => void;
  navigate?: (destination: string, leaves?: boolean) => void;
  /** F3d rule 2/3: a session-derived lock, always drawn as `draft` — never the lease's words, whatever the fixture says. */
  locked?: boolean;
}) {
  const { store, snapshot, picture, unavailable, destinationOf } = useCatalog(view);
  const fixture = picture ?? {};
  const menu = snapshot.menu;
  // The selection follows the category's id. One that is no longer on the menu (and a
  // fresh mount) falls to the first, silently, and the store is told so it stays there.
  const selected = menu?.categories.find((c) => c.id === category)?.id ?? menu?.categories[0]?.id;
  useLayoutEffect(() => {
    if (selected !== undefined && selected !== category) selectCategory(selected);
  }, [selected, category, selectCategory]);
  const lock = locked ? 'draft' : originFacts(view).lock;
  const region = useRef<HTMLDivElement>(null);
  // Set when a focused control is removed by a read (the *Try again* a success replaces, a tile an
  // archive removes). The next commit puts focus on the selected category, or on the empty-catalog
  // message when there is none, so a poll never leaves focus on the document.
  const refocus = useRef(false);
  useLayoutEffect(() => {
    if (!refocus.current) return;
    const target =
      region.current?.querySelector<HTMLElement>('.menu-category[aria-pressed="true"]') ??
      region.current?.querySelector<HTMLElement>('#menu-empty-catalog');
    if (!target) return;
    refocus.current = false;
    // Only while focus is still lost. A cashier who has moved to a surviving control (an order line, an
    // action, an open sheet) in the meantime keeps it: the fallback is cancelled.
    const active = document.activeElement;
    if (active && active !== document.body) return;
    target.focus();
  });

  // "Menu availability updated." stays until the next changed projection, the out-of-date warning,
  // or leaving POS-03 (this component unmounting); an unchanged poll keeps it (DESIGN-021 rule 5).
  // A newly adopted projection (a different menu object: an unchanged poll adopts none) ends the old
  // announcement, unless it changes availability itself, which announces again.
  const [availability, setAvailability] = useState({ seen: snapshot.availabilityChanges, menu, shown: false });
  if (availability.menu !== menu || availability.seen !== snapshot.availabilityChanges) {
    setAvailability({ seen: snapshot.availabilityChanges, menu, shown: availability.seen !== snapshot.availabilityChanges });
  } else if (snapshot.outOfDate && availability.shown) {
    setAvailability({ ...availability, shown: false });
  }
  const status = snapshot.outOfDate ? STALE_STATUS : availability.shown ? AVAILABILITY_STATUS : '';

  // Under either lock the rail and grid are absent, not inert: adding a line is
  // one of the five blocked actions and the grid is the surface that performs
  // it (AC-21, AC-29). The notice takes the space and carries the one way out;
  // without it a locked panel strands the cashier.
  if (lock) {
    return (
      <div className="order-screen__menu">
        <div className="menu-area">
          <LockNoticeView lock={lock} navigate={navigate} />
        </div>
      </div>
    );
  }

  const items = (menu?.items ?? []).filter((i) => i.categoryId === selected);
  const reading = fixture.loading === true || (menu === null && snapshot.read === 'loading');
  const loadingBlock = (
    <div className="menu-loading" aria-busy="true">
      <div className="menu-loading__label">{LOADING_LABEL}</div>
      <div className="skel-bar skel-bar--80" aria-hidden="true" />
      <div className="skel-bar skel-bar--60" aria-hidden="true" />
      <div className="skel-bar skel-bar--40" aria-hidden="true" />
    </div>
  );

  return (
    <div className="order-screen__menu" ref={region}>
      {menu !== null && menu.categories.length > 0 && (
        <nav className="menu-categories" aria-label="Menu categories">
          {menu.categories.map((c) => {
            const isSelected = c.id === selected;
            const pressed = fixture.pressedCategories?.includes(c.id) ?? false;
            return (
              <button
                key={c.id}
                type="button"
                className={['menu-category', isSelected && 'menu-category--selected', pressed && 'is-pressed']
                  .filter(Boolean)
                  .join(' ')}
                data-category={c.id}
                aria-pressed={isSelected}
                aria-current={isSelected ? 'true' : undefined}
                onClick={() => selectCategory(c.id)}
              >
                {c.name}
              </button>
            );
          })}
        </nav>
      )}

      <div className="menu-area">
        {fixture.catalogChanged && (
          <div className="notice menu-notice" role="status">
            <div className="notice__title">{CATALOG_NOTICE.title}</div>
            <div>{CATALOG_NOTICE.body}</div>
          </div>
        )}

        {/*
          B-20. The rejection is drawn over a live screen: the grid below is
          untouched, because adding the line again is the whole point of the
          state, and the order beside it is the order that was already there.

          *Try again* is a <button>: it acts on the screen it is on rather than
          going to one that already exists (ruling of 2026-09-17). All it can
          truthfully do with no server is clear the notice and leave the order
          alone — which is all B-20 claims — so it navigates to the view the
          fixture says this rejection was drawn over, replacing the history
          entry as every [INLINE] change of POS-03 does (SITEMAP §1).

          **The view's own `gone` rides along.** `fixture.rejected` names the
          state this rejection was drawn over, not the order the cashier is
          looking at: the state carries `gone` from the URL, not from the
          fixture, so a line the cashier removed with the notice on screen
          stays removed once the notice clears. Found by review — the review
          it caught by: fixture.rejected on its own discarded `view.gone`
          entirely, and the check that should have caught it started from the
          untouched fixture, where nothing was ever removed to lose.
        */}
        {fixture.rejected && (
          <div className="notice menu-notice" role="alert">
            <div className="notice__title">{REJECTED_NOTICE.title}</div>
            <div>{REJECTED_NOTICE.body}</div>
            <button
              type="button"
              className="action action--compact menu-notice__action"
              onClick={() => navigate(viewSearch({ ...fixture.rejected!, gone: view.gone }))}
            >
              {REJECTED_NOTICE.action}
            </button>
          </div>
        )}

        {/*
          Loading is the first read only: no timer, no countdown, no promised duration. One failed
          first read is a failure, which background retries do not turn back into loading; only the
          explicit *Try again* does. An empty catalog is a successful read with no categories: it
          offers no control (no retry, no link to the back office).
        */}
        {reading ? (
          loadingBlock
        ) : menu === null ? (
          <ReadFailed variant={snapshot.failure ?? 'failed'} retry={() => store.retry()} refocus={refocus} />
        ) : menu.categories.length === 0 ? (
          <div className="menu-empty" id="menu-empty-catalog" tabIndex={-1}>
            <div className="menu-empty__title">{EMPTY_CATALOG.title}</div>
            <div>{EMPTY_CATALOG.body}</div>
          </div>
        ) : (
          <div className="menu-grid">
            {items.length === 0 && <div className="menu-grid__empty">{EMPTY_CATEGORY}</div>}
            {items.map((item) => (
              <Tile
                key={item.id}
                item={item}
                off={unavailable.includes(item.id)}
                pressed={item.id === fixture.pressedItem}
                from={view.from ?? view.state}
                destinationOf={destinationOf}
                navigate={navigate}
                refocus={refocus}
              />
            ))}
          </div>
        )}

        {/*
          A fixed band, reserved when empty and always in the accessibility tree, so showing or clearing
          text moves nothing. Only the server's menu has anything to say here; the fixture pictures draw
          their own notices above and keep the fixture screens exactly as they were reviewed.
        */}
        {store.kind === 'real' && (
          <div className="menu-status" role="status" aria-live="polite">
            {status && <span key={snapshot.outOfDate ? 'stale' : availability.seen}>{status}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The shared general failure's two variants (*The system is unavailable* for `unavailable`,
 * *Something went wrong* otherwise), both with *Try again*. A failure moves focus to *Try again*
 * only when focus is on the document (nothing, or a control this read removed); anything else
 * the cashier is on keeps it. If the read succeeds while *Try again* holds focus, the region
 * puts focus on the first category.
 */
function ReadFailed({
  variant,
  retry,
  refocus,
}: {
  variant: 'unavailable' | 'failed';
  retry: () => void;
  refocus: MutableRefObject<boolean>;
}) {
  const copy = READ_FAILURE[variant];
  const button = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    refocus.current = false;
    const active = document.activeElement;
    if (!active || active === document.body) button.current?.focus();
  }, [refocus]);
  // The read control going away with focus on it: its success, or the press that shows loading.
  useLayoutEffect(() => {
    const el = button.current;
    return () => {
      if (el && document.activeElement === el) refocus.current = true;
    };
  }, [refocus]);
  return (
    <div className="notice menu-notice" role="alert">
      <div className="notice__title">{copy.title}</div>
      <div>{copy.body}</div>
      <button ref={button} type="button" className="action action--compact menu-notice__action" data-action="served-retry" onClick={retry}>
        {READ_FAILURE.retry}
      </button>
    </div>
  );
}

// Ruling C-3: an 86'd tile is disabled in place. It keeps its slot in the grid
// and its box, greys, and carries the 86 tag. FE-024: it is a button with
// aria-disabled that describes itself by the tag, so Tab reaches it. Its press
// does nothing, and the pressed rule below matches only an enabled tile. It is never removed and never moved to the end — a
// cashier's hand knows where Steak is, and a reflowed grid puts another item
// under it.
//
// One element for both states, so a poll that 86s or restores the item under a
// cashier's finger keeps the very node, and with it the focus. The accessible name is the
// full item name and its price, then "unavailable, 86" (DESIGN-021). The name wraps and is
// clamped after two lines; the price is its own line and is never clamped (R1).
function Tile({
  item,
  off,
  pressed,
  from,
  destinationOf,
  navigate,
  refocus,
}: {
  item: CatalogItem;
  off: boolean;
  pressed: boolean;
  /** The state this tile was pressed on: the item sheet returns there. */
  from: OrderState;
  /** `null`: this menu's tiles open nothing. */
  destinationOf: ((itemId: string, from?: OrderState) => string) | null;
  navigate: (destination: string, leaves?: boolean) => void;
  refocus: MutableRefObject<boolean>;
}) {
  const button = useRef<HTMLButtonElement>(null);
  // A removed tile that held focus sends it to its selected category (the region's effect).
  useLayoutEffect(() => {
    const el = button.current;
    return () => {
      if (el && document.activeElement === el) refocus.current = true;
    };
  }, [refocus]);
  const price = formatAmount(item.price);
  const tag = `tag-86-${item.id}`;
  // Spans, not divs: a <button> holds phrasing content only.
  return (
    <button
      ref={button}
      type="button"
      className={off ? 'menu-tile menu-tile--off' : pressed ? 'menu-tile is-pressed' : 'menu-tile'}
      data-item={item.id}
      aria-label={off ? `${item.name}, ${price}, unavailable, 86` : `${item.name}, ${price}`}
      aria-disabled={off ? 'true' : undefined}
      aria-describedby={off ? tag : undefined}
      onClick={() => {
        if (!off && destinationOf) navigate(destinationOf(item.id, from));
      }}
    >
      <span className="menu-tile__name">{item.name}</span>
      <span className="menu-tile__foot">
        <span className="menu-tile__price">{price}</span>
        {off && (
          <span className="tag-86" id={tag}>
            86
          </span>
        )}
      </span>
    </button>
  );
}

function LockNoticeView({
  lock,
  navigate,
}: {
  lock: SettlementLock;
  navigate: (destination: string, leaves?: boolean) => void;
}) {
  const { title, body, action, soft } = LOCK_NOTICE[lock];
  return (
    <div className={soft ? 'notice notice--soft menu-notice' : 'notice menu-notice'} role="status" data-lock={lock}>
      <div className="notice__title">{title}</div>
      <div>{body}</div>
      <a
        className="action action--compact menu-notice__action"
        href={action.href}
        onClick={(event) => {
          event.preventDefault();
          navigate(action.href, true);
        }}
      >
        {action.label}
      </a>
    </div>
  );
}

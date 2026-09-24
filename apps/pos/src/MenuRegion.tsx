import { formatAmount } from './money.js';
import {
  CATALOG_NOTICE,
  itemDestination,
  LOADING_LABEL,
  LOCK_NOTICE,
  MENU_CATEGORIES,
  menuFixtureFor,
  originFacts,
  itemsIn,
  REJECTED_NOTICE,
  type CategoryId,
  type MenuItem,
} from './menuFixtures.js';
import { viewSearch, type OrderState, type OrderView, type SettlementLock } from './orderFixtures.js';

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
  category: CategoryId;
  selectCategory: (category: CategoryId) => void;
  navigate?: (destination: string, leaves?: boolean) => void;
  /** F3d rule 2/3: a session-derived lock, always drawn as `draft` — never the lease's words, whatever the fixture says. */
  locked?: boolean;
}) {
  const fixture = menuFixtureFor(view);
  const lock = locked ? 'draft' : originFacts(view).lock;

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

  return (
    <div className="order-screen__menu">
      <nav className="menu-categories" aria-label="Menu categories">
        {MENU_CATEGORIES.map((c) => {
          const selected = c.id === category;
          const pressed = fixture.pressedCategories?.includes(c.id) ?? false;
          return (
            <button
              key={c.id}
              type="button"
              className={['menu-category', selected && 'menu-category--selected', pressed && 'is-pressed']
                .filter(Boolean)
                .join(' ')}
              aria-current={selected ? 'true' : undefined}
              onClick={() => selectCategory(c.id)}
            >
              {c.name}
            </button>
          );
        })}
      </nav>

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

        {fixture.loading ? (
          <div className="menu-loading" aria-busy="true">
            <div className="menu-loading__label">{LOADING_LABEL}</div>
            <div className="skel-bar skel-bar--80" aria-hidden="true" />
            <div className="skel-bar skel-bar--60" aria-hidden="true" />
            <div className="skel-bar skel-bar--40" aria-hidden="true" />
          </div>
        ) : (
          <div className="menu-grid">
            {itemsIn(category).map((item) => (
              <Tile
                key={item.id}
                item={item}
                off={fixture.eightySixed?.includes(item.id) ?? false}
                pressed={item.id === fixture.pressedItem}
                from={view.from ?? view.state}
                navigate={navigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Ruling C-3: an 86'd tile is disabled in place. It keeps its slot in the grid
// and its box, greys, and carries the 86 tag. It is a div, not a button, so it
// is not a control and no pressed rule can match it: nothing happened, so
// nothing says it did. It is never removed and never moved to the end — a
// cashier's hand knows where Steak is, and a reflowed grid puts another item
// under it.
function Tile({
  item,
  off,
  pressed,
  from,
  navigate,
}: {
  item: MenuItem;
  off: boolean;
  pressed: boolean;
  /** The state this tile was pressed on: the item sheet returns there. */
  from: OrderState;
  navigate: (destination: string, leaves?: boolean) => void;
}) {

  if (off) {
    return (
      <div className="menu-tile menu-tile--off" aria-disabled="true" data-item={item.id}>
        <div>
          {item.name} <span className="tag-86">86</span>
        </div>
        <div className="menu-tile__price">{formatAmount(item.price)}</div>
      </div>
    );
  }

  // Spans, not divs: a <button> holds phrasing content only. The tile is a
  // flex column, so each is laid out as the 86'd tile's divs are.
  return (
    <button
      type="button"
      className={pressed ? 'menu-tile is-pressed' : 'menu-tile'}
      data-item={item.id}
      onClick={() => navigate(itemDestination(item.id, from))}
    >
      <span>{item.name}</span>
      <span className="menu-tile__price">{formatAmount(item.price)}</span>
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

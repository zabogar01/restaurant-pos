import { formatAmount } from './money.js';
import {
  CATALOG_NOTICE,
  ITEM_HREF,
  LOADING_LABEL,
  LOCK_NOTICE,
  MENU_CATEGORIES,
  MENU_FIXTURES,
  MENU_ITEMS,
  SELECTED_CATEGORY,
  categoryHref,
  type MenuItem,
} from './menuFixtures.js';
import type { OrderState, SettlementLock } from './orderFixtures.js';

// POS-03, F2b: the menu region left of the order panel — the category rail and
// the tile grid, or, under a settlement lock, the notice that carries the route
// out of it.
export function MenuRegion({ state }: { state: OrderState }) {
  const fixture = MENU_FIXTURES[state];

  // Under either lock the rail and grid are absent, not inert: adding a line is
  // one of the five blocked actions and the grid is the surface that performs
  // it (AC-21, AC-29). The notice takes the space and carries the one way out;
  // without it a locked panel strands the cashier.
  if (fixture.lock) {
    return (
      <div className="order-screen__menu">
        <div className="menu-area">
          <LockNoticeView lock={fixture.lock} />
        </div>
      </div>
    );
  }

  return (
    <div className="order-screen__menu">
      <nav className="menu-categories" aria-label="Menu categories">
        {MENU_CATEGORIES.map((c) => {
          const selected = c.id === SELECTED_CATEGORY;
          const pressed = fixture.pressedCategories?.includes(c.id) ?? false;
          return (
            <a
              key={c.id}
              className={['menu-category', selected && 'menu-category--selected', pressed && 'is-pressed']
                .filter(Boolean)
                .join(' ')}
              href={categoryHref(c.id)}
              aria-current={selected ? 'true' : undefined}
            >
              {c.name}
            </a>
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

        {fixture.loading ? (
          <div className="menu-loading" aria-busy="true">
            <div className="menu-loading__label">{LOADING_LABEL}</div>
            <div className="menu-loading__bar menu-loading__bar--80" aria-hidden="true" />
            <div className="menu-loading__bar menu-loading__bar--60" aria-hidden="true" />
            <div className="menu-loading__bar menu-loading__bar--40" aria-hidden="true" />
          </div>
        ) : (
          <div className="menu-grid">
            {MENU_ITEMS.map((item) => (
              <Tile
                key={item.id}
                item={item}
                off={fixture.eightySixed?.includes(item.id) ?? false}
                pressed={item.id === fixture.pressedItem}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Ruling C-3: an 86'd tile is disabled in place. It keeps its slot in the grid
// and its box, greys, and carries the 86 tag. It is a div, not a link, so it is
// not a control and no pressed rule can match it: nothing happened, so nothing
// says it did. It is never removed and never moved to the end — a cashier's
// hand knows where Steak is, and a reflowed grid puts another item under it.
function Tile({ item, off, pressed }: { item: MenuItem; off: boolean; pressed: boolean }) {
  const price = <div className="menu-tile__price">{formatAmount(item.price)}</div>;

  if (off) {
    return (
      <div className="menu-tile menu-tile--off" aria-disabled="true" data-item={item.id}>
        <div>
          {item.name} <span className="tag-86">86</span>
        </div>
        {price}
      </div>
    );
  }

  return (
    <a className={pressed ? 'menu-tile is-pressed' : 'menu-tile'} href={ITEM_HREF} data-item={item.id}>
      <div>{item.name}</div>
      {price}
    </a>
  );
}

function LockNoticeView({ lock }: { lock: SettlementLock }) {
  const { title, body, action, soft } = LOCK_NOTICE[lock];
  return (
    <div className={soft ? 'notice notice--soft menu-notice' : 'notice menu-notice'} role="status" data-lock={lock}>
      <div className="notice__title">{title}</div>
      <div>{body}</div>
      <a className="action action--compact menu-notice__action" href={action.href}>
        {action.label}
      </a>
    </div>
  );
}

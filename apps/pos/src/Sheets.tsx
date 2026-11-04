import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ADD_REASON, CEILING_REASON, cannotIncrease } from './catalog/menuCopy.js';
import { follow, groupsOf, noticeOf, prune, startFollowing, type Picked } from './catalog/servedSheet.js';
import type { CatalogItem } from './catalog/types.js';
import { formatAmount } from './money.js';
import type { OrderView, Totals } from './orderFixtures.js';
import { ceilingFor, previewQuantity, unitOf, type AddOutcome, type NewLine } from './orderStore.js';
import { LINE_TOTAL_LIMIT, ORDER_TOTAL_LIMIT } from './tender.js';
import type { ShownOrder } from './voidFixtures.js';
import {
  QUANTITY_MAX,
  QUANTITY_MIN,
  unitPrice,
  type ItemGroup,
  type ItemOption,
  type ItemSheetFixture,
  type LineSheetFixture,
  type SheetFixture,
} from './sheetFixtures.js';

// POS-03's ungated sheets (F2c): M-2, the item configuration sheet, and the
// line editor. A sheet is a dialog over the order screen. It covers the menu
// region and leaves the order panel legible, because the running order is what
// the cashier is acting on (docs/DESIGN.md, Overlays); OrderScreen makes the
// rest of the frame inert while it is open, so the panel can be read but not
// operated. Every control is a <button>: each acts on the order, none leaves
// the screen (ruling of 2026-09-17).

export function SheetView({
  sheet,
  go,
  addLine,
  setQuantity,
  order,
  renderTotals,
  served = false,
}: {
  sheet: SheetFixture;
  go: (view: OrderView) => void;
  addLine: (line: NewLine) => AddOutcome;
  setQuantity: (lineId: string, quantity: number) => void;
  /** The store's order: the line editor reads its line's current quantity and previews against it. */
  order: ShownOrder;
  renderTotals: (totals: Totals) => ReactNode;
  /** This is a served catalog (the screen's catalog store is the server's): the line editor takes the served frame. */
  served?: boolean;
}) {
  return sheet.kind === 'item' ? (
    <ItemSheet sheet={sheet} go={go} addLine={addLine} />
  ) : (
    <LineSheet sheet={sheet} go={go} setQuantity={setQuantity} order={order} renderTotals={renderTotals} served={served} />
  );
}

export function SheetFrame({
  title,
  aside,
  band,
  foot,
  onClose,
  served = false,
  children,
}: {
  title: string;
  aside?: ReactNode;
  /**
   * A fixed band between the scrolling body and the footer (DESIGN-021 rule 8): what must stay in view
   * while the body scrolls. Absent for every fixture sheet, which are drawn as they were reviewed.
   */
  band?: ReactNode;
  foot: ReactNode;
  onClose: () => void;
  /**
   * M-2 over a served item and the served line editor: focus opens on the heading, and Tab and Shift-Tab are
   * contained in the sheet (DESIGN-021's focus rules). The fixture sheets keep the dialog itself as the
   * opening focus.
   */
  served?: boolean;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // Focus moves into the sheet when it opens: onto the dialog itself, so a
  // screen reader lands on its name rather than on whichever option is first.
  // A served sheet lands on its heading, which names it just the same.
  useEffect(() => (served ? heading.current : box.current)?.focus(), [served]);

  // Escape closes, as Cancel does. On the document, not the dialog, so it
  // still works after a press on the sheet's body has moved focus to nothing.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Tab wraps inside a served sheet. The heading is focusable but not a stop: from it, Tab goes to the
  // first control and Shift-Tab to the last.
  const contain = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!served || e.key !== 'Tab') return;
    const keys = [...e.currentTarget.querySelectorAll<HTMLElement>('button, a[href]')].filter((k) => !k.hasAttribute('disabled'));
    const i = keys.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey ? i <= 0 : i === keys.length - 1) {
      e.preventDefault();
      keys[e.shiftKey ? keys.length - 1 : 0]?.focus();
    }
  };

  return (
    <>
      <div className="sheet-scrim" aria-hidden="true" />
      <div
        className={served ? 'sheet sheet--served' : 'sheet'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        ref={box}
        onKeyDown={contain}
      >
        <div className="sheet__head">
          <h2 id="sheet-title" className="sheet__title" ref={heading} tabIndex={served ? -1 : undefined}>
            {title}
          </h2>
          {aside}
        </div>
        <div className="sheet__body">{children}</div>
        {band !== undefined && <div className="sheet__band">{band}</div>}
        <div className="sheet__foot">{foot}</div>
      </div>
    </>
  );
}

const signed = (delta: bigint) => (delta < 0n ? formatAmount(delta) : `+${formatAmount(delta)}`);

// The quantity control both sheets carry in their footer: − n +, beside the
// sheet's one commit. It only drafts a number; nothing here touches the order.
// − at the minimum is off and is never a removal (FR-M5): removal is Remove
// line, a separate control. Off means aria-disabled, never `disabled` (FE-024):
// it stays where the hand expects it and stays reachable by Tab, and it names
// the bound copy under the stepper as its reason.
const SHEET_BOUND_ID = 'sheet-bound';
const SHEET_UNAVAILABLE_ID = 'sheet-unavailable';
/** The footer's one reserved reason line: why the commit is off. Present, and empty, when there is none. */
const SHEET_REASON_ID = 'served-add-reason';

function QuantityStepper({
  value,
  onChange,
  moreBlocked = false,
}: {
  value: number;
  onChange: (n: number) => void;
  /** The next quantity would pass a money ceiling (D1): plus is off, minus stays live. */
  moreBlocked?: boolean;
}) {
  const step = (by: number) => {
    const next = Math.min(QUANTITY_MAX, Math.max(QUANTITY_MIN, value + by));
    if (next !== value) onChange(next);
  };
  const offPlus = value >= QUANTITY_MAX || moreBlocked;
  const off = (isOff: boolean) => (isOff ? 'action sheet-stepper__step action--off' : 'action sheet-stepper__step');
  return (
    <div className="sheet-stepper sheet-stepper--foot" role="group" aria-label="Quantity">
      <button
        type="button"
        className={off(value <= QUANTITY_MIN)}
        aria-label="Decrease quantity"
        aria-disabled={value <= QUANTITY_MIN}
        aria-describedby={value <= QUANTITY_MIN ? SHEET_BOUND_ID : undefined}
        onClick={() => value > QUANTITY_MIN && step(-1)}
      >
        −
      </button>
      <output className="sheet-stepper__value" aria-live="polite" aria-label="Quantity">
        {value}
      </output>
      <button
        type="button"
        className={off(offPlus)}
        aria-label="Increase quantity"
        aria-disabled={offPlus}
        aria-describedby={offPlus ? SHEET_BOUND_ID : undefined}
        onClick={() => !offPlus && step(1)}
      >
        +
      </button>
    </div>
  );
}

/**
 * What the artifact says under the stepper, by bound. `adding` is the item sheet, whose minimum has no line to
 * remove. `ceiling` is the money sentence when the NEXT quantity would pass one (D1); it takes the line.
 */
function boundCopy(quantity: number, adding: boolean, ceiling?: string): string {
  if (quantity >= QUANTITY_MAX) return `Maximum ${QUANTITY_MAX} per line. Increase is unavailable.`;
  if (ceiling) return cannotIncrease(ceiling);
  if (quantity <= QUANTITY_MIN) return adding ? `Minimum ${QUANTITY_MIN} per line.` : `Minimum ${QUANTITY_MIN}. Use Remove line to remove this line.`;
  return `Quantity · whole numbers, maximum ${QUANTITY_MAX}`;
}

const ceilingSentence = (which: 'line' | 'order' | undefined) =>
  which && (which === 'line' ? CEILING_REASON(LINE_TOTAL_LIMIT).line : CEILING_REASON(ORDER_TOTAL_LIMIT).order);

// M-2. Choose-one and choose-any groups, and the line total follows the
// selection and the quantity. When a manager 86s the item mid-choice (FR-C6,
// AC-12) the sheet stays open, the selections stay exactly as they were so the
// cashier can read them back, a notice says why, and Add to order stops being a
// control: an inert button (aria-disabled, FE-024), drawn unavailable in place,
// that describes itself by the notice. The same shape as the 86'd tile (C-3)
// and the disabled Continue on the lock screen.
// The stepper stays while the item is unavailable (DESIGN-021 rule 10: the
// drawing, not the earlier comment here, is right): quantity can still be
// drafted, and Add alone is blocked.
function ItemSheet({
  sheet,
  go,
  addLine,
}: {
  sheet: ItemSheetFixture;
  go: (view: OrderView) => void;
  addLine: (line: NewLine) => AddOutcome;
}) {
  const [picked, setPicked] = useState<Readonly<Record<string, ReadonlyArray<string>>>>(sheet.chosen);
  const [quantity, setQuantity] = useState(QUANTITY_MIN);

  const chosen = (group: ItemGroup) => group.options.filter((o) => picked[group.id]?.includes(o.id));
  const unit = unitPrice(sheet.price, sheet.groups.flatMap((group) => chosen(group).map((o) => o.delta)));
  const total = unit * BigInt(quantity);
  const pick = (group: ItemGroup, id: string) =>
    setPicked((p) => {
      const now = p[group.id] ?? [];
      return { ...p, [group.id]: group.many ? (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]) : [id] };
    });

  // FE-014, mutation 1; FR-D4. Every chosen option is snapshotted onto the
  // line, a zero-delta Size such as Regular included: the line must say which
  // one the cashier chose, whatever it cost. A zero delta is written as the
  // bare name, as the panel draws it.
  const chosenModifiers = () =>
    sheet.groups.flatMap((group) => chosen(group).map(({ name, delta }) => (delta === 0n ? { name } : { name, delta })));

  return (
    <SheetFrame
      title={sheet.name}
      aside={<span className="sheet__aside">{formatAmount(sheet.price)}</span>}
      onClose={() => go(sheet.cancel)}
      foot={
        <>
          <div className="sheet__secondary">
            <button type="button" className="action" onClick={() => go(sheet.cancel)}>
              Cancel
            </button>
          </div>
          <div className="sheet__commit">
            <QuantityStepper value={quantity} onChange={setQuantity} />
            {sheet.unavailable ? (
              <button
                type="button"
                className="action action--off"
                aria-disabled="true"
                aria-describedby={SHEET_UNAVAILABLE_ID}
                onClick={() => {}}
              >
                Add to order
              </button>
            ) : (
              <button
                type="button"
                className="action action--primary"
                onClick={() => {
                  // A refusal changes nothing and the sheet stays (the screen should not have offered the press).
                  if (!addLine({ itemId: sheet.itemId, name: sheet.name, quantity, basePrice: sheet.price, modifiers: chosenModifiers() }).refused) go(sheet.add);
                }}
              >
                Add to order
              </button>
            )}
          </div>
          <div className="sheet__bound" id={SHEET_BOUND_ID} aria-live="polite">
            {boundCopy(quantity, true)}
          </div>
        </>
      }
    >
      {sheet.unavailable && (
        <div className="notice sheet__notice" role="status" id={SHEET_UNAVAILABLE_ID}>
          <div className="notice__title">{sheet.unavailable.title}</div>
          <div>{sheet.unavailable.body}</div>
        </div>
      )}

      {sheet.groups.map((group) => (
        <div key={group.id} className="sheet-group" role="group" aria-labelledby={`sheet-group-${group.id}`}>
          <span id={`sheet-group-${group.id}`} className="sheet__label">
            {group.name} — choose {group.many ? 'any' : 'one'}
          </span>
          <div className="sheet-options">
            {group.options.map((o) => (
              <OptionButton
                key={o.id}
                option={o}
                selected={picked[group.id]?.includes(o.id) ?? false}
                stacked={!group.many}
                onPress={() => pick(group, o.id)}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="sheet-total">
        <span>Line total</span>
        <span className="sheet-total__amount">{formatAmount(total)}</span>
      </div>
      {quantity > 1 && (
        <div className="sheet__note">
          {formatAmount(unit)} × {quantity} = {formatAmount(total)}
        </div>
      )}
    </SheetFrame>
  );
}

/**
 * M-2 for a served item (PHASE1-S7b2; consult C4 items 7 and 8; DESIGN-021 rules 7 to 11). The cashier chooses
 * from the live catalog item, and the sheet follows that item while it is open.
 *
 * - **The adapter.** The groups come from the item as it is *now* (`groupsOf` over the last-known item), at
 *   each render, so a price, a name, an option's delta or an addition shows at once and what is displayed is
 *   what Add adds (FR-C7). The cashier's choices (`picked`) are option ids; a line snapshots names and deltas.
 * - **The item leaving the projection** (archived, or its category) changes nothing on the sheet but Add and
 *   the notice: the last-known details stay readable, and Cancel returns to a grid without that tile.
 * - **Nothing is preselected,** and an item with variants needs exactly one before Add.
 * - **One owner for the notice and the reason,** both derived from the item and the order at each render: the
 *   notice lives in a fixed band between the scrolling body and the footer, and the reason on the footer's
 *   one reserved line, so a poll arriving moves neither the options nor Add (rule 8).
 * - **Add is `aria-disabled`, never `disabled`** (rule 10): a poll that turns it off while it has focus keeps
 *   focus on it, its press does nothing, and Escape still closes. The stepper stays while the item is
 *   unavailable or absent; Add alone is blocked.
 */
export function ServedItemSheet({
  opened,
  live,
  order,
  addLine,
  onClose,
}: {
  /** The item as the tile showed it when the sheet opened: where the sheet starts remembering. */
  opened: CatalogItem;
  /** The item in the current projection, or `undefined` once it has left it. */
  live: CatalogItem | undefined;
  /** The store's order: the order ceiling counts what it already holds. */
  order: ShownOrder;
  addLine: (line: NewLine) => AddOutcome;
  /** Cancel, Escape, and a successful Add. All three leave the view as it is. */
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Picked>({});
  const [quantity, setQuantity] = useState(QUANTITY_MIN);
  const [followed, setFollowed] = useState(() => startFollowing(opened));
  // Between polls: the sheet compares the item it holds with the one the poll brought, and drops any
  // choice that is no longer an option. Adjusted while rendering, so no frame shows the old item.
  const advanced = follow(followed, live, picked);
  if (advanced !== followed) {
    setFollowed(advanced);
    setPicked(prune(picked, advanced.known));
  }
  const item = followed.known;
  const availability = live === undefined ? 'gone' : live.available ? 'available' : 'unavailable';

  const groups = groupsOf(item);
  const chosen = (group: ReturnType<typeof groupsOf>[number]) => group.options.filter((o) => picked[group.id]?.includes(o.id));
  const unit = unitPrice(item.price, groups.flatMap((group) => chosen(group).map((o) => o.delta)));
  const total = unit * BigInt(quantity);
  const variants = groups.find((group) => group.id === 'variant');
  const needsVariant = variants !== undefined && chosen(variants).length === 0;
  const ceiling = ceilingFor(order, unit, quantity);
  const nextCeiling = quantity < QUANTITY_MAX ? ceilingFor(order, unit, quantity + 1) : undefined;
  // Why Add is off, the first that holds. An item that is gone or 86'd is explained by the notice too; the
  // reason is the footer's one line, and says it in the words the button is described by.
  const reason =
    availability === 'gone'
      ? ADD_REASON.gone
      : availability === 'unavailable'
        ? ADD_REASON.unavailable
        : needsVariant
          ? ADD_REASON.variant
          : (ceilingSentence(ceiling) ?? '');
  const addOff = reason !== '';

  const pick = (group: ReturnType<typeof groupsOf>[number], id: string) =>
    setPicked((p) => {
      const now = p[group.id] ?? [];
      return { ...p, [group.id]: group.many ? (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]) : [id] };
    });

  // Every chosen option is snapshotted onto the line, a zero-delta one included: the line must say which the
  // cashier chose, whatever it cost. A zero delta is written as the bare name, as the panel draws it.
  const chosenModifiers = () =>
    groups.flatMap((group) => chosen(group).map(({ name, delta }) => (delta === 0n ? { name } : { name, delta })));

  // A focused option that a poll removes sends focus to its group's heading, or to the sheet's when the
  // group is gone too, without scrolling the body. Only while focus is lost: a cashier who has moved on keeps it.
  const lastOption = useRef<{ group: string; option: string } | null>(null);
  useLayoutEffect(() => {
    const was = lastOption.current;
    if (!was || document.querySelector(`.sheet [data-option="${was.option}"]`)) return;
    lastOption.current = null;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const target = document.getElementById(`sheet-group-${was.group}`) ?? document.getElementById('sheet-title');
    if (!target) return;
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
  });

  const text = noticeOf(followed, availability);

  return (
    <SheetFrame
      served
      title={item.name}
      aside={<span className="sheet__aside">{formatAmount(item.price)}</span>}
      onClose={onClose}
      band={
        <>
          <div className="sheet__live" id="served-sheet-notice" role="status" aria-live="polite">
            {text}
          </div>
          <div className="sheet-figure">
            <span>Unit price</span>
            <b id="served-unit">{formatAmount(unit)}</b>
          </div>
          <div className="sheet-total">
            <span>Line total</span>
            <span className="sheet-total__amount" data-line-total>
              {formatAmount(total)}
            </span>
          </div>
          {quantity > 1 && (
            <div className="sheet__note">
              {formatAmount(unit)} × {quantity} = {formatAmount(total)}
            </div>
          )}
        </>
      }
      foot={
        <>
          <div className="sheet__secondary">
            <button type="button" className="action" onClick={onClose}>
              Cancel
            </button>
          </div>
          <div className="sheet__commit">
            <QuantityStepper value={quantity} onChange={setQuantity} moreBlocked={nextCeiling !== undefined} />
            <button
              type="button"
              className={addOff ? 'action action--primary action--off' : 'action action--primary'}
              aria-disabled={addOff}
              aria-describedby={SHEET_REASON_ID}
              onClick={() => {
                if (addOff) return;
                // The store asks again at the press and may refuse; the sheet then stays, as it should
                // never have offered the press.
                const outcome = addLine({
                  itemId: item.id,
                  name: item.name,
                  quantity,
                  basePrice: item.price,
                  modifiers: chosenModifiers(),
                });
                if (!outcome.refused) onClose();
              }}
            >
              Add to order
            </button>
          </div>
          <div className="sheet__reason" id={SHEET_REASON_ID} aria-live="polite">
            {reason}
          </div>
          <div className="sheet__bound" id={SHEET_BOUND_ID} aria-live="polite">
            {boundCopy(quantity, true, ceilingSentence(nextCeiling))}
          </div>
        </>
      }
    >
      {groups.map((group) => (
        <div key={group.id} className="sheet-group" role="group" aria-labelledby={`sheet-group-${group.id}`}>
          <span id={`sheet-group-${group.id}`} className="sheet__label">
            {group.name} — choose {group.many ? 'any' : 'one'}
          </span>
          <div
            className="sheet-options"
            onFocus={(e) => {
              const option = (e.target as HTMLElement).dataset.option;
              if (option) lastOption.current = { group: group.id, option };
            }}
            onBlur={(e) => {
              // Focus moving to another control ends the claim; a removal leaves no `relatedTarget`.
              if (e.relatedTarget) lastOption.current = null;
            }}
          >
            {group.options.map((o) => (
              <OptionButton key={o.id} option={o} selected={picked[group.id]?.includes(o.id) ?? false} onPress={() => pick(group, o.id)} />
            ))}
          </div>
        </div>
      ))}
    </SheetFrame>
  );
}

// Selection fills (A7): a chosen option takes the primary fill, as the
// artifact draws it. aria-pressed carries the same fact for assistive tech.
function OptionButton({
  option,
  selected,
  stacked = false,
  onPress,
}: {
  option: ItemOption;
  selected: boolean;
  stacked?: boolean;
  onPress: () => void;
}) {
  const className = ['action', 'sheet-option', stacked && 'sheet-option--stacked', selected && 'action--primary']
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={className} aria-pressed={selected} data-option={option.id} onClick={onPress}>
      {stacked ? (
        <>
          <span>{option.name}</span>
          <span>{signed(option.delta)}</span>
        </>
      ) : (
        `${option.name} ${signed(option.delta)}`
      )}
    </button>
  );
}

// The line editor, retained for quantity (FR-D5, FR-M5), which has nowhere
// else to live. The stepper drafts a number; *Update to n* is the one thing that
// writes it (store.setQuantity) and it is off while the draft equals the line's
// quantity. Back discards the draft. Remove line is the separate, secondary
// exit; the remove control on the row is the fast path. Both are ungated: the
// line is PENDING (FR-H2), which is also why a fired line never opens this
// sheet and so never has a stepper.
function LineSheet({
  sheet,
  go,
  setQuantity,
  order,
  renderTotals,
  served,
}: {
  sheet: LineSheetFixture;
  go: (view: OrderView) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  order: ShownOrder;
  renderTotals: (totals: Totals) => ReactNode;
  /** Served catalog: the served frame (heading focus, Tab wrap, wrapping header) and the reserved reason row. */
  served: boolean;
}) {
  const line = order.groups.flatMap((g) => g.lines).find((l) => l.id === sheet.lineId);
  // The order's own quantity wins over the fixture's, so a line the cashier
  // already updated opens at what it now says.
  const current = line?.quantity ?? sheet.quantity;
  const [quantity, setDraft] = useState(current);
  const changed = quantity !== current;
  const preview = line ? previewQuantity(order, sheet.lineId, quantity) : undefined;
  const unit = line ? unitOf(line) : 0n;
  // D1: the same question the item sheet and the store ask. *Update* is off past a ceiling, with the reason,
  // and plus is off when the next quantity would pass one; minus stays live.
  const ceiling = line ? ceilingFor(order, unit, quantity, line.id) : undefined;
  const nextCeiling = line && quantity < QUANTITY_MAX ? ceilingFor(order, unit, quantity + 1, line.id) : undefined;
  const updateOff = !changed || ceiling !== undefined;

  return (
    <SheetFrame
      served={served}
      title={sheet.title}
      aside={sheet.tag && <span className="sheet__aside round-head__tag">{sheet.tag}</span>}
      onClose={() => go(sheet.back)}
      foot={
        <>
          <div className="sheet__secondary">
            <button type="button" className="action" onClick={() => go(sheet.back)}>
              Back
            </button>
            <button type="button" className="action" onClick={() => go(sheet.remove)}>
              Remove line
            </button>
          </div>
          <div className="sheet__commit">
            <QuantityStepper value={quantity} onChange={setDraft} moreBlocked={nextCeiling !== undefined} />
            <button
              type="button"
              className={updateOff ? 'action action--primary action--off' : 'action action--primary'}
              aria-disabled={updateOff}
              aria-describedby={served && ceiling ? SHEET_REASON_ID : undefined}
              data-action="update-quantity"
              onClick={() => {
                if (updateOff) return;
                setQuantity(sheet.lineId, quantity);
                go(sheet.back);
              }}
            >
              Update to {quantity}
            </button>
          </div>
          {/* Served mode only: the fixture editor keeps its reviewed layout, with no reason row. */}
          {served && (
            <div className="sheet__reason" id={SHEET_REASON_ID} aria-live="polite">
              {ceilingSentence(ceiling)}
            </div>
          )}
          <div className="sheet__bound" id={SHEET_BOUND_ID} aria-live="polite">
            {boundCopy(quantity, false, ceilingSentence(nextCeiling))}
          </div>
        </>
      }
    >
      <div className="sheet-group" role="group" aria-labelledby="sheet-quantity">
        <span id="sheet-quantity" className="sheet__label">
          Quantity — whole numbers, maximum {QUANTITY_MAX}
        </span>
      </div>

      {preview && (
        <>
          <div className="sheet-total">
            <span>Line total</span>
            <span className="sheet-total__amount">{formatAmount(preview.amount)}</span>
          </div>
          <div className="sheet__note">
            {formatAmount(unit)} × {quantity} = {formatAmount(preview.amount)}
          </div>
          <div className="sheet__preview">
            <span className="sheet__label">After update · not saved yet</span>
            {renderTotals(preview.totals)}
          </div>
        </>
      )}

      {sheet.notes.map((n) => (
        <p key={n} className="sheet__note">
          {n}
        </p>
      ))}
    </SheetFrame>
  );
}

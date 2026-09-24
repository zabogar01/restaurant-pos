import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatAmount } from './money.js';
import type { OrderView, Totals } from './orderFixtures.js';
import { previewQuantity, unitOf, type NewLine } from './orderStore.js';
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
}: {
  sheet: SheetFixture;
  go: (view: OrderView) => void;
  addLine: (line: NewLine) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  /** The store's order: the line editor reads its line's current quantity and previews against it. */
  order: ShownOrder;
  renderTotals: (totals: Totals) => ReactNode;
}) {
  return sheet.kind === 'item' ? (
    <ItemSheet sheet={sheet} go={go} addLine={addLine} />
  ) : (
    <LineSheet sheet={sheet} go={go} setQuantity={setQuantity} order={order} renderTotals={renderTotals} />
  );
}

export function SheetFrame({
  title,
  aside,
  foot,
  onClose,
  children,
}: {
  title: string;
  aside?: ReactNode;
  foot: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);

  // Focus moves into the sheet when it opens: onto the dialog itself, so a
  // screen reader lands on its name rather than on whichever option is first.
  useEffect(() => box.current?.focus(), []);

  // Escape closes, as Cancel does. On the document, not the dialog, so it
  // still works after a press on the sheet's body has moved focus to nothing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="sheet-scrim" aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabIndex={-1} ref={box}>
        <div className="sheet__head">
          <h2 id="sheet-title" className="sheet__title">
            {title}
          </h2>
          {aside}
        </div>
        <div className="sheet__body">{children}</div>
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

function QuantityStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const step = (by: number) => {
    const next = Math.min(QUANTITY_MAX, Math.max(QUANTITY_MIN, value + by));
    if (next !== value) onChange(next);
  };
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
        className={off(value >= QUANTITY_MAX)}
        aria-label="Increase quantity"
        aria-disabled={value >= QUANTITY_MAX}
        aria-describedby={value >= QUANTITY_MAX ? SHEET_BOUND_ID : undefined}
        onClick={() => value < QUANTITY_MAX && step(1)}
      >
        +
      </button>
    </div>
  );
}

/** What the artifact says under the stepper, by bound. `adding` is the item sheet, whose minimum has no line to remove. */
function boundCopy(quantity: number, adding: boolean): string {
  if (quantity >= QUANTITY_MAX) return `Maximum ${QUANTITY_MAX} per line. Increase is unavailable.`;
  if (quantity <= QUANTITY_MIN) return adding ? `Minimum ${QUANTITY_MIN} per line.` : `Minimum ${QUANTITY_MIN}. Use Remove line to remove this line.`;
  return `Quantity · whole numbers, maximum ${QUANTITY_MAX}`;
}

// M-2. Choose-one and choose-any groups, and the line total follows the
// selection and the quantity. When a manager 86s the item mid-choice (FR-C6,
// AC-12) the sheet stays open, the selections stay exactly as they were so the
// cashier can read them back, a notice says why, and Add to order stops being a
// control: an inert button (aria-disabled, FE-024), drawn unavailable in place,
// that describes itself by the notice. The same shape as the 86'd tile (C-3)
// and the disabled Continue on the lock screen.
// There is no quantity to commit then, so no stepper.
function ItemSheet({
  sheet,
  go,
  addLine,
}: {
  sheet: ItemSheetFixture;
  go: (view: OrderView) => void;
  addLine: (line: NewLine) => void;
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
                  addLine({ itemId: sheet.itemId, name: sheet.name, quantity, modifiers: chosenModifiers() });
                  go(sheet.add);
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
}: {
  sheet: LineSheetFixture;
  go: (view: OrderView) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  order: ShownOrder;
  renderTotals: (totals: Totals) => ReactNode;
}) {
  const line = order.groups.flatMap((g) => g.lines).find((l) => l.id === sheet.lineId);
  // The order's own quantity wins over the fixture's, so a line the cashier
  // already updated opens at what it now says.
  const current = line?.quantity ?? sheet.quantity;
  const [quantity, setDraft] = useState(current);
  const changed = quantity !== current;
  const preview = line ? previewQuantity(order, sheet.lineId, quantity) : undefined;
  const unit = line ? unitOf(line) : 0n;

  return (
    <SheetFrame
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
            <QuantityStepper value={quantity} onChange={setDraft} />
            <button
              type="button"
              className={changed ? 'action action--primary' : 'action action--primary action--off'}
              aria-disabled={!changed}
              data-action="update-quantity"
              onClick={() => {
                if (!changed) return;
                setQuantity(sheet.lineId, quantity);
                go(sheet.back);
              }}
            >
              Update to {quantity}
            </button>
          </div>
          <div className="sheet__bound" id={SHEET_BOUND_ID} aria-live="polite">
            {boundCopy(quantity, false)}
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

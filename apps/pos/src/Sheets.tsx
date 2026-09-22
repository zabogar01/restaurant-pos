import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatAmount } from './money.js';
import type { OrderView } from './orderFixtures.js';
import type { NewLine } from './orderStore.js';
import {
  QUANTITY_MAX,
  QUANTITY_MIN,
  unitPrice,
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
}: {
  sheet: SheetFixture;
  go: (view: OrderView) => void;
  addLine: (line: NewLine) => void;
}) {
  return sheet.kind === 'item' ? <ItemSheet sheet={sheet} go={go} addLine={addLine} /> : <LineSheet sheet={sheet} go={go} />;
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

// M-2. Size is choose-one, extras choose-any, and the line total follows the
// selection. When a manager 86s the item mid-choice (FR-C6, AC-12) the sheet
// stays open, the selections stay exactly as they were so the cashier can read
// them back, a notice says why, and Add to order stops being a control: a
// span, drawn unavailable in place, with nothing to press. The same shape as
// the 86'd tile (C-3) and the disabled Continue on the lock screen.
function ItemSheet({
  sheet,
  go,
  addLine,
}: {
  sheet: ItemSheetFixture;
  go: (view: OrderView) => void;
  addLine: (line: NewLine) => void;
}) {
  const [size, setSize] = useState(sheet.chosen.size);
  const [extras, setExtras] = useState<ReadonlyArray<string>>(sheet.chosen.extras);

  const deltaOf = (options: ReadonlyArray<ItemOption>, id: string) => options.find((o) => o.id === id)?.delta ?? 0n;
  const total = unitPrice(sheet.price, [deltaOf(sheet.sizes, size), ...extras.map((id) => deltaOf(sheet.extras, id))]);
  const toggle = (id: string) => setExtras((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  // FE-014, mutation 1. A modifier is shown when it is worth showing: a
  // priced option only when it actually changes the price (the artifact never
  // shows "Regular" beside a Burger charged at its base price), an extra
  // whenever it is chosen, at whatever delta it carries — zero included, on
  // the same footing as the Steak's own no-delta "Medium rare".
  const chosenModifiers = () => {
    const opt = (options: ReadonlyArray<ItemOption>, id: string) => options.find((o) => o.id === id)!;
    const sizeOpt = opt(sheet.sizes, size);
    const mods = extras.map((id) => opt(sheet.extras, id)).map(({ name, delta }) => (delta === 0n ? { name } : { name, delta }));
    return sizeOpt.delta === 0n ? mods : [{ name: sizeOpt.name, delta: sizeOpt.delta }, ...mods];
  };

  return (
    <SheetFrame
      title={sheet.name}
      aside={<span className="sheet__aside">{formatAmount(sheet.price)}</span>}
      onClose={() => go(sheet.cancel)}
      foot={
        <>
          <button type="button" className="action" onClick={() => go(sheet.cancel)}>
            Cancel
          </button>
          {sheet.unavailable ? (
            <span className="action action--off" aria-disabled="true">
              Add to order
            </span>
          ) : (
            <button
              type="button"
              className="action action--primary"
              onClick={() => {
                addLine({ itemId: sheet.itemId, name: sheet.name, quantity: 1, modifiers: chosenModifiers() });
                go(sheet.add);
              }}
            >
              Add to order
            </button>
          )}
        </>
      }
    >
      {sheet.unavailable && (
        <div className="notice sheet__notice" role="status">
          <div className="notice__title">{sheet.unavailable.title}</div>
          <div>{sheet.unavailable.body}</div>
        </div>
      )}

      <div className="sheet-group" role="group" aria-labelledby="sheet-sizes">
        <span id="sheet-sizes" className="sheet__label">
          Size — choose one
        </span>
        <div className="sheet-options">
          {sheet.sizes.map((o) => (
            <OptionButton key={o.id} option={o} selected={o.id === size} stacked onPress={() => setSize(o.id)} />
          ))}
        </div>
      </div>

      <div className="sheet-group" role="group" aria-labelledby="sheet-extras">
        <span id="sheet-extras" className="sheet__label">
          Extras — choose any
        </span>
        <div className="sheet-options">
          {sheet.extras.map((o) => (
            <OptionButton key={o.id} option={o} selected={extras.includes(o.id)} onPress={() => toggle(o.id)} />
          ))}
        </div>
      </div>

      <div className="sheet-total">
        <span>Line total</span>
        <span className="sheet-total__amount">{formatAmount(total)}</span>
      </div>
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
// else to live. Its Remove is the exit from the sheet; the remove control on
// the row is the fast path. Both are ungated: the line is PENDING (FR-H2).
// The quantity changes only on the sheet: this fixture has no command to send
// it with, so the panel does not follow.
function LineSheet({ sheet, go }: { sheet: LineSheetFixture; go: (view: OrderView) => void }) {
  const [quantity, setQuantity] = useState(sheet.quantity);
  const step = (by: number) => setQuantity((q) => Math.min(QUANTITY_MAX, Math.max(QUANTITY_MIN, q + by)));

  return (
    <SheetFrame
      title={sheet.title}
      aside={sheet.tag && <span className="sheet__aside round-head__tag">{sheet.tag}</span>}
      onClose={() => go(sheet.back)}
      foot={
        <>
          <button type="button" className="action" onClick={() => go(sheet.back)}>
            Back
          </button>
          <button type="button" className="action action--primary" onClick={() => go(sheet.remove)}>
            Remove line
          </button>
        </>
      }
    >
      <div className="sheet-group" role="group" aria-labelledby="sheet-quantity">
        <span id="sheet-quantity" className="sheet__label">
          Quantity — whole numbers, maximum {QUANTITY_MAX}
        </span>
        <div className="sheet-stepper">
          <button type="button" className="action sheet-stepper__step" aria-label="Decrease quantity" onClick={() => step(-1)}>
            −
          </button>
          <output className="sheet-stepper__value" aria-live="polite" aria-label="Quantity">
            {quantity}
          </output>
          <button type="button" className="action sheet-stepper__step" aria-label="Increase quantity" onClick={() => step(1)}>
            +
          </button>
        </div>
      </div>

      {sheet.notes.map((n) => (
        <p key={n} className="sheet__note">
          {n}
        </p>
      ))}
    </SheetFrame>
  );
}

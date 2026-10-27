import { priceText } from '../menu/money.js';
import type { NameError } from '../menu/name.js';
import {
  CHANGE_EMPTY,
  CHANGE_NEGATIVE,
  MODIFIERS,
  MODIFIERS_HELP,
  MODIFIERS_NOTE,
  MOVE_DOWN,
  MOVE_UP,
  NEW_OPTION,
  OPTION_NAME_LONG,
  PREVIEW_FLOOR,
  PREVIEW_UNKNOWN,
  REMOVE,
  UNDO,
  VARIANTS,
  VARIANTS_FLOOR,
  VARIANTS_HELP,
  VARIANTS_NOTE,
  WILL_BE_REMOVED,
  addLabel,
  changeBounds,
  changeFormat,
  changeLabel,
  emptyList,
  moveDownName,
  moveUpName,
  nameLabel,
  optionNameControl,
  optionNameDuplicate,
  optionNameEmpty,
  previewOver,
  removeName,
  undoName,
  withoutModifiers,
} from './copy.js';
import type { Form, ItemModel, OptionFault } from './model.js';
import { listKey, optionId, type OptionKind, type Row } from './options.js';
import type { PriceError } from './price.js';
import { previewOf } from './preview.js';

// The Variants and Modifiers sections of BO-04 (PHASE1-S4c2b), as DESIGN-020 draws them: two
// lists with their own heading, note, help and Add, each row a name, a price change and its three
// controls, a saved row's removal pending until Save, and, under a variant, the price without
// modifiers. It draws what the model holds and keeps nothing of its own. An off action is
// `aria-disabled` with `tabIndex={-1}`, never `disabled`; the fields are inert while a save is
// pending.

const nameFault = (kind: OptionKind, fault: OptionFault): string => {
  const byError: Record<NameError | 'duplicate', string> = {
    empty: optionNameEmpty(kind),
    long: OPTION_NAME_LONG,
    control: optionNameControl(kind),
    duplicate: optionNameDuplicate(kind),
  };
  return byError[fault];
};

const changeFault = (kind: OptionKind, fault: PriceError): string => {
  const byError: Record<PriceError, string> = {
    empty: CHANGE_EMPTY,
    negative: CHANGE_NEGATIVE,
    format: changeFormat(kind),
    bounds: changeBounds(kind),
  };
  return byError[fault];
};

function previewText(base: string, change: string): string {
  const preview = previewOf(base, change);
  switch (preview.kind) {
    case 'sum':
      return withoutModifiers(priceText(preview.price));
    case 'floor':
      return PREVIEW_FLOOR;
    case 'over':
      return previewOver(priceText(preview.price));
    case 'unknown':
      return PREVIEW_UNKNOWN;
  }
}

interface SectionProps {
  kind: OptionKind;
  form: Form;
  model: ItemModel;
  pending: boolean;
}

/** One list's section. */
export function OptionSection({ kind, form, model, pending }: SectionProps) {
  const variant = kind === 'variant';
  const rows = form.draft[listKey(kind)];
  const errors = form.errors[listKey(kind)];
  const active = rows.filter((r) => !r.removed);
  const heading = variant ? VARIANTS : MODIFIERS;
  const titleId = `${kind}s-title`;
  return (
    <section className="item-section" aria-labelledby={titleId}>
      <div className="item-section-head">
        <div>
          <h2 id={titleId}>{heading}</h2>
          <p>{variant ? VARIANTS_NOTE : MODIFIERS_NOTE}</p>
        </div>
        <button
          type="button"
          className="office-button"
          id={optionId(kind, null, 'add')}
          aria-disabled={pending ? 'true' : undefined}
          tabIndex={pending ? -1 : undefined}
          onClick={() => model.addOption(kind)}
        >
          {addLabel(kind)}
        </button>
      </div>
      <p className="settings-help">{variant ? VARIANTS_HELP : MODIFIERS_HELP}</p>
      <div id={`${kind}-list`}>
        {rows.length === 0 && <p className="item-list-empty">{emptyList(kind)}</p>}
        {rows.map((row) => {
          const n = active.indexOf(row) + 1;
          return row.removed ? (
            <Removed key={row.key} kind={kind} row={row} form={form} model={model} pending={pending} />
          ) : (
            <Active
              key={row.key}
              kind={kind}
              row={row}
              n={n}
              last={active.length}
              fault={errors[row.key]}
              base={form.draft.price}
              model={model}
              pending={pending}
            />
          );
        })}
      </div>
      {variant && <p className="settings-help">{VARIANTS_FLOOR}</p>}
    </section>
  );
}

function Removed({ kind, row, form, model, pending }: { kind: OptionKind; row: Row; form: Form; model: ItemModel; pending: boolean }) {
  // A saved row pending removal is named by its saved name (DESIGN.md); Undo brings back the draft's.
  const name = form.original[listKey(kind)].find((o) => o.id === row.id)?.name ?? row.name.trim();
  return (
    <div className="item-option" data-kind={kind} data-option={row.key} data-removed="true">
      <p>
        <strong>{name}</strong>
        <br />
        {WILL_BE_REMOVED}
      </p>
      <div className="office-actions">
        <button
          type="button"
          className="office-button small"
          id={optionId(kind, row.key, 'undo')}
          aria-label={undoName(kind, name)}
          aria-disabled={pending ? 'true' : undefined}
          tabIndex={pending ? -1 : undefined}
          onClick={() => model.undoOption(kind, row.key)}
        >
          {UNDO}
        </button>
      </div>
    </div>
  );
}

interface ActiveProps {
  kind: OptionKind;
  row: Row;
  n: number;
  last: number;
  fault: { name: OptionFault | null; change: PriceError | null } | undefined;
  base: string;
  model: ItemModel;
  pending: boolean;
}

function Active({ kind, row, n, last, fault, base, model, pending }: ActiveProps) {
  const name = optionId(kind, row.key, 'name');
  const change = optionId(kind, row.key, 'change');
  const nameError = fault?.name == null ? null : nameFault(kind, fault.name);
  const changeError = fault?.change == null ? null : changeFault(kind, fault.change);
  const control = (part: 'up' | 'down' | 'remove', label: string, shown: string, off: boolean, act: () => void) => (
    <button
      type="button"
      className={`office-button small${part === 'remove' ? ' danger' : ''}`}
      id={optionId(kind, row.key, part)}
      aria-label={label}
      aria-disabled={off || pending ? 'true' : undefined}
      tabIndex={off || pending ? -1 : undefined}
      onClick={act}
    >
      {shown}
    </button>
  );
  return (
    <div className="item-option" data-kind={kind} data-option={row.key} data-new={row.id === null ? 'true' : 'false'}>
      <div>
        <div className="item-option-label">
          <label htmlFor={name}>{nameLabel(kind, n)}</label>
          {row.id === null && <span>{NEW_OPTION}</span>}
        </div>
        <input
          id={name}
          type="text"
          className="office-field"
          autoComplete="off"
          spellCheck={false}
          value={row.name}
          disabled={pending}
          aria-invalid={nameError === null ? undefined : true}
          aria-describedby={nameError === null ? undefined : `${name}-error`}
          onFocus={() => model.noteOption(kind, row.key, 'name')}
          onChange={(event) => model.setOptionName(kind, row.key, event.currentTarget.value)}
        />
        {nameError !== null && (
          <span id={`${name}-error`} className="office-error">
            {nameError}
          </span>
        )}
      </div>
      <div>
        <div className="item-option-label">
          <label htmlFor={change}>{changeLabel(kind, n)}</label>
        </div>
        <input
          id={change}
          type="text"
          inputMode={kind === 'variant' ? 'text' : 'numeric'}
          className="office-field"
          autoComplete="off"
          spellCheck={false}
          value={row.change}
          disabled={pending}
          aria-invalid={changeError === null ? undefined : true}
          aria-describedby={changeError === null ? undefined : `${change}-error`}
          onFocus={() => model.noteOption(kind, row.key, 'change')}
          onBlur={() => model.blurOptionChange(kind, row.key)}
          onChange={(event) => model.setOptionChange(kind, row.key, event.currentTarget.value)}
        />
        {changeError !== null && (
          <span id={`${change}-error`} className="office-error">
            {changeError}
          </span>
        )}
      </div>
      <div className="office-actions">
        {control('up', moveUpName(kind, n), MOVE_UP, n === 1, () => model.moveOption(kind, row.key, 'up'))}
        {control('down', moveDownName(kind, n), MOVE_DOWN, n === last, () => model.moveOption(kind, row.key, 'down'))}
        {control('remove', removeName(kind, n), REMOVE, false, () => model.removeOption(kind, row.key))}
      </div>
      {kind === 'variant' && (
        <p className="item-option-note" data-preview={row.key}>
          {previewText(base, row.change)}
        </p>
      )}
    </div>
  );
}

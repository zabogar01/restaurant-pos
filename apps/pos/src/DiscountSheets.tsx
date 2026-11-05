import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ApprovalDialog } from './Approval.js';
import type { ApprovalRequest } from './approvalFixtures.js';
import { PRESET_ANYTHING_ELSE, PRESET_GROUP, PRESET_LOADING_LABEL, PRESET_NONE, READ_FAILURE } from './catalog/menuCopy.js';
import { useCatalogStore } from './catalog/useCatalog.js';
import {
  discountAmount,
  discountName,
  needsManager,
  parseFreeForm,
  presetOf,
  sameSnapshot,
  totalsLabel,
  valueText,
  type DiscountSnapshot,
  type FreeFormEntry,
  type Preset,
} from './discount.js';
import { snapshotFor, type DiscountChange, type DiscountThrough } from './discountChange.js';
import type { DiscountSheetFixture, DiscountStep } from './discountFixtures.js';
import { formatAmount } from './money.js';
import type { OrderView } from './orderFixtures.js';
import type { DiscountOutcome } from './orderStore.js';
import { SheetFrame } from './Sheets.js';
import type { ShownOrder } from './voidFixtures.js';

// M-3, the discount sheets (F2i): the preset picker, free-form entry, and the
// change sheet for a discount already applied. Three sheets to the eye, one
// family to the order: the cashier moves between them without leaving the
// sheet, and every one of them knows what the order carries now.
//
// FE-035: the sheets read the order on screen — its discount, that discount's
// note and its subtotal — and write through the store's changeDiscount, never
// a fixture's order. A fixture says only which sheet shows, what is half-typed,
// who opened it and where the screen lands.
//
// Nothing here decides a gate for the order. Every change goes through one
// door, change(), which asks needsManager (FR-F8's table, discount.ts) about
// what is applied and what would replace it, to draw a control gated and to
// decide whether to open the manager prompt (M-1). Ungated, the change is
// made; gated, the prompt opens over the sheet. The operation decides the gate
// again, on the order it writes (discountChange.ts). The prompt is component
// state, never a URL: a [MODAL] is neither a route nor back-stackable (SITEMAP
// §1), so no approval ever reaches the address bar or the history. Cancelling
// it returns to the sheet exactly as it was (B-20), with focus on the control
// that raised it.
//
// Every control that acts is a <button>. The free-form value is the one field.

/** The gated marker, as the artifact writes it on "Other amount — needs a manager". */
export const NEEDS_MANAGER = ' — needs a manager';

export function DiscountSheet({
  fixture,
  order,
  changeDiscount,
  go,
}: {
  fixture: DiscountSheetFixture;
  /** The order on screen, which the sheet reads and the store writes. */
  order: ShownOrder;
  changeDiscount: (change: DiscountChange, through: DiscountThrough) => DiscountOutcome;
  go: (view: OrderView) => void;
}) {
  const { applied } = order;
  const subtotal = order.totals.subtotal;
  // The presets are the catalog's, read at every render (the lead's ruling 2): the picker follows the poll, in
  // fixture mode through the same store as in a served build. Never copied into state, so there is one owner.
  const catalog = useCatalogStore();
  const held = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot);
  const presets = useMemo(() => (held.menu?.presets ?? []).map(presetOf), [held.menu]);
  const served = catalog.kind === 'real';
  const read: PresetRead =
    held.menu !== null ? { state: 'ready' } : held.read === 'failed' ? { state: 'failed', variant: held.failure ?? 'failed' } : { state: 'loading' };
  const [trail, setTrail] = useState(fixture.trail);
  const [entry, setEntry] = useState<FreeFormEntry>(fixture.entry ?? { kind: 'percent', text: '' });
  const [refusal, setRefusal] = useState<string>();
  const [prompt, setPrompt] = useState<{ next: DiscountChange; request: ApprovalRequest }>();
  const promptOpen = useRef(false);
  const raisedBy = useRef<HTMLElement | null>(null);
  // A change step over an order with nothing applied shows the picker: the
  // order is the store's, so a fixture's step can disagree with it.
  const last = trail[trail.length - 1]!;
  const step = last === 'change' && !applied ? 'picker' : last;

  // The order has been asked to change. A refusal is not a landing: the prompt,
  // if it was open, closes and the sheet stays, showing what the store holds.
  function settle(result: DiscountOutcome, next: DiscountChange) {
    promptOpen.current = false;
    if (result.refused) return setPrompt(undefined);
    go(fixture.landsOn(next));
  }

  // The one door. FR-F8 decides from the order, never from the sheet.
  function change(asked: DiscountChange, from: HTMLElement) {
    const shown = asked.kind === 'remove' ? 'remove' : snapshotFor(asked, presets);
    // A preset pick carries the snapshot this screen displays, so the store can refuse it if the list no longer
    // gives that (a preset edited or deactivated since), over a prompt as well as for a direct press.
    const next: DiscountChange = asked.kind === 'preset' && shown && shown !== 'remove' ? { ...asked, shown } : asked;
    if (!shown || !needsManager(applied, next.kind === 'remove' ? 'remove' : { source: next.kind })) {
      return settle(changeDiscount(next, 'direct'), next);
    }
    raisedBy.current = from;
    promptOpen.current = true;
    setPrompt({ next, request: requestFor(applied, shown, subtotal) });
  }

  // A prompt describes one transition. If its preset leaves the live list or its snapshot changes while the manager
  // is deciding, the prompt closes as a refused submission does: the sheet stays, nothing is applied, and no
  // sentence is added. The cashier picks again, and a gated pick asks for a fresh approval (B-14, FR-F8).
  useLayoutEffect(() => {
    if (!prompt || prompt.next.kind !== 'preset' || !prompt.next.shown) return;
    const now = snapshotFor(prompt.next, presets);
    if (now && sameSnapshot(now, prompt.next.shown)) return;
    promptOpen.current = false;
    setPrompt(undefined);
  }, [prompt, presets]);

  function cancelPrompt() {
    promptOpen.current = false;
    setPrompt(undefined);
  }

  // A prompt closing (cancelled, refused, or closed because its preset changed) hands focus back to the control
  // that raised it, if that control is still there. A preset a poll removed while its prompt held focus is not:
  // focus goes to the preset group's heading, now that the sheet is no longer inert, never to the body.
  const flow = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (prompt || !raisedBy.current) return;
    const opener = raisedBy.current;
    raisedBy.current = null;
    if (opener.isConnected) opener.focus();
    else flow.current?.querySelector<HTMLElement>('#preset-heading')?.focus();
  }, [prompt]);

  const open = (next: DiscountStep) => {
    if (next === 'free-form') setEntry({ kind: 'percent', text: '' });
    setRefusal(undefined);
    setTrail((t) => [...t, next]);
  };
  const back = () => (trail.length > 1 ? setTrail((t) => t.slice(0, -1)) : go(fixture.cancel));
  const cancel = () => go(fixture.cancel);

  // Escape does what the sheet's left-hand foot button does. Stable, so the
  // sheet's listener is registered before the prompt's and sees the prompt
  // open: Escape then cancels the prompt alone, and the sheet stays.
  const escape = useRef(() => {});
  escape.current = () => {
    if (promptOpen.current) return;
    if (step === 'free-form') back();
    else cancel();
  };
  const onEscape = useCallback(() => escape.current(), []);

  // React 18 has no inert prop; an empty string renders the bare attribute.
  const inert = prompt ? { inert: '' } : {};

  return (
    <>
      <div className="discount-flow" ref={flow} {...inert}>
        {step === 'picker' &&
          (served ? (
            <ServedPicker
              presets={presets}
              read={read}
              retry={catalog.retry}
              applied={applied}
              change={change}
              open={open}
              cancel={cancel}
              onEscape={onEscape}
            />
          ) : (
            <Picker presets={presets} applied={applied} change={change} open={open} cancel={cancel} onEscape={onEscape} />
          ))}
        {step === 'free-form' && (
          <FreeForm
            applied={applied}
            subtotal={subtotal}
            entry={entry}
            setEntry={(e) => {
              setEntry(e);
              setRefusal(undefined);
            }}
            refusal={refusal}
            apply={(from) => {
              const parsed = parseFreeForm(entry, subtotal);
              if (!parsed.ok) return setRefusal(parsed.message);
              change({ kind: 'free-form', value: parsed.value }, from);
            }}
            back={back}
            onEscape={onEscape}
          />
        )}
        {step === 'change' && (
          <Change applied={applied} appliedNote={order.appliedNote} subtotal={subtotal} change={change} open={open} cancel={cancel} onEscape={onEscape} />
        )}
      </div>
      {prompt && (
        <ApprovalDialog
          request={prompt.request}
          requireFull
          // The confirm key stands for the server accepting the command. Nothing
          // is verified here: the six digits are neither read nor kept, so the
          // handler takes no parameter, and a second attempt mounts a fresh prompt.
          onSubmit={() => settle(changeDiscount(prompt.next, 'manager-prompt'), prompt.next)}
          onCancel={cancelPrompt}
        />
      )}
    </>
  );
}

type MakeChange = (next: DiscountChange, from: HTMLElement) => void;

/** A control that makes or begins a change. Gated, it says so and is drawn dashed, as the artifact draws it. */
function ChangeButton({ label, gated, onPress }: { label: string; gated: boolean; onPress: (el: HTMLElement) => void }) {
  return (
    <button
      type="button"
      className={gated ? 'action discount-option discount-option--gated' : 'action discount-option'}
      data-gated={gated ? 'true' : 'false'}
      onClick={(e) => onPress(e.currentTarget)}
    >
      {gated ? label + NEEDS_MANAGER : label}
    </button>
  );
}

type PickerProps = {
  presets: ReadonlyArray<Preset>;
  applied: DiscountSnapshot | undefined;
  change: MakeChange;
  open: (step: DiscountStep) => void;
  cancel: () => void;
  onEscape: () => void;
};

function Picker({ presets, applied, change, open, cancel, onEscape }: PickerProps) {
  // Every preset is gated alike, because the table decides by kind: none is,
  // unless what the order carries is free-form.
  const presetsGated = needsManager(applied, { source: 'preset' });

  return (
    <SheetFrame
      title="Discount"
      aside={<span className="sheet__aside discount-aside">One per order</span>}
      onClose={onEscape}
      foot={
        <>
          <button type="button" className="action" onClick={cancel}>
            Cancel
          </button>
          <span />
        </>
      }
    >
      <span className="sheet__label">{presetsGated ? PRESETS_GATED : PRESET_GROUP}</span>
      <div className="discount-options">
        {/* FR-F5: a deactivated preset is not offered. No preset is chosen until a finger chooses it (B-21). */}
        {presets
          .filter((p) => p.active)
          .map((p) => (
            <ChangeButton
              key={p.id}
              label={discountName(p)}
              gated={presetsGated}
              onPress={(el) => change({ kind: 'preset', presetId: p.id }, el)}
            />
          ))}
      </div>
      <span className="sheet__label">{PRESET_ANYTHING_ELSE}</span>
      <div className="discount-options">
        <ChangeButton label="Other amount" gated={needsManager(applied, { source: 'free-form' })} onPress={() => open('free-form')} />
      </div>
    </SheetFrame>
  );
}

/** What the served picker knows of the catalog's first read: the presets arrive with the menu. */
type PresetRead = { state: 'loading' } | { state: 'failed'; variant: 'unavailable' | 'failed' } | { state: 'ready' };

/**
 * M-3 over the served presets (DESIGN-021 rule 12). The list is the catalog's, drawn at every render, so an open
 * picker follows the poll: an edited preset's row updates, a deactivated one leaves, with no notice and no
 * rule in place (a wrong preset is replaced without approval). Nothing is held back from a failed read: until
 * the catalog has answered there is no list, and *Other amount* is offered all the same.
 *
 * Focus (DESIGN-021's M-3 rules): the sheet opens on its heading, never on *Try again*; a failure moves focus
 * to *Try again* only when focus is on the body or on a control the read removed; a retry that succeeds, and a
 * focused preset that a poll removed, both send focus to the group heading.
 */
function ServedPicker({ presets, read, retry, applied, change, open, cancel, onEscape }: PickerProps & { read: PresetRead; retry: () => void }) {
  const presetsGated = needsManager(applied, { source: 'preset' });
  const heading = useRef<HTMLSpanElement>(null);
  // Focus was on a control that a retry or a poll removed. Read after every commit, once the removal has happened.
  const lost = useRef(false);
  const lose = useCallback(() => {
    lost.current = true;
  }, []);
  useLayoutEffect(() => {
    // A retry in flight keeps the claim: the list it draws, if it succeeds, is where focus goes. A failed read
    // is its own *Try again*'s to focus.
    if (!lost.current || read.state === 'loading') return;
    lost.current = false;
    if (read.state === 'ready') heading.current?.focus();
  });

  return (
    <SheetFrame
      title="Discount"
      aside={<span className="sheet__aside discount-aside">One per order</span>}
      onClose={onEscape}
      served
      foot={
        // One full-width Cancel, as the artifact draws it: no empty sibling holding the second column.
        <button type="button" className="action served-preset-cancel" data-action="served-preset-cancel" onClick={cancel}>
          Cancel
        </button>
      }
    >
      <span className="sheet__label" id="preset-heading" tabIndex={-1} ref={heading}>
        {presetsGated ? PRESETS_GATED : PRESET_GROUP}
      </span>
      {read.state === 'loading' && (
        <div className="menu-loading__label served-presets__loading" role="status">
          {PRESET_LOADING_LABEL}
        </div>
      )}
      {read.state === 'failed' && <PresetReadFailed variant={read.variant} retry={retry} lose={lose} />}
      {read.state === 'ready' && presets.length === 0 && <p className="served-presets__none">{PRESET_NONE}</p>}
      {read.state === 'ready' && presets.length > 0 && (
        <div className="discount-options served-presets">
          {presets.map((p) => (
            <PresetEntry key={p.id} preset={p} gated={presetsGated} lose={lose} onPress={(el) => change({ kind: 'preset', presetId: p.id }, el)} />
          ))}
        </div>
      )}
      <span className="sheet__label">{PRESET_ANYTHING_ELSE}</span>
      <div className="discount-options">
        <ChangeButton label="Other amount" gated={needsManager(applied, { source: 'free-form' })} onPress={() => open('free-form')} />
      </div>
    </SheetFrame>
  );
}

/**
 * One preset: its name and its value in two columns, named as the design names it, "{name} — {value}". The value
 * is the one the preset is stored at (a fixed amount above the subtotal is listed as stored and capped only when
 * applied, FR-M5). Gated like every preset when the order carries a free-form discount (FR-F8).
 */
function PresetEntry({ preset, gated, lose, onPress }: { preset: Preset; gated: boolean; lose: () => void; onPress: (el: HTMLElement) => void }) {
  const button = useRef<HTMLButtonElement>(null);
  // A poll that removes this row while it holds focus: the sheet sends focus to the group heading.
  useLayoutEffect(() => {
    const el = button.current;
    return () => {
      if (el && document.activeElement === el) lose();
    };
  }, [lose]);
  const value = valueText(preset.value);
  return (
    <button
      ref={button}
      type="button"
      className={gated ? 'action discount-option discount-option--gated served-preset' : 'action discount-option served-preset'}
      data-gated={gated ? 'true' : 'false'}
      data-preset={preset.id}
      aria-label={gated ? discountName(preset) + NEEDS_MANAGER : discountName(preset)}
      onClick={(e) => onPress(e.currentTarget)}
    >
      <span className="served-preset__name">{preset.name}</span>
      <span className="served-preset__value">{gated ? value + NEEDS_MANAGER : value}</span>
    </button>
  );
}

/** The shared general failure, with its one control (DESIGN-021): the menu's own words, and `preset-retry`. */
function PresetReadFailed({ variant, retry, lose }: { variant: 'unavailable' | 'failed'; retry: () => void; lose: () => void }) {
  const copy = READ_FAILURE[variant];
  const button = useRef<HTMLButtonElement>(null);
  // Focus moves here only from the body: opening focus is the heading's, and a control the cashier is on keeps it.
  useLayoutEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) button.current?.focus();
  }, []);
  // The control going away with focus on it: the press that shows loading, or the read's success.
  useLayoutEffect(() => {
    const el = button.current;
    return () => {
      if (el && document.activeElement === el) lose();
    };
  }, [lose]);
  return (
    <div className="notice" role="alert">
      <div className="notice__title">{copy.title}</div>
      <div>{copy.body}</div>
      <button ref={button} type="button" className="action action--compact menu-notice__action" data-action="preset-retry" onClick={retry}>
        {READ_FAILURE.retry}
      </button>
    </div>
  );
}

// PROVISIONAL COPY. The artifact draws the picker only over a preset, where
// its presets need no approval; over a free-form discount they all do (FR-F8).
const PRESETS_GATED = 'Presets — need a manager';

function FreeForm({
  applied,
  subtotal,
  entry,
  setEntry,
  refusal,
  apply,
  back,
  onEscape,
}: {
  applied: DiscountSnapshot | undefined;
  subtotal: bigint;
  entry: FreeFormEntry;
  setEntry: (entry: FreeFormEntry) => void;
  refusal: string | undefined;
  apply: (from: HTMLElement) => void;
  back: () => void;
  onEscape: () => void;
}) {
  const gated = needsManager(applied, { source: 'free-form' });
  const kind = (k: FreeFormEntry['kind'], label: string) => (
    <button
      type="button"
      className={entry.kind === k ? 'action discount-kind action--primary' : 'action discount-kind'}
      aria-pressed={entry.kind === k}
      onClick={() => setEntry({ kind: k, text: entry.kind === k ? entry.text : '' })}
    >
      {label}
    </button>
  );

  return (
    <SheetFrame
      title="Other discount"
      aside={gated && <span className="discount-tag">MANAGER REQUIRED</span>}
      onClose={onEscape}
      foot={
        <>
          <button type="button" className="action" onClick={back}>
            Back
          </button>
          <button type="button" className="action action--primary" onClick={(e) => apply(e.currentTarget)}>
            Apply
          </button>
        </>
      }
    >
      <div className="discount-kinds" role="group" aria-label="Discount kind">
        {kind('percent', 'Percent')}
        {kind('fixed', 'Fixed amount')}
      </div>
      <label className="sheet__label" htmlFor="discount-value">
        {/* PROVISIONAL COPY for a fixed amount: the artifact draws Percent chosen. */}
        {entry.kind === 'percent' ? 'Value — 0 to 100%' : `Value — 0 to ${formatAmount(subtotal)}`}
      </label>
      <div className={refusal ? 'discount-field discount-field--invalid' : 'discount-field'}>
        <input
          id="discount-value"
          className="discount-field__input"
          inputMode={entry.kind === 'percent' ? 'decimal' : 'numeric'}
          autoComplete="off"
          size={8}
          value={entry.text}
          aria-invalid={refusal ? 'true' : undefined}
          aria-describedby={refusal ? 'discount-value-refusal' : undefined}
          onChange={(e) => setEntry({ kind: entry.kind, text: e.currentTarget.value })}
        />
        {entry.kind === 'percent' && <span aria-hidden="true">%</span>}
      </div>
      {refusal && (
        <span id="discount-value-refusal" className="discount-field__refusal">
          {refusal}
        </span>
      )}
      {gated && (
        <p className="sheet__note discount-note">
          A manager must enter their PIN before this is applied. Nothing changes on the order until they do.
        </p>
      )}
    </SheetFrame>
  );
}

function Change({
  applied,
  appliedNote,
  subtotal,
  change,
  open,
  cancel,
  onEscape,
}: {
  applied: DiscountSnapshot | undefined;
  appliedNote: string | undefined;
  subtotal: bigint;
  change: MakeChange;
  open: (step: DiscountStep) => void;
  cancel: () => void;
  onEscape: () => void;
}) {
  if (!applied) throw new Error('the change sheet needs a discount to change');

  return (
    <SheetFrame
      title="Change discount"
      onClose={onEscape}
      foot={
        <>
          <button type="button" className="action" onClick={cancel}>
            Cancel
          </button>
          <span />
        </>
      }
    >
      {/* Read from the order's snapshot alone (B-8), so a preset deactivated since (FR-F5) still reads. */}
      <div className="discount-applied">
        <div className="discount-applied__title">Currently applied</div>
        <div className="discount-applied__row">
          <span>{discountName(applied)}</span>
          <span>{formatAmount(-discountAmount(subtotal, applied.value))}</span>
        </div>
        {appliedNote && <div className="discount-applied__note">{appliedNote}</div>}
      </div>
      <div className="discount-options">
        <ChangeButton
          label="Replace with another preset"
          gated={needsManager(applied, { source: 'preset' })}
          onPress={() => open('picker')}
        />
        <ChangeButton
          label="Replace with another amount"
          gated={needsManager(applied, { source: 'free-form' })}
          onPress={() => open('free-form')}
        />
        <ChangeButton label="Remove the discount" gated={needsManager(applied, 'remove')} onPress={(el) => change({ kind: 'remove' }, el)} />
      </div>
    </SheetFrame>
  );
}

/**
 * The one change the manager is asked to approve, whole: what goes and what
 * replaces it (FR-F8). The PRD asks no reason for a discount.
 *
 * PROVISIONAL COPY. The artifact draws the prompt only for a void.
 */
export function requestFor(applied: DiscountSnapshot | undefined, next: DiscountSnapshot | 'remove', subtotal: bigint): ApprovalRequest {
  if (next === 'remove') {
    const was = applied!;
    return {
      action: 'discount-change',
      description: 'Remove the discount',
      subject: { name: totalsLabel(was), amount: -discountAmount(subtotal, was.value) },
    };
  }
  const subject = { name: totalsLabel(next), amount: -discountAmount(subtotal, next.value) };
  if (!applied) return { action: 'free-form-discount', description: 'Apply a discount', subject };
  return {
    action: 'discount-change',
    description: `Replace ${totalsLabel(applied)}`,
    subject: { ...subject, name: `with ${subject.name}` },
  };
}

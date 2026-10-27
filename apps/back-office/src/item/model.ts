import {
  CreateItemRequest,
  UpdateItemRequest,
  type CategoryView,
  type ItemView,
} from '@pos/contracts';
import { call, meaningOf, type Answered, type Meaning } from '../forms/answer.js';
import { fieldsInError } from '../forms/fieldsInError.js';
import { sameName } from '../menu/group.js';
import type { ItemSubject, MenuModel } from '../menu/model.js';
import type { NameError } from '../menu/name.js';
import { priceText } from '../menu/money.js';
import { router } from '../router.js';
import type { ConfigApi } from '../session/api.js';
import type { WorkGuard, WorkStatus } from '../work/guard.js';
import { checkCategory, type CategoryFault } from './categories.js';
import { createLists, editChanges } from './changes.js';
import { keepRows } from './keep.js';
import { checkItemName, checkOptionName, duplicateKeys } from './name.js';
import { listKey, plainRows, rowsOf, type OptionKind, type Row } from './options.js';
import { checkPrice, shownPrice, type PriceError } from './price.js';

// BO-04's behaviour, apart from how it is drawn: the item's own fields (name, category, base
// price) read, edited and saved as one command through the S4b routes (PHASE1-S4c2a). It copies
// the configuration-form rules S1b to S4c1 built, as BO-03's model does. It sends a command once
// and never again: a resend is the manager's own press of Save. It never infers success from a
// reread.
//
// **The two option lists** (PHASE1-S4c2b) are part of the draft, as two arrays of rows in `Fields`
// (`options.ts`). The whole screen is one command: a create sends both lists in order, an edit
// sends an explicit change list (`changes.ts`). Keep my changes rebuilds each list by DESIGN-020
// round 2's principle (`keep.ts`): a row the draft touched keeps the draft's values whole, a row it
// did not touch follows the current item.
//
// **Which item this edits is client state, never the address** (ruling 3). The subject is set by
// Menu alone (`open`), lives as long as the working area, and is cleared by leaving BO-04 in any
// way. Arriving with no subject draws the *Different manager* sentence and reads nothing.
//
// **The version.** BO-04 reads the catalog itself on each arrival with a subject, and the draft
// builds on that read's version (`base`). The base then moves only by an answer, an unchanged
// answer, Keep my changes or Use current item; a reread alone never moves it (ADR-012 rule 3,
// copied from BO-08's settings model). A create carries none.
//
// **One command at a time, across BO-03 and BO-04.** Leaving BO-04 with a save outstanding drops
// the draft only: the command is not cancelled and never resent. Menu is told (`holdForSave`) and
// holds its own openers inert until the answer settles it (`releaseFromSave`).
//
// One model belongs to one working area. A different manager's sign-in changes the area's key,
// React drops the component, and its model and its subject go with it.

export type FieldKey = 'name' | 'category' | 'price';
export type NameFault = NameError | 'duplicate';
/** A variant's or modifier's name is refused for the item name's reasons, or for repeating another row's. */
export type OptionFault = NameError | 'duplicate';
export type FormNotice =
  | 'failure'
  | 'session'
  | 'unknown'
  | 'unknown-unread'
  | 'unknown-newer'
  | 'stale'
  | 'stale-unread'
  | 'kept'
  | 'used'
  | 'category-archived';

/** An element of one option row, or a list's Add. A row that is no longer there sends focus to Item name. */
export interface OptionTarget {
  kind: OptionKind;
  key: string | null;
  part: 'name' | 'change' | 'up' | 'down' | 'remove' | 'undo' | 'add';
}
export type FocusTarget = FieldKey | 'notice' | 'save' | 'return' | 'retry-load' | OptionTarget;

/** The item's fields and its two lists. A price or change is canonical in `original` and as typed in `draft`. */
export interface Fields {
  name: string;
  categoryId: string;
  price: string;
  variants: Row[];
  modifiers: Row[];
}

/** The current item as a reread showed it, beside a draft waiting for the manager's choice. */
export interface Offered {
  version: number;
  item: ItemView;
}

/** The refusals on one option row; a row with none has no entry. */
export interface RowErrors {
  name: OptionFault | null;
  change: PriceError | null;
}
export type OptionErrors = Readonly<Record<string, RowErrors>>;

export interface FieldErrors {
  name: NameFault | null;
  category: CategoryFault | null;
  price: PriceError | null;
  variants: OptionErrors;
  modifiers: OptionErrors;
}

export interface Form {
  /** Which form this is; a command remembers it, so a late answer knows whether its form is still here. */
  key: number;
  kind: 'create' | 'edit';
  /** The item the form builds on: as read when opened, replaced by Keep my changes and Use current item. Null for a create. */
  stored: ItemView | null;
  /** The version the draft builds on; null for a create, which carries none. */
  base: number | null;
  /** What the draft is compared with to say what changed. */
  original: Fields;
  draft: Fields;
  errors: FieldErrors;
  /** A refused name was reread, so its holder can be told. */
  reread: boolean;
  /** The server refused the category (a create into one archived meanwhile): Save waits for an active one. */
  categoryRefused: boolean;
  notice: FormNotice | null;
  /** After Keep my changes: the rerun checks found nothing to correct. */
  keptClean: boolean;
  /** The edit's destination category was archived meanwhile; the stale notice says so. */
  destinationArchived: boolean;
  /** The current item waiting for the manager's choice (Keep my changes or Use current item), or null. */
  offered: Offered | null;
  /** An unknown outcome is open: leaving asks, whatever the draft holds. */
  uncertain: boolean;
  /** The field last edited or focused, where focus returns. */
  lastField: FieldKey | (OptionTarget & { part: 'name' | 'change' });
}

interface Command {
  kind: 'create' | 'edit';
  itemId: string | null;
  formKey: number;
  /** The version an edit carried; null for a create. */
  expected: number | null;
  /** The manager left BO-04 with this outstanding. Its answer still lands in Menu, silently. */
  discarded: boolean;
}

export interface ItemState {
  /** Which item this edits, or null: the screen was reached with no item chosen. */
  subject: ItemSubject | null;
  read: 'idle' | 'loading' | 'ready' | 'failed';
  /** The subject names an item or category the read does not hold. Unreachable today: the read returns archived rows too. */
  missing: boolean;
  /** The latest catalog read of this screen, which the category field and the comparison draw from. */
  categories: readonly CategoryView[];
  items: readonly ItemView[];
  readVersion: number | null;
  form: Form | null;
  command: Command | null;
  decision: boolean;
  focus: { target: FocusTarget; n: number } | null;
}

interface Applied {
  version: number;
  item: ItemView;
}
type Answer = Answered<Applied>;

interface Snapshot {
  version: number;
  categories: readonly CategoryView[];
  items: readonly ItemView[];
}

/** A reread's outcome, with what it showed beside the draft; held with a finished result. */
interface Reread {
  fresh: boolean;
  offered: Offered | null;
}

const READ = '/api/back-office/config/catalog' as const;
const ITEM_CREATE = '/api/back-office/config/catalog/items/create' as const;
const ITEM_UPDATE = '/api/back-office/config/catalog/items/update' as const;

/** The item as the form compares against it: every price and change canonical. */
export const fieldsOf = (item: ItemView): Fields => ({
  name: item.name,
  categoryId: item.categoryId,
  price: item.basePrice,
  variants: rowsOf(item, 'variant', false),
  modifiers: rowsOf(item, 'modifier', false),
});

/** The item as a draft opens on it: prices and changes grouped for reading. */
const draftOf = (item: ItemView): Fields => ({
  name: item.name,
  categoryId: item.categoryId,
  price: priceText(item.basePrice),
  variants: rowsOf(item, 'variant', true),
  modifiers: rowsOf(item, 'modifier', true),
});

/** A price as the form compares it: canonical when it is a price, otherwise exactly as typed. */
const priceKey = (typed: string): string => {
  const checked = checkPrice(typed, 'base');
  return checked.error === null ? checked.value : typed;
};

export const hasErrors = (errors: FieldErrors): boolean =>
  errors.name !== null ||
  errors.category !== null ||
  errors.price !== null ||
  Object.keys(errors.variants).length > 0 ||
  Object.keys(errors.modifiers).length > 0;

const NO_ERRORS: FieldErrors = { name: null, category: null, price: null, variants: {}, modifiers: {} };

/**
 * The values of a form, for comparing a draft with what it opened from or with the current item:
 * the fields, then each list's rows as identity, trimmed name, canonical change and removal. A
 * flag that is not a value (`moved`) is left out, so a row moved down and back up is clean again
 * (DESIGN-020 round 2, the note on `plain()`).
 */
export const plainFields = (f: Fields): string =>
  JSON.stringify([f.name.trim(), f.categoryId, priceKey(f.price), plainRows(f.variants, 'variant'), plainRows(f.modifiers, 'modifier')]);

/**
 * Who holds the name a refused save asked for, once the reread has shown it: the active item
 * with the same name by the sort's collator, never the item being edited. Nobody matching means
 * no holder line.
 */
export function holderOf(state: ItemState): { item: ItemView; category: CategoryView | undefined } | null {
  const { form } = state;
  if (form === null || form.errors.name !== 'duplicate' || !form.reread) return null;
  const typed = form.draft.name.trim();
  const found = state.items.find(
    (i) => i.isActive && i.itemId !== form.stored?.itemId && sameName(i.name, typed)
  );
  return found === undefined
    ? null
    : { item: found, category: state.categories.find((c) => c.categoryId === found.categoryId) };
}

export type ItemModel = ReturnType<typeof createItemModel>;

export function createItemModel(config: ConfigApi, menu: MenuModel) {
  let state: ItemState = {
    subject: null,
    read: 'idle',
    missing: false,
    categories: [],
    items: [],
    readVersion: null,
    form: null,
    command: null,
    decision: false,
    focus: null,
  };
  const listeners = new Set<() => void>();
  let gate = false;
  let stopped = true;
  /** Counts the arrivals and the departures, so a read knows whether what asked for it is still here. */
  let visit = 0;
  /** The arrival with a subject has not read yet; the screen's first showing reads once. */
  let needsRead = false;
  let formSequence = 0;
  let focusSequence = 0;
  let readSequence = 0;
  /** Names a new option row; unique within a list, never visible text (S4b's `OptionKey`). */
  let optionSequence = 0;
  const freshKey = (): string => `new-${(optionSequence += 1)}`;
  /** The newest reread, settled with the outcome of the catalog on screen. */
  let newestRead: Promise<boolean> = Promise.resolve(true);
  /** Where the manager was going when the decision was shown. */
  let proceed: (() => void) | null = null;
  /** An answer that arrived while the session was away or a decision was open, with its reread if it made one. */
  let held: { command: Command; answer: Answer; read?: Reread } | null = null;
  /** The finished result of an explicit retry of a reread, held the same way. */
  let heldRetry: (() => void) | null = null;

  const set = (patch: Partial<ItemState>): void => {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener();
  };
  const aim = (target: FocusTarget): ItemState['focus'] => ({ target, n: (focusSequence += 1) });

  /** The form a command was sent from, if it is still open and was not discarded. */
  const formOf = (command: Command): Form | null =>
    !command.discarded && state.form !== null && state.form.key === command.formKey ? state.form : null;

  const pendingSave = (): boolean => {
    const { form, command } = state;
    return form !== null && command !== null && !command.discarded && command.formKey === form.key;
  };
  const dirty = (): boolean => {
    const { form } = state;
    return form !== null && plainFields(form.draft) !== plainFields(form.original);
  };
  const uncertain = (): boolean => {
    const { form } = state;
    return form !== null && (pendingSave() || form.uncertain);
  };
  const status = (): WorkStatus => (uncertain() ? 'uncertain' : dirty() ? 'dirty' : 'clean');

  /** Where focus returns to take the draft up again. */
  const returnTo = (): FocusTarget => (pendingSave() ? 'notice' : (state.form?.lastField ?? 'name'));

  // ---- Reading -------------------------------------------------------------------------------

  async function fetchCatalog(): Promise<Snapshot | null> {
    try {
      const answer = await config[READ]();
      return answer.kind === 'ok' ? answer.value : null;
    } catch {
      return null;
    }
  }

  /** The form an arrival opens on, from the read; null when the read does not hold its subject. */
  function formFor(subject: ItemSubject, snapshot: Snapshot): Form | null {
    const base = {
      key: (formSequence += 1),
      errors: NO_ERRORS,
      reread: false,
      categoryRefused: false,
      notice: null,
      keptClean: false,
      destinationArchived: false,
      offered: null,
      uncertain: false,
      lastField: 'name' as const,
    };
    if (subject.kind === 'edit') {
      const item = snapshot.items.find((i) => i.itemId === subject.itemId);
      if (item === undefined) return null;
      return {
        ...base,
        kind: 'edit',
        stored: item,
        base: snapshot.version,
        original: fieldsOf(item),
        draft: draftOf(item),
      };
    }
    if (!snapshot.categories.some((c) => c.categoryId === subject.categoryId)) return null;
    const blank: Fields = { name: '', categoryId: subject.categoryId, price: '', variants: [], modifiers: [] };
    return { ...base, kind: 'create', stored: null, base: null, original: blank, draft: blank };
  }

  /** The arrival's one read: it shows *Loading item…* meanwhile, and a failed read shows its own state. */
  async function readSubject(mine: number): Promise<void> {
    set({ read: 'loading', missing: false });
    const snapshot = await fetchCatalog();
    if (stopped || mine !== visit) return;
    const { subject } = state;
    if (subject === null) return;
    if (snapshot === null) {
      set({ read: 'failed', focus: aim('retry-load') });
      return;
    }
    const known = { categories: snapshot.categories, items: snapshot.items, readVersion: snapshot.version };
    const form = formFor(subject, snapshot);
    if (form === null) set({ ...known, read: 'ready', missing: true, form: null });
    else set({ ...known, read: 'ready', missing: false, form, focus: aim('name') });
  }

  // A reread after a refusal or an unknown outcome. It never moves the base: only an answer, Keep
  // my changes or Use current item does. What a caller receives describes the catalog on screen:
  // a reread that is no longer the newest waits for the newest and returns its outcome.
  function reread(): Promise<boolean> {
    const run = readAgain();
    newestRead = run;
    return run;
  }

  async function readAgain(): Promise<boolean> {
    readSequence += 1;
    const mine = readSequence;
    const asked = visit;
    const snapshot = await fetchCatalog();
    if (stopped) return snapshot !== null;
    if (mine === readSequence) {
      if (snapshot !== null && asked === visit) {
        set({ categories: snapshot.categories, items: snapshot.items, readVersion: snapshot.version });
      }
      return snapshot !== null;
    }
    return newestRead;
  }

  /** What a reread showed of the item being edited, beside its draft. */
  function offeredNow(form: Form): Offered | null {
    if (form.kind !== 'edit' || form.stored === null || state.readVersion === null) return null;
    const id = form.stored.itemId;
    const item = state.items.find((i) => i.itemId === id);
    return item === undefined ? null : { version: state.readVersion, item };
  }

  const categoryArchived = (categoryId: string): boolean =>
    state.categories.find((c) => c.categoryId === categoryId)?.isActive === false;

  // ---- Settling a command --------------------------------------------------------------------

  function send(command: Command, request: () => Promise<Answer>, patch: Partial<ItemState> = {}): void {
    set({ ...patch, command });
    void request().then(
      (answer) => answered(command, answer),
      () => answered(command, { kind: 'invalid-request' })
    );
  }

  function answered(command: Command, answer: Answer): void {
    if (stopped) return;
    if (meaningOf(answer, command.expected) === 'session') {
      // Refused before the handler: nothing was applied, and nothing is held for the session to
      // hand back. M-6 or BO-01 is the session's own, and the draft stays where it is.
      set({ command: state.command === command ? null : state.command });
      if (command.discarded) {
        menu.releaseFromSave({ kind: 'other' });
        return;
      }
      const form = formOf(command);
      // The Saving notice the press asked focus for is gone: the same manager returns to the draft.
      if (form !== null) set({ form: { ...form, notice: 'session', uncertain: false }, focus: aim(form.lastField) });
      return;
    }
    if (!gate || state.decision) {
      held = { command, answer };
      return;
    }
    void present(command, answer);
  }

  /** The save the manager left behind has answered: Menu hears of it silently, and presents nothing. */
  function settleDiscarded(command: Command, answer: Answer, meaning: Meaning): void {
    set({ command: state.command === command ? null : state.command });
    if ((meaning === 'saved' || meaning === 'unchanged') && answer.kind === 'ok') {
      const { item, version } = answer.applied;
      menu.releaseFromSave({ kind: 'ok', item, version, category: state.categories.find((c) => c.categoryId === item.categoryId) });
    } else {
      menu.releaseFromSave({ kind: meaning === 'unknown' ? 'unknown' : 'other' });
    }
  }

  // After an unknown outcome the reread has been made. Same version: the plain uncertainty. A
  // newer version, for an edit that carried one: the uncertainty with the comparison and its two
  // choices. The reread failed: the facts are withheld and Try again repeats the read only.
  function settleUnknown(form: Form, read: Reread): Partial<ItemState> {
    if (!read.fresh) {
      return { form: { ...form, notice: 'unknown-unread', offered: null, uncertain: true }, focus: aim('name') };
    }
    if (form.base !== null && read.offered !== null && read.offered.version > form.base) {
      return { form: { ...form, notice: 'unknown-newer', offered: read.offered, uncertain: true }, focus: aim('notice') };
    }
    return { form: { ...form, notice: 'unknown', offered: null, uncertain: true }, focus: aim('name') };
  }

  /** The comparison after a refusal: the notice, and the destination category if it was archived meanwhile. */
  function compare(form: Form, offered: Offered): Partial<ItemState> {
    const destinationArchived = form.draft.categoryId !== form.original.categoryId && categoryArchived(form.draft.categoryId);
    return {
      form: {
        ...form,
        notice: 'stale',
        offered,
        destinationArchived,
        errors: destinationArchived ? { ...form.errors, category: 'archived' } : form.errors,
        categoryRefused: destinationArchived || form.categoryRefused,
        uncertain: false,
      },
      focus: aim('notice'),
    };
  }

  async function present(command: Command, answer: Answer, read?: Reread): Promise<void> {
    const meaning = meaningOf(answer, command.expected);
    const done = (): Command | null => (state.command === command ? null : state.command);

    // The manager left BO-04 with this outstanding: nothing is presented, and nothing is read here.
    if (command.discarded) {
      settleDiscarded(command, answer, meaning);
      return;
    }
    const first = formOf(command);
    if (first === null) {
      set({ command: done() });
      return;
    }

    if (meaning === 'unknown') {
      // The reread comes first and never establishes success: it only makes the catalog current.
      let result = read;
      if (result === undefined) {
        const fresh = await reread();
        result = { fresh, offered: fresh ? offeredNow(first) : null };
      }
      if (stopped) return;
      if (command.discarded) {
        settleDiscarded(command, answer, meaning);
        return;
      }
      if (!gate || state.decision) {
        // The session or a decision took the screen during the reread: hold the finished result and
        // its read, and present them once when the same manager is back. Nothing is read or sent again.
        held = { command, answer, read: result };
        return;
      }
      const form = formOf(command);
      if (form === null) set({ command: done() });
      else set({ command: done(), ...settleUnknown(form, result) });
      return;
    }

    if (meaning === 'saved' || meaning === 'unchanged') {
      if (answer.kind !== 'ok') return;
      // Back to Menu, on the same row, which announces the result and focuses the row's Edit.
      // The category is BO-04's read of it: Menu hosts it only if its own list holds none (the B-24 walk).
      const { item, version } = answer.applied;
      menu.receiveItem(item, version, meaning === 'unchanged', state.categories.find((c) => c.categoryId === item.categoryId));
      leaveForMenu(done());
      return;
    }

    if (meaning === 'stale') {
      // Nothing was written. A create can only have been refused because its category was archived
      // meanwhile, which the refusal itself tells; an edit is the ordinary stale draft.
      if (first.kind === 'create') {
        markArchived(first.draft.categoryId);
        let result = read;
        if (result === undefined) result = { fresh: await reread(), offered: null };
        if (stopped) return;
        if (command.discarded) {
          settleDiscarded(command, answer, meaning);
          return;
        }
        if (!gate || state.decision) {
          held = { command, answer, read: result };
          return;
        }
        const form = formOf(command);
        if (form === null) {
          set({ command: done() });
          return;
        }
        set({
          command: done(),
          form: {
            ...form,
            errors: { ...form.errors, category: 'archived' },
            categoryRefused: true,
            notice: 'category-archived',
            offered: null,
            uncertain: false,
          },
          focus: aim('category'),
        });
        return;
      }
      let result = read;
      if (result === undefined) {
        const fresh = await reread();
        result = { fresh, offered: fresh ? offeredNow(first) : null };
      }
      if (stopped) return;
      if (command.discarded) {
        settleDiscarded(command, answer, meaning);
        return;
      }
      if (!gate || state.decision) {
        held = { command, answer, read: result };
        return;
      }
      const form = formOf(command);
      if (form === null) {
        set({ command: done() });
        return;
      }
      if (!result.fresh) {
        set({ command: done(), form: { ...form, notice: 'stale-unread', offered: null, uncertain: false }, focus: aim('notice') });
      } else if (result.offered !== null && form.base !== null && result.offered.version > form.base) {
        set({ command: done(), ...compare(form, result.offered) });
      } else {
        // The refusal stands and the reread gave nothing to compare (DESIGN-019 draws no state
        // for it): the definite general failure, draft kept. Save asks again, with its own reread.
        set({ command: done(), form: { ...form, notice: 'failure', offered: null, uncertain: false }, focus: aim('name') });
      }
      return;
    }

    // A refusal that applied nothing. The refused and the gone also reread, so the manager sees
    // what the server sees; neither establishes anything about this command. A refused name's
    // reread does present something (the holder line, its link and the archived-category copy), so
    // when it lands behind M-6, BO-01 or the decision the finished result is held and presented
    // once when the same manager is back. Nothing is read or sent again.
    if (meaning === 'duplicate' || meaning === 'gone') {
      void reread().then((fresh) => {
        if (stopped || !fresh) return;
        if (meaning !== 'duplicate') return;
        if (!gate || state.decision) heldRetry = () => showHolder(command);
        else showHolder(command);
      });
    }
    if (meaning === 'duplicate') {
      set({
        command: done(),
        form: { ...first, errors: { ...first.errors, name: 'duplicate' }, reread: false, notice: null, offered: null },
        focus: aim('name'),
      });
      return;
    }
    // The definite general failure: draft kept, nothing was saved.
    set({ command: done(), form: { ...first, notice: 'failure', offered: null, uncertain: false }, focus: aim('name') });
  }

  /** The reread behind a refused name has landed: the holder can now be told. */
  function showHolder(command: Command): void {
    const { form } = state;
    if (form !== null && form.key === command.formKey && form.errors.name === 'duplicate') {
      set({ form: { ...form, reread: true } });
    }
  }

  /** A create refused its category: the one the server named is archived, which the reread will show too. */
  function markArchived(categoryId: string): void {
    set({ categories: state.categories.map((c) => (c.categoryId === categoryId ? { ...c, isActive: false } : c)) });
  }

  /** An answered save: BO-04 closes and the way back to Menu is taken, with nothing to ask. */
  function leaveForMenu(command: Command | null): void {
    visit += 1;
    set({ command, subject: null, form: null, read: 'idle', missing: false, decision: false, focus: null });
    router.navigate('menu');
  }

  function flush(): void {
    if (!gate || state.decision) return;
    if (held !== null) {
      const result = held;
      held = null;
      void present(result.command, result.answer, result.read);
    }
    if (heldRetry !== null) {
      const result = heldRetry;
      heldRetry = null;
      result();
    }
  }

  // ---- The draft and Save --------------------------------------------------------------------

  /**
   * One list checked, row by row: a row's name before its change. A repeated name is refused on the
   * later row. A row pending removal is left out, as it is from `order`.
   */
  function checkList(kind: OptionKind, rows: readonly Row[]): { errors: OptionErrors; first: OptionTarget | null } {
    const repeated = new Set(duplicateKeys(rows));
    const errors: Record<string, RowErrors> = {};
    let first: OptionTarget | null = null;
    for (const row of rows) {
      if (row.removed) continue;
      const name = checkOptionName(row.name).error ?? (repeated.has(row.key) ? 'duplicate' : null);
      const change = checkPrice(row.change, kind).error;
      if (name === null && change === null) continue;
      errors[row.key] = { name, change };
      first ??= { kind, key: row.key, part: name !== null ? 'name' : 'change' };
    }
    return { errors, first };
  }

  /** Every field checked, in reading order: the item's three, then each list top to bottom. The first that is not valid is where focus goes. */
  function checkAll(form: Form): { errors: FieldErrors; name: string; price: string | null; first: FocusTarget | null } {
    const name = checkItemName(form.draft.name);
    const category = checkCategory(state.categories, form.draft.categoryId, form.stored?.categoryId ?? null);
    const price = checkPrice(form.draft.price, 'base');
    const variants = checkList('variant', form.draft.variants);
    const modifiers = checkList('modifier', form.draft.modifiers);
    const errors: FieldErrors = {
      name: name.error,
      category,
      price: price.error,
      variants: variants.errors,
      modifiers: modifiers.errors,
    };
    const first: FocusTarget | null =
      name.error !== null ? 'name' : category !== null ? 'category' : price.error !== null ? 'price' : variants.first ?? modifiers.first;
    return { errors, name: name.name, price: price.value, first };
  }

  /** A list as a send leaves it in the draft: names trimmed, changes grouped when accepted and as typed when not. */
  const settle = (rows: readonly Row[], kind: OptionKind): Row[] =>
    rows.map((r) => ({ ...r, name: r.name.trim(), change: shownPrice(r.change, kind) }));

  function save(): void {
    const { form } = state;
    if (form === null || state.command !== null) return;
    // A choice comes first: neither Keep my changes nor Use current item has been made, or the
    // comparison could not be read. A refused field holds Save until it is corrected.
    if (form.offered !== null || form.notice === 'stale-unread' || hasErrors(form.errors)) return;

    const checked = checkAll(form);
    if (checked.first !== null || checked.price === null) {
      set({
        form: {
          ...form,
          draft: {
            ...form.draft,
            name: checked.name,
            variants: form.draft.variants.map((r) => ({ ...r, name: r.name.trim() })),
            modifiers: form.draft.modifiers.map((r) => ({ ...r, name: r.name.trim() })),
          },
          errors: checked.errors,
          reread: false,
          notice: null,
        },
        focus: aim(checked.first ?? 'price'),
      });
      return;
    }
    const price = checked.price;
    const create = form.kind === 'create';
    const fields: { name?: string; basePrice?: string; categoryId?: string } = {
      ...(checked.name !== form.original.name ? { name: checked.name } : {}),
      ...(price !== form.original.price ? { basePrice: price } : {}),
      ...(form.draft.categoryId !== form.original.categoryId ? { categoryId: form.draft.categoryId } : {}),
    };
    // A clean Save still sends, as `changes: {}`: an edit equal to the stored item is answered
    // *unchanged* (DESIGN-018). A list key is present only when that list changed (`changes.ts`).
    const lists = { variants: form.draft.variants, modifiers: form.draft.modifiers };
    const itemId = form.stored?.itemId ?? null;
    const body = create
      ? { categoryId: form.draft.categoryId, name: checked.name, basePrice: price, ...createLists(lists) }
      : { itemId: itemId ?? '', expectedVersion: form.base ?? -1, changes: editChanges(fields, form.original, lists) };
    const wrong = create ? fieldsInError(CreateItemRequest, body) : fieldsInError(UpdateItemRequest, body);
    if (wrong.length > 0 || (!create && (itemId === null || form.base === null))) {
      // The form's check and the contract disagree: a defect, shown as the general failure.
      set({ form: { ...form, draft: { ...form.draft, name: checked.name }, errors: NO_ERRORS, notice: 'failure' }, focus: aim('name') });
      return;
    }
    const command: Command = {
      kind: create ? 'create' : 'edit',
      itemId,
      formKey: form.key,
      expected: create ? null : form.base,
      discarded: false,
    };
    const next: Form = {
      ...form,
      draft: {
        ...form.draft,
        name: checked.name,
        price: shownPrice(form.draft.price, 'base'),
        variants: settle(form.draft.variants, 'variant'),
        modifiers: settle(form.draft.modifiers, 'modifier'),
      },
      errors: NO_ERRORS,
      reread: false,
      notice: null,
      uncertain: false,
    };
    send(
      command,
      () =>
        create
          ? call(config[ITEM_CREATE](body as Parameters<(typeof config)[typeof ITEM_CREATE]>[0]), (v) => ({ version: v.version, item: v.item }))
          : call(config[ITEM_UPDATE](body as Parameters<(typeof config)[typeof ITEM_UPDATE]>[0]), (v) => ({ version: v.version, item: v.item })),
      { form: next, focus: aim('notice') }
    );
  }

  // ---- The option rows -----------------------------------------------------------------------

  // Every method below guards on a pending save, so a press on an inert control sends nothing and
  // changes nothing. They change the draft only; Save is what sends.

  /** The form, if an edit may be made to it now: open, and no save outstanding. */
  const editable = (): Form | null => {
    const { form } = state;
    return form === null || state.command !== null ? null : form;
  };

  /** A list's rows replaced, with its refusals adjusted by `errors`. */
  function withList(form: Form, kind: OptionKind, rows: Row[], errors: OptionErrors = form.errors[listKey(kind)]): Form {
    return {
      ...form,
      draft: { ...form.draft, [listKey(kind)]: rows },
      errors: { ...form.errors, [listKey(kind)]: errors },
    };
  }

  /** One row's refusals cleared: all of them, or only `part`'s. */
  function without(errors: OptionErrors, key: string, part?: 'name' | 'change'): OptionErrors {
    const current = errors[key];
    if (current === undefined) return errors;
    const { [key]: _gone, ...rest } = errors;
    if (part === undefined) return rest;
    const left: RowErrors = { ...current, [part]: null };
    return left.name === null && left.change === null ? rest : { ...rest, [key]: left };
  }

  /**
   * A duplicate refusal belongs to its list (DESIGN-020 round 2, F4): after a name edit, a removal
   * or an Undo, each duplicate refusal whose name no other active row shares is cleared. It adds
   * none; Save checks afresh.
   */
  function recheck(rows: readonly Row[], errors: OptionErrors): OptionErrors {
    const active = rows.filter((r) => !r.removed);
    const same = (r: Row): boolean =>
      active.some((x) => x !== r && x.name.trim().toLowerCase() === r.name.trim().toLowerCase());
    let next = errors;
    for (const row of active) {
      if (next[row.key]?.name === 'duplicate' && !same(row)) next = without(next, row.key, 'name');
    }
    return next;
  }

  const rowOf = (form: Form, kind: OptionKind, key: string): Row | undefined =>
    form.draft[listKey(kind)].find((r) => r.key === key);

  function addOption(kind: OptionKind): void {
    const form = editable();
    if (form === null) return;
    const row: Row = { id: null, key: freshKey(), name: '', change: '0', removed: false, moved: false };
    set({
      form: {
        ...withList(form, kind, [...form.draft[listKey(kind)], row]),
        lastField: { kind, key: row.key, part: 'name' },
      },
      focus: aim({ kind, key: row.key, part: 'name' }),
    });
  }

  function setOptionName(kind: OptionKind, key: string, value: string): void {
    const form = editable();
    if (form === null || rowOf(form, kind, key) === undefined) return;
    const rows = form.draft[listKey(kind)].map((r) => (r.key === key ? { ...r, name: value } : r));
    // Editing clears the row's own refusal; the rest of the list is rechecked.
    const errors = recheck(rows, without(form.errors[listKey(kind)], key, 'name'));
    set({ form: { ...withList(form, kind, rows, errors), lastField: { kind, key, part: 'name' } } });
  }

  function setOptionChange(kind: OptionKind, key: string, value: string): void {
    const form = editable();
    if (form === null || rowOf(form, kind, key) === undefined) return;
    const rows = form.draft[listKey(kind)].map((r) => (r.key === key ? { ...r, change: value } : r));
    // Like the base price, the field keeps the text as typed until it loses focus.
    set({ form: { ...withList(form, kind, rows, without(form.errors[listKey(kind)], key, 'change')), lastField: { kind, key, part: 'change' } } });
  }

  function removeOption(kind: OptionKind, key: string): void {
    const form = editable();
    const row = form === null ? undefined : rowOf(form, kind, key);
    if (form === null || row === undefined || row.removed) return;
    // A saved row is marked and keeps its place; a new row is deleted, and is never pending removal.
    const rows =
      row.id === null
        ? form.draft[listKey(kind)].filter((r) => r.key !== key)
        : form.draft[listKey(kind)].map((r) => (r.key === key ? { ...r, removed: true } : r));
    const errors = recheck(rows, without(form.errors[listKey(kind)], key));
    set({
      form: withList(form, kind, rows, errors),
      focus: aim(row.id === null ? { kind, key: null, part: 'add' } : { kind, key, part: 'undo' }),
    });
  }

  function undoOption(kind: OptionKind, key: string): void {
    const form = editable();
    const row = form === null ? undefined : rowOf(form, kind, key);
    if (form === null || row === undefined || !row.removed) return;
    const rows = form.draft[listKey(kind)].map((r) => (r.key === key ? { ...r, removed: false } : r));
    set({
      form: { ...withList(form, kind, rows, recheck(rows, form.errors[listKey(kind)])), lastField: { kind, key, part: 'name' } },
      focus: aim({ kind, key, part: 'name' }),
    });
  }

  /**
   * Move up and Move down swap the row with the previous or next *active* row; a row pending
   * removal keeps its place. Only the pressed row is marked `moved` (DESIGN-020 round 2, F1).
   */
  function moveOption(kind: OptionKind, key: string, direction: 'up' | 'down'): void {
    const form = editable();
    if (form === null) return;
    const rows = [...form.draft[listKey(kind)]];
    const active = rows.flatMap((r, i) => (r.removed ? [] : [i]));
    const at = active.findIndex((i) => rows[i]!.key === key);
    const to = direction === 'up' ? at - 1 : at + 1;
    if (at < 0 || to < 0 || to >= active.length) return;
    const [a, b] = [active[at]!, active[to]!];
    [rows[a], rows[b]] = [rows[b]!, { ...rows[a]!, moved: true }];
    // Focus stays on the pressed control, or goes to the row's other move control when it is now at an end.
    const atEnd = direction === 'up' ? to === 0 : to === active.length - 1;
    set({ form: withList(form, kind, rows), focus: aim({ kind, key, part: atEnd ? (direction === 'up' ? 'down' : 'up') : direction }) });
  }

  // ---- Leaving -------------------------------------------------------------------------------

  // Leaving drops the draft and the subject. A save still outstanding is not cancelled and never
  // resent: Menu is told to wait for its answer.
  function depart(next: () => void): void {
    const { form, command } = state;
    if (command !== null && form !== null && command.formKey === form.key) command.discarded = true;
    visit += 1;
    set({ subject: null, form: null, read: 'idle', missing: false, decision: false, focus: null });
    flush();
    if (state.command !== null && state.command.discarded) menu.holdForSave();
    next();
  }

  // Leaving with unsaved work, or a save pending or of unknown outcome, needs the manager's word.
  function leave(next: () => void): 'left' | 'held' {
    if (state.form === null || (!dirty() && !uncertain())) {
      depart(next);
      return 'left';
    }
    proceed = next;
    set({ decision: true });
    return 'held';
  }

  /** Where Menu puts focus when BO-04 closes without a save: the item's Edit, or that category's New item. */
  function openerOf(subject: ItemSubject | null): { focus: { itemAction: string } | { newItem: string }; selected?: string } | null {
    if (subject === null) return null;
    return subject.kind === 'edit'
      ? { focus: { itemAction: subject.itemId }, selected: subject.itemId }
      : { focus: { newItem: subject.categoryId } };
  }

  const guard: WorkGuard = {
    status,
    leave: (next) => leave(next),
    focus: () => {
      if (state.form !== null) set({ focus: aim(returnTo()) });
    },
  };

  /** Opens BO-04 for a subject (Menu's call): the screen reads on its first showing. */
  function open(subject: ItemSubject): void {
    visit += 1;
    needsRead = true;
    set({
      subject,
      read: 'loading',
      missing: false,
      categories: [],
      items: [],
      readVersion: null,
      form: null,
      decision: false,
      focus: null,
    });
    router.navigate('item');
  }

  return {
    getState: (): ItemState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    guard,
    /**
     * The model lives as long as the working area: a save outlives the manager leaving BO-04. It
     * also becomes the way Menu opens an item subject. Returns the stop, which the area's unmount calls.
     */
    start(): () => void {
      stopped = false;
      const unbind = menu.bindItemEditor(open);
      return () => {
        stopped = true;
        unbind();
      };
    },
    /** BO-04 is on screen. An arrival with a subject reads once; with none it reads nothing and offers the way back. */
    shown(): void {
      if (state.subject === null) {
        set({ focus: aim('return') });
        return;
      }
      if (needsRead) {
        needsRead = false;
        void readSubject(visit);
      }
    },
    /** Whether answers may be presented: the session is signed in and nothing of the frame's is open. */
    setGate(next: boolean): void {
      gate = next;
      if (next) flush();
    },
    /** Try again after a failed first read: the read only. */
    retryLoad(): void {
      if (state.read !== 'failed' || state.subject === null) return;
      void readSubject(visit);
    },
    /** Try again after an unknown or stale outcome whose reread failed: that reread, and nothing sent. */
    async retryRead(): Promise<void> {
      const asked = state.form;
      if (asked === null || (asked.notice !== 'unknown-unread' && asked.notice !== 'stale-unread')) return;
      const fresh = await reread();
      if (!fresh || stopped) return;
      // What the completed read shows beside the draft is kept now, with the read: presenting it
      // later never reads again.
      const offered = offeredNow(asked);
      const present = (): void => {
        const { form } = state;
        // Gone, discarded or changed meanwhile: the result is not for what is on screen.
        if (form === null || form.key !== asked.key || form.notice !== asked.notice) return;
        if (asked.notice === 'unknown-unread') set(settleUnknown(form, { fresh: true, offered }));
        else if (offered !== null && form.base !== null && offered.version > form.base) set(compare(form, offered));
        else set({ form: { ...form, notice: 'failure', offered: null }, focus: aim('name') });
      };
      // The session or a decision took the screen during the read: hold the finished result and
      // present it once, with its focus, when the same manager is back. Nothing is read again.
      if (!gate || state.decision) heldRetry = present;
      else present();
    },
    /** After the session's own screen: put focus back in the work. */
    refocus(): void {
      set({ focus: aim(returnTo()) });
    },
    noteField(field: FieldKey): void {
      const { form } = state;
      if (form !== null && form.lastField !== field) set({ form: { ...form, lastField: field } });
    },
    setName(value: string): void {
      const { form } = state;
      if (form === null || state.command !== null) return;
      // Editing clears the field's obsolete error and its holder marker.
      set({
        form: { ...form, draft: { ...form.draft, name: value }, errors: { ...form.errors, name: null }, reread: false, lastField: 'name' },
      });
    },
    setCategory(categoryId: string): void {
      const { form } = state;
      if (form === null || state.command !== null) return;
      const chosen = state.categories.find((c) => c.categoryId === categoryId);
      set({
        form: {
          ...form,
          draft: { ...form.draft, categoryId },
          errors: { ...form.errors, category: null },
          categoryRefused: chosen?.isActive === true ? false : form.categoryRefused,
          lastField: 'category',
        },
      });
    },
    setPrice(value: string): void {
      const { form } = state;
      if (form === null || state.command !== null) return;
      // The field keeps the text as typed: it is regrouped when it loses focus, never under the caret.
      set({ form: { ...form, draft: { ...form.draft, price: value }, errors: { ...form.errors, price: null }, lastField: 'price' } });
    },
    addOption,
    setOptionName,
    setOptionChange,
    removeOption,
    undoOption,
    moveOption,
    /** An option field was focused: it is where focus returns. */
    noteOption(kind: OptionKind, key: string, part: 'name' | 'change'): void {
      const { form } = state;
      if (form === null || rowOf(form, kind, key) === undefined) return;
      const last = form.lastField;
      if (typeof last === 'object' && last.kind === kind && last.key === key && last.part === part) return;
      set({ form: { ...form, lastField: { kind, key, part } } });
    },
    /** An option's change field lost focus: an accepted value is regrouped, a refused one stays as typed. */
    blurOptionChange(kind: OptionKind, key: string): void {
      const { form } = state;
      const row = form === null ? undefined : rowOf(form, kind, key);
      if (form === null || row === undefined) return;
      const shown = shownPrice(row.change, kind);
      if (shown !== row.change) {
        set({ form: withList(form, kind, form.draft[listKey(kind)].map((r) => (r.key === key ? { ...r, change: shown } : r))) });
      }
    },
    /** The price field lost focus: an accepted value is regrouped, a refused one stays as typed. */
    blurPrice(): void {
      const { form } = state;
      if (form === null) return;
      const shown = shownPrice(form.draft.price, 'base');
      if (shown !== form.draft.price) set({ form: { ...form, draft: { ...form.draft, price: shown } } });
    },
    save,
    /**
     * Keep my changes: the draft now builds on the version read, and what it is compared with is
     * the current item, so every field that differs from it is sent. Nothing is sent now. The local
     * checks run again over the result.
     */
    keepMine(): void {
      const { form } = state;
      if (form === null || form.offered === null) return;
      const { offered } = form;
      // Each list is rebuilt from the current item by the child-row principle (`keep.ts`); `original`
      // then becomes the current item, so the next Save's change list is computed against it.
      const rebuilt: Form = {
        ...form,
        stored: offered.item,
        base: offered.version,
        original: fieldsOf(offered.item),
        draft: {
          ...form.draft,
          variants: keepRows('variant', form.original.variants, form.draft.variants, rowsOf(offered.item, 'variant', true), freshKey),
          modifiers: keepRows('modifier', form.original.modifiers, form.draft.modifiers, rowsOf(offered.item, 'modifier', true), freshKey),
        },
        offered: null,
      };
      const checked = checkAll(rebuilt);
      set({
        form: { ...rebuilt, errors: checked.errors, notice: 'kept', keptClean: checked.first === null, categoryRefused: false, destinationArchived: false },
        focus: aim(checked.first ?? 'save'),
      });
    },
    /** Use current item: the form shows the item just read, clean against it. Nothing is sent. */
    useCurrent(): void {
      const { form } = state;
      if (form === null || form.offered === null) return;
      const { offered } = form;
      set({
        form: {
          ...form,
          stored: offered.item,
          base: offered.version,
          original: fieldsOf(offered.item),
          draft: draftOf(offered.item),
          errors: NO_ERRORS,
          reread: false,
          categoryRefused: false,
          destinationArchived: false,
          notice: 'used',
          offered: null,
        },
        focus: aim('name'),
      });
    },
    /** Cancel and Escape: leave BO-04 for Menu, asking first if the draft is not clean. */
    cancel(): void {
      const back = openerOf(state.subject);
      leave(() => {
        if (back !== null) menu.stageArrival({ focus: back.focus, ...(back.selected === undefined ? {} : { selected: back.selected }) });
        router.navigate('menu');
      });
    },
    /** *View item on Menu*: leave through the departure decision, and land on the holder's row. */
    viewHolder(): void {
      const holder = holderOf(state);
      if (holder === null) return;
      const id = holder.item.itemId;
      leave(() => {
        menu.stageArrival({ focus: { itemAction: id }, selected: id });
        router.navigate('menu');
      });
    },
    /** *Return to menu*, where there is no draft to ask about. */
    returnToMenu(): void {
      leave(() => router.navigate('menu'));
    },
    stay(): void {
      proceed = null;
      set({ decision: false, focus: aim(returnTo()) });
      flush();
    },
    discard(): void {
      const next = proceed ?? (() => {});
      proceed = null;
      set({ decision: false });
      depart(next);
    },
  };
}

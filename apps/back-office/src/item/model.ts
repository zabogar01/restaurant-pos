import {
  CreateItemRequest,
  UpdateItemRequest,
  type CategoryView,
  type ItemChanges,
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
import { checkItemName } from './name.js';
import { checkPrice, shownPrice, type PriceError } from './price.js';

// BO-04's behaviour, apart from how it is drawn: the item's own fields (name, category, base
// price) read, edited and saved as one command through the S4b routes (PHASE1-S4c2a). It copies
// the configuration-form rules S1b to S4c1 built, as BO-03's model does. It sends a command once
// and never again: a resend is the manager's own press of Save. It never infers success from a
// reread. Nothing of the variants and modifiers is here (PHASE1-S4c2b): an edit sends no
// `variants` or `modifiers` key, and a create sends two empty lists.
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

export type FocusTarget = FieldKey | 'notice' | 'save' | 'return' | 'retry-load';

/** The item's own fields. A price is canonical in `original` and as typed in `draft`. */
export interface Fields {
  name: string;
  categoryId: string;
  price: string;
}

/** The current item as a reread showed it, beside a draft waiting for the manager's choice. */
export interface Offered {
  version: number;
  item: ItemView;
}

export interface FieldErrors {
  name: NameFault | null;
  category: CategoryFault | null;
  price: PriceError | null;
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
  lastField: FieldKey;
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

const fieldsOf = (item: ItemView): Fields => ({ name: item.name, categoryId: item.categoryId, price: item.basePrice });

/** A price as the form compares it: canonical when it is a price, otherwise exactly as typed. */
const priceKey = (typed: string): string => {
  const checked = checkPrice(typed, 'base');
  return checked.error === null ? checked.value : typed;
};

const hasErrors = (errors: FieldErrors): boolean =>
  errors.name !== null || errors.category !== null || errors.price !== null;

const NO_ERRORS: FieldErrors = { name: null, category: null, price: null };

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
    if (form === null) return false;
    return (
      form.draft.name.trim() !== form.original.name ||
      form.draft.categoryId !== form.original.categoryId ||
      priceKey(form.draft.price) !== form.original.price
    );
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
        draft: { ...fieldsOf(item), price: priceText(item.basePrice) },
      };
    }
    if (!snapshot.categories.some((c) => c.categoryId === subject.categoryId)) return null;
    const blank: Fields = { name: '', categoryId: subject.categoryId, price: '' };
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

  /** Every field checked, in reading order: the first that is not valid is where focus goes. */
  function checkAll(form: Form): { errors: FieldErrors; name: string; price: string | null; first: FieldKey | null } {
    const name = checkItemName(form.draft.name);
    const category = checkCategory(state.categories, form.draft.categoryId, form.stored?.categoryId ?? null);
    const price = checkPrice(form.draft.price, 'base');
    const errors: FieldErrors = { name: name.error, category, price: price.error };
    const first = name.error !== null ? 'name' : category !== null ? 'category' : price.error !== null ? 'price' : null;
    return { errors, name: name.name, price: price.value, first };
  }

  function save(): void {
    const { form } = state;
    if (form === null || state.command !== null) return;
    // A choice comes first: neither Keep my changes nor Use current item has been made, or the
    // comparison could not be read. A refused field holds Save until it is corrected.
    if (form.offered !== null || form.notice === 'stale-unread' || hasErrors(form.errors)) return;

    const checked = checkAll(form);
    if (checked.first !== null || checked.price === null) {
      set({
        form: { ...form, draft: { ...form.draft, name: checked.name }, errors: checked.errors, reread: false, notice: null },
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
    // *unchanged* (DESIGN-018). No `variants` or `modifiers` key: they stay as they are.
    const changes: ItemChanges = Object.keys(fields).length === 0 ? {} : { fields };
    const itemId = form.stored?.itemId ?? null;
    const body = create
      ? { categoryId: form.draft.categoryId, name: checked.name, basePrice: price, variants: [], modifiers: [] }
      : { itemId: itemId ?? '', expectedVersion: form.base ?? -1, changes };
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
      draft: { ...form.draft, name: checked.name, price: shownPrice(form.draft.price, 'base') },
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
      const rebuilt: Form = { ...form, stored: offered.item, base: offered.version, original: fieldsOf(offered.item), offered: null };
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
      const fields = fieldsOf(offered.item);
      set({
        form: {
          ...form,
          stored: offered.item,
          base: offered.version,
          original: fields,
          draft: { ...fields, price: priceText(offered.item.basePrice) },
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

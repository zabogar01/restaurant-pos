import type { ApiResult } from '@pos/api-client';
import {
  CreateCategoryRequest,
  ErrorCode,
  ReorderCategoriesRequest,
  ReorderItemsRequest,
  UpdateCategoryRequest,
  type CategoryView,
  type ItemView,
} from '@pos/contracts';
import { fieldsInError } from '../forms/fieldsInError.js';
import type { ConfigApi } from '../session/api.js';
import type { WorkGuard, WorkStatus } from '../work/guard.js';
import { activeItemScope, sameName, scopeOfCategories } from './group.js';
import { checkCategoryName, type NameError } from './name.js';

// BO-03's behaviour, apart from how it is drawn: the grouped list, the category form, the two
// reorders, the four state commands, and what each answer does (consult C2 section 6, DESIGN-019
// and `D`'s configuration-form rules, copied from BO-05's and BO-08's models). It sends a
// command once and never again: a resend is the manager's own press of Save, Create, Save order
// or a row action. It never infers success from a reread. The record a command answers is applied
// to the list; nothing is reread after a success.
//
// **The screen's state is this model's.** One workGuard registration, one `command` slot (a
// union over the command kinds), one `decision` and one held result belong to the screen. At
// most one editor is open: the category form (create or rename), or a reorder (of the
// categories, or of the items of one category). Every opener goes through `leave`, which closes
// a clean editor and asks about a dirty or uncertain one, and every opener is inert while the
// slot is full. 86 and Make available, Edit and New item are not here (S5 and S4c2).
//
// **The version.** `version` is the one the list stands at (DESIGN-019 round 2, F1). A full
// read sets it. A command's answer advances it only when the answered version is exactly one
// step ahead, or equal. Otherwise it keeps the standing version, so the next edit opened from
// the list is refused `CATALOG_CHANGED` and rereads. An editor carries the standing version at
// the moment it opens (`base`). A reread alone never moves it: only an answer, an unchanged
// answer, Keep my changes or Use current menu does (ADR-012 rule 3).
//
// One model belongs to one working area. A different manager's sign-in changes the area's
// key, React drops the component, and its model goes with it: nothing of it is announced or
// focused in the next manager's area.

export type FieldError = NameError | 'duplicate';
export type FormNotice =
  | 'failure'
  | 'session'
  | 'unknown'
  | 'unknown-unread'
  | 'unknown-newer'
  | 'stale'
  | 'stale-unread'
  | 'kept'
  | 'used';

export type EditorKind = 'create' | 'rename' | 'categories' | 'items';

/** The current menu as a reread showed it, beside a draft that is waiting for the manager's choice. */
export interface Offered {
  version: number;
  /** The category's current name (a rename). */
  name: string;
  /** The current order of the scope, as record ids (a reorder). */
  order: string[];
}

export type FocusTarget =
  | 'name'
  | 'notice'
  | 'status'
  | 'save'
  | 'first-move'
  | 'new-category'
  | 'reorder-categories'
  | { move: string; delta: -1 | 1 }
  | { rename: string }
  | { itemAction: string }
  | { reorderItems: string };

export interface Editor {
  /** Which editor this is; a command remembers it, so a late answer knows whether its editor is still here. */
  key: number;
  kind: EditorKind;
  /** The category renamed, or whose items are reordered; null for a create and for the categories' order. */
  recordId: string | null;
  /** Whether that category was active when the editor opened (a rename). */
  active: boolean;
  /** The category's name when the editor opened, which names the panel; empty otherwise. */
  openedName: string;
  /** The version the draft builds on; null for a create, which carries none. */
  base: number | null;
  original: string;
  draft: string;
  originalOrder: string[];
  order: string[];
  error: FieldError | null;
  /** A refused name was reread, so the holder can be told. */
  reread: boolean;
  notice: FormNotice | null;
  /** The current menu waiting for the manager's choice (Keep my changes or Use current menu), or null. */
  offered: Offered | null;
  /** An unknown outcome is open: leaving asks, whatever the draft holds. */
  uncertain: boolean;
  /** Where focus returns when the editor closes without a save. */
  opener: FocusTarget;
}

type CommandKind =
  | 'create'
  | 'rename'
  | 'reorder-categories'
  | 'reorder-items'
  | 'archive-category'
  | 'restore-category'
  | 'archive-item'
  | 'restore-item';

interface Command {
  kind: CommandKind;
  /** The category or item the command is about; null for a create and the categories' order. */
  recordId: string | null;
  /** The name the page speaks of: the submitted one for a save, the row's for a state command. */
  name: string;
  /** The editor this was sent from, or null for a state command. */
  editorKey: number | null;
  /** The version an edit carried; null for the commands that carry none. */
  expected: number | null;
  /** The manager discarded the editor this was sent from. Its answer still lands in the list, silently. */
  discarded: boolean;
}

export type PageStatus =
  | { kind: 'saved'; name: string }
  | { kind: 'order-saved'; scope: 'categories' }
  | { kind: 'order-saved'; scope: 'items'; category: string }
  | { kind: 'unchanged'; version: number }
  | { kind: 'pending'; action: 'archive' | 'restore'; name: string }
  | { kind: 'archived' | 'restored'; subject: 'category' | 'item'; name: string; hidden: boolean }
  | { kind: 'failed' | 'session'; name: string }
  | { kind: 'unknown'; name: string; unread: boolean }
  | { kind: 'duplicate'; subject: 'category' | 'item'; id: string; name: string; reread: boolean }
  | { kind: 'refreshed' }
  | { kind: 'waiting' };

export interface MenuState {
  read: 'loading' | 'ready' | 'failed';
  categories: readonly CategoryView[];
  items: readonly ItemView[];
  /** The version the list stands at; null until a full read has succeeded. */
  version: number | null;
  /**
   * An authoritative answer was applied while the read stood failed: the rows are the ones the
   * client knows, shown with the partial alert, and no count claims they are current. A
   * successful read clears it.
   */
  partial: boolean;
  editor: Editor | null;
  /** The command in flight, or being settled; also a discarded save's, until it answers. The screen's one slot. */
  command: Command | null;
  page: PageStatus | null;
  /** The stay-or-discard decision is wanted. Whoever draws it keeps it open until it is answered. */
  decision: boolean;
  /** The decision was opened by Archive or Restore: the draft is being continued from, not left. */
  continuing: boolean;
  focus: { target: FocusTarget; n: number } | null;
}

/** What an ok answer carries into the list. */
interface Applied {
  version: number;
  categories: readonly CategoryView[];
  items: readonly ItemView[];
}

type Failure = Exclude<ApiResult<never>, { kind: 'ok' }>;
type Answer = { kind: 'ok'; applied: Applied } | Failure;
type Meaning = 'saved' | 'unchanged' | 'stale' | 'duplicate' | 'gone' | 'session' | 'general' | 'unknown';

/** A reread's outcome, with what it showed beside the draft; held with a finished result. */
interface Reread {
  fresh: boolean;
  offered: Offered | null;
}

const READ = '/api/back-office/config/catalog' as const;
const CATEGORY_CREATE = '/api/back-office/config/catalog/categories/create' as const;
const CATEGORY_UPDATE = '/api/back-office/config/catalog/categories/update' as const;
const CATEGORY_REORDER = '/api/back-office/config/catalog/categories/reorder' as const;
const CATEGORY_ARCHIVE = '/api/back-office/config/catalog/categories/archive' as const;
const CATEGORY_RESTORE = '/api/back-office/config/catalog/categories/restore' as const;
const ITEM_REORDER = '/api/back-office/config/catalog/items/reorder' as const;
const ITEM_ARCHIVE = '/api/back-office/config/catalog/items/archive' as const;
const ITEM_RESTORE = '/api/back-office/config/catalog/items/restore' as const;

/**
 * What an answer means (consult C2 section 6). Never the text of an error. An edit's `ok` is read
 * against the version it carried: equal is *unchanged*, one ahead is *saved*, anything behind is
 * not an answer to this command. The commands that carry no version are *saved* when ok.
 */
function meaningOf(answer: Answer, expected: number | null): Meaning {
  switch (answer.kind) {
    case 'ok': {
      if (expected === null) return 'saved';
      const { version } = answer.applied;
      if (version === expected) return 'unchanged';
      return version > expected ? 'saved' : 'unknown';
    }
    case 'failed':
    case 'unavailable':
      return 'unknown';
    case 'session-gone':
      return 'session';
    case 'invalid-request':
      return 'general';
    case 'refused':
      switch (answer.body.error.code) {
        case ErrorCode.CATALOG_CHANGED:
          return 'stale';
        case ErrorCode.DUPLICATE:
          return 'duplicate';
        // Unreachable today: this client names only records it has read and sends whole scopes.
        // Each is the definite failure of the command, with the list reread once.
        case ErrorCode.NOT_FOUND:
        case ErrorCode.VALIDATION_FAILED:
          return 'gone';
        case ErrorCode.SESSION_IDLE:
        case ErrorCode.UNAUTHENTICATED:
        case ErrorCode.FORBIDDEN:
          return 'session';
        default:
          return 'general';
      }
  }
}

function call<T>(request: Promise<ApiResult<T>>, applied: (value: T) => Applied): Promise<Answer> {
  return request.then((answer) => (answer.kind === 'ok' ? { kind: 'ok' as const, applied: applied(answer.value) } : answer));
}

function upsertCategories(rows: readonly CategoryView[], record: CategoryView): CategoryView[] {
  return rows.some((row) => row.categoryId === record.categoryId)
    ? rows.map((row) => (row.categoryId === record.categoryId ? record : row))
    : [...rows, record];
}

function upsertItems(rows: readonly ItemView[], record: ItemView): ItemView[] {
  return rows.some((row) => row.itemId === record.itemId)
    ? rows.map((row) => (row.itemId === record.itemId ? record : row))
    : [...rows, record];
}

const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/** The same ids, in any order. */
const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id) => b.includes(id));

/**
 * Who holds the name a refused create, rename or restore asked for, once the reread has shown
 * it: the active category (or, for an item restore, the active item) with the same name by the
 * sort's collator. Nobody matching means no marker.
 */
export function holderOf(state: MenuState): { kind: 'category' | 'item'; id: string } | null {
  const { editor, page } = state;
  if (editor !== null && editor.error === 'duplicate' && editor.reread) {
    const found = state.categories.find(
      (c) => c.isActive && c.categoryId !== editor.recordId && sameName(c.name, editor.draft.trim())
    );
    return found === undefined ? null : { kind: 'category', id: found.categoryId };
  }
  if (page !== null && page.kind === 'duplicate' && page.reread) {
    if (page.subject === 'category') {
      const found = state.categories.find((c) => c.isActive && c.categoryId !== page.id && sameName(c.name, page.name));
      return found === undefined ? null : { kind: 'category', id: found.categoryId };
    }
    const found = state.items.find((i) => i.isActive && i.itemId !== page.id && sameName(i.name, page.name));
    return found === undefined ? null : { kind: 'item', id: found.itemId };
  }
  return null;
}

export type MenuModel = ReturnType<typeof createMenuModel>;

export function createMenuModel(config: ConfigApi) {
  let state: MenuState = {
    read: 'loading',
    categories: [],
    items: [],
    version: null,
    partial: false,
    editor: null,
    command: null,
    page: null,
    decision: false,
    continuing: false,
    focus: null,
  };
  const listeners = new Set<() => void>();
  let gate = false;
  let stopped = true;
  let loaded = false;
  /** Counts the answers applied and the versions adopted, so a read can tell which came after it began. */
  let clock = 0;
  const appliedCategories = new Map<string, { record: CategoryView; at: number }>();
  const appliedItems = new Map<string, { record: ItemView; at: number }>();
  /** When the standing version was last moved by an answer. */
  let standingAt = 0;
  let readSequence = 0;
  /** The newest list read, settled with the outcome of the list on screen. */
  let newestRead: Promise<boolean> = Promise.resolve(true);
  let editorSequence = 0;
  let focusSequence = 0;
  /** Where the manager was going when the decision was shown. */
  let proceed: (() => void) | null = null;
  /** An answer that arrived while the session was away or a decision was open, with its reread if it made one. */
  let held: { command: Command; answer: Answer; read?: Reread } | null = null;

  const set = (patch: Partial<MenuState>): void => {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener();
  };
  const aim = (target: FocusTarget): MenuState['focus'] => ({ target, n: (focusSequence += 1) });
  const withEditor = (patch: Partial<Editor>): Editor | null =>
    state.editor === null ? null : { ...state.editor, ...patch };

  const isReorder = (editor: Editor): boolean => editor.kind === 'categories' || editor.kind === 'items';
  const submitLabel = (editor: Editor | null): string =>
    editor === null ? 'Save' : isReorder(editor) ? 'Save order' : editor.kind === 'create' ? 'Create' : 'Save';
  /** Where focus goes to take up the draft again. */
  const draftTarget = (editor: Editor): FocusTarget => (isReorder(editor) ? 'first-move' : 'name');

  const pendingSave = (): boolean => {
    const { editor, command } = state;
    return editor !== null && command !== null && !command.discarded && command.editorKey === editor.key;
  };
  const dirty = (): boolean => {
    const { editor } = state;
    if (editor === null) return false;
    return editor.draft !== editor.original || !sameIds(editor.order, editor.originalOrder);
  };
  const uncertain = (): boolean => {
    const { editor } = state;
    return editor !== null && (pendingSave() || editor.uncertain);
  };
  const status = (): WorkStatus => (uncertain() ? 'uncertain' : dirty() ? 'dirty' : 'clean');

  /** The reorder scope the list holds now, for the editor's kind. */
  const scopeNow = (editor: Editor): string[] =>
    editor.kind === 'categories'
      ? scopeOfCategories(state.categories)
      : editor.recordId === null || state.categories.find((c) => c.categoryId === editor.recordId)?.isActive !== true
        ? []
        : activeItemScope(state.items, editor.recordId);

  // The list read, for the first load, for Try again, and for a reread after a refusal or an
  // unknown outcome (which does not hide the list while it runs). The latest read decides.
  //
  // A read is a snapshot taken before some command may have answered. A record a command's
  // authoritative answer replaced after the read began is kept (or inserted, if the read lacks
  // it), so an older snapshot arriving late never undoes a newer success. The same holds for the
  // standing version: an answer adopted after the read began, ahead of what the read saw, stays.
  //
  // What a caller receives describes the list on screen: a read that is no longer the newest
  // waits for the newest read already in flight and returns that read's outcome. It starts no
  // read of its own.
  function load(visible: boolean): Promise<boolean> {
    const run = readList(visible);
    newestRead = run;
    return run;
  }

  async function readList(visible: boolean): Promise<boolean> {
    readSequence += 1;
    const mine = readSequence;
    const startedAt = clock;
    if (visible) set({ read: 'loading' });
    let snapshot: { version: number; categories: readonly CategoryView[]; items: readonly ItemView[] } | null = null;
    try {
      const answer = await config[READ]();
      if (answer.kind === 'ok') snapshot = answer.value;
    } catch {
      snapshot = null;
    }
    if (stopped) return snapshot !== null;
    if (mine === readSequence) {
      if (snapshot !== null) {
        let categories = [...snapshot.categories];
        let items = [...snapshot.items];
        for (const { record, at } of appliedCategories.values()) if (at > startedAt) categories = upsertCategories(categories, record);
        for (const { record, at } of appliedItems.values()) if (at > startedAt) items = upsertItems(items, record);
        const ahead = state.version !== null && standingAt > startedAt && state.version > snapshot.version;
        set({
          read: 'ready',
          categories,
          items,
          partial: false,
          version: ahead ? state.version : snapshot.version,
        });
      } else {
        // The same reconciliation as a read that succeeded: an answer applied after this read
        // began is on screen, so the known rows stay drawn with the alert and no counts.
        set({ read: 'failed', partial: state.partial || clock > startedAt });
      }
      return snapshot !== null;
    }
    return newestRead;
  }

  /** What a reread showed of the record or scope an editor is about, beside its draft. */
  function offeredFor(kind: CommandKind, recordId: string | null): Offered | null {
    if (state.version === null) return null;
    if (kind === 'rename') {
      const category = state.categories.find((c) => c.categoryId === recordId);
      return category === undefined ? null : { version: state.version, name: category.name, order: [] };
    }
    if (kind === 'reorder-categories') {
      return { version: state.version, name: '', order: scopeOfCategories(state.categories) };
    }
    if (kind === 'reorder-items' && recordId !== null) {
      const active = state.categories.find((c) => c.categoryId === recordId)?.isActive === true;
      return { version: state.version, name: '', order: active ? activeItemScope(state.items, recordId) : [] };
    }
    return null;
  }

  /** The command kind an editor sends, which names what its reread should show. */
  const kindOf = (editor: Editor): CommandKind =>
    editor.kind === 'create' ? 'create' : editor.kind === 'rename' ? 'rename' : editor.kind === 'categories' ? 'reorder-categories' : 'reorder-items';

  /** A command's answer moves the list's version only when it is this write and nothing else. */
  function adopt(version: number): void {
    const { version: standing } = state;
    if (standing !== null && (version === standing + 1 || version === standing)) {
      clock += 1;
      standingAt = clock;
      set({ version });
    }
  }

  function apply(applied: Applied): void {
    clock += 1;
    let { categories, items } = state;
    for (const record of applied.categories) {
      appliedCategories.set(record.categoryId, { record, at: clock });
      categories = upsertCategories(categories, record);
    }
    for (const record of applied.items) {
      appliedItems.set(record.itemId, { record, at: clock });
      items = upsertItems(items, record);
    }
    // The read stands failed: the rows are the client's own, and the alert stays (F4).
    set({ categories, items, partial: state.read === 'failed' ? true : state.partial });
    adopt(applied.version);
  }

  function openEditor(init: {
    kind: EditorKind;
    recordId: string | null;
    active: boolean;
    openedName: string;
    base: number | null;
    name: string;
    order: string[];
    opener: FocusTarget;
  }): void {
    editorSequence += 1;
    set({
      editor: {
        key: editorSequence,
        kind: init.kind,
        recordId: init.recordId,
        active: init.active,
        openedName: init.openedName,
        base: init.base,
        original: init.name,
        draft: init.name,
        originalOrder: [...init.order],
        order: [...init.order],
        error: null,
        reread: false,
        notice: null,
        offered: null,
        uncertain: false,
        opener: init.opener,
      },
      page: null,
      focus: aim(init.kind === 'categories' || init.kind === 'items' ? 'first-move' : 'name'),
    });
  }

  function closeEditor(): void {
    const { editor, command } = state;
    if (editor === null) return;
    if (command !== null && command.editorKey === editor.key) command.discarded = true;
    set({ editor: null, focus: aim(editor.opener) });
  }

  // Leaving: the editor closes, a held answer is presented (silently, if its editor is gone), and
  // the destination runs. A save still outstanding says so, until it answers.
  function depart(next: () => void): void {
    closeEditor();
    flush();
    next();
    if (state.command?.discarded === true) set({ page: { kind: 'waiting' } });
  }

  function flush(): void {
    if (held === null || !gate || state.decision) return;
    const result = held;
    held = null;
    void present(result.command, result.answer, result.read);
  }

  function send(command: Command, request: () => Promise<Answer>, patch: Partial<MenuState> = {}): void {
    set({ ...patch, command });
    void request().then(
      (answer) => answered(command, answer),
      () => answered(command, { kind: 'invalid-request' })
    );
  }

  function answered(command: Command, answer: Answer): void {
    if (stopped) return;
    if (meaningOf(answer, command.expected) === 'session') {
      // Refused before the handler: nothing was applied, and nothing is held for the session
      // to hand back. M-6 or BO-01 is the session's own, and the draft stays where it is.
      const form = command.editorKey !== null;
      const editor = editorOf(command);
      const waiting = state.page?.kind === 'waiting' ? null : state.page;
      set({
        command: state.command === command ? null : state.command,
        editor: editor === null ? state.editor : { ...editor, notice: 'session', uncertain: false },
        page: form ? waiting : { kind: 'session', name: command.name },
        // The Saving notice the press asked focus for is gone: the same manager returns to the draft.
        ...(editor === null ? {} : { focus: aim(draftTarget(editor)) }),
      });
      return;
    }
    if (!gate || state.decision) {
      held = { command, answer };
      return;
    }
    void present(command, answer);
  }

  /** The editor a command was sent from, if it is still open and was not discarded. */
  const editorOf = (command: Command): Editor | null =>
    command.editorKey !== null && !command.discarded && state.editor?.key === command.editorKey ? state.editor : null;

  // After an unknown outcome the reread has been made. Same version: the plain uncertainty. A
  // newer version, for an edit that carried one: the uncertainty with the comparison and its two
  // choices. The reread failed: the facts are withheld and Try again repeats the read only.
  function settleUnknown(editor: Editor, read: Reread): Partial<MenuState> {
    if (!read.fresh) {
      return { editor: { ...editor, notice: 'unknown-unread', offered: null, uncertain: true }, focus: aim(draftTarget(editor)) };
    }
    if (editor.base !== null && state.version !== null && state.version > editor.base && read.offered !== null) {
      return { editor: { ...editor, notice: 'unknown-newer', offered: read.offered, uncertain: true }, focus: aim('notice') };
    }
    return { editor: { ...editor, notice: 'unknown', offered: null, uncertain: true }, focus: aim(draftTarget(editor)) };
  }

  async function present(command: Command, answer: Answer, read?: Reread): Promise<void> {
    const meaning = meaningOf(answer, command.expected);
    const clearWaiting = (): PageStatus | null => (state.page?.kind === 'waiting' ? null : state.page);
    const done = state.command === command ? null : state.command;
    const form = command.editorKey !== null;

    if (meaning === 'unknown') {
      // The reread comes first and never establishes success: it only makes the list current.
      let reread = read;
      if (reread === undefined) {
        const fresh = await load(false);
        reread = { fresh, offered: fresh ? offeredFor(command.kind, command.recordId) : null };
      }
      if (stopped) return;
      if (command.discarded) {
        set({ command: done, page: clearWaiting() });
        return;
      }
      if (!gate || state.decision) {
        // The session or a decision took the screen during the reread: hold the finished result and
        // its read, and present them once when the same manager is back. Nothing is read or sent again.
        held = { command, answer, read: reread };
        return;
      }
      const editor = editorOf(command);
      if (form) {
        if (editor === null) set({ command: done, page: clearWaiting() });
        else set({ command: done, ...settleUnknown(editor, reread) });
      } else {
        set({ command: done, page: { kind: 'unknown', name: command.name, unread: !reread.fresh }, focus: aim('status') });
      }
      return;
    }

    if (meaning === 'saved' || meaning === 'unchanged') {
      if (answer.kind !== 'ok') return;
      const { applied } = answer;
      apply(applied);
      const editor = editorOf(command);
      if (form && editor === null) {
        set({ command: done, page: clearWaiting() });
        return;
      }
      set({ command: done, ...(form ? { editor: null } : {}), ...resultOf(command, applied, meaning) });
      return;
    }

    if (meaning === 'stale') {
      // Nothing was written. One reread, so the manager sees what the server sees.
      let reread = read;
      if (reread === undefined) {
        const fresh = await load(false);
        reread = { fresh, offered: fresh ? offeredFor(command.kind, command.recordId) : null };
      }
      if (stopped) return;
      const editor = editorOf(command);
      if (editor === null) {
        set({ command: done, page: clearWaiting() });
        return;
      }
      if (!gate || state.decision) {
        held = { command, answer, read: reread };
        return;
      }
      if (!reread.fresh) {
        set({ command: done, editor: { ...editor, notice: 'stale-unread', offered: null, uncertain: false }, focus: aim('notice') });
      } else if (reread.offered !== null && editor.base !== null && reread.offered.version > editor.base) {
        set({ command: done, editor: { ...editor, notice: 'stale', offered: reread.offered, uncertain: false }, focus: aim('notice') });
      } else {
        // The refusal stands and the reread gave nothing to compare (DESIGN-019 draws no state
        // for it): the definite general failure, draft kept. Save asks again, with its own reread.
        set({ command: done, editor: { ...editor, notice: 'failure', offered: null, uncertain: false }, focus: aim(draftTarget(editor)) });
      }
      return;
    }

    // A refusal that applied nothing. The refused and the gone also reread, so the manager sees
    // what the server sees; neither establishes anything about this command. Nothing is
    // presented after the reread, so there is nothing for the session gate to hold.
    if (meaning === 'duplicate' || meaning === 'gone') {
      void load(false).then((fresh) => {
        if (stopped || !fresh) return;
        if (meaning === 'duplicate') showHolder(command);
      });
    }
    if (command.discarded) {
      set({ command: done, page: clearWaiting() });
      return;
    }
    if (meaning === 'duplicate' && form) {
      const editor = editorOf(command);
      if (editor === null) {
        set({ command: done, page: clearWaiting() });
        return;
      }
      set({ command: done, editor: { ...editor, error: 'duplicate', reread: false, notice: null, offered: null }, focus: aim('name') });
      return;
    }
    if (meaning === 'duplicate') {
      // A restore into a held name is a page result, never a form: Rename is a separate action.
      set({
        command: done,
        page: {
          kind: 'duplicate',
          subject: command.kind === 'restore-category' ? 'category' : 'item',
          id: command.recordId!,
          name: command.name,
          reread: false,
        },
        focus: aim('status'),
      });
      return;
    }
    // The definite general failure: draft kept, nothing was saved.
    if (form) {
      const editor = editorOf(command);
      if (editor === null) set({ command: done, page: clearWaiting() });
      else set({ command: done, editor: { ...editor, notice: 'failure', offered: null, uncertain: false }, focus: aim(draftTarget(editor)) });
    } else {
      set({ command: done, page: { kind: 'failed', name: command.name }, focus: aim('status') });
    }
  }

  /** The reread behind a refused name has landed: the holder can now be told. */
  function showHolder(command: Command): void {
    const { editor, page } = state;
    if (command.editorKey !== null) {
      if (editor !== null && editor.key === command.editorKey && editor.error === 'duplicate') set({ editor: { ...editor, reread: true } });
    } else if (page !== null && page.kind === 'duplicate' && page.id === command.recordId) {
      set({ page: { ...page, reread: true } });
    }
  }

  /** The page's sentence and focus for a command that was answered, and applied to the list. */
  function resultOf(command: Command, applied: Applied, meaning: 'saved' | 'unchanged'): Partial<MenuState> {
    const category = applied.categories[0];
    const item = applied.items[0];
    switch (command.kind) {
      case 'create':
      case 'rename':
        if (meaning === 'unchanged') return { page: { kind: 'unchanged', version: applied.version }, focus: aim(category ? { rename: category.categoryId } : 'new-category') };
        return { page: { kind: 'saved', name: category?.name ?? command.name }, focus: aim(category ? { rename: category.categoryId } : 'new-category') };
      case 'reorder-categories':
        return meaning === 'unchanged'
          ? { page: { kind: 'unchanged', version: applied.version }, focus: aim('reorder-categories') }
          : { page: { kind: 'order-saved', scope: 'categories' }, focus: aim('reorder-categories') };
      case 'reorder-items': {
        const name = state.categories.find((c) => c.categoryId === command.recordId)?.name ?? command.name;
        const opener: FocusTarget = { reorderItems: command.recordId! };
        return meaning === 'unchanged'
          ? { page: { kind: 'unchanged', version: applied.version }, focus: aim(opener) }
          : { page: { kind: 'order-saved', scope: 'items', category: name }, focus: aim(opener) };
      }
      case 'archive-category':
      case 'restore-category':
        return {
          page: { kind: command.kind === 'archive-category' ? 'archived' : 'restored', subject: 'category', name: category?.name ?? command.name, hidden: false },
          focus: aim({ rename: command.recordId! }),
        };
      case 'archive-item':
      case 'restore-item': {
        const owner = item === undefined ? undefined : state.categories.find((c) => c.categoryId === item.categoryId);
        return {
          page: {
            kind: command.kind === 'archive-item' ? 'archived' : 'restored',
            subject: 'item',
            name: item?.name ?? command.name,
            hidden: owner?.isActive === false,
          },
          // Edit takes this focus when S4c2 adds it; until then it is the row action now shown.
          focus: aim({ itemAction: command.recordId! }),
        };
      }
    }
  }

  // ---- The category form and the reorders ----------------------------------------------------

  function save(): void {
    const { editor } = state;
    if (editor === null || state.command !== null) return;
    // A choice comes first: neither Keep my changes nor Use current menu has been made, or the
    // comparison could not be read.
    if (editor.offered !== null || editor.notice === 'stale-unread') return;

    if (!isReorder(editor)) {
      const checked = checkCategoryName(editor.draft);
      const create = editor.kind === 'create';
      const body = create
        ? { name: checked.name }
        : { categoryId: editor.recordId, expectedVersion: editor.base, name: checked.name };
      const fields = fieldsInError(create ? CreateCategoryRequest : UpdateCategoryRequest, body);
      if (checked.error !== null) {
        set({ editor: { ...editor, draft: checked.name, error: checked.error, reread: false, notice: null }, focus: aim('name') });
        return;
      }
      if (fields.length > 0) {
        // The form's check and the contract disagree: a defect, shown as the general failure.
        set({ editor: { ...editor, draft: checked.name, error: null, notice: 'failure' }, focus: aim('name') });
        return;
      }
      const command: Command = {
        kind: create ? 'create' : 'rename',
        recordId: editor.recordId,
        name: checked.name,
        editorKey: editor.key,
        expected: create ? null : editor.base,
        discarded: false,
      };
      send(
        command,
        () =>
          create
            ? call(config[CATEGORY_CREATE]({ name: checked.name }), (v) => ({ version: v.version, categories: [v.category], items: [] }))
            : call(
                config[CATEGORY_UPDATE]({ categoryId: editor.recordId!, expectedVersion: editor.base!, name: checked.name }),
                (v) => ({ version: v.version, categories: [v.category], items: [] })
              ),
        { editor: { ...editor, draft: checked.name, error: null, reread: false, notice: null, uncertain: false }, page: null, focus: aim('notice') }
      );
      return;
    }

    // A reorder sends the complete active scope in the draft's order. A draft whose scope is no
    // longer the list's (another tab archived or restored a record) is never sent: it would be an
    // incomplete scope, and a reorder never silently merges a changed scope.
    if (editor.base === null || !sameSet(editor.order, scopeNow(editor))) {
      set({ editor: { ...editor, notice: 'failure', uncertain: false }, focus: aim(draftTarget(editor)) });
      return;
    }
    const categories = editor.kind === 'categories';
    const body = categories
      ? { expectedVersion: editor.base, categoryIds: editor.order }
      : { categoryId: editor.recordId, expectedVersion: editor.base, itemIds: editor.order };
    if (fieldsInError(categories ? ReorderCategoriesRequest : ReorderItemsRequest, body).length > 0) {
      set({ editor: { ...editor, notice: 'failure' }, focus: aim(draftTarget(editor)) });
      return;
    }
    const command: Command = {
      kind: categories ? 'reorder-categories' : 'reorder-items',
      recordId: editor.recordId,
      name: editor.openedName,
      editorKey: editor.key,
      expected: editor.base,
      discarded: false,
    };
    send(
      command,
      () =>
        categories
          ? call(config[CATEGORY_REORDER]({ expectedVersion: editor.base!, categoryIds: editor.order }), (v) => ({
              version: v.version,
              categories: v.categories,
              items: [],
            }))
          : call(
              config[ITEM_REORDER]({ categoryId: editor.recordId!, expectedVersion: editor.base!, itemIds: editor.order }),
              (v) => ({ version: v.version, categories: [], items: v.items })
            ),
      { editor: { ...editor, notice: null, uncertain: false }, page: null, focus: aim('notice') }
    );
  }

  // ---- The state commands --------------------------------------------------------------------

  function changeCategoryState(categoryId: string): void {
    const row = state.categories.find((c) => c.categoryId === categoryId);
    if (row === undefined || state.command !== null) return;
    const archive = row.isActive;
    set({ page: { kind: 'pending', action: archive ? 'archive' : 'restore', name: row.name }, focus: aim('status') });
    const command: Command = {
      kind: archive ? 'archive-category' : 'restore-category',
      recordId: categoryId,
      name: row.name,
      editorKey: null,
      expected: null,
      discarded: false,
    };
    send(command, () =>
      call(
        archive ? config[CATEGORY_ARCHIVE]({ categoryId }) : config[CATEGORY_RESTORE]({ categoryId }),
        (v) => ({ version: v.version, categories: [v.category], items: [] })
      )
    );
  }

  function changeItemState(itemId: string): void {
    const row = state.items.find((i) => i.itemId === itemId);
    if (row === undefined || state.command !== null) return;
    const archive = row.isActive;
    set({ page: { kind: 'pending', action: archive ? 'archive' : 'restore', name: row.name }, focus: aim('status') });
    const command: Command = {
      kind: archive ? 'archive-item' : 'restore-item',
      recordId: itemId,
      name: row.name,
      editorKey: null,
      expected: null,
      discarded: false,
    };
    send(command, () =>
      call(
        archive ? config[ITEM_ARCHIVE]({ itemId }) : config[ITEM_RESTORE]({ itemId }),
        (v) => ({ version: v.version, categories: [], items: [v.item] })
      )
    );
  }

  // Leaving with unsaved work, or a save pending or of unknown outcome, needs the manager's
  // word. `continuing` is for Archive and Restore: they change scopes, so they ask, but the
  // draft is being continued from and not left.
  function leave(next: () => void, continuing = false): 'left' | 'held' {
    if (state.editor === null || (!dirty() && !uncertain())) {
      depart(next);
      return 'left';
    }
    proceed = next;
    set({ decision: true, continuing });
    return 'held';
  }

  const returnTo = (): FocusTarget => {
    const { editor } = state;
    if (editor === null) return 'new-category';
    return pendingSave() ? 'notice' : draftTarget(editor);
  };

  const guard: WorkGuard = {
    status,
    leave: (next) => leave(next),
    focus: () => {
      if (state.editor !== null) set({ focus: aim(returnTo()) });
    },
  };

  // The page can be drawn when a read succeeded, or when an answer was applied to the rows the
  // client knew while a read stands failed (the alert stays, the counts are withheld).
  const usable = (): boolean => state.read === 'ready' || state.partial;

  return {
    getState: (): MenuState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    guard,
    /**
     * The model lives as long as the working area (the keyed `div`), not as long as the screen:
     * a command outlives the manager leaving Menu. Returns the stop, which the area's unmount calls.
     */
    start(): () => void {
      stopped = false;
      return () => {
        stopped = true;
      };
    },
    /**
     * Menu is on screen. Every visit reads the list: the first shows "Loading", a later one
     * rereads without hiding the rows already held (the merge keeps any record a command answered
     * after the read began). A stale result is dropped. A visit sends its own read even while an
     * earlier one is out: the latest read decides. A read is not interactive, so a development
     * double effect that sends one more is harmless.
     */
    shown(): void {
      if (!loaded) {
        loaded = true;
        void load(true);
      } else {
        void load(false);
      }
      const { page } = state;
      if (page !== null && page.kind !== 'waiting' && page.kind !== 'pending') set({ page: null });
    },
    /** Whether answers may be presented: the session is signed in and nothing of the frame's is open. */
    setGate(open: boolean): void {
      gate = open;
      if (open) flush();
    },
    /** Try again: the read only. After an unknown or stale outcome whose reread failed, it is that reread. */
    async retryRead(): Promise<void> {
      const fresh = await load(true);
      if (!fresh || stopped) return;
      const { editor, page } = state;
      if (editor !== null && editor.notice === 'unknown-unread') {
        set(settleUnknown(editor, { fresh: true, offered: offeredFor(kindOf(editor), editor.recordId) }));
      } else if (editor !== null && editor.notice === 'stale-unread') {
        const offered = offeredFor(kindOf(editor), editor.recordId);
        if (offered !== null && editor.base !== null && offered.version > editor.base) {
          set({ editor: { ...editor, notice: 'stale', offered }, focus: aim('notice') });
        } else {
          set({ editor: { ...editor, notice: 'failure', offered: null }, focus: aim(draftTarget(editor)) });
        }
      } else if (page?.kind === 'unknown' && page.unread) {
        set({ page: { ...page, unread: false }, focus: aim('status') });
      } else {
        set({ page: { kind: 'refreshed' }, focus: aim('status') });
      }
    },
    /** After the session's own screen: put focus back in the work. */
    refocus(): void {
      set({ focus: aim(returnTo()) });
    },
    // One command at a time: while one is pending these are inert, whatever pressed them.
    openCreate(): void {
      if (state.command === null && usable()) leave(() => openEditor({ kind: 'create', recordId: null, active: true, openedName: '', base: null, name: '', order: [], opener: 'new-category' }));
    },
    openRename(categoryId: string): void {
      if (state.command !== null || state.version === null) return;
      leave(() => {
        // The version is the list's standing one at the moment the editor opens.
        const row = state.categories.find((c) => c.categoryId === categoryId);
        const base = state.version;
        if (row === undefined || base === null) return;
        openEditor({ kind: 'rename', recordId: categoryId, active: row.isActive, openedName: row.name, base, name: row.name, order: [], opener: { rename: categoryId } });
      });
    },
    openReorderCategories(): void {
      if (state.command !== null || state.read !== 'ready' || state.version === null) return;
      if (scopeOfCategories(state.categories).length < 2) return;
      leave(() => {
        // The scope and the version are read when the editor opens, after a clean editor closed.
        if (state.version === null) return;
        openEditor({ kind: 'categories', recordId: null, active: true, openedName: '', base: state.version, name: '', order: scopeOfCategories(state.categories), opener: 'reorder-categories' });
      });
    },
    openReorderItems(categoryId: string): void {
      if (state.command !== null || state.read !== 'ready' || state.version === null) return;
      const row = state.categories.find((c) => c.categoryId === categoryId);
      if (row === undefined || !row.isActive || activeItemScope(state.items, categoryId).length < 2) return;
      leave(() => {
        if (state.version === null) return;
        openEditor({ kind: 'items', recordId: categoryId, active: true, openedName: row.name, base: state.version, name: '', order: activeItemScope(state.items, categoryId), opener: { reorderItems: categoryId } });
      });
    },
    /** Archive or Restore of a category: sent at once from the header, with no confirmation. */
    changeCategoryState(categoryId: string): void {
      if (state.command === null) leave(() => changeCategoryState(categoryId), true);
    },
    /** Archive or Restore of an item: sent at once from the row, with no confirmation. */
    changeItemState(itemId: string): void {
      if (state.command === null) leave(() => changeItemState(itemId), true);
    },
    setDraft(value: string): void {
      const { editor } = state;
      if (editor === null || isReorder(editor) || state.command !== null) return;
      // Editing clears the field's obsolete error and its holder marker.
      set({ editor: { ...editor, draft: value, error: null, reread: false } });
    },
    /** Move up (-1) or Move down (1): the draft's order only. Nothing is sent. */
    move(id: string, delta: -1 | 1): void {
      const { editor } = state;
      if (editor === null || !isReorder(editor) || state.command !== null) return;
      const at = editor.order.indexOf(id);
      const to = at + delta;
      if (at < 0 || to < 0 || to >= editor.order.length) return;
      const order = [...editor.order];
      [order[at], order[to]] = [order[to]!, order[at]!];
      // Focus stays on the moved record's control, or on its other one at an end.
      const atEnd = (delta === -1 && to === 0) || (delta === 1 && to === order.length - 1);
      set({ editor: { ...editor, order }, focus: aim({ move: id, delta: atEnd ? (delta === -1 ? 1 : -1) : delta }) });
    },
    save,
    /** Keep my changes: the draft now builds on the version read; nothing is sent. */
    keepMine(): void {
      const { editor } = state;
      if (editor === null || editor.offered === null) return;
      set({ editor: { ...editor, base: editor.offered.version, offered: null, notice: 'kept' }, focus: aim('save') });
    },
    /** Use current menu: the editor takes the current values; nothing is sent. */
    useCurrent(): void {
      const { editor } = state;
      if (editor === null || editor.offered === null) return;
      const { offered } = editor;
      const next: Editor = isReorder(editor)
        ? { ...editor, base: offered.version, offered: null, order: [...offered.order], originalOrder: [...offered.order], notice: 'used' }
        : { ...editor, base: offered.version, offered: null, draft: offered.name, original: offered.name, error: null, reread: false, notice: 'used' };
      set({ editor: next, focus: aim(draftTarget(next)) });
    },
    /** Cancel and Escape: leave the editor where it stands. */
    cancel(): void {
      leave(() => {});
    },
    stay(): void {
      proceed = null;
      set({ decision: false, continuing: false, focus: aim(returnTo()) });
      flush();
    },
    discard(): void {
      const next = proceed ?? (() => {});
      proceed = null;
      set({ decision: false, continuing: false });
      depart(next);
    },
  };
}

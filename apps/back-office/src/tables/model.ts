import type { ApiResult } from '@pos/api-client';
import { CreateTableRequest, ErrorCode, UpdateTableRequest, type TableResponse, type TableView } from '@pos/contracts';
import { fieldsInError } from '../forms/fieldsInError.js';
import type { ConfigApi } from '../session/api.js';
import type { WorkGuard, WorkStatus } from '../work/guard.js';
import { checkLabel, type LabelError } from './label.js';

// BO-05's behaviour, apart from how it is drawn: the list, the form, the four commands, and
// what each answer does (consult C2 section 6, DESIGN-017 and `D`'s configuration-form rules).
// It sends a command once and never again: a resend is the manager's own press of Save or of
// a row action, so the server's no-op rule makes it harmless (a repeated create is `DUPLICATE`).
// It never infers success from a reread. The record a command answers is inserted or
// replaced in the list; nothing is reread after a success.
//
// One model belongs to one working area. A different manager's sign-in changes the area's
// key, React drops the component, and its model goes with it: nothing of it is announced or
// focused in the next manager's area.

export type FieldError = LabelError | 'duplicate' | 'duplicate-reactivate';
export type FormNotice = 'failure' | 'unknown' | 'unknown-unread';

export interface Editor {
  /** Which form this is; a command remembers it, so a late answer knows whether its form is still here. */
  key: number;
  /** The record being edited, or null for a new table. */
  recordId: string | null;
  /** Whether that record was active when the form opened. */
  active: boolean;
  /** The record's label when the form opened, which names the form; empty for a new table. */
  openedLabel: string;
  original: string;
  draft: string;
  error: FieldError | null;
  notice: FormNotice | null;
}

type Op = 'save' | 'deactivate' | 'reactivate';

interface Command {
  op: Op;
  recordId: string | null;
  /** The label the page speaks of: the submitted one for a save, the row's for a status command. */
  label: string;
  editorKey: number | null;
  /** The manager discarded the form this was sent from. Its answer still lands in the list, silently. */
  discarded: boolean;
}

export type PageStatus =
  | { kind: 'saved' | 'deactivated' | 'reactivated' | 'deactivating' | 'reactivating' | 'failed' | 'session'; label: string }
  | { kind: 'unknown'; label: string; unread: boolean }
  | { kind: 'waiting' };

export type FocusTarget = 'label' | 'notice' | 'status' | 'opener' | { edit: string };

export interface TablesState {
  read: 'loading' | 'ready' | 'failed';
  rows: readonly TableView[];
  /**
   * An authoritative answer was applied while the collection read stood failed: the rows are
   * the ones the client knows, shown with the read-failure alert, and no count claims they are
   * current. A successful read clears it.
   */
  partial: boolean;
  editor: Editor | null;
  /** The command in flight, or being settled; also a discarded save's, until it answers. */
  command: Command | null;
  page: PageStatus | null;
  /** The stay-or-discard decision is wanted. Whoever draws it keeps it open until it is answered. */
  decision: boolean;
  focus: { target: FocusTarget; n: number } | null;
}

type Answer = ApiResult<TableResponse>;
type Meaning = 'ok' | 'duplicate' | 'not-found' | 'session' | 'general' | 'unknown';

/** What an answer means for the form (consult C2 section 6). Never the text of an error. */
function meaningOf(answer: Answer): Meaning {
  switch (answer.kind) {
    case 'ok':
      return 'ok';
    case 'failed':
    case 'unavailable':
      return 'unknown';
    case 'session-gone':
      return 'session';
    case 'invalid-request':
      return 'general';
    case 'refused':
      switch (answer.body.error.code) {
        case ErrorCode.DUPLICATE:
          return 'duplicate';
        case ErrorCode.NOT_FOUND:
          return 'not-found';
        case ErrorCode.SESSION_IDLE:
        case ErrorCode.UNAUTHENTICATED:
        case ErrorCode.FORBIDDEN:
          return 'session';
        default:
          return 'general';
      }
  }
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Active first, then inactive; labels in natural, case-insensitive order; ties by id. */
export function ordered(rows: readonly TableView[]): TableView[] {
  return [...rows].sort(
    (a, b) =>
      Number(b.isActive) - Number(a.isActive) ||
      collator.compare(a.label, b.label) ||
      (a.tableId < b.tableId ? -1 : a.tableId > b.tableId ? 1 : 0)
  );
}

const upsert = (rows: readonly TableView[], table: TableView): TableView[] =>
  rows.some((row) => row.tableId === table.tableId)
    ? rows.map((row) => (row.tableId === table.tableId ? table : row))
    : [...rows, table];

export type TablesModel = ReturnType<typeof createTablesModel>;

export function createTablesModel(config: ConfigApi) {
  let state: TablesState = { read: 'loading', rows: [], partial: false, editor: null, command: null, page: null, decision: false, focus: null };
  const listeners = new Set<() => void>();
  let gate = false;
  let stopped = true;
  let loaded = false;
  /** Counts the answers applied to the list, so a read can tell which came after it began. */
  let appliedClock = 0;
  const applied = new Map<string, { table: TableView; at: number }>();
  let readSequence = 0;
  /** The newest list read, settled with the outcome of the list on screen. */
  let newestRead: Promise<boolean> = Promise.resolve(true);
  let editorSequence = 0;
  let focusSequence = 0;
  /** Where the manager was going when the decision was shown. */
  let proceed: (() => void) | null = null;
  /** An answer that arrived while the session was away or a decision was open. */
  let held: { command: Command; answer: Answer } | null = null;

  const set = (patch: Partial<TablesState>): void => {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener();
  };
  const aim = (target: FocusTarget): TablesState['focus'] => ({ target, n: (focusSequence += 1) });

  const dirty = (): boolean => state.editor !== null && state.editor.draft !== state.editor.original;
  const uncertain = (): boolean => {
    const { editor, command } = state;
    if (editor === null) return false;
    return (
      (command !== null && !command.discarded && command.editorKey === editor.key) ||
      editor.notice === 'unknown' ||
      editor.notice === 'unknown-unread'
    );
  };
  const status = (): WorkStatus => (uncertain() ? 'uncertain' : dirty() ? 'dirty' : 'clean');

  // The list read, for the first load, for Try again, and for a reread after a refusal or an
  // unknown outcome (which does not hide the list while it runs). The latest read decides.
  //
  // A read is a snapshot taken before some command may have answered. A record a command's
  // authoritative answer replaced after the read began is kept (or inserted, if the read
  // lacks it), so an older snapshot arriving late never undoes a newer success.
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
    const startedAt = appliedClock;
    if (visible) set({ read: 'loading' });
    let rows: readonly TableView[] | null = null;
    try {
      const answer = await config['/api/back-office/config/tables']();
      if (answer.kind === 'ok') rows = answer.value.tables;
    } catch {
      rows = null;
    }
    if (mine === readSequence) {
      if (rows !== null) {
        let merged = [...rows];
        for (const { table, at } of applied.values()) if (at > startedAt) merged = upsert(merged, table);
        set({ read: 'ready', rows: merged, partial: false });
      } else {
        // The same reconciliation as a read that succeeded: an answer applied after this read
        // began is on screen, so the known rows stay drawn with the alert and no counts.
        set({ read: 'failed', partial: state.partial || appliedClock > startedAt });
      }
      return rows !== null;
    }
    return newestRead;
  }

  function openEditor(recordId: string | null): void {
    const row = recordId === null ? undefined : state.rows.find((r) => r.tableId === recordId);
    if (recordId !== null && row === undefined) return;
    editorSequence += 1;
    set({
      editor: {
        key: editorSequence,
        recordId,
        active: row?.isActive ?? true,
        openedLabel: row?.label ?? '',
        original: row?.label ?? '',
        draft: row?.label ?? '',
        error: null,
        notice: null,
      },
      page: null,
      focus: aim('label'),
    });
  }

  function closeEditor(): void {
    const { editor, command } = state;
    if (editor === null) return;
    if (command !== null && command.editorKey === editor.key) command.discarded = true;
    set({ editor: null, focus: aim(editor.recordId === null ? 'opener' : { edit: editor.recordId }) });
  }

  const withEditor = (patch: Partial<Editor>): Editor | null => (state.editor === null ? null : { ...state.editor, ...patch });

  // Leaving: the form closes, a held answer is presented (silently, if its form is gone), and
  // the destination runs. A save still outstanding says so, until it answers.
  function depart(next: () => void): void {
    closeEditor();
    flush();
    next();
    if (state.command?.discarded === true) set({ page: { kind: 'waiting' } });
  }

  function flush(): void {
    if (held === null || !gate || state.decision) return;
    const { command, answer } = held;
    held = null;
    void present(command, answer);
  }

  function send(command: Command, call: () => Promise<Answer>, patch: Partial<TablesState> = {}): void {
    set({ ...patch, command });
    void call().then(
      (answer) => answered(command, answer),
      () => answered(command, { kind: 'invalid-request' })
    );
  }

  function answered(command: Command, answer: Answer): void {
    if (stopped) return;
    if (meaningOf(answer) === 'session') {
      // Refused before the handler: nothing was applied, and nothing is held for the session
      // to hand back. M-6 or BO-01 is the session's own, and the draft stays where it is.
      const refused = command.op !== 'save' ? ({ kind: 'session', label: command.label } as const) : null;
      set({
        command: state.command === command ? null : state.command,
        page: refused ?? (state.page?.kind === 'waiting' ? null : state.page),
      });
      return;
    }
    if (!gate || state.decision) {
      held = { command, answer };
      return;
    }
    void present(command, answer);
  }

  async function present(command: Command, answer: Answer): Promise<void> {
    const meaning = meaningOf(answer);
    const clearWaiting = (): PageStatus | null => (state.page?.kind === 'waiting' ? null : state.page);
    const done = state.command === command ? null : state.command;

    if (meaning === 'unknown') {
      // The reread comes first and never establishes success: it only makes the list current.
      const fresh = await load(false);
      if (stopped) return;
      if (command.discarded) {
        set({ command: done, page: clearWaiting() });
      } else if (command.op === 'save') {
        set({
          command: done,
          editor: withEditor({ notice: fresh ? 'unknown' : 'unknown-unread' }),
          focus: aim('label'),
        });
      } else {
        set({ command: done, page: { kind: 'unknown', label: command.label, unread: !fresh }, focus: aim('status') });
      }
      return;
    }

    if (meaning === 'ok' && answer.kind === 'ok') {
      const { table } = answer.value;
      appliedClock += 1;
      applied.set(table.tableId, { table, at: appliedClock });
      const rows = upsert(state.rows, table);
      // The read stands failed: the rows are the client's own, and the alert stays (F4).
      const partial = state.read === 'failed' ? true : state.partial;
      if (command.discarded) {
        set({ command: done, rows, partial, page: clearWaiting() });
      } else if (command.op === 'save') {
        set({
          command: done,
          rows,
          partial,
          editor: null,
          page: { kind: 'saved', label: table.label },
          focus: aim({ edit: table.tableId }),
        });
      } else {
        set({
          command: done,
          rows,
          partial,
          page: { kind: command.op === 'deactivate' ? 'deactivated' : 'reactivated', label: table.label },
          focus: aim({ edit: table.tableId }),
        });
      }
      return;
    }

    // A refusal that applied nothing. NOT_FOUND and DUPLICATE also reread, so the manager
    // sees what the server sees; neither establishes anything about this command.
    if (meaning === 'duplicate' || meaning === 'not-found') void load(false);
    if (command.discarded) {
      set({ command: done, page: clearWaiting() });
      return;
    }
    if (meaning === 'duplicate' && command.op === 'save') {
      set({ command: done, editor: withEditor({ error: 'duplicate', notice: null }), focus: aim('label') });
      return;
    }
    if (meaning === 'duplicate' && command.op === 'reactivate') {
      // The reactivation was refused: open that inactive table's own label for renaming.
      set({ command: done });
      openEditor(command.recordId);
      set({ editor: withEditor({ error: 'duplicate-reactivate' }) });
      return;
    }
    // The definite general failure: draft kept, nothing was saved.
    if (command.op === 'save') {
      set({ command: done, editor: withEditor({ notice: 'failure' }), focus: aim('label') });
    } else {
      set({ command: done, page: { kind: 'failed', label: command.label }, focus: aim('status') });
    }
  }

  function save(): void {
    const { editor } = state;
    if (editor === null || state.command !== null) return;
    const checked = checkLabel(editor.draft);
    const create = editor.recordId === null;
    const body = create ? { label: checked.label } : { tableId: editor.recordId, label: checked.label };
    const fields = fieldsInError(create ? CreateTableRequest : UpdateTableRequest, body);
    if (checked.error !== null) {
      set({ editor: withEditor({ draft: checked.label, error: checked.error, notice: null }), focus: aim('label') });
      return;
    }
    if (fields.length > 0) {
      // The form's check and the contract disagree: a defect, shown as the general failure.
      set({ editor: withEditor({ draft: checked.label, error: null, notice: 'failure' }), focus: aim('label') });
      return;
    }
    const command: Command = { op: 'save', recordId: editor.recordId, label: checked.label, editorKey: editor.key, discarded: false };
    send(
      command,
      () =>
        create
          ? config['/api/back-office/config/tables/create']({ label: checked.label })
          : config['/api/back-office/config/tables/update']({ tableId: editor.recordId!, label: checked.label }),
      { editor: withEditor({ draft: checked.label, error: null, notice: null }), page: null, focus: aim('notice') }
    );
  }

  function changeStatus(recordId: string): void {
    const row = state.rows.find((r) => r.tableId === recordId);
    if (row === undefined || state.command !== null) return;
    const op: Op = row.isActive ? 'deactivate' : 'reactivate';
    set({
      page: { kind: op === 'deactivate' ? 'deactivating' : 'reactivating', label: row.label },
      focus: aim('status'),
    });
    const command: Command = { op, recordId, label: row.label, editorKey: null, discarded: false };
    send(command, () =>
      op === 'deactivate'
        ? config['/api/back-office/config/tables/deactivate']({ tableId: recordId })
        : config['/api/back-office/config/tables/reactivate']({ tableId: recordId })
    );
  }

  // Leaving with unsaved work, or a save pending or of unknown outcome, needs the manager's
  // word. A status command has no draft, so it asks nobody.
  function leave(next: () => void): 'left' | 'held' {
    if (state.editor === null || (!dirty() && !uncertain())) {
      depart(next);
      return 'left';
    }
    proceed = next;
    set({ decision: true });
    return 'held';
  }

  const guard: WorkGuard = {
    status,
    leave,
    focus: () => {
      if (state.editor !== null) set({ focus: aim(state.command !== null ? 'notice' : 'label') });
    },
  };

  return {
    getState: (): TablesState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    guard,
    /**
     * The model lives as long as the working area (the keyed `div`), not as long as the screen:
     * a command outlives the manager leaving Tables. Returns the stop, which the area's
     * unmount calls.
     */
    start(): () => void {
      stopped = false;
      return () => {
        stopped = true;
      };
    },
    /**
     * Tables is on screen. Every visit reads the list: the first shows "Loading", a later one
     * rereads without hiding the rows already held (the F3 merge keeps any record a command
     * answered after the read began). A stale result is dropped. A visit sends its own read even
     * while an earlier one is out: the latest read decides. A development double effect may send
     * one more, which is harmless, a read not being interactive.
     */
    shown(): void {
      if (!loaded) {
        loaded = true;
        void load(true);
      } else {
        void load(false);
      }
      const { page } = state;
      if (page !== null && !['waiting', 'deactivating', 'reactivating'].includes(page.kind)) set({ page: null });
    },
    /** Whether answers may be presented: the session is signed in and nothing of the frame's is open. */
    setGate(open: boolean): void {
      gate = open;
      if (open) flush();
    },
    /** Try again on a failed read: the read only. */
    async retryRead(): Promise<void> {
      const fresh = await load(true);
      if (!fresh || stopped) return;
      const { editor, page } = state;
      if (editor !== null && editor.notice === 'unknown-unread') {
        set({ editor: withEditor({ notice: 'unknown' }), focus: aim('label') });
      } else if (page?.kind === 'unknown' && page.unread) {
        set({ page: { ...page, unread: false }, focus: aim('status') });
      } else {
        set({ focus: aim('opener') });
      }
    },
    /** After the session's own screen: put focus back in the work. */
    refocus(): void {
      const { editor, command } = state;
      set({ focus: aim(editor === null ? 'opener' : command !== null ? 'notice' : 'label') });
    },
    // One command at a time: while one is pending these are inert, whatever pressed them.
    openNew(): void {
      if (state.command === null) leave(() => openEditor(null));
    },
    openEdit(recordId: string): void {
      if (state.command === null) leave(() => openEditor(recordId));
    },
    changeStatus(recordId: string): void {
      if (state.command === null) leave(() => changeStatus(recordId));
    },
    setDraft(value: string): void {
      if (state.editor === null || state.command !== null) return;
      // Editing clears the field's obsolete error and its holder marker.
      set({ editor: withEditor({ draft: value, error: null }) });
    },
    save,
    /** Cancel and Escape: leave the form where it stands. */
    cancel(): void {
      leave(() => {});
    },
    stay(): void {
      proceed = null;
      set({ decision: false, focus: aim(state.command !== null ? 'notice' : 'label') });
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

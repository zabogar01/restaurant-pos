import {
  CreateCashierUserRequest,
  CreateKitchenUserRequest,
  CreateManagerUserRequest,
  ReactivateUserRequest,
  type UserView,
} from '@pos/contracts';
import { call, type Answered } from '../forms/answer.js';
import type { ConfigApi } from '../session/api.js';
import type { WorkGuard, WorkStatus } from '../work/guard.js';
import type { Classification } from './copy.js';
import { checkName, checkPassword, checkPin, checkUsername } from './fields.js';

// BO-06's behaviour, apart from how it is drawn: the staff list, the one form (a new person, or
// the new PIN a reactivation asks for), and the two state commands with the deactivation
// confirmation (consult C3 section 10, DESIGN-023, and `D`'s configuration-form rules, copied from
// BO-07's presets model without its versions). It sends a command once and never again: a resend
// is the manager's own press of Save or a row action. It never infers success from a reread. The
// record a command answers is applied to the list; nothing is reread after a success.
//
// **The screen's state is this model's.** One workGuard registration, one `command` slot, one
// `decision` and one held result belong to the screen. At most one form is open, and every opener
// (Add person, Deactivate, Reactivate) goes through `leave`, which closes a clean form and asks
// about a dirty or uncertain one. Every opener is inert while the slot is full, a discarded save
// still outstanding included.
//
// **Credentials are not in this model.** A credential lives in a native, uncontrolled input of the
// view. `submit` receives the typed values once, builds the request from them inside the call
// that sends it, and keeps none of them. The model knows only *that* something was typed
// (`typed`, for the departure decision) and asks the view to empty its inputs by moving
// `credentialEpoch`: after every response the open form received, on a classification change, and
// when the session leaves the frame.
//
// **The rows are held in the order the server answered** (creation order). A new person is
// appended and a changed one replaces its row in place, and the table groups them for display
// (`order.ts`). The client never sorts by name.
//
// One model belongs to one working area. A different manager's sign-in changes the area's key,
// React drops the component, and its model goes with it: nothing of it is announced or focused in
// the next manager's area.

export type FieldKey = 'name' | 'pin' | 'username' | 'password';
export type FieldError =
  | 'empty'
  | 'long'
  | 'control'
  | 'invalid'
  | 'duplicate'
  | 'duplicate-reactivate';
export type FormNotice =
  | 'failure'
  | 'session'
  | 'unknown'
  | 'unknown-unread'
  | 'own-account'
  | 'user-changed'
  | 'user-changed-unread'
  | 'not-found'
  | 'not-found-unread';

export type FocusTarget = FieldKey | 'classification' | 'notice' | 'status' | 'add-person' | { row: string };

/** What the view hands to `submit`: the credential fields as typed, each present only if it is on the form. */
export interface Typed {
  pin?: string;
  username?: string;
  password?: string;
}

export interface Editor {
  /** Which form this is; a command remembers it, so a late answer knows whether its form is still here. */
  key: number;
  kind: 'create' | 'reactivate';
  /** The person a reactivation form is about; null for a new person. */
  staffUserId: string | null;
  /** The reactivated person's name, which names the form; empty for a new person. */
  subjectName: string;
  classification: Classification;
  openedClassification: Classification;
  name: string;
  /** The name the last save was sent with, which the notices after it speak of. */
  sentName: string;
  /** Whether any credential field has been typed in since it was last emptied. */
  typed: boolean;
  errors: Partial<Record<FieldKey, FieldError>>;
  notice: FormNotice | null;
  /** The credentials were emptied while the form stayed: say so. */
  credentialsNotice: boolean;
  /** A form-level refusal stands: Save is off and the manager returns to the list. */
  blocked: boolean;
  /** An unknown outcome is open: leaving asks, whatever the draft holds. */
  uncertain: boolean;
  /** Where focus returns when the form closes without a save. */
  opener: FocusTarget;
}

type CommandKind = 'create' | 'deactivate' | 'reactivate';

interface Command {
  kind: CommandKind;
  /** The person the command is about; null for a create. */
  staffUserId: string | null;
  /** The name the page speaks of: the submitted one for a create, the row's for the others. */
  name: string;
  /** The form this was sent from, or null for a row command. */
  editorKey: number | null;
  /** The manager discarded the form this was sent from. Its answer still lands in the list, silently. */
  discarded: boolean;
}

export type PageStatus =
  | { kind: 'added' | 'deactivated' | 'reactivated'; name: string }
  | { kind: 'pending'; action: 'deactivate' | 'reactivate'; name: string }
  | { kind: 'failed' | 'session'; name: string }
  | { kind: 'unknown'; name: string; unread: boolean }
  | { kind: 'waiting' };

/** The deactivation confirmation: a modal in the working area, naming the person. */
export interface Confirm {
  staffUserId: string;
  name: string;
  classification: Classification;
}

export interface StaffState {
  read: 'loading' | 'ready' | 'failed';
  /** In the order the server answered. */
  users: readonly UserView[];
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
  confirm: Confirm | null;
  /** The stay-or-discard decision is wanted. Whoever draws it keeps it open until it is answered. */
  decision: boolean;
  /** Moves when the view must empty its credential inputs. */
  credentialEpoch: number;
  focus: { target: FocusTarget; n: number } | null;
}

interface Applied {
  user: UserView;
}
type Answer = Answered<Applied>;

type Meaning =
  | { kind: 'saved' }
  | { kind: 'unknown' }
  | { kind: 'session' }
  | { kind: 'general' }
  | { kind: 'duplicate'; field: 'pin' | 'username' }
  | { kind: 'own-account' }
  | { kind: 'user-changed' }
  | { kind: 'not-found' };

/** A reread's outcome, held with a finished result. */
interface Reread {
  fresh: boolean;
}

const READ = '/api/back-office/config/users' as const;
const CREATE = '/api/back-office/config/users/create' as const;
const DEACTIVATE = '/api/back-office/config/users/deactivate' as const;
const REACTIVATE = '/api/back-office/config/users/reactivate' as const;

/** What an answer means to the screen. Never the text of an error: its kind, its code and `details.field`. */
function meaningOf(answer: Answer): Meaning {
  switch (answer.kind) {
    case 'ok':
      return { kind: 'saved' };
    case 'failed':
    case 'unavailable':
      return { kind: 'unknown' };
    case 'session-gone':
      return { kind: 'session' };
    case 'invalid-request':
      return { kind: 'general' };
    case 'refused': {
      const { error } = answer.body;
      switch (error.code) {
        case 'DUPLICATE':
          // Only `details.field` places the refusal; without it there is nothing to place.
          return error.details === undefined ? { kind: 'general' } : { kind: 'duplicate', field: error.details.field };
        case 'OWN_ACCOUNT':
          return { kind: 'own-account' };
        case 'USER_CHANGED':
          return { kind: 'user-changed' };
        case 'NOT_FOUND':
          return { kind: 'not-found' };
        case 'SESSION_IDLE':
        case 'UNAUTHENTICATED':
        case 'FORBIDDEN':
          return { kind: 'session' };
        default:
          return { kind: 'general' };
      }
    }
  }
}

function upsert(rows: readonly UserView[], record: UserView): UserView[] {
  return rows.some((row) => row.staffUserId === record.staffUserId)
    ? rows.map((row) => (row.staffUserId === record.staffUserId ? record : row))
    : [...rows, record];
}

/** The fields a form shows, in displayed order. */
export function fieldsOf(editor: Pick<Editor, 'kind' | 'classification'>): FieldKey[] {
  if (editor.kind === 'reactivate') return ['pin'];
  if (editor.classification === 'KITCHEN') return ['name'];
  if (editor.classification === 'CASHIER') return ['name', 'pin'];
  return ['name', 'pin', 'username', 'password'];
}

const hasCredentials = (editor: Pick<Editor, 'kind' | 'classification'>): boolean =>
  fieldsOf(editor).some((field) => field !== 'name');

export type StaffModel = ReturnType<typeof createStaffModel>;

export function createStaffModel(config: ConfigApi) {
  let state: StaffState = {
    read: 'loading',
    users: [],
    partial: false,
    editor: null,
    command: null,
    page: null,
    confirm: null,
    decision: false,
    credentialEpoch: 0,
    focus: null,
  };
  const listeners = new Set<() => void>();
  let gate = false;
  let stopped = true;
  let loaded = false;
  /** Counts the answers applied, so a read can tell which came after it began. */
  let clock = 0;
  /** A record a command answered, and when it was applied. */
  const applied = new Map<string, { record: UserView; at: number }>();
  let readSequence = 0;
  /** The newest list read, settled with the outcome of the list on screen. */
  let newestRead: Promise<boolean> = Promise.resolve(true);
  let editorSequence = 0;
  let focusSequence = 0;
  /** Where the manager was going when the decision was shown. */
  let proceed: (() => void) | null = null;
  /** An answer that arrived while the session was away or a decision was open, with its reread if it made one. */
  let held: { command: Command; answer: Answer; read?: Reread } | null = null;
  /** The finished result of an explicit retry of a reread, held the same way. */
  let heldRetry: (() => void) | null = null;

  const set = (patch: Partial<StaffState>): void => {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener();
  };
  const aim = (target: FocusTarget): StaffState['focus'] => ({ target, n: (focusSequence += 1) });
  const emptyInputs = (): number => state.credentialEpoch + 1;

  const busy = (): boolean => state.command !== null;
  const pendingSave = (): boolean => {
    const { editor, command } = state;
    return editor !== null && command !== null && !command.discarded && command.editorKey === editor.key;
  };
  const dirty = (): boolean => {
    const { editor } = state;
    return (
      editor !== null &&
      (editor.typed || editor.name !== '' || editor.classification !== editor.openedClassification)
    );
  };
  const uncertain = (): boolean => {
    const { editor } = state;
    return editor !== null && (pendingSave() || editor.uncertain);
  };
  const status = (): WorkStatus => (uncertain() ? 'uncertain' : dirty() ? 'dirty' : 'clean');
  /** Whether a finished result may be presented now: the same manager is here and nothing is open over the work. */
  const open = (): boolean => gate && !state.decision && state.confirm === null;
  const usable = (): boolean => state.read === 'ready' || state.partial;
  const rowOf = (staffUserId: string): UserView | undefined => state.users.find((u) => u.staffUserId === staffUserId);

  // The list read, for the first load, for Try again, and for a reread after a refusal or an
  // unknown outcome (which does not hide the list while it runs). The latest read decides.
  //
  // A read is a snapshot taken before or after some command committed, and arrival order does not
  // say which. There is no version on a users route, so the rule is the one the clock can state:
  // a record a command answered after the read began is never undone by it (kept, or inserted at
  // the end, which is where a new person belongs). What a caller receives describes the list on
  // screen: a read that is no longer the newest waits for the newest read already in flight and
  // returns that read's outcome. It starts no read of its own.
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
    let snapshot: readonly UserView[] | null = null;
    try {
      const answer = await config[READ]();
      if (answer.kind === 'ok') snapshot = answer.value.users;
    } catch {
      snapshot = null;
    }
    if (stopped) return snapshot !== null;
    if (mine === readSequence) {
      if (snapshot !== null) {
        let users = [...snapshot];
        for (const { record, at } of applied.values()) {
          if (at > startedAt) users = upsert(users, record);
        }
        set({ read: 'ready', users, partial: false });
      } else {
        // An answer applied after this read began is on screen, so the known rows stay drawn
        // with the alert and no counts.
        set({ read: 'failed', partial: state.partial || clock > startedAt });
      }
      return snapshot !== null;
    }
    return newestRead;
  }

  function apply(record: UserView): void {
    clock += 1;
    applied.set(record.staffUserId, { record, at: clock });
    // The read stands failed: the rows are the client's own, and the alert stays.
    set({ users: upsert(state.users, record), partial: state.read === 'failed' ? true : state.partial });
  }

  function openEditor(init: {
    kind: Editor['kind'];
    staffUserId: string | null;
    subjectName: string;
    opener: FocusTarget;
  }): void {
    editorSequence += 1;
    const classification: Classification = 'KITCHEN';
    set({
      editor: {
        key: editorSequence,
        kind: init.kind,
        staffUserId: init.staffUserId,
        subjectName: init.subjectName,
        classification,
        openedClassification: classification,
        name: '',
        sentName: init.subjectName,
        typed: false,
        errors: {},
        notice: null,
        credentialsNotice: false,
        blocked: false,
        uncertain: false,
        opener: init.opener,
      },
      page: null,
      focus: aim(init.kind === 'create' ? 'name' : 'pin'),
    });
  }

  function closeEditor(): void {
    const { editor, command } = state;
    if (editor === null) return;
    if (command !== null && command.editorKey === editor.key) command.discarded = true;
    set({ editor: null, focus: aim(editor.opener) });
  }

  // Leaving: the form (and the confirmation, if one is open) closes, a held answer is presented
  // (silently, if its form is gone), and the destination runs. A save still outstanding says so,
  // until it answers.
  function depart(next: () => void): void {
    closeEditor();
    if (state.confirm !== null) set({ confirm: null });
    flush();
    next();
    if (state.command?.discarded === true) set({ page: { kind: 'waiting' } });
  }

  function flush(): void {
    if (!open()) return;
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

  function send(command: Command, request: () => Promise<Answer>, patch: Partial<StaffState> = {}): void {
    set({ ...patch, command });
    void request().then(
      (answer) => answered(command, answer),
      () => answered(command, { kind: 'invalid-request' })
    );
  }

  /** The form a command was sent from, if it is still open and was not discarded. */
  const editorOf = (command: Command): Editor | null =>
    command.editorKey !== null && !command.discarded && state.editor?.key === command.editorKey ? state.editor : null;

  const firstField = (editor: Editor): FocusTarget => (editor.kind === 'create' ? 'name' : 'pin');

  function answered(command: Command, answer: Answer): void {
    if (stopped) return;
    if (meaningOf(answer).kind === 'session') {
      // Refused before the handler: nothing was applied, and nothing is held for the session to
      // hand back. M-6 or BO-01 is the session's own, and the draft stays where it is.
      const form = command.editorKey !== null;
      const editor = editorOf(command);
      const waiting = state.page?.kind === 'waiting' ? null : state.page;
      set({
        command: state.command === command ? null : state.command,
        editor: editor === null ? state.editor : { ...editor, notice: 'session', uncertain: false, typed: false },
        page: form ? waiting : { kind: 'session', name: command.name },
        ...(editor === null ? {} : { credentialEpoch: emptyInputs(), focus: aim(firstField(editor)) }),
      });
      return;
    }
    if (!open()) {
      held = { command, answer };
      return;
    }
    void present(command, answer);
  }

  async function reread(): Promise<Reread> {
    return { fresh: await load(false) };
  }

  async function present(command: Command, answer: Answer, read?: Reread): Promise<void> {
    const meaning = meaningOf(answer);
    const clearWaiting = (): PageStatus | null => (state.page?.kind === 'waiting' ? null : state.page);
    const done = state.command === command ? null : state.command;
    const form = command.editorKey !== null;

    // Every outcome that rereads does so first, once, and presents only if the session is still
    // here and nothing is open over the work. Otherwise the finished result is held with its read
    // and presented when the same manager returns: nothing is read or sent again.
    const rereads =
      meaning.kind === 'unknown' ||
      meaning.kind === 'user-changed' ||
      meaning.kind === 'not-found' ||
      (meaning.kind === 'own-account' && !form);
    if (rereads) {
      const settled = read ?? (await reread());
      if (stopped) return;
      if (command.discarded) {
        set({ command: done, page: clearWaiting() });
        return;
      }
      if (!open()) {
        held = { command, answer, read: settled };
        return;
      }
      settle(command, meaning, settled, done);
      return;
    }

    if (meaning.kind === 'saved') {
      if (answer.kind !== 'ok') return;
      const { user } = answer.applied;
      apply(user);
      const editor = editorOf(command);
      if (form && editor === null) {
        set({ command: done, page: clearWaiting() });
        return;
      }
      set({
        command: done,
        ...(form ? { editor: null, credentialEpoch: emptyInputs() } : {}),
        ...resultOf(command, user),
      });
      return;
    }

    if (meaning.kind === 'duplicate') {
      duplicate(command, meaning.field, done);
      return;
    }

    if (meaning.kind === 'own-account') {
      const editor = editorOf(command);
      if (command.discarded || editor === null) {
        set({ command: done, page: clearWaiting() });
        return;
      }
      set({
        command: done,
        editor: { ...editor, notice: 'own-account', blocked: true, uncertain: false, typed: false },
        credentialEpoch: emptyInputs(),
        focus: aim('notice'),
      });
      return;
    }

    // A refusal that applied nothing and needs no reread: the definite general failure.
    failure(command, done);
  }

  /** A finished outcome that reread, presented. The command is not discarded and the session is here. */
  function settle(command: Command, meaning: Meaning, read: Reread, done: Command | null): void {
    const clearWaiting = (): PageStatus | null => (state.page?.kind === 'waiting' ? null : state.page);
    const form = command.editorKey !== null;
    const editor = editorOf(command);

    if (!form) {
      if (meaning.kind === 'unknown') {
        set({ command: done, page: { kind: 'unknown', name: command.name, unread: !read.fresh }, focus: aim('status') });
      } else {
        // OWN_ACCOUNT, USER_CHANGED and NOT_FOUND cannot be reached from a row command (the own
        // row offers no Deactivate, a no-op answers the record, nothing deletes a person): each
        // is the command's definite failure, with the list reread.
        failure(command, done);
      }
      return;
    }

    if (editor === null) {
      set({ command: done, page: clearWaiting() });
      return;
    }
    if (meaning.kind === 'unknown') {
      set({
        command: done,
        editor: {
          ...editor,
          notice: read.fresh ? 'unknown' : 'unknown-unread',
          uncertain: true,
          typed: false,
          credentialsNotice: hasCredentials(editor),
        },
        credentialEpoch: emptyInputs(),
        focus: aim(firstField(editor)),
      });
      return;
    }
    if ((meaning.kind === 'user-changed' || meaning.kind === 'not-found') && editor.kind === 'reactivate') {
      const notice: FormNotice =
        meaning.kind === 'user-changed'
          ? read.fresh
            ? 'user-changed'
            : 'user-changed-unread'
          : read.fresh
            ? 'not-found'
            : 'not-found-unread';
      set({
        command: done,
        editor: { ...editor, notice, blocked: true, uncertain: false, typed: false },
        credentialEpoch: emptyInputs(),
        focus: aim('notice'),
      });
      return;
    }
    // A create names no existing person: these codes are not reachable from it.
    failure(command, done);
  }

  /** `DUPLICATE` is placed by `details.field` and nothing else. No reread, and no holder is named. */
  function duplicate(command: Command, field: 'pin' | 'username', done: Command | null): void {
    const clearWaiting = (): PageStatus | null => (state.page?.kind === 'waiting' ? null : state.page);
    if (command.discarded) {
      set({ command: done, page: clearWaiting() });
      return;
    }
    const editor = editorOf(command);
    if (editor !== null) {
      // A username conflict is only reachable from a create; on the reactivation form it is a
      // PIN field or nothing.
      if (field === 'username' && !fieldsOf(editor).includes('username')) {
        failure(command, done);
        return;
      }
      const error: FieldError = field === 'username' ? 'duplicate' : editor.kind === 'reactivate' ? 'duplicate-reactivate' : 'duplicate';
      set({
        command: done,
        editor: {
          ...editor,
          errors: { ...editor.errors, [field]: error },
          notice: null,
          uncertain: false,
          typed: false,
          credentialsNotice: hasCredentials(editor),
        },
        credentialEpoch: emptyInputs(),
        focus: aim(field),
      });
      return;
    }
    // A plain reactivation into a held PIN opens that inactive person's form, asking for a new
    // one. Only a person with a PIN can meet it; a kitchen person never does.
    const person = command.staffUserId === null ? undefined : rowOf(command.staffUserId);
    if (command.kind !== 'reactivate' || field !== 'pin' || person === undefined || person.classification === 'KITCHEN') {
      failure(command, done);
      return;
    }
    set({ command: done });
    openEditor({ kind: 'reactivate', staffUserId: person.staffUserId, subjectName: person.name, opener: { row: person.staffUserId } });
    const opened = state.editor;
    if (opened !== null) set({ editor: { ...opened, errors: { pin: 'duplicate-reactivate' } } });
  }

  /** The definite general failure: draft kept, nothing was saved. */
  function failure(command: Command, done: Command | null): void {
    const clearWaiting = (): PageStatus | null => (state.page?.kind === 'waiting' ? null : state.page);
    if (command.discarded) {
      set({ command: done, page: clearWaiting() });
      return;
    }
    if (command.editorKey !== null) {
      const editor = editorOf(command);
      if (editor === null) {
        set({ command: done, page: clearWaiting() });
      } else {
        set({
          command: done,
          editor: { ...editor, notice: 'failure', uncertain: false, typed: false, credentialsNotice: hasCredentials(editor) },
          credentialEpoch: emptyInputs(),
          focus: aim(firstField(editor)),
        });
      }
    } else {
      set({ command: done, page: { kind: 'failed', name: command.name }, focus: aim('status') });
    }
  }

  /** The page's sentence and focus for a command that was answered, and applied to the list. */
  function resultOf(command: Command, user: UserView): Partial<StaffState> {
    const name = user.name;
    const page: PageStatus =
      command.kind === 'create'
        ? { kind: 'added', name }
        : command.kind === 'deactivate'
          ? { kind: 'deactivated', name }
          : { kind: 'reactivated', name };
    return { page, focus: aim({ row: user.staffUserId }) };
  }

  // ---- The form ------------------------------------------------------------------------------

  /**
   * Save. `typed` holds the credential fields as the view read them from the native inputs, once,
   * now. They are checked, and on success they go into the request built here and nowhere else.
   * A refusal of the form's own check is not a response: nothing is emptied, so the manager can
   * correct what was typed.
   */
  function submit(typed: Typed): void {
    const { editor } = state;
    if (editor === null || busy() || editor.blocked) return;

    const errors: Partial<Record<FieldKey, FieldError>> = {};
    let name = editor.name;
    let pin = '';
    let username = '';
    let password = '';
    for (const field of fieldsOf(editor)) {
      if (field === 'name') {
        const checked = checkName(editor.name);
        name = checked.name;
        if (checked.error !== null) errors.name = checked.error;
      } else if (field === 'pin') {
        pin = typed.pin ?? '';
        if (checkPin(pin) !== null) errors.pin = 'invalid';
      } else if (field === 'username') {
        const checked = checkUsername(typed.username ?? '');
        username = checked.username;
        if (checked.error !== null) errors.username = 'invalid';
      } else {
        password = typed.password ?? '';
        if (checkPassword(password) !== null) errors.password = 'invalid';
      }
    }
    const first = fieldsOf(editor).find((field) => errors[field] !== undefined);
    if (first !== undefined) {
      set({ editor: { ...editor, name, errors, notice: null }, focus: aim(first) });
      return;
    }

    if (editor.kind === 'reactivate') {
      const staffUserId = editor.staffUserId;
      const body = { staffUserId: staffUserId ?? '', pin };
      if (staffUserId === null || !ReactivateUserRequest.safeParse(body).success) {
        set({ editor: { ...editor, name, notice: 'failure' }, focus: aim('pin') });
        return;
      }
      const command: Command = {
        kind: 'reactivate',
        staffUserId,
        name: editor.subjectName,
        editorKey: editor.key,
        discarded: false,
      };
      send(
        command,
        () => call(config[REACTIVATE](body), (v) => ({ user: v.user })),
        { editor: { ...editor, errors: {}, notice: null, uncertain: false, credentialsNotice: false }, page: null, focus: aim('notice') }
      );
      return;
    }

    const body =
      editor.classification === 'KITCHEN'
        ? { classification: 'KITCHEN' as const, name }
        : editor.classification === 'CASHIER'
          ? { classification: 'CASHIER' as const, name, pin }
          : { classification: 'MANAGER' as const, name, pin, username, password };
    // The form's check and the contract agree (a test holds them so): a disagreement is a defect,
    // shown as the general failure.
    const schema =
      editor.classification === 'KITCHEN'
        ? CreateKitchenUserRequest
        : editor.classification === 'CASHIER'
          ? CreateCashierUserRequest
          : CreateManagerUserRequest;
    if (!schema.safeParse(body).success) {
      set({ editor: { ...editor, name, notice: 'failure' }, focus: aim('name') });
      return;
    }
    const command: Command = { kind: 'create', staffUserId: null, name, editorKey: editor.key, discarded: false };
    send(
      command,
      () => call(config[CREATE](body), (v) => ({ user: v.user })),
      {
        editor: { ...editor, name, sentName: name, errors: {}, notice: null, uncertain: false, credentialsNotice: false },
        page: null,
        focus: aim('notice'),
      }
    );
  }

  // ---- The state commands --------------------------------------------------------------------

  function sendState(person: UserView, kind: 'deactivate' | 'reactivate'): void {
    set({ page: { kind: 'pending', action: kind, name: person.name }, focus: aim('status') });
    const command: Command = {
      kind,
      staffUserId: person.staffUserId,
      name: person.name,
      editorKey: null,
      discarded: false,
    };
    const body = { staffUserId: person.staffUserId };
    send(command, () =>
      call(kind === 'deactivate' ? config[DEACTIVATE](body) : config[REACTIVATE](body), (v) => ({ user: v.user }))
    );
  }

  // Leaving with unsaved work, or a save pending or of unknown outcome, needs the manager's word.
  function leave(next: () => void): 'left' | 'held' {
    if (state.editor === null || (!dirty() && !uncertain())) {
      depart(next);
      return 'left';
    }
    proceed = next;
    set({ decision: true });
    return 'held';
  }

  const returnTo = (): FocusTarget => {
    const { editor } = state;
    if (editor === null) return 'add-person';
    return pendingSave() ? 'notice' : firstField(editor);
  };

  const guard: WorkGuard = {
    status,
    leave: (next) => leave(next),
    focus: () => {
      if (state.editor !== null) set({ focus: aim(returnTo()) });
    },
  };

  return {
    getState: (): StaffState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    guard,
    /**
     * The model lives as long as the working area (the keyed `div`), not as long as the screen:
     * a command outlives the manager leaving BO-06. Returns the stop, which the area's unmount calls.
     */
    start(): () => void {
      stopped = false;
      return () => {
        stopped = true;
      };
    },
    /**
     * BO-06 is on screen. Every visit reads the list: the first shows "Loading", a later one
     * rereads without hiding the rows already held (the merge keeps any record a command answered
     * after the read began). A read is not interactive, so a development double effect that sends
     * one more is harmless.
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
    setGate(on: boolean): void {
      gate = on;
      if (on) flush();
    },
    /**
     * The session left the frame (M-6 or BO-01): every credential field is emptied, and the form
     * that stays says so. What was typed is gone; the name and the classification are kept.
     */
    credentialsAway(): void {
      const { editor } = state;
      if (editor === null) return;
      set({
        editor: { ...editor, typed: false, credentialsNotice: true },
        credentialEpoch: emptyInputs(),
      });
    },
    /** Try again: the read only. After an unknown or blocked outcome whose reread failed, it is that reread. */
    async retryRead(): Promise<void> {
      const asked = state.editor;
      const askedPage = state.page;
      const fresh = await load(true);
      if (!fresh || stopped) return;
      const present = (): void => {
        const { editor, page } = state;
        const unread: Partial<Record<FormNotice, FormNotice>> = {
          'unknown-unread': 'unknown',
          'user-changed-unread': 'user-changed',
          'not-found-unread': 'not-found',
        };
        if (asked !== null && asked.notice !== null && unread[asked.notice] !== undefined) {
          // Gone, discarded or changed meanwhile: the result is not for what is on screen.
          if (editor === null || editor.key !== asked.key || editor.notice !== asked.notice) return;
          const notice = unread[asked.notice] as FormNotice;
          set({
            editor: { ...editor, notice },
            focus: aim(notice === 'unknown' ? firstField(editor) : 'notice'),
          });
        } else if (askedPage?.kind === 'unknown' && askedPage.unread) {
          if (page === askedPage) set({ page: { ...askedPage, unread: false }, focus: aim('status') });
        } else {
          // A plain retry has no sentence of its own: focus returns to the work.
          set({ focus: aim(editor === null ? 'add-person' : firstField(editor)) });
        }
      };
      // The session or a decision took the screen during the read: hold the finished result and
      // present it once, with its focus, when the same manager is back. Nothing is read again.
      if (!open()) heldRetry = present;
      else present();
    },
    /** After the session's own screen: put focus back in the work. */
    refocus(): void {
      set({ focus: aim(returnTo()) });
    },
    // One command at a time: while one is pending these are inert, whatever pressed them.
    openCreate(): void {
      // A new person needs a list to be drawn beside (DESIGN-023 draws it inert otherwise).
      if (busy() || !usable()) return;
      leave(() => openEditor({ kind: 'create', staffUserId: null, subjectName: '', opener: 'add-person' }));
    },
    /** Deactivate: the confirmation opens first; nothing is sent until its final action. */
    openDeactivate(staffUserId: string): void {
      if (busy() || !usable()) return;
      leave(() => {
        const row = rowOf(staffUserId);
        if (row === undefined || !row.isActive) return;
        set({ confirm: { staffUserId, name: row.name, classification: row.classification }, page: null });
      });
    },
    /** Escape and Keep active: nothing is sent, and focus returns to that row's Deactivate. */
    confirmKeep(): void {
      const { confirm } = state;
      if (confirm === null) return;
      set({ confirm: null, focus: aim({ row: confirm.staffUserId }) });
      flush();
    },
    /** The confirmation's final action: the one press that sends a deactivation. */
    confirmDeactivate(): void {
      const { confirm } = state;
      if (confirm === null || busy()) return;
      const row = rowOf(confirm.staffUserId);
      set({ confirm: null });
      if (row === undefined) return;
      sendState(row, 'deactivate');
    },
    /** Reactivate: sent at once from the row, with no confirmation. */
    reactivate(staffUserId: string): void {
      if (busy() || !usable()) return;
      leave(() => {
        const row = rowOf(staffUserId);
        if (row === undefined || row.isActive) return;
        sendState(row, 'reactivate');
      });
    },
    setName(value: string): void {
      const { editor } = state;
      if (editor === null || busy()) return;
      const { name: _cleared, ...errors } = editor.errors;
      set({ editor: { ...editor, name: value, errors } });
    },
    /** A credential field was typed in: the form is dirty, and that field's own error is obsolete. */
    credentialTyped(field: Exclude<FieldKey, 'name'>): void {
      const { editor } = state;
      if (editor === null || busy()) return;
      const { [field]: _cleared, ...errors } = editor.errors;
      if (editor.typed && !editor.credentialsNotice && editor.errors[field] === undefined) return;
      set({ editor: { ...editor, typed: true, credentialsNotice: false, errors } });
    },
    /**
     * The classification choice: the name stays, every credential field is emptied (even one the
     * new choice also needs), the errors of the credentials go, and focus goes to the first
     * credential the new choice needs, or to the choice itself if it needs none.
     */
    setClassification(classification: Classification): void {
      const { editor } = state;
      if (editor === null || busy() || editor.kind !== 'create' || editor.classification === classification) return;
      const next = { ...editor, classification };
      const first = fieldsOf(next).find((field) => field !== 'name');
      const errors = editor.errors.name === undefined ? {} : { name: editor.errors.name };
      set({
        editor: { ...next, errors, typed: false, credentialsNotice: true, notice: null },
        credentialEpoch: emptyInputs(),
        focus: aim(first ?? 'classification'),
      });
    },
    submit,
    /** Cancel and Escape: leave the form where it stands. */
    cancel(): void {
      leave(() => {});
    },
    /** Return to staff list, from a form a form-level refusal blocked. */
    returnToList(): void {
      leave(() => {});
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

import {
  ChangeRoleRequest,
  CreateCashierUserRequest,
  CreateKitchenUserRequest,
  CreateManagerUserRequest,
  OwnPasswordRequest,
  OwnPinRequest,
  ReactivateUserRequest,
  SetPasswordRequest,
  SetPinRequest,
  type UserView,
} from '@pos/contracts';
import { call, type Answered } from '../forms/answer.js';
import type { ConfigApi } from '../session/api.js';
import type { WorkGuard, WorkStatus } from '../work/guard.js';
import type { Classification } from './copy.js';
import { checkCurrentPassword, checkName, checkPassword, checkPin, checkUsername } from './fields.js';

// BO-06's behaviour, apart from how it is drawn: the staff list, the one form (a new person, the
// new PIN a reactivation asks for, a role change, a reset of another person's PIN or password, or
// the manager's own password or PIN), and the two state commands with the deactivation
// confirmation (consult C3 section 10, DESIGN-023, and `D`'s configuration-form rules, copied from
// BO-07's presets model without its versions). It sends a command once and never again: a resend
// is the manager's own press of Save or a row action. It never infers success from a reread. The
// record a command answers is applied to the list; nothing is reread after a success.
//
// **The cooldown belongs here, keyed to the manager** (PHASE1-S8c2 ruling 8). A fifth wrong
// current password, or a `THROTTLED` answer, starts the account's sign-in cooldown: `cooldown`
// holds whose it is and the whole seconds left, counted down by this model's own timer from the
// server's `retryAfterSeconds`. Every own-change form of that manager reads it, so closing and
// reopening a form, and M-6 or BO-01 recovery, keep the wait; a different manager's sign-in
// builds a new working area and with it a new model.
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

export type FieldKey = 'name' | 'currentPassword' | 'pin' | 'username' | 'password';
export type FieldError =
  | 'empty'
  | 'long'
  | 'control'
  | 'invalid'
  | 'duplicate'
  | 'duplicate-reactivate'
  | 'wrong';
export type FormNotice =
  | 'failure'
  | 'session'
  | 'unknown'
  | 'unknown-unread'
  | 'unknown-changed'
  | 'own-account'
  | 'user-changed'
  | 'user-changed-unread'
  | 'not-found'
  | 'not-found-unread';

/** The buttons of a row, which a focus request names (never "the first button"). */
export type RowAction =
  | 'change-role'
  | 'reset-pin'
  | 'reset-password'
  | 'deactivate'
  | 'reactivate'
  | 'change-my-password'
  | 'change-my-pin';

export type FocusTarget = FieldKey | 'classification' | 'notice' | 'status' | 'add-person' | { row: string; action: RowAction };

/** What the view hands to `submit`: the credential fields as typed, each present only if it is on the form. */
export interface Typed {
  currentPassword?: string;
  pin?: string;
  username?: string;
  password?: string;
}

export type EditorKind = 'create' | 'reactivate' | 'move' | 'reset-pin' | 'reset-password' | 'own-password' | 'own-pin';

/** The person as the list showed them when a form opened: what a move compares a reread with. */
export interface Subject {
  classification: Classification;
  isActive: boolean;
  username: string | null;
}

/** What the list shows of a person after an unknown move, when it differs from the opening. */
export interface Change {
  classification: Classification;
  isActive: boolean;
}

export interface Editor {
  /** Which form this is; a command remembers it, so a late answer knows whether its form is still here. */
  key: number;
  kind: EditorKind;
  /** The person a form other than create is about; null for a new person. */
  staffUserId: string | null;
  /** That person's name, which names the form; empty for a new person. */
  subjectName: string;
  /** The person as the list showed them when the form opened; null for a new person. */
  subject: Subject | null;
  /** A move's chosen destination; null until one is chosen, and always null on other forms. */
  target: Classification | null;
  /** After an unknown move, what the reread shows when it differs from `subject`. */
  changed: Change | null;
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

type CommandKind =
  | 'create'
  | 'deactivate'
  | 'reactivate'
  | 'move'
  | 'reset-pin'
  | 'reset-password'
  | 'own-password'
  | 'own-pin';

const isOwnKind = (kind: EditorKind | CommandKind): boolean => kind === 'own-password' || kind === 'own-pin';

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
  | { kind: 'added' | 'deactivated' | 'reactivated' | 'pin-reset' | 'password-reset' | 'own-password' | 'own-pin'; name: string }
  | { kind: 'moved'; name: string; classification: Classification }
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
  /**
   * The account's sign-in cooldown, started by an own change: whose it is and the whole seconds
   * left. Null when none runs. The wait follows the manager, not a form.
   */
  cooldown: { staffUserId: string; remaining: number } | null;
  focus: { target: FocusTarget; n: number } | null;
}

/** Whether this own-change form is held by its manager's running cooldown. */
export function isCooling(state: Pick<StaffState, 'cooldown'>, editor: Pick<Editor, 'kind' | 'staffUserId'> | null): boolean {
  return (
    editor !== null &&
    isOwnKind(editor.kind) &&
    state.cooldown !== null &&
    state.cooldown.staffUserId === editor.staffUserId
  );
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
  | { kind: 'not-found' }
  | { kind: 'wrong-password' }
  | { kind: 'cooldown'; seconds: number };

/** A reread's outcome, held with a finished result. */
interface Reread {
  fresh: boolean;
}

const READ = '/api/back-office/config/users' as const;
const CREATE = '/api/back-office/config/users/create' as const;
const DEACTIVATE = '/api/back-office/config/users/deactivate' as const;
const REACTIVATE = '/api/back-office/config/users/reactivate' as const;
const CHANGE_ROLE = '/api/back-office/config/users/change-role' as const;
const SET_PIN = '/api/back-office/config/users/set-pin' as const;
const SET_PASSWORD = '/api/back-office/config/users/set-password' as const;
const OWN_PASSWORD = '/api/back-office/config/users/own-password' as const;
const OWN_PIN = '/api/back-office/config/users/own-pin' as const;

/** The row button each form was opened from, to which focus returns on Cancel. */
const OPENER: Record<'move' | 'reset-pin' | 'reset-password' | 'own-password' | 'own-pin', RowAction> = {
  move: 'change-role',
  'reset-pin': 'reset-pin',
  'reset-password': 'reset-password',
  'own-password': 'change-my-password',
  'own-pin': 'change-my-pin',
};

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
        // The current password of an own change. The failure that starts the cooldown carries its
        // duration, and so does every answer while it runs: both are the same state. Without a
        // duration `INVALID_CREDENTIALS` is a plain wrong password, and `THROTTLED` names nothing
        // to count down, so it is the general failure.
        case 'INVALID_CREDENTIALS':
          return error.details === undefined
            ? { kind: 'wrong-password' }
            : { kind: 'cooldown', seconds: error.details.retryAfterSeconds };
        case 'THROTTLED':
          return error.details === undefined
            ? { kind: 'general' }
            : { kind: 'cooldown', seconds: error.details.retryAfterSeconds };
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

/**
 * The fields a move asks for (C3 section 2): a PIN from kitchen, a password for every promotion
 * to manager, and a username only when the person has none. Nothing before a move is chosen.
 */
function moveFields(subject: Subject | null, target: Classification | null): FieldKey[] {
  if (subject === null || target === null) return [];
  const fields: FieldKey[] = [];
  if (subject.classification === 'KITCHEN' && target !== 'KITCHEN') fields.push('pin');
  if (target === 'MANAGER') {
    if (subject.username === null) fields.push('username');
    fields.push('password');
  }
  return fields;
}

/** The fields a form shows, in displayed order. */
export function fieldsOf(editor: Pick<Editor, 'kind' | 'classification' | 'subject' | 'target'>): FieldKey[] {
  switch (editor.kind) {
    case 'reactivate':
    case 'reset-pin':
      return ['pin'];
    case 'reset-password':
      return ['password'];
    case 'own-password':
      return ['currentPassword', 'password'];
    case 'own-pin':
      return ['currentPassword', 'pin'];
    case 'move':
      return moveFields(editor.subject, editor.target);
    case 'create':
      if (editor.classification === 'KITCHEN') return ['name'];
      if (editor.classification === 'CASHIER') return ['name', 'pin'];
      return ['name', 'pin', 'username', 'password'];
  }
}

const hasCredentials = (editor: Pick<Editor, 'kind' | 'classification' | 'subject' | 'target'>): boolean =>
  fieldsOf(editor).some((field) => field !== 'name');

/** The row now, when it differs from the person as a form found them. */
function differs(subject: Subject, row: UserView): Change | null {
  return row.classification !== subject.classification || row.isActive !== subject.isActive || row.username !== subject.username
    ? { classification: row.classification, isActive: row.isActive }
    : null;
}

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
    cooldown: null,
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

  // The cooldown's clock: the end of the wait on the monotonic clock, and the one timer that
  // redraws it at each whole-second change and ends it at zero. Nothing is sent by the timer.
  let cooldownEnd = 0;
  let cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  const secondsLeft = (): number => Math.max(0, Math.ceil((cooldownEnd - performance.now()) / 1000));
  function cancelTimer(): void {
    if (cooldownTimer !== null) clearTimeout(cooldownTimer);
    cooldownTimer = null;
  }
  function scheduleTick(): void {
    cancelTimer();
    if (stopped || state.cooldown === null) return;
    // The next moment this wait's whole-second number changes.
    const toNext = cooldownEnd - performance.now() - (secondsLeft() - 1) * 1000;
    cooldownTimer = setTimeout(tick, Math.max(toNext, 1));
  }
  function tick(): void {
    cooldownTimer = null;
    if (stopped || state.cooldown === null) return;
    const left = secondsLeft();
    set({ cooldown: left === 0 ? null : { ...state.cooldown, remaining: left } });
    scheduleTick();
  }
  /**
   * The deadline is fixed when the answer ARRIVES (`answered`), whatever holds its presentation.
   * Presenting records nothing: it shows what remains to that deadline, and shows none if it passed.
   */
  function recordDeadline(seconds: number): void {
    cooldownEnd = performance.now() + seconds * 1000;
  }
  function showCooldown(staffUserId: string): void {
    const left = secondsLeft();
    set({ cooldown: left === 0 ? null : { staffUserId, remaining: left } });
    scheduleTick();
  }
  const aim = (target: FocusTarget): StaffState['focus'] => ({ target, n: (focusSequence += 1) });
  const emptyInputs = (): number => state.credentialEpoch + 1;

  const busy = (): boolean => state.command !== null;
  const pendingSave = (): boolean => {
    const { editor, command } = state;
    return editor !== null && command !== null && !command.discarded && command.editorKey === editor.key;
  };
  const dirty = (): boolean => {
    const { editor } = state;
    // A form a refusal blocked cannot be saved, so what it keeps (a move's chosen destination)
    // is not unsaved work: Return to staff list leaves it without asking. An unknown outcome is
    // asked about separately (`uncertain`).
    return (
      editor !== null &&
      !editor.blocked &&
      (editor.typed ||
        editor.name !== '' ||
        editor.classification !== editor.openedClassification ||
        editor.target !== null)
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

  /** Where focus goes when a form of this kind opens, or returns to it: its first control. */
  const firstOf = (kind: EditorKind): FocusTarget =>
    kind === 'create'
      ? 'name'
      : kind === 'move'
        ? 'classification'
        : isOwnKind(kind)
          ? 'currentPassword'
          : kind === 'reset-password'
            ? 'password'
            : 'pin';

  function openEditor(init: {
    kind: EditorKind;
    staffUserId: string | null;
    subjectName: string;
    subject: Subject | null;
    opener: FocusTarget;
  }): void {
    editorSequence += 1;
    const classification: Classification = 'KITCHEN';
    // An own-change form opened while its manager's cooldown runs opens held, on the notice.
    const cooling = isCooling(state, init);
    set({
      editor: {
        key: editorSequence,
        kind: init.kind,
        staffUserId: init.staffUserId,
        subjectName: init.subjectName,
        subject: init.subject,
        target: null,
        changed: null,
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
      focus: aim(cooling ? 'notice' : firstOf(init.kind)),
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

  /** A held form's first control is its notice: the field it would focus is off. */
  const firstField = (editor: Editor): FocusTarget => (isCooling(state, editor) ? 'notice' : firstOf(editor.kind));

  function answered(command: Command, answer: Answer): void {
    if (stopped) return;
    // Whatever the answer, and whether or not it can be presented yet, the form that sent it no
    // longer needs what was typed: the inputs are emptied now. Presentation, focus and the
    // announcement stay behind the gate.
    if (editorOf(command) !== null) set({ credentialEpoch: emptyInputs() });
    // The account's wait starts now, not when the answer is presented.
    const arrived = meaningOf(answer);
    if (arrived.kind === 'cooldown' && isOwnKind(command.kind)) recordDeadline(arrived.seconds);
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

    // The current password of an own change was refused. Only an own change can be: the same
    // answers from any other command are the general failure.
    if (meaning.kind === 'wrong-password' || meaning.kind === 'cooldown') {
      if (!isOwnKind(command.kind)) {
        failure(command, done);
        return;
      }
      currentPasswordRefused(command, meaning, done);
      return;
    }

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

  /**
   * `INVALID_CREDENTIALS` or `THROTTLED` on an own change. A wait the server named belongs to the
   * account, so it is kept even when the form that met it was discarded; the form, if it is still
   * here, shows the plain wrong password or the cooldown. Nothing is reread and nothing is resent.
   */
  function currentPasswordRefused(
    command: Command,
    meaning: { kind: 'wrong-password' } | { kind: 'cooldown'; seconds: number },
    done: Command | null
  ): void {
    const clearWaiting = (): PageStatus | null => (state.page?.kind === 'waiting' ? null : state.page);
    if (meaning.kind === 'cooldown' && command.staffUserId !== null) showCooldown(command.staffUserId);
    const editor = editorOf(command);
    if (command.discarded || editor === null) {
      set({ command: done, page: clearWaiting() });
      return;
    }
    set({
      command: done,
      editor: {
        ...editor,
        errors: meaning.kind === 'wrong-password' ? { currentPassword: 'wrong' } : {},
        notice: null,
        uncertain: false,
        typed: false,
        credentialsNotice: hasCredentials(editor),
      },
      credentialEpoch: emptyInputs(),
      // A cooldown whose deadline passed while the answer was held leaves the field live.
      focus: aim(meaning.kind === 'cooldown' && state.cooldown !== null ? 'notice' : 'currentPassword'),
    });
  }

  /** After an unknown move: what the list now shows of the person, when it is not what the form opened on. */
  function changeSince(editor: Editor): Change | null {
    if (editor.kind !== 'move' || editor.subject === null || editor.staffUserId === null) return null;
    const row = rowOf(editor.staffUserId);
    return row === undefined ? null : differs(editor.subject, row);
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
      // A move whose reread shows the person changed since the form opened may be this save's
      // doing or another manager's: it says so and blocks the form, and never claims either.
      const changed = read.fresh ? changeSince(editor) : null;
      set({
        command: done,
        editor: {
          ...editor,
          notice: changed !== null ? 'unknown-changed' : read.fresh ? 'unknown' : 'unknown-unread',
          changed,
          blocked: changed !== null,
          uncertain: true,
          typed: false,
          credentialsNotice: changed === null && hasCredentials(editor),
        },
        credentialEpoch: emptyInputs(),
        focus: aim(changed !== null ? 'notice' : firstField(editor)),
      });
      return;
    }
    if ((meaning.kind === 'user-changed' || meaning.kind === 'not-found') && editor.kind !== 'create') {
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
      // A conflict is placed on a field the form shows, or it is the general failure: a username
      // conflict only from a create or a promotion without one, a PIN conflict only where a PIN
      // is being set.
      if (!fieldsOf(editor).includes(field)) {
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
    openEditor({
      kind: 'reactivate',
      staffUserId: person.staffUserId,
      subjectName: person.name,
      subject: { classification: person.classification, isActive: person.isActive, username: person.username },
      opener: { row: person.staffUserId, action: 'reactivate' },
    });
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
    let page: PageStatus;
    switch (command.kind) {
      case 'create':
        page = { kind: 'added', name };
        break;
      case 'deactivate':
        page = { kind: 'deactivated', name };
        break;
      case 'reactivate':
        page = { kind: 'reactivated', name };
        break;
      case 'move':
        page = { kind: 'moved', name, classification: user.classification };
        break;
      case 'reset-pin':
        page = { kind: 'pin-reset', name };
        break;
      case 'reset-password':
        page = { kind: 'password-reset', name };
        break;
      case 'own-password':
        page = { kind: 'own-password', name };
        break;
      case 'own-pin':
        page = { kind: 'own-pin', name };
        break;
    }
    // Focus goes to the person's first action, named and not "the first button": Change role on an
    // active other person, Reactivate on an inactive one, Change my password on the own row.
    const action: RowAction = isOwnKind(command.kind) ? 'change-my-password' : user.isActive ? 'change-role' : 'reactivate';
    return { page, focus: aim({ row: user.staffUserId, action }) };
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
    // Nothing is sent before a move is chosen, nor while the manager's cooldown holds an own change.
    if (editor.kind === 'move' && editor.target === null) return;
    if (isCooling(state, editor)) return;

    const errors: Partial<Record<FieldKey, FieldError>> = {};
    let name = editor.name;
    let currentPassword = '';
    let pin = '';
    let username = '';
    let password = '';
    for (const field of fieldsOf(editor)) {
      if (field === 'name') {
        const checked = checkName(editor.name);
        name = checked.name;
        if (checked.error !== null) errors.name = checked.error;
      } else if (field === 'currentPassword') {
        currentPassword = typed.currentPassword ?? '';
        const refused = checkCurrentPassword(currentPassword);
        if (refused !== null) errors.currentPassword = refused;
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

    if (editor.kind !== 'create') {
      // A move, a reset or an own change: one request, built here from exactly the fields the form
      // showed and checked against its contract schema first. A disagreement is a defect, shown as
      // the general failure.
      const staffUserId = editor.staffUserId ?? '';
      const sent = (kind: CommandKind): Command => ({
        kind,
        staffUserId: staffUserId === '' ? null : staffUserId,
        name: editor.subjectName,
        editorKey: editor.key,
        discarded: false,
      });
      const patch: Partial<StaffState> = {
        editor: { ...editor, errors: {}, notice: null, uncertain: false, credentialsNotice: false },
        page: null,
        focus: aim('notice'),
      };
      const defect = (): void => set({ editor: { ...editor, notice: 'failure' }, focus: aim(firstOf(editor.kind)) });

      if (editor.kind === 'reset-pin') {
        const parsed = SetPinRequest.safeParse({ staffUserId, pin });
        if (!parsed.success) return defect();
        send(sent('reset-pin'), () => call(config[SET_PIN](parsed.data), (v) => ({ user: v.user })), patch);
      } else if (editor.kind === 'reset-password') {
        const parsed = SetPasswordRequest.safeParse({ staffUserId, password });
        if (!parsed.success) return defect();
        send(sent('reset-password'), () => call(config[SET_PASSWORD](parsed.data), (v) => ({ user: v.user })), patch);
      } else if (editor.kind === 'own-password') {
        const parsed = OwnPasswordRequest.safeParse({ currentPassword, password });
        if (!parsed.success) return defect();
        send(sent('own-password'), () => call(config[OWN_PASSWORD](parsed.data), (v) => ({ user: v.user })), patch);
      } else if (editor.kind === 'own-pin') {
        const parsed = OwnPinRequest.safeParse({ currentPassword, pin });
        if (!parsed.success) return defect();
        send(sent('own-pin'), () => call(config[OWN_PIN](parsed.data), (v) => ({ user: v.user })), patch);
      } else if (editor.kind === 'move') {
        const { subject, target } = editor;
        if (subject === null || target === null) return;
        // `username` is sent exactly when the person has none (a former manager's is retained).
        const login = subject.username === null ? { username } : {};
        const variant =
          subject.classification === 'KITCHEN' && target === 'CASHIER'
            ? { change: 'KITCHEN_TO_CASHIER', staffUserId, pin }
            : subject.classification === 'KITCHEN' && target === 'MANAGER'
              ? { change: 'KITCHEN_TO_MANAGER', staffUserId, pin, password, ...login }
              : subject.classification === 'CASHIER' && target === 'MANAGER'
                ? { change: 'CASHIER_TO_MANAGER', staffUserId, password, ...login }
                : subject.classification === 'MANAGER' && target === 'CASHIER'
                  ? { change: 'MANAGER_TO_CASHIER', staffUserId }
                  : subject.classification === 'CASHIER' && target === 'KITCHEN'
                    ? { change: 'CASHIER_TO_KITCHEN', staffUserId }
                    : subject.classification === 'MANAGER' && target === 'KITCHEN'
                      ? { change: 'MANAGER_TO_KITCHEN', staffUserId }
                      : null;
        // The discriminated union checks the body against the variant its `change` names.
        const parsed = ChangeRoleRequest.safeParse(variant);
        if (!parsed.success) return defect();
        send(sent('move'), () => call(config[CHANGE_ROLE](parsed.data), (v) => ({ user: v.user })), patch);
      }
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
      scheduleTick();
      return () => {
        stopped = true;
        cancelTimer();
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
          // A move whose list now shows the person changed is blocked, as after a first reread.
          const changed = notice === 'unknown' ? changeSince(editor) : null;
          if (changed !== null) {
            set({ editor: { ...editor, notice: 'unknown-changed', changed, blocked: true }, focus: aim('notice') });
            return;
          }
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
      leave(() =>
        openEditor({ kind: 'create', staffUserId: null, subjectName: '', subject: null, opener: 'add-person' })
      );
    },
    /** Change role, Reset PIN and Reset password (another person), Change my password and Change my PIN (the own row). */
    openForm(kind: 'move' | 'reset-pin' | 'reset-password' | 'own-password' | 'own-pin', staffUserId: string): void {
      if (busy() || !usable()) return;
      leave(() => {
        const row = rowOf(staffUserId);
        if (row === undefined || !row.isActive) return;
        // The row offers a PIN reset to a cashier or a manager, and a password reset to a manager.
        if (kind === 'reset-pin' && row.classification === 'KITCHEN') return;
        if (kind === 'reset-password' && row.classification !== 'MANAGER') return;
        openEditor({
          kind,
          staffUserId,
          subjectName: row.name,
          subject: { classification: row.classification, isActive: row.isActive, username: row.username },
          opener: { row: staffUserId, action: OPENER[kind] },
        });
      });
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
      set({ confirm: null, focus: aim({ row: confirm.staffUserId, action: 'deactivate' }) });
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
      if (editor === null || busy() || editor.blocked) return;
      if (editor.kind === 'move') {
        // A move's destination: never the person's current classification, and replacing an earlier
        // choice empties every credential and says so.
        if (editor.subject === null || classification === editor.subject.classification || editor.target === classification) return;
        const next = { ...editor, target: classification };
        set({
          editor: { ...next, errors: {}, typed: false, credentialsNotice: editor.target !== null, notice: null },
          credentialEpoch: emptyInputs(),
          focus: aim(fieldsOf(next).find((field) => field !== 'name') ?? 'classification'),
        });
        return;
      }
      if (editor.kind !== 'create' || editor.classification === classification) return;
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

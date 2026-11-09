import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type FormEvent } from 'react';
import { DEPARTURE_BODY, DEPARTURE_BODY_UNCERTAIN } from '../copy.js';
import { Decision } from '../forms/Decision.js';
import { useSession } from '../session/useSession.js';
import { workGuard } from '../work/guard.js';
import {
  ADD_PERSON,
  CANCEL,
  CHANGE_MY_PASSWORD,
  CHANGE_MY_PIN,
  CHANGE_ROLE,
  CLASSIFICATION_HELP,
  CLASSIFICATION_LABEL,
  COLUMN_ACTIONS,
  COLUMN_CLASSIFICATION,
  COLUMN_PERSON,
  COLUMN_STATUS,
  CREATE_CONTEXT,
  CREATE_HEADING,
  CREDENTIALS_CLEARED,
  CURRENT_EMPTY,
  CURRENT_HELP,
  CURRENT_LABEL,
  CURRENT_LONG,
  CURRENT_WRONG,
  DEACTIVATE,
  FOOT_HINT,
  FOOT_HINT_BLOCKED,
  FOOT_HINT_COOLDOWN,
  FOOT_HINT_PENDING,
  FOOT_HINT_UNCHOSEN,
  FORM_FAILED,
  FORM_SESSION_REFUSED,
  INTRO,
  KEEP_ACTIVE,
  LIST_CAPTION,
  LIST_LABEL,
  LIST_PARTIAL,
  LOADING,
  MOVE_HELP,
  MOVE_PLACEHOLDER,
  NAME_CONTROL,
  NAME_EMPTY,
  NAME_HELP,
  NAME_LABEL,
  NAME_LONG,
  NO_SIGN_IN,
  OWN_ACCOUNT,
  OWN_MARKER,
  OWN_WARNING,
  PASSWORD_HELP,
  PASSWORD_INVALID,
  PASSWORD_LABEL,
  PIN_DUPLICATE,
  PIN_DUPLICATE_REACTIVATE,
  PIN_HELP,
  PIN_INVALID,
  PIN_LABEL,
  READ_FAILED,
  REACTIVATE,
  RESET_PASSWORD,
  RESET_PIN,
  RETURN_TO_LIST,
  SAVE,
  SAVE_REACTIVATE,
  SAVING,
  STAFF,
  STATUS_ACTIVE,
  STATUS_INACTIVE,
  TRY_AGAIN,
  USERNAME_DUPLICATE,
  USERNAME_HELP,
  USERNAME_INVALID,
  USERNAME_LABEL,
  WAITING,
  added,
  changeMyPasswordName,
  changeMyPinName,
  changeRoleName,
  changedContext,
  classificationChoice,
  classificationText,
  confirmDeactivateName,
  cooldownNotice,
  counts,
  currentCooling,
  deactivateName,
  deactivateTitle,
  deactivateWarning,
  deactivated,
  deactivating,
  keepActiveName,
  moveContext,
  moveWarning,
  moved,
  notFound,
  outcomeUnknownFor,
  ownPasswordChanged,
  ownPinChanged,
  passwordReset,
  pinReset,
  reactivateContext,
  reactivateHeading,
  reactivateName,
  reactivated,
  reactivating,
  resetPasswordName,
  resetPinName,
  resetWarning,
  retainedFact,
  retainedUsername,
  statusFailed,
  statusSessionRefused,
  subjectContext,
  unknownBody,
  userChanged,
  username as usernameFact,
  type Classification,
  type NoticeCopy,
  type UnknownEnd,
} from './copy.js';
import { storedUsername } from './fields.js';
import { useFitPanel } from './fit.js';
import {
  fieldsOf,
  isCooling,
  type Editor,
  type FieldError,
  type FieldKey,
  type PageStatus,
  type RowAction,
  type StaffModel,
  type StaffState,
  type Typed,
} from './model.js';
import { countsOf, inOrder, isFormerManager } from './order.js';

// BO-06, as DESIGN-023 draws it (docs/design/visual-directions/frost/back-office/users.html): the
// staff in one table, active first, and beside it a non-modal panel for the one form. The panel is
// a named `role="dialog"` with `aria-modal="false"`, so the rail, Log out and the list stay live
// while it is open. The stay-or-discard decision (`forms/Decision.tsx`) and the deactivation
// confirmation are modal `<dialog>`s that follow the working-area dialog rule (C2 section 7). An
// off action is `aria-disabled`, never `disabled`, as in BO-03, BO-05, BO-07 and BO-08.
//
// **Every credential field is a native, uncontrolled `<input>`** (ADR-011 rule 25): no `value` or
// `defaultValue`, read once from its ref at submit, and emptied whenever the model moves
// `credentialEpoch`. Nothing a person types into one is in React state, an attribute, a text
// node, browser storage or a log line.

const CLOSED_BY_NONE = { closedby: 'none' } as const;
const CLASSIFICATIONS: readonly Classification[] = ['KITCHEN', 'CASHIER', 'MANAGER'];

const fieldText: Record<FieldError, Partial<Record<FieldKey, string>>> = {
  empty: { name: NAME_EMPTY, currentPassword: CURRENT_EMPTY },
  long: { name: NAME_LONG, currentPassword: CURRENT_LONG },
  control: { name: NAME_CONTROL },
  invalid: { pin: PIN_INVALID, username: USERNAME_INVALID, password: PASSWORD_INVALID },
  duplicate: { pin: PIN_DUPLICATE, username: USERNAME_DUPLICATE },
  'duplicate-reactivate': { pin: PIN_DUPLICATE_REACTIVATE },
  wrong: { currentPassword: CURRENT_WRONG },
};

/** The id of each field's error line: what its `aria-describedby` names. */
const errorId: Record<FieldKey, string> = {
  name: 'staff-name-error',
  currentPassword: 'staff-current-password-error',
  pin: 'staff-pin-error',
  username: 'staff-username-error',
  password: 'staff-password-error',
};

function pageText(page: PageStatus): string {
  switch (page.kind) {
    case 'moved':
      return moved(page.name, page.classification);
    case 'pin-reset':
      return pinReset(page.name);
    case 'password-reset':
      return passwordReset(page.name);
    case 'own-password':
      return ownPasswordChanged(page.name);
    case 'own-pin':
      return ownPinChanged(page.name);
    case 'added':
      return added(page.name);
    case 'pending':
      return page.action === 'deactivate' ? deactivating(page.name) : reactivating(page.name);
    case 'deactivated':
      return deactivated(page.name);
    case 'reactivated':
      return reactivated(page.name);
    case 'failed':
      return statusFailed(page.name);
    case 'session':
      return statusSessionRefused(page.name);
    case 'unknown':
      return unknownBody(page.name, !page.unread);
    case 'waiting':
      return WAITING;
  }
}

const inertProps = (inert: boolean) => ({
  'aria-disabled': inert ? ('true' as const) : undefined,
  tabIndex: inert ? -1 : undefined,
});

/** The view of the working area's BO-06 model (made in `Screens`); it draws what the model holds. */
export function Staff({ model }: { model: StaffModel }) {
  const session = useSession();
  const state = useSyncExternalStore(model.subscribe, model.getState);
  const phase = session.phase;
  const signedIn = phase === 'signed-in';
  const ownId = phase === 'signed-in' || phase === 'idle' ? session.person.staffUserId : null;
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    model.shown();
  }, [model]);
  useEffect(() => workGuard.register(model.guard), [model]);
  useEffect(() => model.subscribe(workGuard.changed), [model]);

  // Entering M-6 or BO-01, and each M-6 mode change, empties every credential field (the form
  // that stays says so). The model asks the inputs to empty; nothing is read from them here.
  const away = phase === 'idle' ? `idle-${session.mode}` : phase === 'signed-out' ? 'signed-out' : null;
  useLayoutEffect(() => {
    if (away !== null) model.credentialsAway();
  }, [away, model]);

  // Coming back from BO-01 as the same manager: the panel is shown again with the first control
  // focused, unless a decision or the confirmation was restored, which takes focus first. Coming
  // back from M-6: the frame has put focus back where it was; if that element is gone, the work
  // takes it.
  const before = useRef(phase);
  useEffect(() => {
    const was = before.current;
    before.current = phase;
    if (phase !== 'signed-in') return;
    if (was === 'signed-out') {
      const now = model.getState();
      if (!now.decision && now.confirm === null) model.refocus();
    } else if (was === 'idle') {
      // The frame gives back the element that had focus. An open ordinary form takes focus at its
      // first field whatever was restored (no secret and no selection comes back); a reopened
      // confirmation or a held decision keeps its own focus; a pending command is answered by
      // `refocus` on its status. With no form open, only a lost focus is found again.
      const now = model.getState();
      if (now.decision || now.confirm !== null) return;
      const active = document.activeElement;
      if (now.editor !== null || active === null || active === document.body) model.refocus();
    }
  }, [phase, model]);

  // Where the model asked focus to go. A request made while the session is away waits for the
  // same manager's return.
  const focus = state.focus;
  const handled = useRef(focus?.n ?? 0);
  useEffect(() => {
    if (focus === null || focus.n <= handled.current) return;
    if (!signedIn || root.current === null) return;
    handled.current = focus.n;
    const area = root.current;
    const pick = (selector: string) => area.querySelector<HTMLElement>(selector);
    const target = focus.target;
    let found: HTMLElement | null;
    if (target === 'name') found = pick('#staff-name');
    else if (target === 'pin') found = pick('#staff-pin');
    else if (target === 'username') found = pick('#staff-username');
    else if (target === 'password') found = pick('#staff-password');
    else if (target === 'currentPassword') found = pick('#staff-current-password');
    else if (target === 'classification') found = pick('#staff-classification');
    else if (target === 'notice') found = pick('#form-notice');
    else if (target === 'status') found = pick('#page-status');
    else if (target === 'add-person') found = pick('#staff-add');
    else found = pick(`tr[data-user="${target.row}"] [data-action="${target.action}"]`) ?? pick('#staff-add');
    found?.focus();
  }, [focus, signedIn]);

  // Escape leaves the form as Cancel does, unless a modal (M-6, the decision, the confirmation) is open.
  const live = useRef(signedIn);
  live.current = signedIn;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !live.current) return;
      const now = model.getState();
      if (now.editor === null || now.decision || now.confirm !== null || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      model.cancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [model]);

  const { editor, command, page, read, users } = state;
  const busy = command !== null;
  // The rows can be drawn when a read succeeded, or when an answer was applied to the rows the
  // client knew while a read stands failed (the alert stays, the counts are withheld).
  const usable = read === 'ready' || state.partial;
  const uncertain = model.guard.status() === 'uncertain';
  const rows = inOrder(users);
  const { active, inactive } = countsOf(users);

  /** A row's action: named by what it does to whom, and found again by `data-action` when focus returns. */
  const action = (which: RowAction, label: string, name: string, onClick: () => void, danger = false) => (
    <button
      type="button"
      data-action={which}
      className={danger ? 'office-button small danger' : 'office-button small'}
      aria-label={name}
      {...inertProps(busy)}
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <div ref={root}>
      <div className="office-heading">
        <h1>{STAFF}</h1>
        <button
          type="button"
          id="staff-add"
          className="office-button primary office-push"
          {...inertProps(busy || !usable)}
          onClick={() => model.openCreate()}
        >
          {ADD_PERSON}
        </button>
      </div>
      <p className="office-muted">{INTRO}</p>
      {read === 'ready' && (
        <p id="list-facts" className="settings-help">
          {counts(active, inactive)}
        </p>
      )}

      {page !== null && (
        <div
          id="page-status"
          tabIndex={-1}
          className="office-notice office-space-top"
          data-kind={page.kind === 'failed' ? 'failure' : 'status'}
          role={page.kind === 'failed' ? 'alert' : 'status'}
        >
          {pageText(page)}
        </div>
      )}

      <div className={editor === null ? 'tables-workspace office-space-top' : 'tables-workspace editing office-space-top'}>
        <section aria-label={LIST_LABEL} id="staff-collection">
          {read === 'loading' && (
            <div id="read-state">
              <div className="office-notice" role="status">
                {LOADING}
              </div>
            </div>
          )}
          {read === 'failed' && (
            <div id="read-state">
              <div className="office-notice" role="alert">
                <strong>{(state.partial ? LIST_PARTIAL : READ_FAILED).title}</strong>
                <p>{(state.partial ? LIST_PARTIAL : READ_FAILED).body}</p>
                <button type="button" className="office-button" onClick={() => void model.retryRead()}>
                  {TRY_AGAIN}
                </button>
              </div>
            </div>
          )}
          {usable && users.length > 0 && (
            <table className="office-table" id="staff-list">
              {read === 'ready' && <caption>{LIST_CAPTION}</caption>}
              <thead>
                <tr>
                  <th scope="col">{COLUMN_PERSON}</th>
                  <th scope="col">{COLUMN_CLASSIFICATION}</th>
                  <th scope="col">{COLUMN_STATUS}</th>
                  <th scope="col">{COLUMN_ACTIONS}</th>
                </tr>
              </thead>
              <tbody id="staff-rows">
                {rows.map((person) => {
                  const own = person.staffUserId === ownId;
                  return (
                    <tr
                      key={person.staffUserId}
                      data-user={person.staffUserId}
                      data-active={person.isActive}
                      data-selected={editor?.staffUserId === person.staffUserId}
                    >
                      <td>
                        {person.name}
                        {own && <span className="staff-detail">{OWN_MARKER}</span>}
                        {person.username !== null && (
                          <span className="staff-detail">
                            {isFormerManager(person) ? retainedUsername(person.username) : usernameFact(person.username)}
                          </span>
                        )}
                      </td>
                      <td>
                        {classificationText(person.classification)}
                        {person.classification === 'KITCHEN' && <span className="staff-detail">{NO_SIGN_IN}</span>}
                      </td>
                      <td>{person.isActive ? STATUS_ACTIVE : STATUS_INACTIVE}</td>
                      <td>
                        <div className="office-actions">
                          {own ? (
                            <>
                              {action('change-my-password', CHANGE_MY_PASSWORD, changeMyPasswordName(person.name), () =>
                                model.openForm('own-password', person.staffUserId)
                              )}
                              {action('change-my-pin', CHANGE_MY_PIN, changeMyPinName(person.name), () =>
                                model.openForm('own-pin', person.staffUserId)
                              )}
                            </>
                          ) : person.isActive ? (
                            <>
                              {action('change-role', CHANGE_ROLE, changeRoleName(person.name), () =>
                                model.openForm('move', person.staffUserId)
                              )}
                              {person.classification !== 'KITCHEN' &&
                                action('reset-pin', RESET_PIN, resetPinName(person.name), () =>
                                  model.openForm('reset-pin', person.staffUserId)
                                )}
                              {person.classification === 'MANAGER' &&
                                action('reset-password', RESET_PASSWORD, resetPasswordName(person.name), () =>
                                  model.openForm('reset-password', person.staffUserId)
                                )}
                              {action(
                                'deactivate',
                                DEACTIVATE,
                                deactivateName(person.name),
                                () => model.openDeactivate(person.staffUserId),
                                true
                              )}
                            </>
                          ) : (
                            action('reactivate', REACTIVATE, reactivateName(person.name), () =>
                              model.reactivate(person.staffUserId)
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
        {editor !== null && <EditorPanel key={editor.key} editor={editor} state={state} model={model} />}
      </div>

      <Decision
        open={state.decision}
        body={uncertain ? DEPARTURE_BODY_UNCERTAIN : DEPARTURE_BODY}
        onStay={() => model.stay()}
        onDiscard={() => model.discard()}
      />
      <DeactivateConfirm model={model} state={state} phase={phase} />
    </div>
  );
}

/**
 * What the notice of an open form says, and how it is announced. The cooldown's notice is a
 * status that is not a live region: it is drawn again every second, and focus announces it once.
 */
function noticeOf(
  editor: Editor,
  pendingSave: boolean,
  cooling: number | null
): { kind: string; role: 'status' | 'alert'; live?: 'off'; copy: NoticeCopy } | null {
  if (pendingSave) return { kind: 'pending', role: 'status', copy: SAVING };
  if (cooling !== null) return { kind: 'failure', role: 'status', live: 'off', copy: cooldownNotice(cooling) };
  const subject = editor.kind === 'create' ? editor.sentName : editor.subjectName;
  const end: UnknownEnd =
    editor.kind === 'reset-pin' || editor.kind === 'reset-password'
      ? 'reset'
      : editor.kind === 'own-password'
        ? 'own-password'
        : 'plain';
  switch (editor.notice) {
    case null:
      return null;
    case 'failure':
      return { kind: 'failure', role: 'alert', copy: FORM_FAILED };
    case 'session':
      return { kind: 'session', role: 'status', copy: FORM_SESSION_REFUSED };
    case 'unknown':
      return { kind: 'unknown', role: 'status', copy: outcomeUnknownFor(subject, true, end, false) };
    case 'unknown-unread':
      return { kind: 'unknown', role: 'status', copy: outcomeUnknownFor(subject, false, end, false) };
    case 'unknown-changed':
      return { kind: 'unknown', role: 'status', copy: outcomeUnknownFor(subject, true, 'plain', true) };
    case 'own-account':
      return { kind: 'failure', role: 'alert', copy: OWN_ACCOUNT };
    case 'user-changed':
      return { kind: 'failure', role: 'alert', copy: userChanged(subject, true) };
    case 'user-changed-unread':
      return { kind: 'failure', role: 'alert', copy: userChanged(subject, false) };
    case 'not-found':
      return { kind: 'failure', role: 'alert', copy: notFound(subject, true) };
    case 'not-found-unread':
      return { kind: 'failure', role: 'alert', copy: notFound(subject, false) };
  }
}

/** The form's heading: it names the command and the person. */
function headingOf(editor: Editor): string {
  switch (editor.kind) {
    case 'create':
      return CREATE_HEADING;
    case 'reactivate':
      return reactivateHeading(editor.subjectName);
    case 'move':
      return changeRoleName(editor.subjectName);
    case 'reset-pin':
      return resetPinName(editor.subjectName);
    case 'reset-password':
      return resetPasswordName(editor.subjectName);
    case 'own-password':
      return changeMyPasswordName(editor.subjectName);
    case 'own-pin':
      return changeMyPinName(editor.subjectName);
  }
}

/**
 * The form's context line. After an unknown move whose reread shows the person changed it never
 * claims the opening classification as current, and never says the change is this save's.
 */
function contextOf(editor: Editor): string {
  const { subject, subjectName } = editor;
  if (editor.changed !== null && subject !== null) {
    return changedContext(subjectName, subject.classification, editor.changed.classification, !editor.changed.isActive);
  }
  switch (editor.kind) {
    case 'create':
      return CREATE_CONTEXT;
    case 'reactivate':
      return reactivateContext(subjectName);
    case 'move':
      return subject === null ? '' : moveContext(subject.classification, editor.target);
    default:
      return subject === null ? '' : subjectContext(subjectName, subject.classification);
  }
}

/**
 * The warning beside Save, in the subject's terms: the surfaces named follow the person's current
 * classification. None before a move is chosen, and none on a form blocked from saving.
 */
function warningOf(editor: Editor): string | null {
  const { subject, subjectName } = editor;
  if (subject === null || editor.blocked) return null;
  switch (editor.kind) {
    case 'move':
      return editor.target === null ? null : moveWarning(subjectName, subject.classification, editor.target);
    case 'reset-pin':
    case 'reset-password':
      return resetWarning(subjectName, subject.classification);
    case 'own-password':
    case 'own-pin':
      return OWN_WARNING;
    default:
      return null;
  }
}

function EditorPanel({ editor, state, model }: { editor: Editor; state: StaffState; model: StaffModel }) {
  const { command } = state;
  const pendingSave = command !== null && !command.discarded && command.editorKey === editor.key;
  // The screen has one command slot: any command in flight holds the draft's controls, not only
  // this form's own save. `pendingSave` stays for the Saving notice.
  const held = command !== null;
  // An own change is held while its manager's cooldown runs: its field and Save are off, and the
  // notice and the field's error speak of the wait that is left.
  const cooling = isCooling(state, editor);
  const remaining = cooling && state.cooldown !== null ? state.cooldown.remaining : null;
  const create = editor.kind === 'create';
  const move = editor.kind === 'move';
  const unchosen = move && editor.target === null;
  const saveOff = held || editor.blocked || unchosen || cooling;
  const notice = noticeOf(editor, pendingSave, remaining);
  const fields = fieldsOf(editor);
  const hint = pendingSave
    ? FOOT_HINT_PENDING
    : editor.blocked
      ? FOOT_HINT_BLOCKED
      : unchosen
        ? FOOT_HINT_UNCHOSEN
        : cooling
          ? FOOT_HINT_COOLDOWN
          : FOOT_HINT;
  const warning = warningOf(editor);

  const panel = useRef<HTMLElement>(null);
  useFitPanel(panel, true);

  // The credential inputs: native and uncontrolled. Their values are read here, once, at submit.
  const current = useRef<HTMLInputElement>(null);
  const pin = useRef<HTMLInputElement>(null);
  const username = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    for (const input of [current.current, pin.current, username.current, password.current]) {
      if (input !== null) input.value = '';
    }
  }, [state.credentialEpoch]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const typed: Typed = {};
    if (current.current !== null) typed.currentPassword = current.current.value;
    if (pin.current !== null) typed.pin = pin.current.value;
    if (username.current !== null) {
      // The field shows the stored form on submit; the request carries the same.
      username.current.value = storedUsername(username.current.value);
      typed.username = username.current.value;
    }
    if (password.current !== null) typed.password = password.current.value;
    model.submit(typed);
  };

  // The cooldown is the current password's error while it runs (the same state as THROTTLED).
  const errorOf = (field: FieldKey): string | null => {
    if (field === 'currentPassword' && remaining !== null) return currentCooling(remaining);
    const error = editor.errors[field];
    return error === undefined ? null : (fieldText[error][field] ?? null);
  };
  const describe = (field: FieldKey, base: string) => (errorOf(field) === null ? base : `${base} ${errorId[field]}`);

  return (
    <section
      ref={panel}
      className="table-editor"
      id="staff-editor"
      role="dialog"
      aria-modal="false"
      aria-labelledby="editor-title"
    >
      <header className="office-dialog__head">
        <h2 id="editor-title">{headingOf(editor)}</h2>
      </header>
      <form id="staff-form" method="post" noValidate onSubmit={submit}>
        <div className="office-dialog__body">
          <p id="form-context">{contextOf(editor)}</p>
          {notice !== null && (
            <div
              id="form-notice"
              tabIndex={-1}
              className="office-notice"
              data-kind={notice.kind}
              role={notice.role}
              aria-live={notice.live}
            >
              <strong>{notice.copy.title}</strong>
              <p>{notice.copy.body}</p>
            </div>
          )}
          {editor.credentialsNotice && (
            <p id="credentials-cleared" className="settings-help">
              {CREDENTIALS_CLEARED}
            </p>
          )}

          {fields.includes('name') && (
            <div className="settings-field office-space-top">
              <label htmlFor="staff-name">{NAME_LABEL}</label>
              <input
                id="staff-name"
                name="name"
                type="text"
                className="office-field"
                autoComplete="off"
                value={editor.name}
                disabled={held}
                aria-invalid={editor.errors.name === undefined ? undefined : true}
                aria-describedby={describe('name', 'staff-name-help')}
                onChange={(event) => model.setName(event.currentTarget.value)}
              />
              {errorOf('name') !== null && (
                <span id="staff-name-error" className="office-error">
                  {errorOf('name')}
                </span>
              )}
              <p className="settings-help" id="staff-name-help">
                {NAME_HELP}
              </p>
            </div>
          )}

          {(create || move) && (
            <div className="settings-field office-space-top">
              <label htmlFor="staff-classification">{CLASSIFICATION_LABEL}</label>
              <select
                id="staff-classification"
                name="classification"
                className="office-field"
                autoComplete="off"
                value={create ? editor.classification : (editor.target ?? '')}
                disabled={held || editor.blocked}
                aria-describedby="staff-classification-help"
                onChange={(event) => model.setClassification(event.currentTarget.value as Classification)}
              >
                {/* A move opens on a disabled placeholder, and never offers the person's own classification. */}
                {move && (
                  <option value="" disabled>
                    {MOVE_PLACEHOLDER}
                  </option>
                )}
                {CLASSIFICATIONS.filter((choice) => !move || choice !== editor.subject?.classification).map((choice) => (
                  <option key={choice} value={choice}>
                    {classificationChoice(choice)}
                  </option>
                ))}
              </select>
              <p className="settings-help" id="staff-classification-help">
                {create ? CLASSIFICATION_HELP : MOVE_HELP}
              </p>
            </div>
          )}

          {move && editor.target === 'MANAGER' && editor.subject?.username != null && (
            <p id="stored-username" className="settings-help">
              {retainedFact(editor.subject.username)}
            </p>
          )}

          {fields.includes('currentPassword') && (
            <div className="settings-field office-space-top">
              <label htmlFor="staff-current-password">{CURRENT_LABEL}</label>
              <input
                ref={current}
                id="staff-current-password"
                name="currentPassword"
                type="password"
                className="office-field"
                autoComplete="current-password"
                disabled={held || cooling}
                aria-invalid={errorOf('currentPassword') === null ? undefined : true}
                aria-describedby={describe('currentPassword', 'staff-current-password-help')}
                onInput={() => model.credentialTyped('currentPassword')}
              />
              {errorOf('currentPassword') !== null && (
                <span id="staff-current-password-error" className="office-error">
                  {errorOf('currentPassword')}
                </span>
              )}
              <p className="settings-help" id="staff-current-password-help">
                {CURRENT_HELP}
              </p>
            </div>
          )}

          {fields.includes('pin') && (
            <div className="settings-field office-space-top">
              <label htmlFor="staff-pin">{PIN_LABEL}</label>
              <input
                ref={pin}
                id="staff-pin"
                name="pin"
                type="password"
                inputMode="numeric"
                className="office-field"
                autoComplete="new-password"
                disabled={held}
                aria-invalid={editor.errors.pin === undefined ? undefined : true}
                aria-describedby={describe('pin', 'staff-pin-help')}
                onInput={() => model.credentialTyped('pin')}
              />
              {errorOf('pin') !== null && (
                <span id="staff-pin-error" className="office-error">
                  {errorOf('pin')}
                </span>
              )}
              <p className="settings-help" id="staff-pin-help">
                {PIN_HELP}
              </p>
            </div>
          )}

          {fields.includes('username') && (
            <div className="settings-field office-space-top">
              <label htmlFor="staff-username">{USERNAME_LABEL}</label>
              <input
                ref={username}
                id="staff-username"
                name="username"
                type="text"
                className="office-field"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                disabled={held}
                aria-invalid={editor.errors.username === undefined ? undefined : true}
                aria-describedby={describe('username', 'staff-username-help')}
                onInput={() => model.credentialTyped('username')}
                onBlur={(event) => {
                  // The stored form, set through the property and never an attribute.
                  event.currentTarget.value = storedUsername(event.currentTarget.value);
                }}
              />
              {errorOf('username') !== null && (
                <span id="staff-username-error" className="office-error">
                  {errorOf('username')}
                </span>
              )}
              <p className="settings-help" id="staff-username-help">
                {USERNAME_HELP}
              </p>
            </div>
          )}

          {fields.includes('password') && (
            <div className="settings-field office-space-top">
              <label htmlFor="staff-password">{PASSWORD_LABEL}</label>
              <input
                ref={password}
                id="staff-password"
                name="password"
                type="password"
                className="office-field"
                autoComplete="new-password"
                disabled={held}
                aria-invalid={editor.errors.password === undefined ? undefined : true}
                aria-describedby={describe('password', 'staff-password-help')}
                onInput={() => model.credentialTyped('password')}
              />
              {errorOf('password') !== null && (
                <span id="staff-password-error" className="office-error">
                  {errorOf('password')}
                </span>
              )}
              <p className="settings-help" id="staff-password-help">
                {PASSWORD_HELP}
              </p>
            </div>
          )}

          {editor.blocked && (
            <div className="office-actions office-space-top">
              <button type="button" id="return-list" className="office-button" onClick={() => model.returnToList()}>
                {RETURN_TO_LIST}
              </button>
            </div>
          )}
        </div>
        <footer className="office-dialog__foot staff-footer">
          {warning !== null && (
            <p className="office-notice" id="session-warning">
              {warning}
            </p>
          )}
          <p className="settings-foot-hint" id="save-hint">
            {hint}
          </p>
          <button type="button" id="cancel-staff" className="office-button" onClick={() => model.cancel()}>
            {CANCEL}
          </button>
          <button
            type="submit"
            id="save-staff"
            className="office-button primary"
            {...inertProps(saveOff)}
            aria-describedby={warning === null ? 'save-hint' : 'save-hint session-warning'}
          >
            {editor.kind === 'reactivate' ? SAVE_REACTIVATE : SAVE}
          </button>
        </footer>
      </form>
    </section>
  );
}

/** The deactivation confirmation: a modal in the working area, held and reopened like the decision. */
function DeactivateConfirm({
  model,
  state,
  phase,
}: {
  model: StaffModel;
  state: StaffState;
  phase: ReturnType<typeof useSession>['phase'];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const { confirm } = state;
  // Wanted open only while the frame is shown. At BO-01 it is closed, and its state kept.
  const wanted = confirm !== null && (phase === 'signed-in' || phase === 'idle');
  const meant = useRef(wanted);
  meant.current = wanted;

  useLayoutEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (wanted && !element.open) {
      element.showModal();
      keep.current?.focus();
    } else if (!wanted && element.open) {
      element.close();
    }
  }, [wanted]);

  return (
    <dialog
      ref={dialog}
      className="office-dialog"
      id="deactivate-confirm"
      aria-labelledby="deactivate-title"
      aria-describedby="deactivate-copy"
      {...CLOSED_BY_NONE}
      onCancel={(event) => {
        // Escape means Keep active.
        event.preventDefault();
        if (meant.current) model.confirmKeep();
      }}
      onClose={() => {
        // Closed by anything but this component (a second Escape in some engines): reopen it.
        const element = dialog.current;
        if (meant.current && element !== null && !element.open) {
          element.showModal();
          keep.current?.focus();
        }
      }}
    >
      {confirm !== null && (
        <>
          <header className="office-dialog__head">
            <h2 id="deactivate-title">{deactivateTitle(confirm.name)}</h2>
          </header>
          <div className="office-dialog__body">
            <p id="deactivate-copy">{deactivateWarning(confirm.name, confirm.classification)}</p>
          </div>
          <footer className="office-dialog__foot">
            <button
              ref={keep}
              type="button"
              id="keep-active"
              className="office-button"
              aria-label={keepActiveName(confirm.name)}
              onClick={() => model.confirmKeep()}
            >
              {KEEP_ACTIVE}
            </button>
            <button
              type="button"
              id="confirm-deactivate"
              className="office-button danger final"
              aria-label={confirmDeactivateName(confirm.name)}
              onClick={() => model.confirmDeactivate()}
            >
              {DEACTIVATE}
            </button>
          </footer>
        </>
      )}
    </dialog>
  );
}

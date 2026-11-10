import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ACCESS_REFUSED,
  DRAFT_ISOLATED,
  MISSING_PASSWORD,
  MISSING_USERNAME,
  SESSION_ENDED,
  SIGN_IN_FAILED,
  UNAVAILABLE,
  WENT_WRONG,
  lockedFor,
  type NoticeCopy,
} from './copy.js';
import { accountKey } from './session/account.js';
import type { SessionSnapshot, SessionStore } from './session/types.js';

// BO-01 as DESIGN-016 draws it (PHASE1-S10): a 420px panel centred in the window, the
// heading and helper, the amber notice, a hidden status element that announces a lock
// once, and the form of two persistent-label 40px fields and a full-width Sign in. This
// is the one `<main>` at BO-01. The sentences are DESIGN-015's.
//
// The password field is an uncontrolled native input: read once on submit, emptied
// at once, never React state and never an attribute (B-12). The username is read
// the same way, and mirrored into state only because the cooldown follows it. Neither
// input is given a `value` prop, which would also write a `value` attribute.

type SignedOut = Extract<SessionSnapshot, { phase: 'signed-out' }>;

// UTF-16 units, as the contracts count them (BackOfficeLoginRequest).
export const USERNAME_LIMIT = 256;
export const PASSWORD_LIMIT = 1024;

type Local = { username: 'missing' | 'oversize' | null; password: 'missing' | 'oversize' | null };
const CLEAN: Local = { username: null, password: null };

/**
 * `locked`: a cooldown, announced once and not a live region. `oversize`: the notice a field
 * that is too long is described by. `draft`: Session ended with the previous session's unsaved
 * work still held in this tab.
 */
type Notice = { copy: NoticeCopy; action?: boolean; locked?: boolean; oversize?: boolean; draft?: boolean };

const NOTICE_BODY_ID = 'bo-notice-body';
const DRAFT_NOTE_ID = 'bo-draft-note';

/** A missing field is described by its own inline message; an oversize one by the notice, with no inline text. */
function describedBy(field: keyof Local, mark: Local[keyof Local]): string | undefined {
  if (mark === 'missing') return field === 'username' ? 'bo-username-error' : 'bo-password-error';
  return mark === 'oversize' ? NOTICE_BODY_ID : undefined;
}

function noticeFor(snapshot: SignedOut, local: Local, waitSeconds: number | null, unsavedWork: boolean): Notice | null {
  const { attempt } = snapshot;
  switch (attempt.kind) {
    case 'lookup-unavailable':
      return { copy: UNAVAILABLE, action: true };
    case 'lookup-failed':
      return { copy: WENT_WRONG, action: true };
    default:
  }
  if (waitSeconds !== null) return { copy: lockedFor(waitSeconds), locked: true };
  if (local.username === 'oversize' || local.password === 'oversize') return { copy: SIGN_IN_FAILED, oversize: true };
  switch (attempt.kind) {
    case 'error':
      return { copy: SIGN_IN_FAILED };
    case 'failed':
      return { copy: WENT_WRONG, action: true };
    case 'unavailable':
      return { copy: UNAVAILABLE, action: true };
    default:
  }
  if (snapshot.why === 'ended') return { copy: SESSION_ENDED, draft: snapshot.held !== null && unsavedWork };
  if (snapshot.why === 'refused') return { copy: ACCESS_REFUSED };
  return null;
}

export function SignIn({
  snapshot,
  store,
  unsavedWork,
}: {
  snapshot: SignedOut;
  store: SessionStore;
  /** The work guard reports unsaved work in the held working area (the frame reads it, not this screen). */
  unsavedWork: boolean;
}) {
  const [username, setUsername] = useState('');
  const [local, setLocal] = useState<Local>(CLEAN);
  const [announcement, setAnnouncement] = useState('');
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);

  const { attempt } = snapshot;
  const lookup = attempt.kind === 'lookup-failed' || attempt.kind === 'lookup-unavailable';
  const verifying = attempt.kind === 'verifying' || snapshot.busy;
  const account = accountKey(username);
  const waitSeconds = snapshot.waits.find((w) => w.username === account)?.remainingSeconds ?? null;
  const fieldsOff = lookup || verifying;
  const passwordOff = fieldsOff || waitSeconds !== null;
  const submitOff = passwordOff;
  const notice = noticeFor(snapshot, local, waitSeconds, unsavedWork);
  // A field is marked by what the local check found, and an oversize mark needs the notice that describes it.
  const marked = (field: keyof Local): Local[keyof Local] =>
    local[field] === 'oversize' && notice?.oversize !== true ? null : local[field];

  // Focus on arrival (DESIGN-016): Username, or Try again when the first lookup failed; and
  // Username when a lookup that failed then succeeds.
  const wasLookup = useRef<boolean | null>(null);
  useEffect(() => {
    if (lookup) retryRef.current?.focus();
    else if (wasLookup.current !== false) usernameRef.current?.focus();
    wasLookup.current = lookup;
  }, [lookup]);

  // After a response that was not a sign-in, the manager enters the password afresh. When the
  // account is cooling down the password is off, so Username is the field to edit.
  const wasVerifying = useRef(false);
  useEffect(() => {
    if (wasVerifying.current && !verifying) (passwordOff ? usernameRef : passwordRef).current?.focus();
    wasVerifying.current = verifying;
  }, [verifying]);

  // A wait reaching zero brings entry back without a submission: focus stays in Username if it
  // is there, and otherwise goes to Password.
  const wasLocked = useRef(false);
  useEffect(() => {
    const locked = waitSeconds !== null;
    if (wasLocked.current && !locked && document.activeElement !== usernameRef.current) passwordRef.current?.focus();
    wasLocked.current = locked;
  }, [waitSeconds !== null]);

  // The cooldown is announced once: when a lock newly appears for the account shown, or the
  // locked account changes. Ticking, a trailing space or a change of case writes nothing.
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (notice?.locked !== true) {
      announced.current = null;
      setAnnouncement('');
      return;
    }
    if (announced.current !== account) {
      announced.current = account;
      setAnnouncement(`${notice.copy.title}. ${notice.copy.body}`);
    }
  }, [notice?.locked === true, account]);

  const onEdit = (field: keyof Local) => {
    setLocal((l) => (l[field] === null ? l : { ...l, [field]: null }));
    store.dismiss();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    // `method="post"` with the submission prevented: no failure of scripting can make
    // this a GET with the password in the address bar (and `form-action 'none'`).
    event.preventDefault();
    if (submitOff) return;
    const user = usernameRef.current?.value ?? '';
    const passwordField = passwordRef.current;
    if (passwordField === null) return;
    // Read once, and emptied at once: the value is never kept by this component.
    const password = passwordField.value;
    passwordField.value = '';
    // Every invalid field is marked; focus goes to the first one in document order. Nothing is
    // truncated and nothing is sent.
    const found: Local = {
      username: user === '' ? 'missing' : user.length > USERNAME_LIMIT ? 'oversize' : null,
      password: password === '' ? 'missing' : password.length > PASSWORD_LIMIT ? 'oversize' : null,
    };
    if (found.username !== null || found.password !== null) {
      setLocal(found);
      (found.username !== null ? usernameRef : passwordRef).current?.focus();
      return;
    }
    setLocal(CLEAN);
    store.signIn(user, password);
  };

  return (
    <main className="login-page">
      <div className="login-panel">
        <h1>Back office</h1>
        <p className="login-intro">Sign in with your manager username and password.</p>
        {notice && (
          // A lock is announced once through the status element below; its ticking title is not live.
          <section
            className="office-notice office-notice--amber"
            role={notice.locked ? undefined : 'alert'}
            aria-live={notice.locked ? 'off' : undefined}
          >
            <strong>{notice.copy.title}</strong>
            <p id={NOTICE_BODY_ID}>{notice.copy.body}</p>
            {notice.draft && <p id={DRAFT_NOTE_ID}>{DRAFT_ISOLATED}</p>}
            {notice.action && (
              <button
                ref={retryRef}
                type="button"
                className="office-button small"
                onClick={() => {
                  store.retry();
                  // A general failure asks for fresh entry here, at once; a failed first read
                  // redraws the form when it answers.
                  if (!lookup) (passwordOff ? usernameRef : passwordRef).current?.focus();
                }}
              >
                Try again
              </button>
            )}
          </section>
        )}
        <span className="office-announcement" role="status" aria-atomic="true">
          {announcement}
        </span>
        <form method="post" noValidate onSubmit={onSubmit}>
          <div className="login-field">
            <label htmlFor="bo-username">Username</label>
            <input
              ref={usernameRef}
              id="bo-username"
              name="username"
              type="text"
              className="office-field"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              disabled={fieldsOff}
              aria-invalid={marked('username') !== null ? true : undefined}
              aria-describedby={describedBy('username', marked('username'))}
              onInput={(event) => {
                setUsername(event.currentTarget.value);
                onEdit('username');
              }}
            />
            {marked('username') === 'missing' && (
              <span id="bo-username-error" className="office-error">
                {MISSING_USERNAME}
              </span>
            )}
          </div>
          <div className="login-field">
            <label htmlFor="bo-password">Password</label>
            <input
              ref={passwordRef}
              id="bo-password"
              name="password"
              type="password"
              className="office-field"
              autoComplete="current-password"
              disabled={passwordOff}
              aria-invalid={marked('password') !== null ? true : undefined}
              aria-describedby={describedBy('password', marked('password'))}
              onInput={() => onEdit('password')}
            />
            {marked('password') === 'missing' && (
              <span id="bo-password-error" className="office-error">
                {MISSING_PASSWORD}
              </span>
            )}
          </div>
          <button
            type="submit"
            className="office-button primary login-submit"
            aria-disabled={submitOff ? 'true' : undefined}
          >
            {verifying ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}

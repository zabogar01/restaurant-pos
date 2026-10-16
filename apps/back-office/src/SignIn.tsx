import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ACCESS_REFUSED,
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

// BO-01, PROVISIONAL (ARCH-014 question 7, item 3): one username field and one
// password field from the 40px field pattern with a persistent label, the office
// primary button, and the amber notice, stacked as the dialog forms stack them.
// Slice B's frontend task replaces the composition; the sentences are DESIGN-015's.
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

type Notice = { copy: NoticeCopy; action?: boolean };

function noticeFor(snapshot: SignedOut, local: Local, waitSeconds: number | null): Notice | null {
  const { attempt } = snapshot;
  switch (attempt.kind) {
    case 'lookup-unavailable':
      return { copy: UNAVAILABLE, action: true };
    case 'lookup-failed':
      return { copy: WENT_WRONG, action: true };
    default:
  }
  if (waitSeconds !== null) return { copy: lockedFor(waitSeconds) };
  if (local.username === 'oversize' || local.password === 'oversize') return { copy: SIGN_IN_FAILED };
  switch (attempt.kind) {
    case 'error':
      return { copy: SIGN_IN_FAILED };
    case 'failed':
      return { copy: WENT_WRONG, action: true };
    case 'unavailable':
      return { copy: UNAVAILABLE, action: true };
    default:
  }
  if (snapshot.why === 'ended') return { copy: SESSION_ENDED };
  if (snapshot.why === 'refused') return { copy: ACCESS_REFUSED };
  return null;
}

export function SignIn({ snapshot, store }: { snapshot: SignedOut; store: SessionStore }) {
  const [username, setUsername] = useState('');
  const [local, setLocal] = useState<Local>(CLEAN);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const { attempt } = snapshot;
  const lookup = attempt.kind === 'lookup-failed' || attempt.kind === 'lookup-unavailable';
  const verifying = attempt.kind === 'verifying' || snapshot.busy;
  const account = accountKey(username);
  const waitSeconds = snapshot.waits.find((w) => w.username === account)?.remainingSeconds ?? null;
  const fieldsOff = lookup || verifying;
  const passwordOff = fieldsOff || waitSeconds !== null;
  const submitOff = passwordOff;
  const notice = noticeFor(snapshot, local, waitSeconds);

  // After a response that was not a sign-in, the manager enters the password afresh.
  const wasVerifying = useRef(false);
  useEffect(() => {
    if (wasVerifying.current && !verifying) passwordRef.current?.focus();
    wasVerifying.current = verifying;
  }, [verifying]);

  const onEdit = () => {
    setLocal(CLEAN);
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
    const missing: Local = {
      username: user === '' ? 'missing' : null,
      password: password === '' ? 'missing' : null,
    };
    if (missing.username !== null || missing.password !== null) {
      setLocal(missing);
      (missing.username !== null ? usernameRef : passwordRef).current?.focus();
      return;
    }
    const oversize: Local = {
      username: user.length > USERNAME_LIMIT ? 'oversize' : null,
      password: password.length > PASSWORD_LIMIT ? 'oversize' : null,
    };
    if (oversize.username !== null || oversize.password !== null) {
      // Nothing is truncated and nothing is sent.
      setLocal(oversize);
      (oversize.username !== null ? usernameRef : passwordRef).current?.focus();
      return;
    }
    setLocal(CLEAN);
    store.signIn(user, password);
  };

  return (
    <main className="office-signin">
      <h1>Back office</h1>
      <p className="office-muted">Sign in with your manager username and password.</p>
      {notice && (
        <section className="office-notice office-notice--amber" role="alert">
          <strong>{notice.copy.title}</strong>
          <p>{notice.copy.body}</p>
          {notice.action && (
            <button type="button" className="office-button small" onClick={() => store.retry()}>
              Try again
            </button>
          )}
        </section>
      )}
      <form method="post" noValidate onSubmit={onSubmit} onInput={onEdit} className="office-stack">
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
          aria-invalid={local.username === 'missing' ? true : undefined}
          aria-describedby={local.username === 'missing' ? 'bo-username-error' : undefined}
          onInput={(event) => setUsername(event.currentTarget.value)}
        />
        {local.username === 'missing' && (
          <span id="bo-username-error" className="office-error">
            {MISSING_USERNAME}
          </span>
        )}
        <label htmlFor="bo-password">Password</label>
        <input
          ref={passwordRef}
          id="bo-password"
          name="password"
          type="password"
          className="office-field"
          autoComplete="current-password"
          disabled={passwordOff}
          aria-invalid={local.password === 'missing' ? true : undefined}
          aria-describedby={local.password === 'missing' ? 'bo-password-error' : undefined}
        />
        {local.password === 'missing' && (
          <span id="bo-password-error" className="office-error">
            {MISSING_PASSWORD}
          </span>
        )}
        <div className="office-actions office-space-top">
          <button type="submit" className="office-button primary" aria-disabled={submitOff ? 'true' : undefined}>
            {verifying ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>
    </main>
  );
}

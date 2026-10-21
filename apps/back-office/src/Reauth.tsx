import { useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import {
  CHOOSE_OTHER_BODY,
  CHOOSE_OTHER_TITLE,
  DISCARD_BODY,
  DISCARD_TITLE,
  INCORRECT_PASSWORD,
  LOGOUT_UNCERTAIN,
  LOGOUT_UNCONFIRMED,
  MISSING_PASSWORD,
  MISSING_USERNAME,
  OTHER_BODY,
  OTHER_TITLE,
  REAUTH_TITLE,
  SIGN_IN_FAILED,
  UNAVAILABLE,
  WENT_WRONG,
  logoutDuringCooldown,
  lockedFor,
  reauthBody,
  sameManagerLocked,
  type NoticeCopy,
} from './copy.js';
import { PASSWORD_LIMIT, USERNAME_LIMIT } from './SignIn.js';
import { accountKey } from './session/account.js';
import type { IdleAttempt, IdleMode, SessionSnapshot, SessionStore } from './session/types.js';
import { workGuard } from './work/guard.js';

// M-6, the back-office re-authentication, as DESIGN-012 draws it and SCREEN-INVENTORY
// specifies it: native modal dialogs over the frame, which stays rendered and inert.
// Escape and a click outside cannot close it, focus loops inside it, and the
// discard confirmation is a second dialog that takes its place while it is open.
//
// The password field is an uncontrolled native input: read once on submit, emptied at
// once and at every change of mode, never React state and never an attribute (B-12).
// Both Usernames take their value as a property from a ref, because React writes the
// `value` attribute for a `value` or `defaultValue` prop and no input has one.
// Every form is `method="post"` with its submission prevented.

type Idle = Extract<SessionSnapshot, { phase: 'idle' }>;

type Local = { username: 'missing' | 'oversize' | null; password: 'missing' | 'oversize' | null };
const CLEAN: Local = { username: null, password: null };

const CLOSED_BY_NONE = { closedby: 'none' } as const;

const FOCUSABLE = 'a[href],button,input,select,textarea,summary,[tabindex="0"]';

export function Reauth({ snapshot, store }: { snapshot: Idle; store: SessionStore }) {
  const main = useRef<HTMLDialogElement>(null);
  const confirmation = useRef<HTMLDialogElement>(null);
  const { mode, attempt, busy, person } = snapshot;
  const confirming = mode === 'confirm-logout';
  // A save pending or of unknown outcome adds one paragraph to the logout confirmation.
  const uncertain = useSyncExternalStore(workGuard.subscribe, workGuard.status) === 'uncertain';
  const verifying = attempt === 'verifying' || busy;
  // What the other manager has typed as Username (never the password). It survives a visit
  // to the discard confirmation, because "Keep this draft" returns to the form it came
  // from, and starts empty each time that form opens from the acknowledgement.
  const typedUsername = useRef('');
  useLayoutEffect(() => {
    if (mode === 'same' || mode === 'confirm-other') typedUsername.current = '';
  }, [mode]);
  const idledAccount = accountKey(person.username);
  const idledWait = snapshot.waits.find((w) => w.username === idledAccount)?.remainingSeconds ?? null;

  // Which dialog is open follows the mode. Each closes as the other opens, and the
  // close guard below leaves the one that is meant to be closed alone.
  useLayoutEffect(() => {
    const show = confirming ? confirmation.current : main.current;
    const hide = confirming ? main.current : confirmation.current;
    if (hide?.open) hide.close();
    if (show && !show.open) show.showModal();
  }, [confirming]);

  // Nothing closes M-6 but the session leaving idle.
  useLayoutEffect(() => {
    const dialogs = [main.current, confirmation.current].filter((d): d is HTMLDialogElement => d !== null);
    // The dialog the current mode means to have open, read from the store and not from a render.
    const meant = (): HTMLDialogElement | null => {
      const now = store.getSnapshot();
      return now.phase === 'idle' && now.mode === 'confirm-logout' ? confirmation.current : main.current;
    };
    const onCancel = (event: Event) => {
      event.preventDefault();
      // The confirmation's Escape is "Keep this draft".
      if (event.target === confirmation.current) store.keepDraft();
    };
    const onClose = (event: Event) => {
      const dialog = event.target as HTMLDialogElement;
      if (store.getSnapshot().phase !== 'idle') return;
      if (dialog === meant() && !dialog.open) dialog.showModal();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const now = store.getSnapshot();
      if (now.phase !== 'idle') return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (now.mode === 'confirm-logout') store.keepDraft();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = meant();
      if (!dialog) return;
      const all = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !(el as HTMLButtonElement).disabled && !el.hidden
      );
      const first = all[0];
      const last = all[all.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    for (const dialog of dialogs) {
      dialog.addEventListener('cancel', onCancel);
      dialog.addEventListener('close', onClose);
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      for (const dialog of dialogs) {
        dialog.removeEventListener('cancel', onCancel);
        dialog.removeEventListener('close', onClose);
      }
      // M-6 is leaving with the phase: nothing may keep a modal open over the next screen.
      for (const dialog of dialogs) if (dialog.open) dialog.close();
    };
  }, [store]);

  // A body that overflows is a region a keyboard can scroll, named by the title.
  // (jsdom has no layout, so this is only seen in a browser.)
  useLayoutEffect(() => {
    for (const dialog of [main.current, confirmation.current]) {
      const body = dialog?.querySelector<HTMLElement>('.office-dialog__body');
      if (!dialog || !body) continue;
      if (body.scrollHeight > body.clientHeight) {
        body.tabIndex = 0;
        body.setAttribute('role', 'region');
        body.setAttribute('aria-labelledby', dialog.getAttribute('aria-labelledby') ?? '');
      } else {
        body.removeAttribute('tabindex');
        body.removeAttribute('role');
        body.removeAttribute('aria-labelledby');
      }
    }
  });

  // Where focus goes: on opening, on each change of mode, and after a response.
  const seen = useRef<{ mode: IdleMode | null; verifying: boolean; attempt: IdleAttempt; waiting: boolean }>({
    mode: null,
    verifying: false,
    attempt: 'none',
    waiting: false,
  });
  const waiting = idledWait !== null;
  useLayoutEffect(() => {
    const before = seen.current;
    seen.current = { mode, verifying, attempt, waiting };
    const dialog = confirming ? confirmation.current : main.current;
    const pick = (id: string) => dialog?.querySelector<HTMLElement>(`#${id}`) ?? null;
    // Password, or what stands in for it while the account's wait disables it.
    const entry = () => {
      const password = pick('reauth-password') as HTMLInputElement | null;
      if (password && !password.disabled) return password;
      return mode === 'other' ? pick('reauth-username') : pick('reauth-switch');
    };
    let target: HTMLElement | null = null;
    if (before.mode !== mode) {
      if (mode === 'confirm-other') target = pick('reauth-stay');
      else if (mode === 'confirm-logout') target = pick('reauth-keep');
      else if (mode === 'other') target = pick('reauth-username');
      else target = before.mode === 'confirm-other' ? pick('reauth-switch') : entry();
    } else if (before.verifying && !verifying) {
      target = entry();
    } else if ((before.attempt === 'failed' || before.attempt === 'unavailable') && attempt === 'none') {
      // "Try again" asks for fresh entry.
      target = entry();
    } else if (mode === 'same' && before.waiting && !waiting) {
      // The wait ran out: entry is enabled, without submission.
      target = pick('reauth-password');
    }
    target?.focus();
  }, [mode, verifying, attempt, waiting, confirming]);

  return (
    <>
      <dialog
        ref={main}
        className="office-dialog"
        aria-labelledby="reauth-title"
        aria-describedby="reauth-description"
        {...CLOSED_BY_NONE}
      >
        <header className="office-dialog__head">
          <h2 id="reauth-title">
            {mode === 'confirm-other' ? CHOOSE_OTHER_TITLE : mode === 'other' ? OTHER_TITLE : REAUTH_TITLE}
          </h2>
        </header>
        {mode === 'confirm-other' && (
          <>
            <div className="office-dialog__body">
              <p id="reauth-description">{CHOOSE_OTHER_BODY}</p>
            </div>
            <footer className="office-dialog__foot">
              <button type="button" id="reauth-stay" className="office-button" onClick={() => store.stayWithCurrentManager()}>
                Stay with current manager
              </button>
              <button
                type="button"
                id="reauth-continue-other"
                className="office-button primary"
                onClick={() => store.continueToOtherSignIn()}
              >
                Continue to sign-in
              </button>
            </footer>
          </>
        )}
        {(mode === 'same' || mode === 'other') && (
          <CredentialForm key={mode} snapshot={snapshot} store={store} typed={typedUsername} />
        )}
      </dialog>
      <dialog
        ref={confirmation}
        className="office-dialog"
        aria-labelledby="logout-title"
        aria-describedby={uncertain ? 'logout-description logout-uncertain' : 'logout-description'}
        {...CLOSED_BY_NONE}
      >
        {confirming && (
          <Discard snapshot={snapshot} store={store} wait={snapshot.from === 'same' ? idledWait : null} uncertain={uncertain} />
        )}
      </dialog>
    </>
  );
}

function Notice({ copy, children }: { copy: NoticeCopy; children?: ReactNode }) {
  return (
    <section className="office-notice office-notice--amber" role="alert">
      <strong>{copy.title}</strong>
      <p>{copy.body}</p>
      {children}
    </section>
  );
}

function CredentialForm({
  snapshot,
  store,
  typed,
}: {
  snapshot: Idle;
  store: SessionStore;
  typed: { current: string };
}) {
  const other = snapshot.mode === 'other';
  const { attempt, busy, person } = snapshot;
  const [username, setUsername] = useState(typed.current);
  const [local, setLocal] = useState<Local>(CLEAN);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // The idled username, as a property: no `value` attribute is ever written (B-12).
  useLayoutEffect(() => {
    if (usernameRef.current) usernameRef.current.value = other ? typed.current : person.username;
  }, [other, person.username, typed]);

  const verifying = attempt === 'verifying' || busy;
  const account = accountKey(other ? username : person.username);
  const waitSeconds = snapshot.waits.find((w) => w.username === account)?.remainingSeconds ?? null;
  const passwordOff = verifying || waitSeconds !== null;

  const onEdit = () => {
    setLocal(CLEAN);
    store.dismiss();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    // `method="post"` with the submission prevented: no failure of scripting can make
    // this a GET with the password in the address bar (and `form-action 'none'`).
    event.preventDefault();
    if (passwordOff) return;
    const passwordField = passwordRef.current;
    if (passwordField === null) return;
    // Read once, and emptied at once: the value is never kept by this component.
    const password = passwordField.value;
    passwordField.value = '';
    if (!other) {
      if (password === '' || password.length > PASSWORD_LIMIT) {
        // Nothing is truncated and nothing is sent.
        setLocal({ username: null, password: password === '' ? 'missing' : 'oversize' });
        passwordField.focus();
        return;
      }
      setLocal(CLEAN);
      store.reauthenticate(password);
      return;
    }
    const user = usernameRef.current?.value ?? '';
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
      setLocal(oversize);
      (oversize.username !== null ? usernameRef : passwordRef).current?.focus();
      return;
    }
    setLocal(CLEAN);
    store.signIn(user, password);
  };

  // The one sentence under the Password field, for the fixed-username form.
  const passwordMessage: string | null = other
    ? local.password === 'missing'
      ? MISSING_PASSWORD
      : null
    : local.password === 'missing'
      ? MISSING_PASSWORD
      : local.password === 'oversize' || (attempt === 'error' && waitSeconds === null)
        ? INCORRECT_PASSWORD
        : null;

  // The amber notice above the fields.
  let notice: { copy: NoticeCopy; action: boolean } | null = null;
  if (other && waitSeconds !== null) notice = { copy: lockedFor(waitSeconds), action: false };
  else if (other && (local.username === 'oversize' || local.password === 'oversize'))
    notice = { copy: SIGN_IN_FAILED, action: false };
  else if (other && attempt === 'error') notice = { copy: SIGN_IN_FAILED, action: false };
  else if (attempt === 'failed') notice = { copy: WENT_WRONG, action: true };
  else if (attempt === 'unavailable') notice = { copy: UNAVAILABLE, action: true };

  const aria = (on: boolean, id: string) => ({
    'aria-invalid': on ? true : undefined,
    'aria-describedby': on ? id : undefined,
  });

  return (
    <>
      <div className="office-dialog__body">
        <p id="reauth-description">{other ? OTHER_BODY : reauthBody(person.username)}</p>
        {notice && (
          <Notice copy={notice.copy}>
            {notice.action && (
              <button
                type="button"
                className="office-button small"
                aria-disabled={verifying ? 'true' : undefined}
                onClick={() => store.retry()}
              >
                Try again
              </button>
            )}
          </Notice>
        )}
        {!other && waitSeconds !== null && <p role="status">{sameManagerLocked(waitSeconds)}</p>}
        <form
          id="reauth-form"
          method="post"
          noValidate
          onSubmit={onSubmit}
          onInput={onEdit}
          aria-busy={verifying ? 'true' : undefined}
        >
          <label htmlFor="reauth-username">Username</label>
          <input
            ref={usernameRef}
            id="reauth-username"
            name="username"
            type="text"
            className="office-field"
            readOnly={!other}
            autoComplete={other ? 'username' : undefined}
            autoCapitalize="none"
            spellCheck={false}
            disabled={verifying}
            {...aria(other && local.username === 'missing', 'reauth-username-error')}
            onInput={(event) => {
              if (other) typed.current = event.currentTarget.value;
              setUsername(event.currentTarget.value);
            }}
          />
          {other && local.username === 'missing' && (
            <span id="reauth-username-error" className="office-error">
              {MISSING_USERNAME}
            </span>
          )}
          <label htmlFor="reauth-password">Password</label>
          <input
            ref={passwordRef}
            id="reauth-password"
            name="password"
            type="password"
            className="office-field"
            autoComplete="current-password"
            disabled={passwordOff}
            {...aria(passwordMessage !== null, 'reauth-password-error')}
          />
          {passwordMessage !== null && (
            <span id="reauth-password-error" className="office-error">
              {passwordMessage}
            </span>
          )}
          <div className="office-actions office-space-top">
            {other ? (
              <button
                type="button"
                id="reauth-back"
                className="office-button"
                aria-disabled={verifying ? 'true' : undefined}
                onClick={() => store.backToCurrentManager()}
              >
                {`Back to ${person.username}`}
              </button>
            ) : (
              <button
                type="button"
                id="reauth-switch"
                className="office-button"
                aria-disabled={verifying ? 'true' : undefined}
                onClick={() => store.chooseOtherManager()}
              >
                Sign in as a different manager
              </button>
            )}
          </div>
        </form>
      </div>
      <footer className="office-dialog__foot">
        <button
          type="button"
          id="reauth-logout"
          className="office-button"
          aria-disabled={verifying ? 'true' : undefined}
          onClick={() => store.askLogout()}
        >
          Log out
        </button>
        <button
          type="submit"
          form="reauth-form"
          id="reauth-submit"
          className="office-button primary"
          aria-disabled={passwordOff ? 'true' : undefined}
        >
          {other ? (verifying ? 'Signing in…' : 'Sign in') : verifying ? 'Verifying…' : 'Continue'}
        </button>
      </footer>
    </>
  );
}

function Discard({
  snapshot,
  store,
  wait,
  uncertain,
}: {
  snapshot: Idle;
  store: SessionStore;
  wait: number | null;
  uncertain: boolean;
}) {
  const { logout, busy } = snapshot;
  const copy = logout.failure === 'unavailable' ? UNAVAILABLE : WENT_WRONG;
  const off = busy || logout.inFlight;
  return (
    <>
      <header className="office-dialog__head">
        <h2 id="logout-title">{DISCARD_TITLE}</h2>
      </header>
      <div className="office-dialog__body">
        <p id="logout-description">{DISCARD_BODY}</p>
        {uncertain && <p id="logout-uncertain">{LOGOUT_UNCERTAIN}</p>}
        {wait !== null && <p role="status">{logoutDuringCooldown(wait)}</p>}
        {logout.failure !== 'none' && (
          <Notice copy={copy}>
            <p>{LOGOUT_UNCONFIRMED}</p>
            <button
              type="button"
              className="office-button small"
              aria-disabled={off ? 'true' : undefined}
              onClick={() => store.logout()}
            >
              Try again
            </button>
          </Notice>
        )}
      </div>
      <footer className="office-dialog__foot">
        <button
          type="button"
          id="reauth-keep"
          className="office-button"
          aria-disabled={off ? 'true' : undefined}
          onClick={() => store.keepDraft()}
        >
          Keep this draft
        </button>
        <button
          type="button"
          className="office-button danger final"
          aria-disabled={off ? 'true' : undefined}
          onClick={() => store.logout()}
        >
          Discard changes and log out
        </button>
      </footer>
    </>
  );
}

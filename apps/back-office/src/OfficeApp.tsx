import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  DISCARD_BODY,
  DISCARD_TITLE,
  LOGOUT_UNCERTAIN,
  LOGOUT_UNCONFIRMED,
  RESUMED,
  UNAVAILABLE,
  WENT_WRONG,
} from './copy.js';
import { Rail } from './Rail.js';
import { Reauth } from './Reauth.js';
import { router } from './router.js';
import { SignIn } from './SignIn.js';
import { useSession, useSessionStore } from './session/useSession.js';
import { workGuard } from './work/guard.js';

const CLOSED_BY_NONE = { closedby: 'none' } as const;

/**
 * The back office as the session draws it: BO-01 when signed out, the frame when
 * signed in (DESIGN-015, "Successful sign-in"): the top bar says "Back office", shows
 * the manager's name and offers "Log out"; the rail lists the destinations that exist
 * (Tables and Settings, under Configuration) and the content pane holds the screen the address
 * names, or nothing at the landing. There is no business day and no incident, because
 * none of their destinations or routes exists. When the session goes idle the same
 * frame stays, visible and inert, under M-6.
 *
 * **The working area is keyed by the staff user it belongs to.** `children` (the
 * screen) is mounted under a key equal to the signed-in `staffUserId`, inside the one
 * `<main>`. When the session is lost to anything that is not a removal, the screen
 * shows BO-01 and that `<main>` stays mounted, hidden and inert, so its form state
 * survives; a sign-in as the same staff user shows it again as it was, and a
 * sign-in as anyone else changes the key, so React destroys it. A confirmed
 * logout, `FORBIDDEN` and a reload destroy it too. The served build gives it the
 * screens (`main.tsx`); tests give it a child of their own.
 *
 * **Log out asks first when the work is not clean.** With unsaved changes, or a save
 * pending or of unknown outcome, the top bar's Log out opens the built logout
 * confirmation (the sentences M-6 uses). It is a modal dialog in the working area, so
 * it follows the same rule as the screen's own: closed at BO-01 and not reopened (closing
 * it is the same as "Keep this draft"), and behind M-6 while M-6 is open.
 */
export function OfficeApp({ children }: { children?: ReactNode }) {
  const store = useSessionStore();
  const session = useSession();
  useEffect(() => store.start(), [store]);
  useEffect(() => router.start(), []);
  useEffect(() => {
    // The harness reads this, not the copy.
    document.getElementById('root')?.setAttribute('data-session', session.phase);
  }, [session.phase]);

  const signedIn = session.phase === 'signed-in';
  const framed = session.phase === 'signed-in' || session.phase === 'idle';
  const workKey =
    session.phase === 'signed-in' || session.phase === 'idle'
      ? session.person.staffUserId
      : session.phase === 'signed-out'
        ? session.held
        : null;

  // `hidden` hides the pane from view and from the accessibility tree at BO-01; `inert`
  // keeps its focus and its controls out of reach there and under M-6, where it stays
  // visible. The rail and the top bar are inert under M-6 too. Set explicitly, not left
  // to the dialog's top layer alone. None of them unmounts.
  const frame = useRef<HTMLDivElement>(null);
  const logoutButton = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    for (const part of frame.current?.querySelectorAll('.bonav, .botop, .bocontent') ?? []) {
      part.toggleAttribute('inert', !signedIn);
    }
  }, [session.phase]);

  // Coming back from M-6. Declared after the effect above, so the work is no longer
  // inert when focus returns to it. The same manager gets the element that was focused
  // and its selection back, wherever it was; a different manager's sign-in puts focus
  // on Log out (shell.js, separateArea).
  const arrival = session.phase === 'signed-in' ? session.arrival : null;
  useLayoutEffect(() => {
    if (arrival === 'resumed') {
      const memory = store.takeFocusMemory();
      if (memory?.element.isConnected) {
        memory.element.focus();
        if (memory.start !== null && memory.end !== null) {
          (memory.element as HTMLInputElement).setSelectionRange(memory.start, memory.end);
        }
      }
    } else if (arrival === 'other-manager') {
      logoutButton.current?.focus();
    }
  }, [arrival, store]);

  const logout = session.phase === 'signed-in' ? session.logout : null;
  const failure = logout?.failure ?? 'none';
  const copy = failure === 'unavailable' ? UNAVAILABLE : WENT_WRONG;
  const retryLogout = () => {
    if (!logout?.inFlight) store.logout();
  };

  // The top bar's Log out: at once when the work is clean, otherwise the confirmation.
  const work = useSyncExternalStore(workGuard.subscribe, workGuard.status);
  // The confirmation belongs to the manager it was opened for: it has the working area's
  // identity lifetime, so a different manager (through M-6 or BO-01) never meets it.
  const [askedFor, setAskedFor] = useState<string | null>(null);
  const asking = askedFor !== null && askedFor === workKey;
  const setAsking = (on: boolean) => setAskedFor(on ? workKey : null);
  const pressLogout = () => {
    if (logout?.inFlight) return;
    if (workGuard.status() === 'clean') store.logout();
    else setAsking(true);
  };
  const confirmation = useRef<HTMLDialogElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  // Open only while the frame is shown; closed with `close()` at BO-01.
  const wanted = asking && framed;
  const meant = useRef(wanted);
  meant.current = wanted;
  useLayoutEffect(() => {
    const element = confirmation.current;
    if (element === null) return;
    if (wanted && !element.open) {
      element.showModal();
      keep.current?.focus();
    } else if (!wanted && element.open) {
      element.close();
    }
  }, [wanted]);
  // Closing it at BO-01 is "Keep this draft": nothing destructive happens without the person.
  useLayoutEffect(() => {
    if (session.phase === 'signed-out' || session.phase === 'starting') setAskedFor(null);
  }, [session.phase]);
  // Another manager's key: the old one's confirmation is dropped for good, so it cannot
  // come back if that manager signs in again.
  useLayoutEffect(() => {
    if (askedFor !== null && workKey !== null && askedFor !== workKey) setAskedFor(null);
  }, [askedFor, workKey]);
  // Nothing is chosen for the manager behind it: the screen holds any answer meanwhile.
  useEffect(() => {
    workGuard.hold(asking);
    return () => workGuard.hold(false);
  }, [asking]);
  const keepDraft = () => {
    setAsking(false);
    workGuard.current()?.focus();
  };

  return (
    <>
      <div ref={frame} className={framed ? 'bo' : 'bo-signin'}>
        {framed && (
          <nav className="bonav" aria-label="Back office">
            <Rail />
          </nav>
        )}
        <div className="bomain">
          {framed && (
            <header className="botop">
              <strong className="office-title">Back office</strong>
              <span className="office-actor">{session.person.name}</span>
              <button
                ref={logoutButton}
                type="button"
                className="office-button small"
                aria-disabled={logout?.inFlight ? 'true' : undefined}
                onClick={pressLogout}
              >
                Log out
              </button>
            </header>
          )}
          {session.phase === 'signed-out' && <SignIn snapshot={session} store={store} />}
          <main className="bocontent" hidden={!framed}>
            {failure !== 'none' && (
              <section className="office-notice office-notice--amber" role="alert">
                <strong>{copy.title}</strong>
                <p>{copy.body}</p>
                <p>{LOGOUT_UNCONFIRMED}</p>
                <button
                  type="button"
                  className="office-button small"
                  aria-disabled={logout?.inFlight ? 'true' : undefined}
                  onClick={retryLogout}
                >
                  Try again
                </button>
              </section>
            )}
            {arrival === 'resumed' && (
              <section className="office-notice" role="status">
                <strong>{RESUMED.title}</strong>
                <p>{RESUMED.body}</p>
              </section>
            )}
            {workKey !== null && (
              <div key={workKey} className="office-work">
                {children}
              </div>
            )}
          </main>
        </div>
      </div>
      <dialog
        ref={confirmation}
        className="office-dialog"
        aria-labelledby="bar-logout-title"
        aria-describedby={work === 'uncertain' ? 'bar-logout-description bar-logout-uncertain' : 'bar-logout-description'}
        {...CLOSED_BY_NONE}
        onCancel={(event) => {
          // Escape is "Keep this draft".
          event.preventDefault();
          if (meant.current) keepDraft();
        }}
        onClose={() => {
          const element = confirmation.current;
          if (meant.current && element !== null && !element.open) {
            element.showModal();
            keep.current?.focus();
          }
        }}
      >
        {asking && (
          <>
            <header className="office-dialog__head">
              <h2 id="bar-logout-title">{DISCARD_TITLE}</h2>
            </header>
            <div className="office-dialog__body">
              <p id="bar-logout-description">{DISCARD_BODY}</p>
              {work === 'uncertain' && <p id="bar-logout-uncertain">{LOGOUT_UNCERTAIN}</p>}
            </div>
            <footer className="office-dialog__foot">
              <button ref={keep} type="button" className="office-button" onClick={keepDraft}>
                Keep this draft
              </button>
              <button
                type="button"
                className="office-button danger final"
                aria-disabled={logout?.inFlight ? 'true' : undefined}
                onClick={() => {
                  setAsking(false);
                  retryLogout();
                }}
              >
                Discard changes and log out
              </button>
            </footer>
          </>
        )}
      </dialog>
      {session.phase === 'idle' && <Reauth snapshot={session} store={store} />}
    </>
  );
}

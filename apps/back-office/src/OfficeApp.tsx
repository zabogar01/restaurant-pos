import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { LOGOUT_UNCONFIRMED, RESUMED, UNAVAILABLE, WENT_WRONG } from './copy.js';
import { Reauth } from './Reauth.js';
import { SignIn } from './SignIn.js';
import { useSession, useSessionStore } from './session/useSession.js';

/**
 * The back office as the session draws it: BO-01 when signed out, the Phase 0 frame
 * when signed in (DESIGN-015, "Successful sign-in"): the top bar says "Back office",
 * shows the manager's name and offers "Log out"; the rail and the content pane are
 * empty. There is no navigation entry, no business day and no incident, because
 * none of their destinations or routes exists. When the session goes idle the same
 * frame stays, visible and inert, under M-6.
 *
 * **The working area is keyed by the staff user it belongs to.** `children` is
 * mounted under a key equal to the signed-in `staffUserId`, inside the one
 * `<main>`. When the session is lost to anything that is not a removal, the screen
 * shows BO-01 and that `<main>` stays mounted, hidden and inert, so its form state
 * survives; a sign-in as the same staff user shows it again as it was, and a
 * sign-in as anyone else changes the key, so React destroys it. A confirmed
 * logout, `FORBIDDEN` and a reload destroy it too. Phase 0 has no form: tests give
 * it a child, and a served build gives it none.
 */
export function OfficeApp({ children }: { children?: ReactNode }) {
  const store = useSessionStore();
  const session = useSession();
  useEffect(() => store.start(), [store]);
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
  const pressLogout = () => {
    if (!logout?.inFlight) store.logout();
  };

  return (
    <>
      <div ref={frame} className={framed ? 'bo' : 'bo-signin'}>
        {framed && <nav className="bonav" aria-label="Back office" />}
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
                  onClick={pressLogout}
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
      {session.phase === 'idle' && <Reauth snapshot={session} store={store} />}
    </>
  );
}

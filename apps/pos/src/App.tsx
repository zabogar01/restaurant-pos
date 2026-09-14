import { useRef } from 'react';
import { LOCK_STATES, NOTICES, lockStateFrom, type LockState } from './fixtures.js';
import { Icon } from './icons.js';
import { PinPad } from './PinPad.js';

export function App({ state = lockStateFrom(window.location.search) }: { state?: LockState }) {
  return (
    <>
      <div className="pos-device">
        <LockScreen state={state} />
      </div>
      {import.meta.env.DEV && <FixtureStates current={state} />}
    </>
  );
}

function LockScreen({ state }: { state: LockState }) {
  const box = useRef<HTMLDivElement>(null);
  const notice = NOTICES[state];

  return (
    <>
      {state === 'incident' && (
        // FR-E3b / ruling C-6: presence before sign-in, detail after. Names
        // the printer, never a table, round, amount or line.
        <div className="emergency-banner" role="alert">
          <span className="emergency-banner__mark">
            <Icon name="alert" />
          </span>
          <div>
            <div className="emergency-banner__title">Kitchen printer needs attention</div>
            <div className="emergency-banner__detail">
              Tap to sign in and view. No order details are shown before sign-in.
            </div>
          </div>
          <button type="button" className="emergency-banner__action" onClick={() => box.current?.focus()}>
            Sign in to view
          </button>
        </div>
      )}

      <main className="lock">
        <div className="lock__box" ref={box} tabIndex={-1} role="group" aria-labelledby="lock-title">
          <div className="lock__heading">
            <h1 id="lock-title" className="lock__title">
              Enter PIN
            </h1>
            <div className="lock__subtitle">Six digits</div>
          </div>

          <PinPad
            // Fixture: the PIN is compared against nothing and goes nowhere.
            // Authentication arrives with the backend (plan Task 9).
            onSubmit={() => {}}
            verifying={state === 'loading'}
            continueDisabled={state === 'throttled'}
          >
            {state === 'loading' && (
              <div className="verifying">
                <div className="verifying__label">VERIFYING</div>
                <div className="verifying__bar" />
              </div>
            )}
            {notice && (
              <div className={notice.soft ? 'notice notice--soft' : 'notice'}>
                <div className="notice__title">{notice.title}</div>
                <div>{notice.body}</div>
              </div>
            )}
          </PinPad>
        </div>
      </main>
    </>
  );
}

// Development-only review aid, outside the 1280×800 frame: links to every
// fixture state so the owner can walk them. Not part of the screen.
function FixtureStates({ current }: { current: LockState }) {
  return (
    <nav className="fixture-states" aria-label="Fixture states">
      {LOCK_STATES.map((s) => (
        <a key={s.id} href={`?state=${s.id}`} aria-current={s.id === current ? 'page' : undefined}>
          {s.label}
        </a>
      ))}
    </nav>
  );
}

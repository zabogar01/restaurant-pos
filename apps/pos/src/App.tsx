import { useRef } from 'react';
import { EmergencyBanner } from './EmergencyBanner.js';
import { LOCK_STATES, NOTICES, lockStateFrom, type LockState } from './fixtures.js';
import { PinPad } from './PinPad.js';

const LOCK_NOTICE_ID = 'lock-notice';

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
        // the printer, never a table, round, amount or line. POS-03 draws the
        // signed-in variant of this same banner (OrderPanel.tsx).
        <EmergencyBanner
          title="Kitchen printer needs attention"
          detail="Tap to sign in and view. No order details are shown before sign-in."
          action={{ label: 'Sign in to view', onPress: () => box.current?.focus() }}
        />
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
            continueDescribedBy={LOCK_NOTICE_ID}
          >
            {state === 'loading' && (
              <div className="verifying">
                <div className="verifying__label">VERIFYING</div>
                <div className="verifying__bar" />
              </div>
            )}
            {notice && (
              <div
                className={notice.soft ? 'notice notice--soft' : 'notice'}
                id={LOCK_NOTICE_ID}
                role={notice.failure ? 'alert' : undefined}
              >
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

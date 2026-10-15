import { EmergencyBanner } from './EmergencyBanner.js';
import { LOCK_STATES, NOTICES, lockStateFrom, type LockState } from './fixtures.js';
import { LockScreen, type LockView } from './LockScreen.js';

// FIXTURE MODE ONLY: POS-01's reviewed pictures, selected by `?state=`. It is
// reached from `session/source.ts` behind `__FIXTURE_SESSION__`, so a built
// bundle holds none of it and `?state=throttled` on the served origin draws
// nothing (ARCH-014 question 3).

function viewOf(state: LockState): LockView {
  return {
    phase: state,
    verifying: state === 'loading',
    continueDisabled: state === 'throttled',
    notice: NOTICES[state],
  };
}

export function App({ state = lockStateFrom(window.location.search) }: { state?: LockState }) {
  return (
    <>
      <div className="pos-device">
        <LockScreen
          view={viewOf(state)}
          // Fixture: the PIN is compared against nothing and goes nowhere.
          onSubmit={() => {}}
          banner={
            state === 'incident'
              ? (focusBox) => (
                  // FR-E3b / ruling C-6: presence before sign-in, detail after. Names
                  // the printer, never a table, round, amount or line. POS-03 draws the
                  // signed-in variant of this same banner (OrderPanel.tsx).
                  <EmergencyBanner
                    title="Kitchen printer needs attention"
                    detail="Tap to sign in and view. No order details are shown before sign-in."
                    action={{ label: 'Sign in to view', onPress: focusBox }}
                  />
                )
              : undefined
          }
        />
      </div>
      <FixtureStates current={state} />
    </>
  );
}

// Review aid, outside the 1280×800 frame: links to every fixture state so the
// owner can walk them. Not part of the screen.
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

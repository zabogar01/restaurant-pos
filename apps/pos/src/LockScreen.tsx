import { useRef, type ReactNode } from 'react';
import { PinPad } from './PinPad.js';

const LOCK_NOTICE_ID = 'lock-notice';

/**
 * What POS-01 draws, as a value. The fixtures produce these for review (App.tsx)
 * and the session produces them for real (LockRoute.tsx): there is one lock
 * screen, not two.
 */
export type LockView = {
  /** Carried as `data-lock-state`, so a harness asserts on state and not on wording. */
  phase: string;
  verifying?: boolean;
  /** Continue is inert; digits still enter (the fixture cooldown picture). */
  continueDisabled?: boolean;
  /** Every key is off (the real cooldown, and a failed first read). */
  padDisabled?: boolean;
  /** Continue stays off until six digits are entered (DESIGN-015, Short PIN): no request below that. */
  requireFull?: boolean;
  notice?: {
    title: string;
    body: string;
    soft?: boolean;
    /** Announced when it appears: the answer to a PIN just entered. */
    failure?: boolean;
    action?: { label: string; onPress: () => void };
  };
};

export function LockScreen({
  view,
  onSubmit,
  banner,
}: {
  view: LockView;
  /** Receives the six digits. Must never log, store or echo them (B-12). */
  onSubmit: (pin: string) => void;
  /** Fixture-only emergency banner; the real session has no route to read an incident from. */
  banner?: (focusBox: () => void) => ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const { notice } = view;

  return (
    <>
      {banner?.(() => box.current?.focus())}

      <main className="lock" data-lock-state={view.phase}>
        <div className="lock__box" ref={box} tabIndex={-1} role="group" aria-labelledby="lock-title">
          <div className="lock__heading">
            <h1 id="lock-title" className="lock__title">
              Enter PIN
            </h1>
            <div className="lock__subtitle">Six digits</div>
          </div>

          <PinPad
            onSubmit={onSubmit}
            verifying={view.verifying}
            continueDisabled={view.continueDisabled}
            continueDescribedBy={notice ? LOCK_NOTICE_ID : undefined}
            disabled={view.padDisabled}
            requireFull={view.requireFull}
          >
            {view.verifying && (
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
                {notice.action && (
                  <button type="button" className="notice__retry" onClick={notice.action.onPress}>
                    {notice.action.label}
                  </button>
                )}
              </div>
            )}
          </PinPad>
        </div>
      </main>
    </>
  );
}

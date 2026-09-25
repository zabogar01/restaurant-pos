import { useEffect, useRef } from 'react';
import { CANCEL_NOTE, type ApprovalFixture, type ApprovalRequest } from './approvalFixtures.js';
import { formatAmount } from './money.js';
import type { OrderView } from './orderFixtures.js';
import { PinPad } from './PinPad.js';

// M-1, the manager approval prompt (F2g). A modal over the screen that
// triggered it — never a route, never a mode, never a session (FR-A6, B-14).
// Every time it opens it asks for a PIN, and nothing it is given can make it
// skip that: a manager already holding a back-office session still enters one
// here (FR-A2c, AC-27).
//
// It holds nothing between openings. The digits live in the pad's ref and are
// cleared on submit and on unmount; the prompt keeps no result, no timer and no
// "last approved" of any kind, and OrderScreen mounts a fresh one per opening.
// It shows a count of digits, never a digit (B-12), through the same pad as
// the lock screen, so test/pin-pad.test.tsx holds both to one test.

export function ApprovalPrompt({ approval, go }: { approval: ApprovalFixture; go: (view: OrderView) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const cancel = () => go(approval.cancel);

  // Focus moves onto the dialog itself, so a screen reader lands on its name.
  useEffect(() => box.current?.focus(), []);

  // Escape cancels, as Cancel does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') go(approval.cancel);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [approval, go]);

  return (
    <>
      <div className="modal-scrim" aria-hidden="true" />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-title"
        aria-describedby="approval-request"
        tabIndex={-1}
        ref={box}
      >
        <div className="modal__head">
          <h2 id="approval-title" className="modal__title">
            Manager PIN
          </h2>
          <div id="approval-request" className="modal__request">
            {requestText(approval.request)}
          </div>
        </div>

        <div className="modal__body">
          <PinPad
            geometry="approval"
            // Fixture: the PIN is compared against nothing and goes nowhere; the
            // artifact's confirm key lands on the order. For real, the PIN travels
            // inside the one protected command it authorises and is not kept.
            onSubmit={() => go(approval.approve)}
            continueDisabled={approval.throttled}
            continueDescribedBy="approval-notice"
          >
            {approval.notice && (
              <div className="notice" id="approval-notice" role={approval.notice.failure ? 'alert' : undefined}>
                <div className="notice__title">{approval.notice.title}</div>
                <div>{approval.notice.body}</div>
              </div>
            )}
          </PinPad>
        </div>

        <div className="modal__foot">
          <button type="button" className="action" onClick={cancel}>
            Cancel
          </button>
          <span className="modal__note">{CANCEL_NOTE}</span>
        </div>
      </div>
    </>
  );
}

/** "Void a fired line — Burger 135.000 — reason: customer changed their mind", as the artifact sets it. */
export function requestText({ description, subject, reason }: ApprovalRequest): string {
  return [description, subject && `${subject.name} ${formatAmount(subject.amount)}`, reason && `reason: ${reason}`]
    .filter(Boolean)
    .join(' — ');
}

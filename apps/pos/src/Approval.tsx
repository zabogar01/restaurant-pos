import { useEffect, useRef, type ReactNode } from 'react';
import { CANCEL_NOTE, type ApprovalFixture, type ApprovalRequest } from './approvalFixtures.js';
import type { Notice } from './fixtures.js';
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
//
// FE-032: there is one M-1. `ApprovalDialog` is it — controlled and
// presentational. The request it displays is fixed for the life of one mounting,
// so the object shown is the object the caller submits; a new attempt is a new
// mounting. `onSubmit` is one callback that carries out the whole protected
// action (ARCHITECTURE section 7.1): the dialog never returns an approval for the
// caller to hold. `onCancel` is the caller's, used by Cancel and Escape alike,
// and there is no other way out (the scrim takes no click). `ApprovalPrompt` is
// the thin adapter POS-03's sheets use, routing through a fixture's views.

export type ApprovalDialogProps = {
  /** What is being approved. Displayed, never collected. */
  request: ApprovalRequest;
  /** More of what the request covers, drawn under it (a refund's money-back line). */
  detail?: ReactNode;
  /** Carries out the whole protected action. It is handed the digits and must never log, keep or send them (B-12). */
  onSubmit: (pin: string) => void;
  onCancel: () => void;
  /** Why the last entry did not approve anything. The caller sets it. */
  notice?: Notice;
  /** The MANAGER_APPROVAL cooldown (FR-A5): the confirm key is drawn inert. The caller sets it. */
  throttled?: boolean;
  /** The confirm key stays off until all six digits are entered. */
  requireFull?: boolean;
  /** A line under the pad (a refund's *Approves this refund only.*). */
  footnote?: string;
};

export function ApprovalDialog({ request, detail, onSubmit, onCancel, notice, throttled, requireFull, footnote }: ApprovalDialogProps) {
  const box = useRef<HTMLDivElement>(null);

  // Focus moves onto the dialog itself, so a screen reader lands on its name.
  useEffect(() => box.current?.focus(), []);

  // Escape cancels, as Cancel does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

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
            {requestText(request)}
          </div>
          {detail}
        </div>

        <div className="modal__body">
          <PinPad
            geometry="approval"
            onSubmit={onSubmit}
            continueDisabled={throttled}
            continueDescribedBy="approval-notice"
            requireFull={requireFull}
          >
            {notice && (
              <div className="notice" id="approval-notice" role={notice.failure ? 'alert' : undefined}>
                <div className="notice__title">{notice.title}</div>
                <div>{notice.body}</div>
              </div>
            )}
          </PinPad>
          {footnote && <p className="modal__approves">{footnote}</p>}
        </div>

        <div className="modal__foot">
          <button type="button" className="action" onClick={onCancel}>
            Cancel
          </button>
          <span className="modal__note">{CANCEL_NOTE}</span>
        </div>
      </div>
    </>
  );
}

export function ApprovalPrompt({ approval, go }: { approval: ApprovalFixture; go: (view: OrderView) => void }) {
  return (
    <ApprovalDialog
      request={approval.request}
      notice={approval.notice}
      throttled={approval.throttled}
      // Fixture: the PIN is compared against nothing and goes nowhere; the
      // artifact's confirm key lands on the order. For real, the PIN travels
      // inside the one protected command it authorises and is not kept.
      onSubmit={() => go(approval.approve)}
      onCancel={() => go(approval.cancel)}
    />
  );
}

/** "Void a fired line — Burger 135.000 — reason: customer changed their mind", as the artifact sets it. */
export function requestText({ description, subject, reason }: ApprovalRequest): string {
  return [description, subject && `${subject.name} ${formatAmount(subject.amount)}`, reason && `reason: ${reason}`]
    .filter(Boolean)
    .join(' — ');
}

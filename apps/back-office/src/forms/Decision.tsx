import { useLayoutEffect, useRef } from 'react';
import { DEPARTURE_TITLE } from '../copy.js';
import { useSession } from '../session/useSession.js';

// The stay-or-discard decision of BO-05, BO-08 and BO-03 (extracted at the third copy). It is
// the one modal `<dialog>` of the configuration screens that follows the working-area dialog
// rule (consult C2 section 7): open only while the frame is shown, closed with `close()` and its
// state kept when the session reaches BO-01, reopened with `showModal()` and focus on Stay when
// the same manager signs in again, left open behind M-6, and destroyed with the area's key for
// anyone else. The screen owns whether it is wanted and what it says; this owns the dialog.

const CLOSED_BY_NONE = { closedby: 'none' } as const;

export function Decision({
  open,
  body,
  onStay,
  onDiscard,
}: {
  /** The screen wants the decision answered. It is kept open until it is. */
  open: boolean;
  /** The sentence under the title, chosen by the caller for what is being left or continued. */
  body: string;
  onStay: () => void;
  onDiscard: () => void;
}) {
  const { phase } = useSession();
  const dialog = useRef<HTMLDialogElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  // Wanted open only while the frame is shown. At BO-01 it is closed, and its state kept.
  const wanted = open && (phase === 'signed-in' || phase === 'idle');
  const meant = useRef(wanted);
  meant.current = wanted;

  useLayoutEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (wanted && !element.open) {
      element.showModal();
      stay.current?.focus();
    } else if (!wanted && element.open) {
      element.close();
    }
  }, [wanted]);

  return (
    <dialog
      ref={dialog}
      className="office-dialog"
      aria-labelledby="departure-title"
      aria-describedby="departure-copy"
      {...CLOSED_BY_NONE}
      onCancel={(event) => {
        // Escape means Stay.
        event.preventDefault();
        if (meant.current) onStay();
      }}
      onClose={() => {
        // Closed by anything but this component (a second Escape in some engines): reopen it.
        // Closed by this component at BO-01, `wanted` is false and nothing is done.
        const element = dialog.current;
        if (meant.current && element !== null && !element.open) {
          element.showModal();
          stay.current?.focus();
        }
      }}
    >
      <header className="office-dialog__head">
        <h2 id="departure-title">{DEPARTURE_TITLE}</h2>
      </header>
      <div className="office-dialog__body">
        <p id="departure-copy">{body}</p>
      </div>
      <footer className="office-dialog__foot">
        <button ref={stay} type="button" id="departure-stay" className="office-button" onClick={onStay}>
          Stay
        </button>
        <button type="button" className="office-button danger final" onClick={onDiscard}>
          Discard
        </button>
      </footer>
    </dialog>
  );
}

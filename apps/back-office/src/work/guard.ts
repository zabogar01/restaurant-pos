// What the frame needs to know of the screen in its working area, and nothing more: is
// there unsaved work, is there a save pending or of unknown outcome, and may the manager
// leave. One screen at a time registers (BO-05 in S1b); the frame asks it before the top
// bar's Log out and before M-6's Log out, and the router asks it before a rail entry or
// browser Back or Forward. The screen owns the decision it shows; this module owns nothing
// of the work itself.

/** `dirty`: the draft differs from the record it was opened from. `uncertain`: a save is pending or its outcome unknown. */
export type WorkStatus = 'clean' | 'dirty' | 'uncertain';

export interface WorkGuard {
  status(): WorkStatus;
  /**
   * The manager is leaving by `proceed` (a rail entry, browser Back or Forward). The screen
   * either runs it at once, after closing its form (`'left'`), or keeps the manager here and
   * shows the stay-or-discard decision, running `proceed` only on Discard (`'held'`).
   */
  leave(proceed: () => void): 'left' | 'held';
  /** Puts focus back in the work after a decision was answered Stay. */
  focus(): void;
}

let current: WorkGuard | null = null;
let held = false;
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of [...listeners]) listener();
};

export const workGuard = {
  /** One screen at a time. Returns the unregistration. */
  register(guard: WorkGuard): () => void {
    current = guard;
    notify();
    return () => {
      if (current === guard) {
        current = null;
        notify();
      }
    };
  },
  current: (): WorkGuard | null => current,
  status: (): WorkStatus => current?.status() ?? 'clean',
  /** The screen's state moved: whoever reads `status` should read it again. */
  changed: notify,
  /**
   * The frame has a decision of its own open (the logout confirmation). The screen holds
   * any answer that arrives meanwhile, so that nothing is chosen for the manager.
   */
  hold(on: boolean): void {
    if (held === on) return;
    held = on;
    notify();
  },
  isHeld: (): boolean => held,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

import type { Money } from '@pos/money';
import { useCallback, useRef, useState } from 'react';

// F3d: the payment session PosRoutes lifts above POS-03 and POS-04, on F3a's
// precedent for the order store — the defect F3c recorded was that the
// drafts lived inside SettlementScreen's own useState, so `← Order` unmounted
// them. FR-G9 (the draft survives the trip) and FR-G12 (the own-tab lock) both
// read this one hook.

export type DraftTender = { id: string; label: string; amount: Money };

export type PaymentSession = {
  /** FR-G12: whether a payment session is open in this tab — POS-03's own-tab lock is derived from this, never from `?state=`. */
  active: boolean;
  drafts: ReadonlyArray<DraftTender>;
  /**
   * FE-019 finding 3: a fact about *this payment session*, not the URL — the
   * server rejected a close attempt and the cashier has not yet covered the
   * balance, reset the drafts, or ended the session. `SettlementScreen` reads
   * this instead of `state === 'error'`, so a partial correcting Add cannot
   * make it vanish while a balance is still owing.
   */
  rejected: boolean;
  addDraft: (label: string, amount: Money) => void;
  removeDraft: (id: string) => void;
  /**
   * Opens the session with a starting set of drafts. The caller is the one
   * that decides whether to call this at all: rule 1 says a session already
   * active keeps its own drafts rather than taking a fixture's, so every
   * caller here guards with `!session.active` first — `activate` itself does
   * not check, so it can also be used to reset the seed in a standalone test.
   * `rejected` seeds the rejected-close fact for the one fixture (`error`)
   * that opens already carrying it.
   */
  activate: (seed: ReadonlyArray<DraftTender>, rejected?: boolean) => void;
  /** Clears the rejected-close fact once the corrected balance reaches zero (rule 8). */
  clearRejection: () => void;
  /** I-5, rule 5: Cancel payment — discards the drafts and ends the session. */
  cancel: () => void;
};

/**
 * `activate` is called from a render body, not an effect (PosRoutes.tsx and
 * SettlementScreen.tsx's standalone fallback both do this) — React's
 * documented "adjust state while rendering" pattern. That is what keeps the
 * first paint of a settlement visit already showing the seeded drafts,
 * without a flash of an empty balance while an effect catches up a tick
 * later.
 */
export function usePaymentSession(): PaymentSession {
  const [active, setActive] = useState(false);
  const [drafts, setDrafts] = useState<ReadonlyArray<DraftTender>>([]);
  const [rejected, setRejected] = useState(false);
  const nextId = useRef(0);

  const activate = useCallback((seed: ReadonlyArray<DraftTender>, seedRejected = false) => {
    setActive(true);
    setDrafts(seed);
    setRejected(seedRejected);
  }, []);

  const addDraft = useCallback((label: string, amount: Money) => {
    setDrafts((prev) => [...prev, { id: `draft-${++nextId.current}`, label, amount }]);
  }, []);

  const removeDraft = useCallback((id: string) => {
    setDrafts((prev) => prev.filter((draft) => draft.id !== id));
  }, []);

  const clearRejection = useCallback(() => setRejected(false), []);

  const cancel = useCallback(() => {
    setActive(false);
    setDrafts([]);
    setRejected(false);
  }, []);

  return { active, drafts, rejected, addDraft, removeDraft, activate, clearRejection, cancel };
}

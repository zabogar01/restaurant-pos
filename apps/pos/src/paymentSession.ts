import type { Money } from '@pos/money';
import { useRef, useState } from 'react';

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

type Held = { drafts: ReadonlyArray<DraftTender>; rejected: boolean };
const NONE: Held = { drafts: [], rejected: false };
const STANDALONE = '';

export type PaymentSessions = {
  /** The session of one order: what the screens see for the active order. Its shape is `usePaymentSession`'s. */
  forOrder: (orderId: string) => PaymentSession;
  /** FR-G12 (FE-026): whether a payment is open on this order. A session belongs to one order, like the book's orders. */
  isActive: (orderId: string) => boolean;
  /** An open session's drafts, for the floor's tiles; `undefined` when none is open. */
  draftsOf: (orderId: string) => ReadonlyArray<DraftTender> | undefined;
};

/**
 * FE-026: sessions keyed per order id, as the order book is. `PosRoutes` holds
 * these once above both screens and hands each the active order's own session.
 *
 * `activate` is called from a render body, not an effect (PosRoutes.tsx and
 * SettlementScreen.tsx's standalone fallback both do this) — React's
 * documented "adjust state while rendering" pattern. That is what keeps the
 * first paint of a settlement visit already showing the seeded drafts,
 * without a flash of an empty balance while an effect catches up a tick
 * later.
 */
export function usePaymentSessions(): PaymentSessions {
  const [held, setHeld] = useState<Readonly<Record<string, Held>>>({});
  const nextId = useRef(0);
  const bound = useRef(new Map<string, Pick<PaymentSession, 'addDraft' | 'removeDraft' | 'activate' | 'clearRejection' | 'cancel'>>());

  const actionsFor = (id: string) => {
    let actions = bound.current.get(id);
    if (!actions) {
      const change = (fn: (h: Held) => Held) => setHeld((prev) => (prev[id] ? { ...prev, [id]: fn(prev[id]!) } : prev));
      actions = {
        activate: (seed, rejected = false) => setHeld((prev) => ({ ...prev, [id]: { drafts: seed, rejected } })),
        addDraft: (label, amount) => change((h) => ({ ...h, drafts: [...h.drafts, { id: `draft-${++nextId.current}`, label, amount }] })),
        removeDraft: (draftId) => change((h) => ({ ...h, drafts: h.drafts.filter((d) => d.id !== draftId) })),
        clearRejection: () => change((h) => ({ ...h, rejected: false })),
        cancel: () =>
          setHeld((prev) => {
            const { [id]: _gone, ...rest } = prev;
            return rest;
          }),
      };
      bound.current.set(id, actions);
    }
    return actions;
  };

  return {
    forOrder: (id) => {
      const h = held[id];
      return { active: h !== undefined, drafts: (h ?? NONE).drafts, rejected: (h ?? NONE).rejected, ...actionsFor(id) };
    },
    isActive: (id) => held[id] !== undefined,
    draftsOf: (id) => held[id]?.drafts,
  };
}

/** One session, for a screen mounted on its own (SettlementScreen's standalone fallback). */
export function usePaymentSession(): PaymentSession {
  return usePaymentSessions().forOrder(STANDALONE);
}

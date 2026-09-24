# ARCH-002 — Should firing to the kitchen ask for confirmation?

Owner: `architect2`. Written by the lead, 2026-09-24. Read-only task: you write
one report and touch nothing else.

## The question

On POS-03, **Send to kitchen** today does nothing visible (FE-011 held it out:
a fire result needs a new fired round, its time and a delivery outcome, and the
reviewed artifact draws no such composition). So a table order's lines stay
pending forever and the table cannot close from a live walk.

The owner's instinct, verbatim in substance: *there should be a confirmation
first to confirm the items, so the kitchen can start; then the order should
follow the fired display that already exists* (the fired-round groups F2a built).
**The owner explicitly invited you to challenge this.**

Answer, with evidence:

1. **Confirm step or not?** Weigh a confirmation modal against firing on one
   press. Consider: speed on a busy floor; `FR-E*` (kitchen dispatch) and every
   `B-*` rule in `docs/BOUNDARIES.md` touching firing, idempotency, or audit;
   what is reversible after a fire (void rules, `FR-F*`) versus before; the
   existing M-1 approval and modal count in `docs/design/SITEMAP.md`; and what
   mainstream POS systems do (Square, Toast, Lightspeed). If you recommend a
   confirmation, say what it lists and what it must not do (it must not become
   a gate the PRD does not grant).
2. **What firing shows** once it succeeds: the new fired round (its heading,
   time source — this app has no clock yet, so say where the time comes from),
   the lines moving from pending into it, and the delivery outcome (`SENT`,
   `FAILED`, `UNKNOWN` per `FR-E3`). Build on the fired-round rendering already
   in `apps/pos/src/OrderPanel.tsx` rather than inventing a second one.
3. **Where the rule lives.** `apps/pos/src/fire.ts` already refuses a fire
   (86'd pending line, `B-17`). Say whether the fire itself belongs in the order
   store (`apps/pos/src/orderStore*`) as a pure transition, and what a frontend
   with no server can honestly show for delivery.

## Constraints

- `docs/BOUNDARIES.md` is inviolable. `docs/PRD.md`, `docs/PRODUCT.md` and
  `docs/ROADMAP.md` are the contract; if the answer needs a contract change,
  **propose exact wording and flag it**, do not assume it.
- The architecture is `docs/ARCHITECTURE.md` with accepted ADRs.
- Do not edit any file except your report. Do not commit.

## Deliverable

Write `.agent/reviews/ARCH-002-fire-confirmation.md`: a recommendation in the
first five lines, then the reasoning with `file:line` and requirement IDs, then
**the exact states a designer must draw** (names, what each shows), since a
design task (DESIGN-007) will consume this directly. Keep it under 250 lines.
Reply in the terminal with only the report's path when done.

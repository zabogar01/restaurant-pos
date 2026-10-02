# ARCH-003 — How may the fixture client model a refund?

Owner: `architect3`. Written by the lead, 2026-10-01. Read-only consult: you write one report
and touch nothing else. It is the architect consult WORKFLOW.md requires before a task that
touches money, audit or boundaries is dispatched.

## The question

FE-032 (`.agent/tasks/FE-032-refund.md`, a draft in this checkout, not yet dispatched) builds
the refund on POS-06: the M-5 allocation sheet, a required reason, the M-1 manager approval,
and the REFUNDED order. The design is reviewed (DESIGN-009, DESIGN-010) and the contract text
is settled (FR-H5, H5b, H6, H7, FR-A6, FR-J2, FR-J3, AC-11, AC-14, AC-18, AC-25, AC-34; B-1,
B-6, B-9, B-10, B-14, B-19, B-20, B-23). What is not settled is how far a client with **no
server, no PIN verification, no manager identity and no audit log** may go in acting a refund
out, and what it must not pretend to do. That section of FE-032, *Architect consult*, is empty
and waits for your answer.

## What exists (verify it; do not take the lead's word)

- The POS client runs against fixtures and an in-memory order book (`apps/pos/src/orderStore.ts`).
  The one operation that records money today is `close` (`orderStore.ts:356–379`, with
  `close.ts`): it stores `closedAt`, `tenders` and one `change` figure per order, and
  `orders()` reports `status: 'open' | 'closed'`.
- POS-05 (`closedOrders.ts`, FE-030) lists the book's closed orders beside six fixture orders;
  POS-06 (`ClosedOrderScreen.tsx`, `closedOrderDetail.ts`, FE-031) shows one, read-only, with
  `refunded: false` for every book order.
- M-1 on POS-03 (`Approval.tsx`, `PinPad.tsx`, `approvalFixtures.ts`) is a fixture picture: it
  takes `{ approval, go }`, ignores the digits and routes to a fixture view. The fired-line
  void and the discount it fronts send no command. Nothing in the client verifies a PIN or
  knows who a manager is (FR-A is not built).
- The client models no audit record of any kind.
- The server is a Fastify skeleton with a pool and one migration: no schema, no API.

## Answer these

1. **May the client record a refund in the order book at all?** The lead's draft says an
   approved refund of a book order leaves it REFUNDED in the book, so POS-05's row and POS-06
   agree, as `close` already does for a sale. The alternatives are a screen-local REFUNDED
   picture that the book never learns of, or fixtures only. Say which is right against
   `docs/ARCHITECTURE.md` and the ADRs, and what must be written down so the in-memory
   operation is not later mistaken for the transaction boundary.
2. **The shape of that operation, if it exists.** Propose it: what it takes (the order, the
   non-zero allocations, the reason), what it refuses and how it reports a refusal (not
   closed, already REFUNDED, zero total, a row that is not one of the order's tenders, a sum
   that is not the total), and whether the order's state becomes a third status `refunded` or
   a refund record on a `closed` order. AC-14 speaks of a `REFUNDED` state; POS-05 today lists
   only `status === 'closed'`. Name every reader that must then handle the new state. B-20
   requires that the operation is all or nothing.
3. **The approver.** The artifact's REFUNDED notice reads *REFUNDED · 20:31 · approved by
   M. Iqbal*, fixture copy. A refund made live in the client has no approver to name. Say what
   the client records and shows for a book order: no approver, a fixture name, or something
   else, and why. Consider FR-A6, B-14, and the rule that the client must not fabricate
   identity.
4. **The PIN.** With nothing to verify, the modal's confirm key after six digits is the
   approval. Is that acceptable for a fixture client when a state change follows, where on
   POS-03 nothing follows? If so, what must hold so it cannot be read as authorization: for
   example that the digits are discarded unread and never stored (B-12), and that the seam
   takes a server's answer later without a rewrite.
5. **Change against several cash tenders.** FR-H5 defines each tender's effective
   contribution as tendered less change, but the book stores one `change` per order. FE-031's
   `moneyReturned` takes the change off the last Cash tender. With two cash tenders, or a
   change larger than the last one, which tender carries it? Give the rule the default
   allocation should use, such that no row is negative and the rows sum to the order total.
6. **Refusals and failure.** `refund-error` and `day-refusal` are fixture states. For a book
   order, the only real refusal is the operation's own (item 2). Say what the screen does on a
   refusal, whether DESIGN-009's no-response rule (re-read the order before saying *the order
   is unchanged*, `:823–829` of its task file) has any honest meaning without a network, and
   whether it should be built now, shaped as a seam, or left to the backend.
7. **Audit.** The client writes none. Is that right, and what should FE-032's Handoff record
   so Phase 5 knows which entries the server owes (the combined entry, the cancelled approval
   with a null approver, the approved-then-refused entry of ruling O4)?
8. **One M-1.** FE-032 asks for a single approval component with a seam for POS-06 (a subject
   of several lines, an approve and a cancel callback) while POS-03's fixture-routed use stays
   as it is. Say whether any ADR constrains that seam (a per-action approval, a token, an
   idempotency key) so it is shaped right the first time.
9. **Anything else in the draft** that contradicts `docs/ARCHITECTURE.md`, an accepted ADR or
   a boundary. Push back where the lead is wrong.

## Read

- `.agent/tasks/FE-032-refund.md`, whole.
- `docs/ARCHITECTURE.md` and the ADRs in `docs/decisions/` that bear on commands, approvals,
  money, audit and the client's role.
- `docs/PRD.md`: FR-H1, H5, H5b, H6, H7, FR-A6, FR-J2, J3, J4, AC-11, AC-14, AC-18, AC-25,
  AC-34. `docs/BOUNDARIES.md`: B-1, B-6, B-9, B-10, B-12, B-14, B-19, B-20, B-23.
- The code named under *What exists*, and
  `docs/design/visual-directions/frost/pos/closed.js:87–180` for what the artifact does.

## Constraints

- Do not edit any file except your report. Do not commit. Do not start any other agent.
- Use the file tools to read. Do not run shell commands except the one report line below; a
  shell prompt would wait on the owner.
- A boundary is not subject to your judgement. If the draft seems to need one broken, say the
  draft is wrong.
- Separate what the documents decide from what you recommend, and name any question that is
  the owner's (product, contract wording, identity) rather than answering it by architecture.

## Reporting

Write `.agent/reviews/ARCH-003-refund-in-the-client.md` in full prose: one section per
question above, each with the answer, the authority it rests on (the ADR, requirement or
boundary by ID) and, where you recommend rather than cite, the alternatives and why they lose.
End with a short list titled *For the task file*: the exact rules the lead should write into
FE-032, and a list titled *For the owner*: anything only the owner can rule.

Then run exactly one of:

    herdr agent prompt lead "architect3: ARCH-003 done — .agent/reviews/ARCH-003-refund-in-the-client.md"
    herdr agent prompt lead "architect3: BLOCKED — <question>"

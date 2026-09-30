# 2026-09-30 — Proposed contract wording for the four refund rulings

**Status:** approved by the owner 2026-09-30 as drafted (refund-only) and applied to `docs/PRD.md` on `agent/lead-0930`. Before that it was a draft; nothing here was in `docs/PRD.md` until the
owner approves it. The rulings themselves are in DECISIONS.md (2026-09-30, four lines) and in
DESIGN-009's Round 2 (O1 to O4); this file only proposes how the contract should say them.

## Why the contract needs it

The DESIGN-009 review (F4, F5) found that `FR-H5` says refund allocations are "selected by the
manager" and must sum to the order total, but not which tender types may be used, whether one
allocation may exceed what was paid with that tender, or what happens to a zero allocation. It
also found that `FR-J3` defines an entry for a successful approved action and for a failed or
cancelled approval, but not for an approval that succeeds and is then refused by the server.
The owner ruled all four on 2026-09-30. Without contract text, the F4e builder and the Phase 5
backend would each have to find the rulings in DECISIONS.md.

## Change 1 — FR-H5 (`docs/PRD.md:273-278`)

Replace:

> - **FR-H5** A full refund reverses a closed order and records one or more
>   `RefundTender` allocations selected by the manager. The default allocation
>   reproduces each original `Tender`'s **effective contribution**, defined as
>   amount tendered minus change given. Allocations must sum exactly to the
>   order total. Partial refunds are out of scope. Requires a manager PIN and a
>   reason, and is audited.

With:

> - **FR-H5** A full refund reverses a closed order and records one or more
>   `RefundTender` allocations selected by the manager. Allocations may use only
>   the tender types the order was paid with; no other type can be added. The
>   default allocation reproduces each original `Tender`'s **effective
>   contribution**, defined as amount tendered minus change given. The manager
>   may move amounts between those tender types, and one allocation may exceed
>   its tender's effective contribution; allocations must sum exactly to the
>   order total. An allocation of zero is dropped before the refund is recorded
>   and is never stored. Partial refunds are out of scope. Requires a manager
>   PIN and a reason, and is audited.

## Change 2 — FR-J3 (`docs/PRD.md:330-338`)

Insert after "A failed or cancelled approval creates one entry naming the initiating actor
with approver null.":

> A refund that is approved and then refused by the server (for example
> because its business day closed in the meantime) creates one entry naming
> actor and approver, with outcome `REFUSED` and the refusal code, and no
> before/after amounts.

## Change 3 — AC-18 (`docs/PRD.md:501`)

Replace "one entry per failed or cancelled approval naming actor with approver null;" with:

> one entry per failed or cancelled approval naming actor with approver null;
> one entry per approved refund that the server refuses, naming actor and
> approver, with outcome `REFUSED`, the refusal code and no amounts;

## Change 4 — a new AC-34 (after `docs/PRD.md:516`)

> | AC-34 | A refund allocation to a tender type the order was not paid with is rejected; an allocation above its tender's effective contribution is accepted when the allocations sum to the order total; an allocation of zero is not stored | FR-H5 |

## Change 5 — two edge cases (section 6, after "Refund attempted on an already-refunded order — rejected.")

> - Refund allocation to a tender type the order was not paid with — rejected (FR-H5).
> - Refund approved, then refused because the business day closed — one
>   `REFUSED` audit entry naming actor and approver; the order is unchanged (FR-H7, FR-J3).

## What this does not change

- The ruling O4 is refund-only, as the owner gave it. The same approved-then-refused case exists
  for a fired-line void and a discount; this draft does not extend the rule to them. That is a
  separate question for the owner if wanted.
- AC-25's pre-IDR figures (20.00 / 4.41 / 15.59) are untouched; they are outside this change.
- `docs/BOUNDARIES.md` needs nothing: B-23 (full-order only) and B-10 (once only) still hold.

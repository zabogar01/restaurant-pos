# Boundaries

Rules that must never be violated. Each one exists because breaking it
corrupts money, destroys history, or lies to a user about what happened.

These are not preferences and not style guidance. A change that breaks one of
these is wrong even when it makes a feature easier, a test pass, or a
deadline. If a requirement appears to demand breaking one, the requirement is
wrong — raise it, do not work around it.

## Money

**B-1. Money is never a floating-point number.**
All monetary values are integers in minor units, at every layer: database,
domain logic, API, and UI. No `float`, no `double`, no untyped decimal
arithmetic on money anywhere.
*Why: binary floating point cannot represent 0.10. Cent drift in a POS is
theft that nobody committed.*

**B-2. Rounding is half-up, applied once, at the point of storage or
display.**
Never round twice. Never round mid-calculation and then continue calculating
on the rounded value beyond the defined order of operations.
*Why: repeated rounding accumulates error, and two code paths that round
differently produce two different totals for one order.*

**B-3. Tax is computed once at order level, never summed from lines.**
*Why: per-line rounding does not reconcile to the order total. The receipt
would not add up.*

**B-4. The tax figure on a tax-inclusive receipt is derived, never added.**
Tax is a component of the price already shown, extracted for display. It is
never added on top of the total.
*Why: the customer pays the menu price. A tax line that increases the total
means the displayed price was a lie.*

**B-5. A non-cash tender is never recorded above the remaining balance.**
Cash may exceed the balance, with the excess returned as change. Card and
custom tenders may not.
*Why: recording a card charge larger than what is owed is overcharging a
customer, and there is no integration here to reverse it.*

**B-6. Recorded revenue is the order total, never the amount tendered.**
Change is not revenue.
*Why: otherwise every cash sale overstates takings by the change given.*

## History

**B-7. The audit log is append-only.**
No update path. No delete path. No soft-delete that hides entries from the
audit view. Not for cleanup, not for tests, not for a mistake.
*Why: an audit log that can be edited is not evidence of anything.*

**B-8. Prices, discounts, and rates are snapshotted onto the record that used
them.**
An order line stores its resolved unit price. A discount stores the preset's
name, kind, and value. References to live configuration are for reporting
only, never for arithmetic.
*Why: what a customer was charged is a historical fact. Editing today's menu
must not rewrite yesterday's orders or last week's report.*

**B-9. A closed business day is immutable.**
Its report snapshot never changes. Orders belonging to it are not voided,
refunded, or edited afterwards.
*Why: a report that changes after it was used for reconciliation is worse
than no report.*

**B-10. Terminal states are terminal.**
`VOIDED` and `REFUNDED` orders accept no further transitions. An order is
refunded at most once.
*Why: double refunds are a direct, trivially exploitable cash loss.*

## Identity and access

**B-11. PINs are hashed with a modern password hash, never stored or
transmitted in plaintext.**
argon2id or bcrypt. Not MD5, not SHA-256, not encrypted-and-decryptable.
*Why: a PIN is a credential that authorises money movement.*

**B-12. No PIN value appears in any log, audit entry, error message, stack
trace, or analytics event, in any form — including partially masked.**
*Why: logs are copied, shipped, and read by people who should not be able to
approve a refund.*

**B-13. Every audited action records a specific, identified actor.**
No shared accounts, no "system" actor standing in for a person, no action
attributable to a terminal rather than a human.
*Why: an audit trail that cannot name a person answers no question worth
asking.*

**B-14. Manager approval authorises one action, at the moment it is given.**
It is never cached, never carried to a subsequent action, and never extends
into a session.
*Why: a persistent approval is a manager PIN left on the terminal, which is
the same as having no approval at all.*

## Order integrity

**B-15. Printing never gates a state transition.**
No order, line, payment, or business-day transition is conditional on a print
succeeding. A print failure produces a visible warning and a reprint action,
never a blocked sale.
*Why: the restaurant keeps serving when the printer jams. A POS that stops
because of paper is worse than a paper pad.*

**B-16. A fire sends only lines not previously fired.**
A kitchen cancellation ticket is a correction, not a fire. It may identify
previously fired work only in order to cancel it, must be unmistakable from a
new work ticket, and must never reissue the original work as new.
*Why: paper cannot be un-printed. A duplicate ticket means duplicated food,
paid for by the restaurant.*

**B-17. An unavailable item never reaches the kitchen.**
An 86'd item cannot be added to an order, and a pending line holding one
blocks the fire.
*Why: the kitchen cannot cook what the restaurant does not have, and the
customer finds out at the worst possible moment.*

**B-18. An order closes only on exact settlement.**
Tenders less change given must equal the total exactly. No tolerance, no
rounding allowance at the close boundary.
*Why: a per-order tolerance is a per-order leak.*

**B-19. Void and refund are never presented as one action.**
Void applies to unpaid orders, refund to closed ones. Distinct preconditions,
distinct approval paths, distinct reporting.
*Why: collapsing them is how money leaves without a trace of which case it
was.*

**B-20. No action leaves partial state.**
An approval that is cancelled, a tender that is rejected, or a fire that is
blocked leaves the order exactly as it was.
*Why: half-applied discounts and orphaned tenders are corruption that
surfaces days later at reconciliation.*

## Scope

**B-21. A discount never applies itself.**
No date-triggered, time-triggered, or automatic discounting in the MVP. A
staff member always chooses it.
*Why: this is the boundary of the promotions rabbit hole. Crossing it brings
precedence, overlap, and timezone rules that were deliberately deferred.*

**B-22. An order carries at most one discount.**
*Why: stacking introduces ordering and interaction rules the MVP has not
designed.*

**B-23. Refunds are full-order only.**
No partial or line-item refunds.
*Why: proration against tax, discount, and service charge already applied is
a design problem, not an implementation detail.*

**B-24. What a restaurant changes routinely is configuration, not code.**
Menu, prices, staff, tax rate, service charge, tables, and discount presets
are all editable without a deployment. No hard-coded menu, rate, or table
list, including in seed data used for demos.
*Why: the first hard-coded tax rate is the one that ships to production.*

## Changing a boundary

A boundary can be retired, but not by an implementer mid-task and not as a
side effect of building a feature. Changing one requires an explicit design
decision, recorded with its reasoning, and a corresponding update to
[PRD.md](PRD.md) and this file in the same change.

If code and this document disagree, this document is right and the code is a
defect.

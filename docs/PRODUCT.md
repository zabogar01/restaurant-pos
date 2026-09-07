# Product

## Purpose

A point-of-sale system for a single restaurant that serves customers at
tables **and** over a counter, without forcing staff to learn two systems or
the owner to buy two products.

Most POS products pick a side. Table-service systems assume every order has a
table, a course structure, and a bill presented at the end. Quick-service
systems assume payment comes first and nobody sits down. A restaurant that
does both ends up running a table-service POS with a fake table called
"Takeaway", or a counter POS that cannot hold an open tab.

This product treats the counter sale as a thin variant of one order model,
not a second mode. Everything else — menu, kitchen, payment, reporting,
audit — is shared.

The first release is deliberately a small vertical slice: one location, one
tax rate, no inventory, no integrations. It exists to prove the core loop —
take an order, feed it to the kitchen, take the money, close the day, and be
able to explain afterwards what happened.

## Who it is for

**The restaurant.** Single location, small enough that the owner and the
manager are often the same person. Runs a mix of dine-in and takeaway. Does
not have an IT department, a reliable internet connection, or the appetite to
train staff for a week.

### Users

**Waiter** — works standing up, on a shared terminal, with a queue of tables
waiting. Optimises for speed above everything. Will not read a confirmation
dialog. Needs to key an order, send it to the kitchen, and come back later to
add another round without re-entering the first one.

**Kitchen** — does not touch a screen. Receives paper tickets and works from
them. Must never be sent a second copy of food already being cooked, and must
never be sent something the restaurant cannot make.

**Cashier** — handles money and is the last person to touch an order. Deals
with the messy cases: split payment, over-tender in cash, a customer who
changed their mind. Needs the arithmetic done for them, correctly, every
time.

**Manager** — accountable for the money. Sets up the menu, the staff, and the
rates. Approves the things that move money in a customer's favour. Closes the
day and has to be able to answer "why is the till short?" the next morning.

The four roles share terminals, so identity is per action, not per session: a
staff member taps a PIN, does something, and the next person taps theirs.

## Product principles

Durable decisions that should outlive the MVP and guide choices this document
does not anticipate.

**1. The floor never waits on hardware.**
Printers jam, run out of paper, and get unplugged. No order, payment, or
state transition is ever conditional on a print succeeding. A print failure
is a visible warning and a reprint button, never a blocked sale.

**2. Correct money beats convenient money.**
Money is integer minor units, rounded by a stated rule, computed in a stated
order. Where correctness and convenience conflict in the arithmetic,
correctness wins and the UI absorbs the cost.

**3. Constrain the common path; gate the rare one.**
Rather than asking a manager to approve routine work, make the routine path
narrow enough to be safe on its own. A named preset any staff member can
apply beats a free-form field guarded by a prompt everybody learns to
click through. Approval prompts are a scarce resource — spend them where the
risk actually is.

**4. History is written once.**
Prices, discounts, and totals are snapshotted onto the record that used them.
Audit entries are append-only. A closed day's report never changes. What the
customer was charged is a fact, and editing today's menu must not rewrite
yesterday.

**5. Tell the kitchen once.**
Each fire sends only what is new. The kitchen's copy of the truth is paper,
and paper cannot be un-printed, so the system is careful about what it emits.

**6. One location, done properly, before many.**
Breadth is deferred until the single-location loop is genuinely good. This
applies to branches, integrations, inventory, and analytics alike.

**7. What a restaurant changes, it changes without a developer.**
Menu, prices, staff, tax rate, service charge, tables, discount presets — all
configuration, editable by a manager. Anything a restaurant adjusts more than
once a year does not belong in code.

## What this product is not

Not a promotions engine, an inventory system, an accounting package, a
reservation book, or a loyalty platform. It records what was sold, to which
table, by whom, for how much, and what happened to the money. Adjacent
problems are real, and belong to other tools or to later releases.

## Reference

- Requirements and acceptance criteria: [PRD.md](PRD.md)
- Delivery sequence: [ROADMAP.md](ROADMAP.md)
- Inviolable rules: [BOUNDARIES.md](BOUNDARIES.md)
- Full design rationale: [specs/2026-09-07-restaurant-pos-mvp-design.md](superpowers/specs/2026-09-07-restaurant-pos-mvp-design.md)

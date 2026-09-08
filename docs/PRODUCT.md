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

**Cashier** — performs both table-service and counter-service work in the MVP.
Opens table orders, adds and fires multiple rounds, returns later to settle
them, and handles quick sales, split tenders, cash change, and ordinary
corrections. Works standing up, at speed, and will not read a confirmation
dialog. The MVP validates the complete order lifecycle through this combined
role; a dedicated waiter role is deferred.

**Kitchen** — is a non-authenticating staff classification in the MVP.
Kitchen staff receive no PIN, use no screen, and issue no application
commands. They work from original and cancellation tickets on paper. Must
never be sent a second copy of food already being cooked, must be told when
fired work is cancelled, and must never be sent something the restaurant
cannot make.

**Manager** — accountable for the money. Sets up the menu, the staff, and the
rates, sitting down, at a desk, reading dense tables. Approves the things that
move money in a customer's favour, standing at the POS. Closes the day and has
to be able to answer "why is the till short?" the next morning.

Cashier and manager are the MVP's authenticating roles. Kitchen is
non-authenticating, and a dedicated waiter role is deferred.

### Two clients, one system

The product is two applications, not one:

**POS** — touch-first, tablet-shaped, used standing on the floor. Order entry,
firing, discounts, tender, voids, refunds, receipt reprints, print recovery.
Identity is per action: a staff member taps a PIN, does something, and the
next person taps theirs. Sessions expire in seconds because the device is
shared and unattended between uses.

**Back office** — web, desktop-shaped, manager only. Menu, staff, tables,
presets, settings, audit history, reports, and the end-of-day close. Sessions
last as long as an ordinary desk session, because expiring mid-edit while
someone builds a menu is its own kind of failure.

They share one server, one database, and one transaction boundary. The
separation is in the clients and their sessions, never in the data. A
back-office session can never satisfy a manager approval at the POS — that
always requires a PIN entered at the moment of the action.

### Deployment status

The MVP runs entirely on the owner's local development machine and is not
approved as a production floor deployment. Before access from another device
or any production use, the owner must approve and provide the server
appliance, managed terminals, TLS and terminal provisioning, UPS, backup
destination, and a tested recovery procedure.

## Product principles

Durable decisions that should outlive the MVP and guide choices this document
does not anticipate.

**1. The floor never waits on hardware.**
Printers jam, run out of paper, and get unplugged. No order, payment, or
state transition is ever conditional on a print succeeding. A print failure
is visible and offers recovery without blocking the sale. Kitchen work or
cancellation-ticket failure is an emergency, because service may stop
silently; receipt failure is a lower-priority customer-service issue. They
are never presented with equal urgency.

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
configuration, editable by a manager in the back office. Anything a restaurant
adjusts more than once a year does not belong in code.

**8. The floor client carries only what the floor needs.**
Management, configuration, history, and reporting live in the back office and
never ship to the POS. The POS is the surface where speed and error cost the
most, so it stays small on purpose.

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

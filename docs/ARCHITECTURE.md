# Architecture — Restaurant POS MVP

Status: Approved

Approved by: Product owner

Approval date: 2026-09-10

Audience: Product owner, implementation team, testers, and future maintainers

## 1. Purpose and authority

This document is the approved technical architecture for the Restaurant POS
MVP. It stands on its own as the implementation authority for technical
structure and trade-offs. PRODUCT.md, PRD.md, ROADMAP.md, and BOUNDARIES.md
remain authoritative for product behavior, scope, sequencing, and inviolable
rules. If this document conflicts with a boundary, the boundary wins; if it
appears to conflict with the product contract, implementation stops and raises
the conflict rather than silently choosing one.

The product owner approved this architecture on 2026-09-10. The accepted
decision records in section 18 preserve the seven consequential decisions and
their trade-offs. Future changes to an accepted decision require a new ADR that
supersedes the old one; accepted ADRs are not edited into a different decision.

Items marked **Deferred beyond MVP** are deliberately excluded. Items marked
**Product decision required** remain open dependencies and are not closed by
architecture approval.

## 2. Architecture

Build one TypeScript modular monolith with two independently bootstrapped
React clients:

```text
https://localhost:<port>
├── /pos/                  touch-first POS bundle
├── /back-office/          desktop back-office bundle
├── /api/pos/...           POS API surface
└── /api/back-office/...   back-office API surface
             │
             ▼
       one Fastify server
             │
             ▼
        one PostgreSQL
```

The client split is real; the service split is not. Both clients use the same
application services, domain rules, database, print dispatcher, and
transaction boundary. There is no POS service, back-office service, message
broker, cache cluster, GraphQL layer, or separate backend-for-frontend.

The monolith should contain explicit internal modules for:

1. identity, sessions, authorization, and security telemetry;
2. settings, catalog, and tables;
3. ordering, discounts, and kitchen documents;
4. checkout, tenders, receipts, and refunds;
5. printing and print incidents;
6. business day, reporting, and audit.

Module boundaries are code ownership boundaries, not network boundaries.
Cross-module writes that form one business action share one PostgreSQL
transaction.

### 2.1 Settled technology choices

The implementation stack is settled: TypeScript, Node.js, Fastify, React,
Vite, and PostgreSQL.

Use Node.js LTS, PostgreSQL 16, strict
TypeScript, npm workspaces, SQL-first migrations, and a thin typed query layer.
Use Zod or an equivalent schema library at HTTP and configuration boundaries,
Argon2id for PIN verification, Vitest plus fast-check for unit and property
tests, Playwright for browser workflows, and real PostgreSQL for integration
tests. Avoid an active-record ORM that hides transaction and locking behavior.

The repository may share API schemas, validation primitives, the Money module,
authentication primitives, and design tokens. It must not share one responsive
application shell or one route manifest between the two clients. POS touch
components and back-office dense-table components should remain independent.

## 3. Deployment shape

### 3.1 MVP deployment

The MVP is a single-host development vertical slice, not a production floor
deployment.

- The POS bundle, back-office bundle, Fastify server, print dispatcher, and
  PostgreSQL all run on the owner's local development machine.
- Fastify serves both built frontend bundles and both API surfaces from one
  HTTPS origin on localhost.
- The application listener binds only to a loopback address. A startup guard
  must reject a hostname or address that could accept inbound connections from
  another device.
- PostgreSQL is reachable only from the same host or a private local container
  network, never from the LAN.
- Printers may be reached by outbound LAN connections from the server. A
  printer never receives direct browser or database access.
- Core behavior has no cloud dependency.

The supported runtime shape is one active interactive POS workflow with one
back-office client allowed alongside it. The concurrency controls remain real
because retries, re-entrant requests, and the two clients can still overlap;
they are not evidence that the MVP supports multiple floor operators.

One origin avoids CORS and gives the application one browser security boundary.
The two session cookies have different names and server-side audiences. The
shared `ClientInstance` cookie uses the root path because it describes the
browser profile, not either authenticated session.

HTTPS on localhost should be terminated by Fastify for the MVP using a local
development certificate. Caddy, an internal certificate authority, terminal
trust installation, certificate renewal operations, a server appliance, a
UPS, and backup infrastructure are not part of this deployment.

Run one application process and one print
dispatcher in that process. Horizontal scaling would add session and print-job
coordination without satisfying an MVP need.

### 3.2 Gate before any networked or production use

**Deferred beyond MVP:** Before the application may listen on a non-loopback
address, be reached from another device, or be used in a real restaurant, the
owner must approve and provide all of the following as one pre-production
deployment gate:

- a dedicated server appliance and a documented replacement procedure;
- purchased, managed, commissioned, and revocable POS terminals;
- provisioned terminal identity, replacing `ClientInstance` wherever device
  trust is required;
- LAN TLS, persistent certificate-authority state, trust installation on every
  terminal, expiry monitoring, and a tested certificate recovery procedure;
- a UPS sized for the appliance, database, and network equipment needed to
  finish or safely stop work;
- an encrypted backup destination, automated backups, retention rules, and a
  restore test;
- multi-terminal print-incident and catalog propagation;
- extension and validation of checkout leasing under real terminal
  contention;
- real-floor concurrency and a dedicated waiter-role validation.

The loopback-only startup guard must fail closed until this gate is deliberately
implemented. A later developer must not be able to expose the MVP merely by
changing `HOST=0.0.0.0`.

## 4. Frontend and backend boundaries

### 4.1 POS client

The POS at `/pos/` is touch-first and tablet-shaped. It owns the floor workflow:

- PIN entry and explicit actor release;
- table and quick-sale order capture;
- pending-line editing, firing, discounts, and voids;
- tender drafting, checkout, refunds, and receipt reprints;
- kitchen, cancellation, and receipt print recovery.

It does not ship menu, user, table, preset, tender-type, or settings management;
the audit viewer; reports; or end-of-day close.

The POS may hold presentation state and a tab-local tender draft. It may show
provisional totals for responsiveness, but server results replace them. It
never owns committed order, money, receipt, approval, or print state.

### 4.2 Back-office client

The back office at `/back-office/` is desktop-shaped and manager-only. It owns:

- settings, business details, tables, users, menu, variants, modifiers,
  presets, tender types, and 86 controls;
- end-of-day close and immutable report history;
- the audit viewer;
- application-wide print incidents and explicit reprint actions.

It may read order state where required for management and end-of-day checks,
but it does not expose order entry, fire, tender, void, refund, or remote POS
approval commands.

### 4.3 Shared behavior without a shared client

Both clients show persistent print incidents. Kitchen work and cancellation
failures are emergency incidents; receipt failures are lower-priority warnings
and must never be presented with the same urgency. An unauthenticated POS lock
screen shows that an unresolved kitchen incident exists, but requires a PIN to
show order details.

Back-office availability changes propagate to the separately running POS
within the three-second acceptance budget. The POS polls a monotonic catalog
revision every two seconds and refreshes immediately on tab focus. The server
also revalidates availability when adding and firing, so polling is never the
integrity control. An item that becomes unavailable while its selection panel
is open remains visible, preserves selections, disables Add, and explains why.

Other catalog mutations also advance the catalog version. A command built on
stale names, prices, variants, modifiers, or presets fails with
`CATALOG_CHANGED`; the client refreshes rather than silently adding a line at a
price different from the one displayed.

### 4.4 Server responsibilities

The server is authoritative for:

- session audience, timeout, actor identity, role authorization, throttling,
  and inline manager approval;
- current catalog state, availability, catalog versions, and price resolution;
- all order, line, checkout-lease, business-day, and print transitions;
- committed money, tax, service charge, tender, change, refund, and revenue;
- receipt-number allocation and immutable receipt creation;
- audit evidence, security telemetry, report construction, and snapshots;
- durable print jobs and physical dispatch attempts.

Clients send explicit commands, not replacement aggregates or requested status
values. The server derives every resulting state.

## 5. Domain entities and authoritative data

All boolean database and domain fields use the `is_` prefix. State machines
remain enums and do not acquire redundant boolean flags.

### 5.1 Entities

| Entity | Responsibility and authoritative data |
|---|---|
| StaffUser | Staff identity, classification, optional authentication role, Argon2id PIN hash for authenticating users, active state, and credential version |
| ClientInstance | Opaque server-issued browser-profile identifier for UI continuity and telemetry; never authorization |
| ActorSession | Opaque session, actor, audience (`POS` or `BACK_OFFICE`), issue time, last interactive activity, absolute expiry, release, and credential version |
| PinThrottleBucket | One durable installation-wide counter and cooldown for each of `LOGIN` and `MANAGER_APPROVAL` |
| SecurityEvent | Operational evidence for unauthenticated failures and cooldowns, containing no PIN and no claimed audit actor |
| SettingsVersion | Immutable currency, precision, tax rate, service-charge rate, receipt business details, and calculation-policy version |
| DiningTable | Physical table label, optional area, and active state |
| CatalogRevision | Monotonic version of menu, option, price, availability, and preset configuration |
| MenuCategory | Current category name, display order, and active state |
| MenuItem | Current category, tax-inclusive base price, availability, and active state |
| Variant | Current option name, signed price delta, display order, and active state |
| Modifier | Current modifier name, non-negative price delta, applicability, and active state |
| DiscountPreset | Current name, percentage-or-fixed kind, value, and active state |
| TenderType | Cash, card, or configured custom method, display name, and active state |
| BusinessDay | Open/close timestamps, state, closing actor, and report reference |
| Order | Table or quick-sale type, optional DiningTable, state, BusinessDay, SettingsVersion, totals, timestamps, and aggregate version |
| OrderLine | Quantity, state, catalog references, and immutable item, option, modifier, component-price, and non-negative resolved-unit-price snapshots |
| OrderLineModifier | Immutable selected modifier name and price-delta snapshot |
| OrderDiscount | The order's optional single discount, source reference, immutable name/kind/value, actor, optional approver, and before/after facts |
| CheckoutLease | Order, opaque holder token, originating client facts, acquired/renewed/expiry times, actor-authentication hard stop, and takeover generation |
| KitchenTicket | Immutable fire round and per-order sequence containing only lines newly fired in that round |
| KitchenCancellationTicket | Immutable correction containing only previously fired work cancelled by one committed void |
| PrintJob | Durable request to print one immutable kitchen, cancellation, receipt, or report document on one configured target |
| PrintAttempt | One physical delivery attempt with start/end times, `PRINTED`, `FAILED`, or `UNKNOWN` outcome, and non-sensitive diagnostics |
| Tender | Immutable contribution recorded only in a successful close: type/name snapshot, amount tendered, change, effective contribution, actor, and timestamp |
| ReceiptSeries | Transactionally locked next number for the installation |
| Receipt | Stored immutable receipt number, closed-order facts, tender summary, business fields, and render-policy version |
| Refund | One full-order reversal, actor, approver, reason, amount, and timestamp |
| RefundTender | One manager-selected refund-method allocation; defaults from each original Tender's effective contribution |
| BusinessDayReport | Immutable gross, reversal, net, count, and void figures plus report-policy version |
| AuditEntry | Append-only actor, optional approver, action, outcome, subject, reason, timestamp, and before/after facts |
| IdempotencyRecord | Scope, key, request fingerprint, committed result reference, and response needed to replay a completed command |

### 5.2 Authority and snapshots

PostgreSQL is the sole authority for operational and financial state. Browser
caches, local form state, printed paper, and a printer's apparent behavior are
not authoritative.

Current configuration governs only new actions. Historical facts use immutable
snapshots:

- An order captures its SettingsVersion when opened. Later rate changes apply
  only to newly opened orders.
- A line captures customer-visible names, component prices, and resolved unit
  price when added. A negative variant delta is allowed, but the resolved unit
  price is floored at zero before it is snapshotted.
- A discount captures its displayed name, kind, and value.
- A Tender captures its displayed tender-type name.
- A Receipt captures every displayed figure and business field required for an
  identical reprint.
- A BusinessDayReport is stored at close and never recomputed from current
  configuration.

Currency and precision become immutable after the first order. The settled
installation is IDR with precision zero. Menu availability remains a current
operational rule: add and fire commands recheck it even though a pending line
already holds historical price snapshots.

Revenue is always the order total, never the amount handed over. Change is not
revenue. No discount applies itself, and routine restaurant data must come
from manager-editable configuration rather than production or demo seed data.

## 6. State transitions and command behavior

### 6.1 Order and line states

Allowed order transitions are:

- `OPEN → CLOSED` by an atomic exact-settlement command;
- `OPEN → VOIDED` by the appropriate unfired or manager-approved void command;
- `CLOSED → REFUNDED` by one manager-approved full refund while its BusinessDay
  remains open.

`VOIDED` and `REFUNDED` are terminal. A closed order cannot be reopened; the
operational correction is refund and re-ring. A closed order accepts no new
lines, discounts, tenders, or ordinary edits.

Allowed line transitions are:

- `PENDING → FIRED` in a successful fire or quick-sale close;
- `PENDING → VOIDED` without approval or audit;
- `FIRED → VOIDED` with inline manager approval, reason, audit, and a kitchen
  cancellation ticket.

Fired lines cannot be edited. Voided lines remain historical and are excluded
from current order totals.

### 6.2 Fire and kitchen cancellation

A table-order fire command locks and reloads the order, validates its expected
version and `OPEN` state, selects only `PENDING` lines, rechecks availability,
creates one immutable KitchenTicket and PrintJob, marks exactly those lines
`FIRED`, increments the order version, and commits. Printer I/O begins only
after commit.

A repeated fire with the same idempotency key returns the original result. A
later fire has a new key and ticket sequence and contains only lines added
since the previous fire.

Voiding fired work creates one visually distinct KitchenCancellationTicket in
the same transaction as the void. It identifies only the previously fired work
being cancelled and never reissues it as new work. Printing occurs after commit
and cannot roll back the void.

### 6.3 CheckoutLease

Beginning settlement acquires a server-side CheckoutLease. The lease is a
mutation guard only: it stores no tender draft and does not change
`Order.status`.

The holder is an opaque, unguessable lease token returned to the POS tab. The
token is not an actor credential. Acquisition, close, re-authentication to
extend the hard stop, and takeover still enforce the appropriate POS session
and role rules. The holder token alone may renew within the existing hard stop
or release its own lease; those operations cannot move money or extend human
authority. ClientInstance may be recorded for continuity and telemetry but is
not trusted as the lease authority.

While a lease is active it blocks add-line, discount change, fire, void, and a
competing settlement. Reads remain available. A back-office 86 command is also
rejected when the affected item occurs on a leased quick-sale order, and the
response names that order. Price or name edits do not rewrite snapshotted
lines.

The POS tab separately disables the same five mutations while its own tender
draft exists. That is a local UX guard the cashier may clear; it is not the
server lease and must not use the message shown when another holder owns the
lease.

Lease timing is:

- renewable to five minutes from database time, with a 30-second heartbeat
  recommended;
- automatically expired no later than five minutes after the holder stops
  renewing;
- stored in PostgreSQL with absolute timestamps, so an application restart
  resumes the remaining wall-clock duration and never restarts the clock;
- unable to continue beyond 15 minutes from the most recent successful actor
  authentication unless the actor re-authenticates;
- explicitly releasable by its holder without approval or money movement.

A manager may take over at any time after acknowledging that an external card
charge may already be in flight. Takeover increments the lease generation,
invalidates the displaced token, and writes audit evidence. The displaced
client's close is rejected even if it arrives later. Card hardware is not
integrated; the risk exists because the system manually records what happened
on an external device.

### 6.4 Atomic settlement

Tender rows do not exist before close. The tender draft is tab-local state,
kept separately from the actor session so it survives the 90-second POS idle
expiry in the same tab. Re-authentication is required before close. The lease
may continue under its own bounded token until its authentication hard stop.

The close command:

1. locks and reloads the BusinessDay, Order, and current CheckoutLease in a
   documented order;
2. validates the expected order version, lease generation, actor, state, and
   catalog/availability preconditions;
3. recomputes authoritative totals from snapshots;
4. rejects a table order with any `PENDING` line;
5. validates each non-cash Tender against the running remaining balance;
6. permits over-tender only for cash and validates the change ceiling;
7. requires total tendered less change to equal the order total exactly;
8. for a quick sale, creates its KitchenTicket and PrintJob and marks its
   pending lines `FIRED` in the same transaction;
9. stores all Tender rows, allocates a receipt number, and stores the immutable
   Receipt;
10. changes the order to `CLOSED`, consumes the lease, creates the receipt
    PrintJob, and commits once.

An underpaid, overpaid, stale, unavailable, unauthorized, displaced, or
otherwise invalid close writes no business state. A zero-total order closes
with an empty Tender set, still receives a Receipt, counts as an order that
reached `CLOSED`, and records zero revenue.

### 6.5 Refund

A refund is a separate immutable record, never a negative Tender and never a
mutation of original Tenders. It is full-order only, once per non-zero closed
order, and only while the original BusinessDay remains open.

The manager selects one or more RefundTender allocations. The default copies
each original Tender's effective contribution, defined as amount tendered
minus change given, so a 20.00 cash Tender with 4.41 change defaults to a 15.59
cash refund allocation. Allocations must total the order total exactly. The
system records what the manager reports was returned; it does not control a
gateway.

Refund, RefundTenders, the `CLOSED → REFUNDED` transition, and one combined
actor-and-approver audit entry commit together. A zero-total order has no
refund action because no money moved.

### 6.6 Business-day close and reports

Business-day close lives in the back office. It locks the current BusinessDay
using the same database coordination point used by order creation and all
mutations that can change the closing report. It then rejects and lists any
`OPEN` order, calculates figures from stored facts, stores one immutable
BusinessDayReport, closes the day, and opens the next day in one transaction.

The report definitions are:

- gross sales are the sum of every Order total that reached `CLOSED`, including
  orders later refunded;
- refunds are a separate reversal line, and net sales are gross less refunds;
- included tax, untaxed service charge, discounts, and effective tender
  movement each show gross, refund reversal, and net;
- order count includes every order that reached `CLOSED`, with refunded orders
  shown separately;
- whole-order void count and value use the order total immediately before the
  void;
- fired-line voids show both the tax-inclusive line snapshot value and the
  before/after reduction in order total, because an order discount and service
  charge can make them differ;
- a refunded order's discount remains in gross discounts and appears again as
  a refund reversal.

## 7. Authentication and authorization

### 7.1 Staff and permissions

The MVP has two authenticating roles:

| Role | Permissions |
|---|---|
| Cashier | POS order capture, pending-line edits, fire, ungated voids, preset discounts, settlement, receipt reprint, and initiation of gated actions |
| Manager | All cashier permissions; inline approval; all back-office configuration, audit, reports, end-of-day, and print recovery |

Kitchen is a non-authenticating staff classification with no PIN, screen,
session, or command permissions. A dedicated waiter role is deferred; the
cashier exercises both table and counter workflows. No rule requires the actor
who fired an order to differ from the actor who settles it.

Manager approval is embedded in the protected POS command. It requires a
manager PIN at that moment, authorizes exactly one action, and creates no
approval session or reusable token. A back-office session never satisfies it.

A manager who initiated a POS action may re-enter their own PIN as its
approver. No second manager is required. The audit entry still identifies the
initiating actor and approver, satisfying B-13, and the PIN is still entered at
the moment of the one protected action without creating reusable authority,
satisfying B-14. Actor and approver may therefore contain the same StaffUser
identifier.

### 7.2 Sessions and cookies

Use opaque server-side sessions, not JWTs. Cookies are `Secure`, `HttpOnly`,
and `SameSite=Strict`; mutating routes also validate origin and an anti-CSRF
token. Use separate cookie names for POS and back office, and select the
expected cookie from the route's server-side audience rather than from a
client-supplied header.

- POS sessions have audience `POS`, expire after 90 seconds without
  interactive activity, and support explicit release.
- Back-office sessions have audience `BACK_OFFICE`, a 30-minute idle timeout,
  an eight-hour absolute lifetime, and explicit logout.
- Polling, health checks, and background refresh do not update interactive
  activity.
- Unsaved back-office form state remains in the client behind re-authentication.
- User deactivation or PIN reset increments a credential version and causes
  that user's sessions to fail on their next authenticated request.

Audience determines route context and timeout policy, not business permission.
Every request still checks the current active StaffUser and role.

### 7.3 PIN lookup, verification, and throttling

PINs are unique, six-digit, numeric, and verified with Argon2id. The raw PIN is
discarded immediately after verification and must never enter logs, traces,
metrics, audit, telemetry, errors, or crash reports.

PIN-only entry needs a way to find one salted Argon2id record without selecting
a user first. store a unique keyed blind index
of the normalized PIN for lookup and uniqueness, using a server secret kept
outside PostgreSQL, then verify the selected record with Argon2id. The blind
index is not an authentication verifier, must never be exposed or logged, and
does not replace Argon2id. This avoids verifying the candidate against every
staff hash while preventing a database-only leak from exposing a direct PIN
lookup table.

Two durable, installation-wide throttle rows exist: `LOGIN` and
`MANAGER_APPROVAL`. Each is atomically locked and updated. Five consecutive
failures in one class cause a five-minute cooldown for that class. Only a
successful verification in the same class resets it. State survives browser,
application, and database restart; deleting or replacing ClientInstance does
not reset it.

ClientInstance is continuity and telemetry only. It neither authenticates a
person nor weakens the installation-wide throttle.

## 8. Transaction and concurrency strategy

Use PostgreSQL `READ COMMITTED` transactions with explicit row locks,
constraints, expected versions, and command preconditions. Serializable
transactions are unnecessary if every command follows the same locking
protocol.

Each Order has a monotonically increasing version. A mutation includes the
version observed by the client. The server locks the Order, checks version and
state, and either commits a complete command or returns a structured conflict
with current state. Harmless edits to `PENDING`-line details may use the last
successfully committed command after server validation. Fire, discount change,
checkout, void, refund, receipt allocation, and business-day close never use
blind last-write-wins.

Commands acquire locks in a documented order. CatalogRevision and affected
catalog rows precede BusinessDay for commands that depend on current catalog
state; BusinessDay precedes Order; Order precedes CheckoutLease and
ReceiptSeries. Catalog commands and add/fire/quick-sale-close commands use the
same catalog coordination row, so an 86 or price change cannot commit between
version validation and the dependent order mutation. Order creation and
end-of-day close use the same BusinessDay coordination row. Settlement, void,
and refund also lock the day before changing reportable facts, preventing a
closed report from racing a late mutation.

The following commands require idempotency keys:

1. open order;
2. fire;
3. settle and close;
4. whole-order void;
5. fired-line void;
6. refund;
7. end-of-day close.

The unique idempotency scope is actor, command type, subject, and key. A retry
with the same request fingerprint returns the original committed result; reuse
with a different payload is rejected. The idempotency result commits in the
same transaction as the command. Lease acquisition and takeover use their own
unique active-lease constraint and retry-safe token/generation protocol.

Database constraints should enforce at least:

- exactly one open BusinessDay;
- at most one `OPEN` order per DiningTable;
- table orders have a DiningTable and quick sales do not;
- at most one OrderDiscount per Order;
- whole-number line quantity from 1 through 99;
- non-negative resolved unit prices and approved money bounds;
- unique KitchenTicket sequence within an Order;
- an OrderLine appears on at most one original KitchenTicket;
- one active CheckoutLease per Order;
- unique receipt numbers;
- at most one Refund per Order and exact RefundTender allocation totals;
- immutable receipt, report, audit, ticket, cancellation, tender, and refund
  records through privileges and the absence of update/delete application
  paths.

## 9. Receipt numbering

Receipt is a stored immutable entity, not a render of current order state.
Allocate its human-visible number by locking one ReceiptSeries row inside the
same transaction that stores Tenders and closes the Order. Rollback consumes no
number; concurrent closes cannot receive the same number. A reprint uses the
same Receipt row, number, figures, and render-policy version and creates only a
new PrintAttempt.

Use an internal UUID independently of the human-visible number. The MVP may use
a single installation-wide monotonically increasing series, but its displayed
format, reset policy, mandatory fiscal fields, refund-document numbering, and
reprint marks remain subject to the receipt product decision in section 19.
Store timestamps as UTC instants. Rendering fiscal and business-day
timestamps depends on the separate restaurant time-zone decision in section
19.

## 10. Monetary and tax calculation

The settled tax convention is **nett**, not Indonesian “++” billing:

- menu prices are tax-inclusive;
- the receipt tax line is derived from the discounted tax-inclusive subtotal
  and never added to it;
- service charge is based on the tax-inclusive discounted subtotal and is not
  itself taxed;
- the installation currency is IDR at minor-unit precision zero.

All money uses integer minor units behind one Money module. In-process money
and exact rate arithmetic use `bigint`; ordinary counts remain `number`.
Canonical base-10 integer strings cross JSON boundaries and are parsed at the
edge. Binary floating point never represents money.

Rates use integer parts per million. Computed fractions round half-up exactly
once when they become a stored or displayed money value. Given tax rate `r`,
service rate `s`, and rate scale `R = 1,000,000`:

1. `subtotal = Σ(non-voided resolved unit price × whole quantity)`;
2. `discount` is the chosen percentage or fixed amount, rounded half-up;
3. `D = subtotal − discount`;
4. `tax_included = round_half_up(D × r / (R + r))`, for display only;
5. `service_charge = round_half_up(D × s / R)`;
6. `total = D + service_charge`.

A discount is 0–100 percent; a fixed discount is capped at subtotal; no total
may be negative. The maximum quantity is 99 per line. Maximum line total,
order total, and single Tender are 99,999,999 minor units; maximum change is
9,999,999 minor units. The POS validates and shows the maximum acceptable cash
before close, and the server enforces all bounds again. Tip capture is
definitively excluded: no Order, Tender, Receipt, report, or API shape contains
a tip amount in the MVP.

## 11. Audit-history strategy

AuditEntry is append-only. The application database role may insert and read
permitted projections but cannot update or delete audit rows. Migration and
administrative roles are separate and are not application credentials.

Every successful audited business action writes its audit evidence in the same
transaction as the action. A successful approved action creates one combined
entry carrying initiating actor and approver, not two loosely linked entries.
Discount replacement or removal records one before/after transition and gates
the whole transition when the old or new state requires free-form approval.
The audited actions are whole-order void, fired-line void, discount
apply/replace/remove, refund, manager CheckoutLease takeover, and every manager
approval outcome. Removing a `PENDING` line is deliberately not audited.

Failed and cancelled manager approvals are different: no business action
exists whose transaction can contain them. They write one actor-attributed,
append-only AuditEntry with `approver = null` and the failed or cancelled
outcome in their own short transaction. Failure to commit that evidence must
fail the protected request; it must never allow the business action to run.

An unauthenticated failed login has no identified actor and therefore cannot
satisfy B-13. It is recorded only as a SecurityEvent. Audit and telemetry both
exclude the PIN value in every form.

## 12. Printing and error recovery

Printing uses a PostgreSQL transactional outbox handled by a dispatcher inside
the monolith:

1. A business transaction stores an immutable document and a pending PrintJob.
2. The transaction commits without contacting the printer.
3. The dispatcher claims the job and creates a PrintAttempt before sending.
4. The attempt becomes `PRINTED`, `FAILED`, or `UNKNOWN`.

`FAILED` means delivery is known not to have completed. `UNKNOWN` means bytes
may have reached the printer before a timeout or process failure. Basic
ESC/POS printers do not offer an end-to-end idempotency key, so no automatic
retry may turn an ambiguous attempt into duplicate kitchen work. After the
single automatic attempt, `FAILED` and `UNKNOWN` require an explicit operator
reprint. A reprint creates a new PrintAttempt against the same immutable
document, never a new fire, cancellation, or receipt.

If the process restarts with an attempt in dispatch, recovery marks that
attempt `UNKNOWN`. Pending jobs, leases, sessions, orders, and immutable
documents survive in PostgreSQL. Printer failure never rolls back a committed
state transition.

Both clients poll application-wide print incidents. Kitchen-ticket and
cancellation-ticket failure is a persistent emergency; receipt failure is a
lower-priority warning. The incident remains independent of the actor session
and survives logout, refresh, and server restart until explicitly resolved.

Other recovery rules are:

- a tab-local tender draft survives POS actor expiry and requires
  re-authentication at close;
- HTTP retries use idempotency records and return the original result;
- validation, authorization, approval, conflict, or database failure rolls
  back the entire command;
- a database outage blocks writes visibly; no client may claim an order,
  approval, fire, tender, or close succeeded;
- errors use stable machine-readable codes and do not expose SQL, stack traces,
  secrets, blind indexes, or PINs;
- migrations are forward-tested against representative data before use.

## 13. API boundary

Use command-oriented REST/JSON plus polling. WebSockets and GraphQL are not
part of the MVP. No client may call a generic `set-status` endpoint or submit a
complete replacement Order.

| Surface | Representative boundary |
|---|---|
| `/api/pos/auth/...` | PIN login, current actor, release, inline approval as part of protected commands |
| `/api/pos/catalog/...` | POS menu projection, tables, catalog revision |
| `/api/pos/orders/...` | Open/read order; add/edit/remove pending line; apply/replace/remove discount; fire; void |
| `/api/pos/checkout/...` | Acquire/renew/release/take over lease; preview authoritative totals; atomically settle and close |
| `/api/pos/history/...` | Closed-order lookup, receipt read/reprint, full refund |
| `/api/pos/printing/...` | Incident projection and explicit reprint |
| `/api/back-office/auth/...` | Manager login, current session, logout, re-authentication |
| `/api/back-office/config/...` | Settings, tables, users, menu, options, presets, tender types, 86 commands |
| `/api/back-office/business-days/...` | Current day, close preview, commit close, immutable reports |
| `/api/back-office/audit/...` | Manager-only filtered audit reads |
| `/api/back-office/printing/...` | Incident projection and explicit reprint |

The two HTTP surfaces may expose different projections of the same underlying
data, but they call the same application services and domain rules. Route
audience and role are both enforced server-side. Back-office configuration
commands cannot mutate orders or tenders; their effects on current POS work are
controlled by snapshots, catalog versions, availability validation, and the
CheckoutLease.

Mutation requests carry expected aggregate/catalog versions where applicable.
The seven irreversible or duplicate-sensitive commands carry idempotency keys.
Money fields are canonical integer strings. Responses return authoritative
state plus structured error or warning codes such as `VERSION_CONFLICT`,
`CATALOG_CHANGED`, `ITEM_UNAVAILABLE`, `LEASE_HELD`, `LEASE_DISPLACED`,
`PENDING_LINES`, `SETTLEMENT_MISMATCH`, and print-delivery warnings.

## 14. Testing strategy

Test at the lowest level that proves the behavior, with browser tests reserved
for workflows, client separation, and conflict presentation.

### 14.1 Unit and property tests

- Money and rate codecs, integer-only arithmetic, half-up rounding, and all
  bounds;
- the nett worked example and the invariant that included tax never increases
  the total;
- resolved-unit-price floor and discount replacement/removal gates;
- split-Tender, change, effective contribution, zero-total, and refund
  allocation invariants;
- order, line, lease, print, and business-day transition tables;
- role, audience, timeout, and approval policy;
- receipt and report snapshot construction.

### 14.2 PostgreSQL integration tests

- partial unique indexes, check constraints, and immutable-table privileges;
- throttle bucket races and restart durability;
- audience-scoped sessions, credential invalidation, and no-PIN scans;
- command rollback when validation, approval evidence, or audit insertion
  fails;
- duplicate idempotency keys and request-fingerprint mismatch;
- order-version conflicts and qualified pending-line last-write behavior;
- order creation versus end-of-day close, settlement/refund versus day close,
  receipt allocation, fire, void, and refund races;
- lease acquisition, renewal, expiry by database time, restart with remaining
  wall-clock duration, release, takeover, and displaced close;
- gross/reversal/net report definitions and snapshot immutability;
- audit completeness, including separate failed/cancelled approval evidence.

### 14.3 End-to-end tests

Use Playwright against the real Fastify server and PostgreSQL. Browser tests
cover the user-visible workflows and the acceptance criteria that cross client
or process boundaries, including:

- complete table and quick-sale workflows;
- session-audience isolation and divergent timeout presentation;
- tender-draft survival through POS re-authentication;
- concurrent POS and back-office contexts for three-second 86 propagation,
  stale catalog rejection, user invalidation, CheckoutLease blocking and
  takeover, and print-incident visibility;
- manager approval, void/cancellation paper, atomic settlement, receipt
  reprint, refund, and end-of-day refusal/retry;
- kitchen emergency versus receipt-warning urgency.

Do not prove arithmetic, report totals, snapshot immutability, or audit-table
completeness primarily through Playwright. AC-4 belongs in unit/property tests;
AC-16 and AC-17 in PostgreSQL integration tests; AC-18 in integration,
permission, and log-scan tests.

Use an ESC/POS TCP emulator to capture deterministic artifacts. Perform an
early smoke test against the intended physical printer, but production
hardware resilience and multi-terminal testing belong to the pre-production
gate.

### 14.4 Local development

Use npm workspaces with one command sequence to start PostgreSQL, apply
migrations, issue or validate the localhost certificate, and serve both client
entry points through Fastify. PostgreSQL may run in Docker Compose for
development and tests; the application itself does not need to be decomposed
into containers.

Use separate database owner/migration and application roles so immutability
privileges are exercised locally. Test data belongs to isolated fixtures and
test-only seed paths. Demo data must be created through configuration or an
explicit import path and must never become a hard-coded menu, rate, table, or
staff list. Acceptance tests run against the same one-origin route shape used
by the MVP, not directly against independent Vite development origins.

Make clocks injectable in unit tests and use PostgreSQL time for lease,
cooldown, session, receipt, and business-day persistence. This prevents the
browser clock from becoming an authority and makes expiry tests deterministic.

## 15. Future offline-mode implications

The MVP works without the internet because all authority is local. Offline
mode would mean the POS continues accepting commands while disconnected from
the local server, which the MVP does not support.

**Deferred beyond MVP:** Do not add a browser database, service-worker write
queue, offline credentials, synchronization log, or conflict resolver now.

Low-cost MVP choices that help later are UUID identifiers, command APIs,
idempotency keys, explicit aggregate and catalog versions, immutable snapshots,
and no direct client access to database tables. They do not constitute offline
support.

Real offline operation would require a new product and architecture cycle for:

- a durable local database per terminal and secure cached credentials;
- command synchronization and an operator-visible conflict ledger;
- terminal or preallocated receipt-number ranges;
- table ownership when disconnected;
- reconciliation of fire, tender, close, void, refund, and print commands;
- catalog and settings synchronization;
- local printer routing;
- a business-day close rule that waits for every terminal or handles
  partitions explicitly.

PostgreSQL would cease to be the sole immediate authority during a partition.
That is an architectural change, not a caching enhancement.

## 16. Major risks and mitigations

| Risk | Impact | Mitigation | Label |
|---|---|---|---|
| The MVP is mistaken for production-ready software | Exposure of PINs, data loss, and operational outage | Loopback startup guard plus the explicit pre-production gate | Deferred beyond MVP |
| One local host is a single point of failure | All writes stop if the development machine or PostgreSQL stops | Fail visibly in MVP; appliance, UPS, backup, and recovery are mandatory before production | Deferred beyond MVP |
| The MVP exercises table service sequentially through a combined cashier | It does not validate waiter/cashier handoff or real floor contention | State this limitation; validate waiter role and multi-terminal service at the pre-production gate | Deferred beyond MVP |
| Installation-wide PIN cooldown can deny all logins or approvals for five minutes | Typing mistakes or abuse cause a bounded local denial of service | Separate LOGIN and MANAGER_APPROVAL buckets, clear UI, durable database-time cooldown; retain because client-reset-resistant throttling is required | Accepted architecture |
| A PIN blind index becomes a fast verifier if its secret and database are both stolen | Six-digit PINs can be enumerated after complete-host compromise | Keep the key outside PostgreSQL, retain Argon2id as verifier, restrict host access, rotate credentials after compromise | Accepted architecture |
| CheckoutLease outlives an abandoned tab | Order mutations are temporarily blocked | Five-minute renewable TTL, explicit release, database time, 15-minute authentication hard stop, audited takeover | Accepted architecture |
| Takeover races a physical card charge | Customer may have been charged before software settlement | Explicit warning, audited takeover, displaced-token rejection, manager reconciliation | Accepted architecture |
| ESC/POS cannot prove exactly-once paper delivery | Missing or duplicate kitchen work | Immutable documents, PrintAttempt history, UNKNOWN state, no automatic retry, explicit operator recovery | Accepted architecture |
| Two frontend bundles drift or duplicate domain behavior | Inconsistent rules and higher maintenance | Share schemas and domain services, never committed calculation or authorization logic in either client | Accepted architecture |
| Local development certificates add setup friction | HTTPS may initially show trust errors | Script and document local certificate creation/trust; do not substitute loopback HTTP | Accepted architecture |
| Receipt law is unresolved | Final fields, numbering, refund documents, and markings may be wrong | Keep Receipt immutable and numbering isolated; settle jurisdiction before Phase 4 completion | Open product decision |
| Permitted rate range is unresolved | Settings validation cannot be finalized | Approve maximum tax and service-charge rates before Phase 2 | Open product decision |
| Post-close corrections are unresolved | Legitimate corrections after day close lack a supported path | Preserve closed-day immutability and define a next-day adjustment process before Phase 5 completion | Open product decision |

## 17. Rejected alternatives

### 17.1 Microservices or separate POS/back-office services

Rejected. Two clients do not justify two service authorities. Separate services
would split transactions for ordering, configuration, audit, reporting, and
printing without an independent scaling or deployment need.

### 17.2 Cloud-hosted core

Rejected for the MVP. The single-host slice needs no cloud dependency, and the
target restaurant cannot make its floor depend on reliable internet. Optional
cloud backup or consolidated reporting can be designed later.

### 17.3 SQLite as the operational database

Rejected. PostgreSQL provides explicit row locks, concurrent transaction
behavior, partial unique indexes, durable lease timing, and database-role
immutability. Integration tests must use PostgreSQL rather than an in-memory
substitute.

### 17.4 Event sourcing

Rejected. Immutable snapshots plus append-only AuditEntry and PrintAttempt
history satisfy the requirements without event-store, projection, and replay
complexity. Audit is evidence, not the source from which all state is rebuilt.

### 17.5 External message broker

Rejected. A PostgreSQL outbox is durable, transactional, and sufficient for
one process and a small number of printers.

### 17.6 Direct browser printing

Rejected. It couples paper delivery to a client tab, produces inconsistent
output, and cannot provide durable recovery history. The server owns immutable
documents and dispatch attempts.

### 17.7 Persisting partial Tenders

Rejected. It would require correction, abandonment, order-edit-after-payment,
and restart rules that the MVP does not define. A bounded CheckoutLease and
tab-local draft protect atomic settlement without inventing money movement.

### 17.8 Automatic retry until a kitchen print succeeds

Rejected. A timeout can occur after the printer accepted bytes. Blind retry can
duplicate food. UNKNOWN requires a human to check before reprint.

### 17.9 Generic resource replacement and unrestricted last-write-wins

Rejected for order, money, catalog-sensitive, and historical state. Explicit
commands with versions and preconditions make conflicts visible and prevent a
stale client from replacing irreversible facts.

### 17.10 Native desktop or tablet applications

Rejected for the MVP. Two browser bundles establish the correct client
separation with less packaging work. A native shell becomes relevant only if
offline storage or device integration demonstrates a need.

## 18. Accepted architecture decision records

The following ADRs were accepted with this architecture on 2026-09-10:

| ADR | Accepted decision |
|---|---|
| [ADR-001](decisions/ADR-001-single-host-modular-monolith-with-two-clients.md) | Single-host modular monolith with two clients |
| [ADR-002](decisions/ADR-002-postgresql-as-sole-operational-authority.md) | PostgreSQL as sole operational authority |
| [ADR-003](decisions/ADR-003-versioned-commands-and-bounded-checkout-leasing.md) | Versioned commands and bounded checkout leasing |
| [ADR-004](decisions/ADR-004-versioned-exact-nett-monetary-policy.md) | Versioned exact nett monetary policy |
| [ADR-005](decisions/ADR-005-transactional-print-outbox-with-uncertain-delivery.md) | Transactional print outbox with uncertain delivery |
| [ADR-006](decisions/ADR-006-transactional-immutable-receipt-numbering.md) | Transactional immutable receipt numbering |
| [ADR-007](decisions/ADR-007-transactional-audit-with-separate-failed-approval-evidence.md) | Transactional audit with separate failed-approval evidence |

## 19. Open product dependencies

Architecture approval does not close these product decisions:

1. **Restaurant time zone — product decision required before timestamp
   rendering and business-day acceptance are final.** The database stores UTC
   instants, but the PRD does not name the restaurant time zone used to display
   receipt timestamps or interpret business-day boundaries.
2. **Receipt content and fiscal requirements — product decision required
   before Phase 4 completion.** Confirm the jurisdiction, business fields,
   number format and reset policy, mandatory tax wording, refund document,
   retention, logo/footer, reprint marking, and any fiscal-device requirement.
3. **Maximum tax and service-charge rates — product decision required before
   Phase 2.** Rate precision is one part per million, but the permitted range
   still needs a business limit.
4. **Post-close corrections — product decision required before Phase 5
   completion.** Define the legitimate correction workflow after BusinessDay
   close. It must use a new adjustment in a later open day and must never mutate
   the closed report or its original orders.
5. **Back-office kitchen-ticket reprint audit treatment — product decision
   required before Phase 3 completion.** FR-E3 grants the reprint action, while
   FR-J3 does not include it in the audited-action list. The immutable-document
   and PrintAttempt design supports either ruling; architecture approval does
   not silently make the action audited or unaudited.

## 20. Deferred beyond MVP

- production or LAN deployment and all items in the pre-production gate;
- multiple POS terminals, simultaneous floor operators, and a waiter role;
- terminal operation while disconnected from the local server;
- tip capture, definitively excluded rather than phase-blocking;
- payment gateway, QR, or payment-terminal integration;
- partial or line-item refunds and split-by-guest billing;
- reopening closed orders, table transfer, merge, and split;
- cash drawer, float, and till reconciliation;
- inventory and automatic availability;
- kitchen display systems;
- customer accounts, loyalty, reservations, and promotions automation;
- multi-location operation and consolidated reporting;
- jurisdiction-specific tax packs and fiscal devices;
- event streaming, distributed services, and horizontal scaling.

None should be anticipated through unused services, queues, database replicas,
or client storage in the MVP. Each returns through an explicit product change
and, when it changes authority or transactions, a new ADR.

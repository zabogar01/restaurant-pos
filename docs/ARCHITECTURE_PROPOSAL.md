# Architecture Proposal — Restaurant POS MVP

Status: Proposed for product-owner and engineering review  
Date: 2026-09-07  
Audience: Product owner, implementation team, testers, and future maintainers

## 1. Purpose and decision labels

This document proposes the simplest architecture that satisfies the approved MVP in PRODUCT.md, PRD.md, ROADMAP.md, and BOUNDARIES.md. It is a handoff document, not an implementation plan. The four source documents remain authoritative when this proposal conflicts with them.

Every unresolved or changeable decision in this document is explicitly marked with one of these labels:

- **Architect recommendation** — the recommended design unless review finds a concrete constraint that makes it unsuitable.
- **Product decision required** — product behavior is ambiguous or materially affects implementation and must be approved by the product owner.
- **Deferred beyond MVP** — deliberately excluded from the MVP and not to be implemented speculatively.

The central recommendation is a browser-based, LAN-hosted modular monolith backed by PostgreSQL. It should be delivered as one restaurant appliance deployment with no cloud dependency, message broker, cache cluster, or microservices.

## 2. Goals and constraints

The architecture must support one restaurant location, a single-digit number of concurrent terminals, table and quick-sale orders, kitchen and receipt printers, exact monetary arithmetic, manager-approved exceptions, immutable historical records, and end-of-day reporting.

The following constraints shape the design:

- The restaurant may have unreliable internet, so core operation must remain entirely on the local network.
- Terminals are shared by several staff members.
- Printing is unreliable and must not gate order or payment state transitions.
- The database must preserve open orders across terminal and application restarts.
- Money, tax, and service-charge calculations must be exact and reproducible.
- Historical prices, rates, discounts, receipts, reports, and audit evidence must not change when current configuration changes.
- The system is not required to scale horizontally for the MVP.
- Terminal operation while disconnected from the LAN server is outside the MVP.

## 3. Recommended architecture and technology choices

### 3.1 Overall architecture

**Architect recommendation:** Build a modular monolith. The web application, command API, domain logic, print dispatcher, and reporting logic should live in one codebase and one application deployment. Modules should have clear internal responsibilities but share one PostgreSQL database and one transaction boundary.

Recommended internal modules are:

1. Identity and access
2. Configuration and catalog
3. Ordering and discounts
4. Settlement and refunds
5. Printing
6. Business day and reporting
7. Audit

This structure keeps the implementation small while allowing a fire, close, refund, or end-of-day operation to commit all related records atomically.

### 3.2 Technology stack

**Architect recommendation:** Use the following stack, subject to confirmation that the implementation team is comfortable maintaining TypeScript:

| Concern | Recommended technology | Reason |
|---|---|---|
| Terminal client | React with TypeScript, built as static browser assets | Suitable for a fast, touch-oriented POS interface without requiring native installation |
| Build tooling | Vite or an equivalent simple static build tool | Small deployment output and minimal runtime complexity |
| Server | Node.js LTS with TypeScript and Fastify | One language across client and server, strong JSON/API support, and a small server framework |
| Database | PostgreSQL | Transactions, row locks, partial unique indexes, strong constraints, and reliable concurrent writes |
| Database access | SQL-first migrations and a thin typed query layer | Keeps transactions and locking visible; avoids domain behavior being hidden by an active-record ORM |
| PIN hashing | Argon2id | Modern password hashing suitable for short credentials |
| HTTPS | Caddy or an equivalent locally managed TLS reverse proxy | PINs must not cross the LAN unencrypted |
| Printing | Server-side ESC/POS adapter over LAN TCP, driven by database-backed jobs | Centralizes printer behavior and survives application restarts |
| Packaging | One Docker Compose bundle or an equivalent appliance image | Reproducible installation, automatic startup, and bounded operational surface |
| Automated browser testing | Playwright | Exercises shared-terminal workflows through the real UI |
| Unit and integration testing | TypeScript test runner plus real PostgreSQL integration tests | Covers calculation rules, state machines, constraints, and transactions |

Money values in the browser and server must use integer-capable types, such as BigInt, for arithmetic. Because ordinary JSON has no BigInt value, API money fields should use canonical base-10 integer strings and be parsed immediately into integer types. No layer may perform money arithmetic with JavaScript Number or another binary floating-point type.

**Product decision required:** Confirm whether the implementation team has a preferred supported stack. If the team does not have TypeScript and PostgreSQL expertise, select an equivalent monolith stack based on demonstrated team familiarity. Do not change the architectural invariants: one server authority, one relational database, exact integer money, command transactions, and durable print jobs.

## 4. Deployment shape

The physical deployment should be:

1. Shared terminal browsers connect over HTTPS to one stable LAN hostname.
2. A small server or appliance runs the TLS endpoint, POS application, print dispatcher, and PostgreSQL.
3. PostgreSQL listens only on the appliance, not on the general LAN.
4. The application connects to one or two ESC/POS printers over the LAN.
5. The application serves the browser assets and API from the same origin.

The logical data flow is:

Terminal browsers → HTTPS endpoint → POS modular monolith → PostgreSQL

The monolith also reads durable print jobs from PostgreSQL and sends immutable documents to the kitchen and receipt printers.

No terminal connects directly to the database or printer. No cloud service is required for login, ordering, printing, payment recording, reporting, or recovery.

**Architect recommendation:** Run one application instance. Horizontal scaling creates printer-job coordination and session consistency problems that the MVP does not need.

**Architect recommendation:** Put the appliance on a UPS and configure automatic, encrypted database backups to removable storage or another LAN device. Backups must be periodically restored in a test environment to prove they are usable.

## 5. Frontend and backend boundaries

The browser is responsible for presentation and interaction:

- Touch-oriented order entry and management screens
- Local form state
- Provisional display calculations for responsiveness
- Showing server validation, conflicts, print warnings, and recovery actions
- Re-fetching changed menus, availability, orders, and print status

The server is authoritative for:

- Authentication, idle expiry, role checks, and manager approval
- Menu availability at the time of an order command
- Price resolution and all committed monetary calculations
- Order, line, business-day, and print state transitions
- Tender validation and exact settlement
- Receipt-number allocation
- Audit insertion
- Report calculation and snapshots
- Printer job creation and dispatch

The browser must never submit an arbitrary replacement for a complete order or choose a new order status directly. It submits explicit commands such as add line, fire pending lines, settle and close, void, refund, and close business day.

**Architect recommendation:** Use a versioned same-origin REST/JSON API. GraphQL, direct database access, and a separate backend-for-frontend add no value to the MVP.

**Architect recommendation:** Use ordinary refetching or short polling for cross-terminal refresh in the MVP. WebSockets may be added only if usability testing demonstrates that polling cannot meet floor-operation needs.

## 6. Domain model and authoritative data

### 6.1 Canonical vocabulary

The PRD calls a contribution toward an order a Tender, while the design rationale names the entity Payment.

**Architect recommendation:** Standardize the entity name as Tender. TenderType describes the method; Tender is one immutable recorded contribution to settlement. Payment may be used as a workflow label, but not as a second entity with overlapping meaning.

Use DiningTable rather than Table in storage and implementation terminology to avoid collision with the generic database term.

### 6.2 Domain entities

| Entity | Responsibility and authoritative data |
|---|---|
| StaffUser | Staff identity, role, PIN hash, active state, failed-attempt state, and lockout expiry |
| ActorSession | Current staff actor, terminal identity, issue time, last activity, and expiry |
| DiningTable | Physical table label, optional area, and active state |
| SettingsVersion | Immutable currency, minor-unit precision, tax rate, service-charge rate, and calculation-policy version |
| MenuCategory | Current menu grouping, display order, and active state |
| MenuItem | Current category, name, base price, availability, and active state |
| Variant | Current item option name, price delta, and active state |
| Modifier | Current modifier name, non-negative price delta, applicability, and active state |
| DiscountPreset | Current name, percentage-or-fixed kind, value, and active state |
| TenderType | Cash, card, or custom method classification, display name, and active state |
| BusinessDay | Open and close times, closing actor, state, and immutable report reference |
| Order | Type, optional dining table, state, business day, settings snapshot, actors, timestamps, and concurrency version |
| OrderLine | Quantity, state, menu references, and immutable item, variant, and resolved-price snapshots |
| OrderLineModifier | Immutable selected modifier name and price-delta snapshot |
| OrderDiscount | Optional preset reference plus immutable name, kind, and value snapshots, applying actor, and optional approver |
| KitchenTicket | One fire round, per-order sequence, immutable content, creation time, and delivery status |
| KitchenTicketLine | Immutable association between a ticket and the lines included in that fire |
| Tender | Order, tender-type and name snapshot, amount tendered, change given, actor, and timestamp |
| ReceiptSeries | The transactionally locked next receipt number |
| Receipt | Unique number, immutable closed-order figures, tender summary, business information, and render-policy version |
| Refund | Original order, full amount, tender disposition, actor, approver, reason, and timestamp |
| BusinessDayReport | Immutable report figures and report-policy version |
| PrintJob | Durable request to print one immutable document on one target printer |
| PrintAttempt | Each physical delivery attempt, outcome, and non-sensitive diagnostic metadata |
| AuditEntry | Append-only actor, optional approver, action, subject, reason, timestamp, and before/after facts |

### 6.3 Authoritative data

PostgreSQL is the authority for all operational and financial state. Browser caches are never authoritative. Paper is an operational artifact: a stored KitchenTicket is the authority for what the system attempted to send, but the system cannot prove that a basic printer physically produced or delivered the paper.

Current configuration is authoritative only for new actions. Historical transactions use snapshots:

- An OrderLine snapshots customer-visible item, variant, and modifier names and every price component used.
- An OrderDiscount snapshots its name, kind, and value.
- An Order snapshots the currency, precision, tax rate, service-charge rate, and calculation-policy version that apply to it.
- A Tender snapshots the displayed tender-type name.
- A Receipt snapshots every displayed figure and business-information field needed for a stable reprint.
- A closed BusinessDayReport is never recomputed from current configuration.

**Architect recommendation:** Currency and minor-unit precision become immutable after the first order. Editing rates creates a new SettingsVersion and affects only subsequently opened orders. Existing open orders retain the version captured when they were opened.

**Product decision required:** Confirm when a changed tax or service-charge rate takes effect. The recommendation is at the next newly opened order, not immediately on existing open orders.

## 7. Order, line, payment, and business-day transitions

### 7.1 Order states

Allowed transitions are:

- OPEN → CLOSED when an atomic settlement exactly covers the current total.
- OPEN → VOIDED when the whole order is voided under the appropriate approval rule.
- CLOSED → REFUNDED when a manager-approved full refund succeeds against the still-open business day.

VOIDED and REFUNDED are terminal. CLOSED permits only the defined full-refund transition; it does not accept further lines, discounts, tenders, or ordinary edits.

When a whole order is voided, all remaining live lines should transition to VOIDED in the same transaction. Existing KitchenTicketLine records preserve which lines had reached the kitchen.

### 7.2 Order-line states

Allowed transitions are:

- PENDING → FIRED as part of a successful fire transaction.
- PENDING → VOIDED without manager approval.
- FIRED → VOIDED with an inline manager approval and reason.

FIRED lines cannot be edited. VOIDED lines are retained and excluded from monetary totals.

### 7.3 Fire transition

A fire command must:

1. Lock and reload the order.
2. Confirm that the order is OPEN.
3. Collect only PENDING lines.
4. Recheck that each referenced MenuItem is available.
5. Create one KitchenTicket and its immutable line associations.
6. Mark those lines FIRED.
7. Create a durable PrintJob.
8. Commit all changes together.

Printer I/O starts only after commit. A repeated request carrying the same idempotency key returns the original ticket rather than creating a new fire.

### 7.4 Settlement and tender transitions

**Architect recommendation:** Tender entry should be a client-side draft until the full settlement is submitted. The server should commit all Tender rows only inside the successful order-close transaction.

The close command should:

1. Lock and reload the order.
2. Recompute authoritative totals from snapshots.
3. Validate all non-cash tenders against the running remaining balance.
4. Calculate change only on cash.
5. Require total tenders less change to equal the order total exactly.
6. For a quick sale, validate availability, create its KitchenTicket, mark lines FIRED, and create its kitchen PrintJob.
7. Record all Tender rows.
8. Allocate the receipt number and create the immutable Receipt.
9. Transition the order to CLOSED.
10. Create the receipt PrintJob.
11. Commit everything atomically.

An underpaid, overpaid, stale, unavailable, or unauthorized settlement writes nothing.

**Product decision required:** Confirm whether partial tenders must persist before the order closes. Persisting them would require payment correction, cancellation, editing-after-payment, and recovery rules that are absent from the MVP. The architectural recommendation is not to persist them.

**Product decision required:** Decide whether a table order may close while it still has PENDING lines. The architectural recommendation is to reject close and require staff to fire or void those lines first.

### 7.5 Refund transition

A refund should create an immutable Refund record, preserve the original Tender records, write the audit evidence, and transition the order to REFUNDED in one transaction. It is allowed only while the order's BusinessDay remains open.

**Product decision required:** Specify whether a refund must reverse the original tender mix or whether the manager chooses how the money is returned. End-of-day tender reporting depends on this decision.

### 7.6 Business-day transition

End-of-day close must lock the current BusinessDay, prevent concurrent order creation, verify that no OPEN orders remain, calculate the report from stored order facts, store an immutable BusinessDayReport, close the day, and open the next day in one transaction.

Order creation and end-of-day close must acquire the same database lock. Without that coordination, an order could be created between the open-order check and the day close.

## 8. Authentication and authorization

Use short-lived opaque server sessions stored in secure, HTTP-only, same-site cookies. JWTs are unnecessary because there is one server authority and immediate session expiry matters.

Every mutating command obtains its actor from the server-side session. The server enforces the permission matrix; hidden UI controls are only a usability feature.

Manager approval must be part of the protected command itself. The request includes the manager identity and PIN plus any required reason. The server verifies the manager, applies the action, and writes the audit evidence in one transaction. It must not issue a reusable approval token or extend manager authority into the actor session.

PINs must:

- Cross the LAN only through HTTPS.
- Be hashed using Argon2id.
- Never be included in request logs, audit entries, errors, metrics, analytics, traces, or crash reports.
- Be discarded immediately after verification.

There is a behavioral conflict in PIN-only authentication: after an incorrect PIN, the server does not know which user should receive the failed attempt and lockout.

**Product decision required:** Choose one of these models:

1. Select staff identity and then enter the PIN. This is the architectural recommendation and permits correct per-user lockout.
2. Retain PIN-only login and redefine failed-attempt throttling as terminal-based rather than per-user.

**Product decision required:** Approve PIN length, uniqueness, retry threshold, cooldown, actor-session idle timeout, and explicit-release behavior before Phase 0.

**Product decision required:** Approve one role matrix. The documents conflict over whether waiters take payment and whether the kitchen role uses a screen to view or reprint tickets.

## 9. Transaction and concurrency strategy

Every state-changing command should execute in one database transaction. Sensitive commands must lock the aggregate rows they validate.

Each Order has a monotonically increasing version. A client command includes the version it observed. The server locks the order, checks the version and current state, then either commits or returns a conflict containing the latest order.

Use idempotency keys for:

- Opening an order
- Firing
- Settling and closing
- Whole-order void
- Fired-line void
- Refund
- End-of-day close

The same actor, command type, subject, and idempotency key return the original committed result. A reprint is intentionally a new physical attempt and therefore uses its own request identity without creating a new business document.

Recommended database invariants include:

- At most one OPEN order per DiningTable.
- Exactly one open BusinessDay.
- At most one OrderDiscount per Order.
- A quick-sale Order has no DiningTable; a table Order has one.
- Receipt numbers are unique.
- KitchenTicket sequence is unique within an Order.
- An OrderLine belongs to at most one original KitchenTicket.
- Money amounts and quantities respect approved bounds.
- The application database role cannot update or delete AuditEntry or closed BusinessDayReport rows.

The PRD permits last-write-wins for concurrent order edits.

**Architect recommendation:** Limit that behavior to harmless mutable details on PENDING lines, and define “last” as the last command successfully serialized by the database. Never apply blind last-write-wins to fire, settlement, tender, discount, void, refund, receipt allocation, or business-day close.

**Product decision required:** Approve this qualified interpretation of last-write-wins. Literal whole-order last-write-wins can duplicate kitchen work, lose lines, or overwrite financial transitions.

## 10. Receipt numbering

**Architect recommendation:** Use one location-wide monotonically increasing receipt number allocated inside the order-close transaction.

The close transaction locks the singleton ReceiptSeries row, takes the next number, advances it, creates the Receipt, and commits. A rolled-back close consumes no committed number. A printer failure does not release or reuse a number.

A receipt reprint uses the original Receipt and number. The reprint may be visibly marked as a reprint, but its monetary figures and business facts remain identical.

Formatting such as a prefix, zero-padding, year, or displayed business-day label is separate from the underlying unique integer.

**Product decision required:** Confirm whether the target jurisdiction requires gapless numbering, daily resets, fiscal-device numbers, refund receipt numbers, specific prefixes, or a visible reprint label.

## 11. Monetary and tax calculation rules

There must be one server-side calculation policy used by order preview, close, receipt, refund, and reporting.

All money is integer minor units. Rates should be stored as exact fixed-scale integers, such as parts per million, rather than floating point. Percentage-discount rates use the same exact representation. Intermediate multiplication must use an integer type large enough to avoid overflow.

For each order:

1. Subtotal is the sum of non-voided line totals using resolved price snapshots and integer quantities.
2. A percentage or fixed discount is calculated and rounded half-up once.
3. Discounted subtotal D equals subtotal minus discount.
4. Included tax equals D multiplied by the tax rate and divided by one plus the tax rate, rounded half-up once. It is displayed but never added.
5. Service charge equals D multiplied by the service-charge rate, rounded half-up once.
6. Total equals D plus service charge.

Tax is calculated once at order level, never summed from line tax. Reports sum finalized stored order figures and do not recompute historical orders with current settings or newer calculation code.

At close, store subtotal, discount, discounted subtotal, included tax, service charge, total, calculation-policy version, and settings version. This makes receipts, refunds, reports, and future migrations reproducible.

**Product decision required:** Define:

- Minimum and maximum percentage discount
- Whether a fixed discount is capped at subtotal
- Whether zero-total orders may close
- Allowed quantity range and whether quantities are whole numbers only
- Whether a negative variant delta is permitted
- Maximum line, order, tender, and change amounts
- Rate input precision

The architectural recommendation is to prevent a negative discounted subtotal or negative total, allow only positive whole-number quantities in the MVP, and cap fixed discounts at the subtotal.

**Product decision required:** Confirm the service-charge base. The current requirement uses the tax-inclusive discounted subtotal. Any alternative changes every affected total.

**Product decision required:** Confirm that tip capture remains excluded before settlement implementation begins.

## 12. Audit-history strategy

Audit evidence must be inserted in the same transaction as the action it describes. An asynchronous audit event would permit the domain change to commit without its required history.

Each AuditEntry should contain:

- Specific initiating actor
- Optional manager approver
- Action type
- Subject type and identifier
- Order and business-day references where applicable
- Required reason
- Structured before and after monetary facts
- Server timestamp
- Terminal identifier
- Correlation and idempotency identifiers

The application database role should have INSERT and SELECT, but not UPDATE or DELETE, permission on the audit table. Schema migrations use a separate database-owner role. Audit views must not hide entries through soft deletion.

**Architect recommendation:** Record one committed-action audit entry containing both actor and approver for an approved void, refund, or free-form discount. This answers who initiated and who approved without creating duplicate business-action entries.

**Product decision required:** The acceptance language can also be read as requiring one approval entry plus one action entry. Confirm whether a manager-approved action produces one combined entry or two linked entries, and whether cancelled or failed approval attempts are audited.

## 13. Printing and error recovery

Printing should use a database-backed outbox handled by a small dispatcher inside the monolith:

1. The business transaction creates an immutable KitchenTicket or Receipt and a pending PrintJob.
2. The transaction commits without contacting the printer.
3. The dispatcher claims the job and records that delivery has started.
4. It sends the immutable bytes or rendered document to the configured printer.
5. It records PRINTED, FAILED, or UNKNOWN.

FAILED means the system knows delivery did not occur. UNKNOWN means a timeout or process failure happened after delivery may have begun.

Basic ESC/POS printers do not provide a reliable end-to-end idempotency key. If the printer receives a ticket but the server crashes before recording success, automatic retry can duplicate food.

**Architect recommendation:** Automatically attempt a kitchen ticket once. Do not automatically retry UNKNOWN kitchen delivery. Show “delivery uncertain; check the printer before reprinting.” An operator-requested reprint creates a new PrintAttempt but not a new KitchenTicket or fire sequence.

Definite failures and all receipt failures remain visible with an explicit reprint action. A printer error never rolls back or blocks the already-valid business transition.

Other recovery rules are:

- Open orders and print jobs survive browser and application restarts in PostgreSQL.
- A job left in the dispatching state after a crash becomes UNKNOWN during recovery.
- Retried HTTP commands use idempotency keys and return the original result.
- Authorization, validation, conflict, or database failures roll back the whole command.
- Error responses use stable machine-readable codes and never expose PINs, SQL text, stack traces, or internal credentials.
- A database outage blocks new writes explicitly; the browser must not pretend that an order, fire, payment, or approval succeeded.
- Backups, restore procedures, and schema migrations must be tested before production use.

**Product decision required:** Confirm the operator workflow and wording for UNKNOWN kitchen delivery.

**Product decision required:** Decide whether voiding a fired line or fired order prints a kitchen cancellation ticket. The original paper cannot otherwise inform the kitchen of the cancellation.

## 14. API boundary

The API should expose explicit commands and read models rather than generic status mutation.

Representative areas are:

| Area | Boundary |
|---|---|
| Authentication | Create, inspect, and release actor session |
| Catalog | Read active menu and tables; manager configuration commands |
| Orders | Create, retrieve, and list; add/edit/void PENDING lines |
| Discounts | Apply, replace, or remove the single order discount |
| Kitchen | Fire PENDING lines; inspect ticket status; request reprint |
| Settlement | Preview authoritative totals; atomically settle and close |
| Voids and refunds | Explicit void and refund commands with their own preconditions |
| Receipts | Retrieve immutable receipt; request reprint |
| Business day | Inspect current day, preview close, commit close, retrieve report |
| Audit | Manager-only filtered reads |
| Printing | Inspect delivery status and request an explicit retry or reprint |

Mutation requests include an idempotency key and expected aggregate version. Responses contain the authoritative updated state plus structured warnings, such as print failure or delivery uncertainty.

Do not expose a generic “set status” endpoint. Void and refund must remain different commands, and only the server may derive CLOSED, VOIDED, or REFUNDED.

## 15. Testing strategy

Testing should follow the risk profile rather than relying mainly on UI happy paths.

### 15.1 Unit tests

- Money arithmetic and half-up rounding
- Worked monetary example from the PRD
- Discount boundaries
- Tender and change rules
- Order, line, print, and business-day state-transition tables
- Role and approval matrix
- Receipt and report snapshot construction

Property-based tests should cover rate and amount boundaries, overflow, split-tender combinations, exact-settlement invariants, and the rule that included tax never increases the total.

### 15.2 Database integration tests

Use real PostgreSQL, not an in-memory substitute, to test:

- Partial unique indexes
- Row locking and transaction isolation
- Simultaneous open-order attempts on one table
- Simultaneous fire and close commands
- Duplicate idempotency keys
- Refund races
- New-order versus end-of-day-close races
- Transaction rollback on approval or validation failure
- Audit and closed-report immutability permissions

### 15.3 End-to-end tests

Automate AC-1 through AC-18 through the browser against the real server and PostgreSQL. Include multiple browser contexts representing different terminals and users.

Use an ESC/POS TCP emulator that captures output as test artifacts. Tests should verify that a second fire contains only new lines and that a reprint does not create a second fire.

### 15.4 Failure and operational tests

- Printer refused connection
- Printer timeout with uncertain delivery
- Application crash immediately after business commit
- Application restart with pending or dispatching jobs
- PostgreSQL restart
- Terminal refresh or close during an open order
- Log and error scan proving that no PIN appears
- Backup creation and restore
- Forward schema migration against representative data
- Hardware smoke tests against the actual printer model early in Phase 3

**Architect recommendation:** Treat the four-document acceptance criteria and boundaries as executable test traceability. Each sensitive command should identify the requirement and boundary tests that protect it.

## 16. Future offline-mode implications

The MVP already works without internet. Future offline mode would mean a terminal continues to take orders while disconnected from the restaurant's LAN server.

**Deferred beyond MVP:** Do not implement a terminal database, synchronization engine, conflict resolver, or offline credentials in the MVP.

Low-cost choices that prepare without building offline behavior are:

- UUID identifiers that a future terminal can generate safely
- Command-oriented APIs
- Idempotency keys
- Explicit aggregate versions
- Immutable price, settings, receipt, and report snapshots
- No direct client access to database tables

Real offline support would require:

- A durable local database on every terminal
- A command or event synchronization protocol
- A conflict ledger and operator resolution workflow
- Secure cached credentials with delayed revocation semantics
- Terminal-specific or preallocated receipt-number ranges
- Rules preventing two disconnected terminals from claiming the same table
- Idempotent reconciliation of fire, tender, close, and refund commands
- Menu and settings version synchronization
- Local printer routing
- A rule that end-of-day close waits for every terminal to synchronize, or a substantially more complex partitioned-close model

Last-write-wins would be unacceptable for offline fired lines, tenders, and receipts. Supporting offline operation changes where authority lives and requires a separate product and architecture design cycle.

## 17. Risks and mitigations

| Risk | Impact | Proposed mitigation | Label |
|---|---|---|---|
| ESC/POS cannot guarantee exactly-once paper delivery | Duplicate or missing kitchen work | At-most-one automatic attempt, UNKNOWN state, operator-controlled reprint | Architect recommendation |
| PIN-only login cannot identify a user after a wrong PIN | Per-user lockout cannot work as written | Select user before PIN or change lockout semantics | Product decision required |
| Literal last-write-wins overwrites sensitive state | Lost lines, duplicate food, or financial corruption | Versioned commands and row locks for sensitive transitions | Architect recommendation |
| Persisted partial tenders lack correction rules | Stranded or incorrect money records | Commit tenders only as part of close | Architect recommendation |
| Refund method is undefined | Incorrect tender reports and unclear cash handling | Add Refund record and approve tender disposition | Product decision required |
| Report formulas are underspecified | End-of-day disputes | Approve gross/net and count definitions before Phase 5 | Product decision required |
| Settings edits can change open orders | Non-reproducible totals | Immutable settings versions captured by order | Architect recommendation |
| Receipt rules may be jurisdiction-specific | Legal or operational non-compliance | Confirm target jurisdiction and receipt rules before Phase 4 | Product decision required |
| One appliance is a single point of failure | Restaurant cannot write new orders during failure | UPS, monitoring, tested backups, documented replacement procedure | Architect recommendation |
| Team unfamiliarity with the proposed stack | Slower delivery and maintenance risk | Confirm team capability before implementation | Product decision required |
| Management screens are replaced with seed files | Routine changes require technical intervention | Keep manager UI because BOUNDARIES.md requires editable configuration | Architect recommendation |
| Offline behavior is assumed to be a browser-cache feature | Conflicting orders and unreconciled money | Treat offline operation as a new architecture program | Deferred beyond MVP |

## 18. Rejected alternatives

### 18.1 Microservices

Rejected for the MVP. There is one location, one database authority, single-digit concurrency, and no independent scaling need. Microservices would introduce distributed transactions, service discovery, deployment coordination, and more failure modes without solving an approved requirement.

### 18.2 Cloud-hosted core

Rejected for the MVP. The restaurant is explicitly expected to have unreliable internet. Cloud reporting or backup may be considered later, but core order, payment, and printing paths must remain local.

### 18.3 SQLite as the production database

Rejected despite its attractive single-file deployment. PostgreSQL provides clearer concurrent transaction behavior, row-level locks, partial unique indexes, role-based immutability controls, and operational headroom for multi-terminal fire, close, refund, and end-of-day races. SQLite may still be used by isolated tools, but not as a substitute in automated integration tests.

### 18.4 Event sourcing

Rejected for the MVP. Immutable snapshots plus an append-only audit table satisfy the requirements with much less modeling and projection complexity. Audit history is not a mandate to rebuild all current state from events.

### 18.5 External message broker

Rejected for the MVP. A PostgreSQL-backed print outbox is durable, transactional, and sufficient for one application instance and a small printer count.

### 18.6 Direct browser printing

Rejected. Browser printing is inconsistent, hard to recover, difficult to audit, and couples terminal availability to printer access. Server-side print jobs provide one durable record and consistent ESC/POS output.

### 18.7 Persisting each partial tender immediately

Rejected as the default proposal. It creates unanswered workflows for correcting a tender, changing the order after payment starts, abandoning payment, and handling restarts. It should be added only if the product owner explicitly requires staged payment persistence.

### 18.8 Automatic retry until a kitchen print succeeds

Rejected. A network timeout may occur after the printer has accepted the bytes. Blind retry can produce duplicate food and violate the “tell the kitchen once” boundary.

### 18.9 Generic resource replacement and unrestricted last-write-wins

Rejected for sensitive data. A stale browser must not replace a newer order containing fired lines or payment state. Explicit commands with transaction-time validation are safer and no more operationally complex.

### 18.10 Native desktop applications for every terminal

Rejected for the MVP. A browser client centralizes deployment and updates. A native shell becomes relevant only if future offline storage or device integration demonstrates a need.

## 19. Proposed architecture decision records

These ADRs are proposed because each records a consequential trade-off that would otherwise be surprising or expensive to reverse.

### ADR-001: LAN modular monolith

**Status:** Proposed  
**Deciders:** Product owner and technical lead

**Context:** The MVP has one location, one write authority, single-digit terminals, and several operations that must commit atomically.

**Decision:** Deploy one modular application and one PostgreSQL database on a restaurant LAN appliance.

**Options considered:** Modular monolith, microservices, and cloud-hosted services.

**Consequences:** Development, deployment, and transactions remain simple. The appliance is a deliberate single point of operation and requires recovery planning.

### ADR-002: PostgreSQL as sole operational authority

**Status:** Proposed  
**Deciders:** Technical lead

**Context:** Concurrent fire, settlement, table allocation, refund, and end-of-day operations require reliable locking and constraints.

**Decision:** PostgreSQL is authoritative; browsers, cached reads, and paper are projections.

**Options considered:** PostgreSQL, SQLite, and client-owned state.

**Consequences:** The application gains strong invariants and predictable concurrency at the cost of running a database service.

### ADR-003: Versioned command concurrency

**Status:** Proposed  
**Deciders:** Product owner and technical lead

**Context:** The PRD permits last-write-wins, but unrestricted use can overwrite irreversible state.

**Decision:** Use aggregate versions, idempotency keys, row locks, and command preconditions. Limit last-write-wins to harmless PENDING-line details.

**Options considered:** Whole-resource last-write-wins, optimistic version checks, and pessimistic terminal ownership.

**Consequences:** Users may occasionally resolve a clear conflict, but food and money transitions cannot be silently overwritten.

### ADR-004: Versioned exact monetary policy

**Status:** Proposed  
**Deciders:** Product owner and technical lead

**Context:** Historical totals must remain reproducible after rates, configuration, or code change.

**Decision:** Use integer minor units, exact fixed-scale rates, centralized half-up calculation, settings snapshots, and a calculation-policy version.

**Options considered:** Floating-point calculation, live configuration lookup, and immutable order snapshots.

**Consequences:** Calculations remain explainable and stable. API serialization and tests must explicitly support integer values.

### ADR-005: Transactional print outbox with uncertain-delivery state

**Status:** Proposed  
**Deciders:** Product owner and technical lead

**Context:** Printing cannot block transitions, while kitchen duplicates are costly and basic printers do not offer exactly-once acknowledgement.

**Decision:** Persist business state and PrintJob atomically, print after commit, and do not automatically retry ambiguous kitchen delivery.

**Options considered:** Synchronous printing, automatic retry, external broker, and database-backed dispatch.

**Consequences:** Sales continue during printer faults. Staff need a clear warning and manual reprint workflow for uncertain delivery.

### ADR-006: Transactional receipt numbering

**Status:** Proposed  
**Deciders:** Product owner and technical lead

**Context:** Concurrent closes must never allocate the same receipt number, and reprints must remain stable.

**Decision:** Allocate one location-wide number from a locked ReceiptSeries inside the close transaction.

**Options considered:** Database sequence, business-day-local counters, random identifiers, and locked transactional counter.

**Consequences:** Committed receipts are unique and stable. Jurisdiction-specific fiscal requirements may supersede this decision.

### ADR-007: Audit within the business transaction

**Status:** Proposed  
**Deciders:** Product owner and technical lead

**Context:** A protected action without its required audit evidence would violate a hard boundary.

**Decision:** Insert audit evidence in the same transaction and deny update/delete privileges to the application role.

**Options considered:** Synchronous transactional insert, asynchronous event consumption, and mutable activity logs.

**Consequences:** Audit completeness is strongly coupled to action success. Audit schema changes require careful migration under a separate database role.

## 20. Questions requiring product-owner approval

The following decisions should be approved before the listed phase begins.

### Before Phase 0 — identity and foundations

1. Should login require selecting a staff identity before PIN entry, or should failed-PIN throttling be terminal-based?
2. What PIN length, retry threshold, cooldown, uniqueness policy, and session idle timeout apply?
3. May waiters take payment?
4. Does the kitchen role interact with a screen for ticket viewing and reprinting?
5. Does an approved action create one combined actor-and-approver audit entry or separate approval and action entries?
6. Are cancelled and failed manager-approval attempts audited?
7. Is the recommended TypeScript, Node.js, React, and PostgreSQL stack acceptable to the implementation team?

### Before Phase 2 — order capture and totals

8. Are currency and precision permanently locked after the first order?
9. Do tax and service-charge changes affect only newly opened orders?
10. What are the allowed discount, quantity, rate, line-total, order-total, tender, and change bounds?
11. Can an applied discount be removed or replaced, and what approval and audit rules apply?
12. May a table order close with PENDING lines?
13. Is the current tax-inclusive discounted subtotal definitely the service-charge base?

### Before Phase 3 — kitchen firing

14. Should a fired-line or fired-order void print a kitchen cancellation ticket?
15. Is the proposed UNKNOWN print-delivery warning and operator-controlled reprint workflow acceptable?

### Before Phase 4 — settlement and refund

16. Must partial tenders persist before close, or may the system commit the complete tender plan atomically?
17. If partial tenders persist, how is a mistaken or abandoned tender corrected?
18. Is tip capture definitely excluded?
19. Must a refund reverse the original tender mix, or may the manager choose another refund method?
20. Can a CLOSED order be reopened, or is refund-and-re-ring the only correction?
21. What business fields, footer, logo, numbering rules, refund documents, reprint marks, and jurisdictional fields must receipts contain?

### Before Phase 5 — business day and reporting

22. Are total sales and tender breakdowns reported gross or net of same-day refunds?
23. Does order count include refunded orders?
24. How are void amount and void count defined?
25. Does a refunded order's original discount remain in discounts given?
26. What is the approved process for a legitimate correction after a business day has closed?

## 21. Deferred beyond MVP

The following architecture-changing capabilities remain explicitly deferred:

- Terminal operation while disconnected from the LAN server
- Multi-location synchronization and consolidated reporting
- External payment-terminal or gateway integration
- Partial and line-item refunds
- Bill splitting by guest
- Inventory and automatic availability
- Kitchen display systems
- Jurisdiction-specific tax engines and fiscal devices
- Customer accounts and loyalty
- Event streaming, distributed services, and horizontal scaling

They should not be anticipated through unused infrastructure in the MVP. Each should enter through a new product decision and, where appropriate, a dedicated ADR.

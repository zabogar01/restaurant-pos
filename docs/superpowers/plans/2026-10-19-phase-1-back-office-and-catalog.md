# Phase 1 — Back office and catalog: the slicing plan

> **Status: Proposed, 2026-10-19.** Written by `architect17` (ARCH-017) for the owner's acceptance. **No Phase 1 task
> is dispatched until the owner accepts this plan.**
>
> **This is a slicing document, not a build script.** It holds no SQL, no code and no test bodies. It says what Phase 1
> delivers, in which slices and in what order, what each slice waits on, which slices need an ADR or an architect
> consult before their task file is written, and the Phase 1 Definition of Done. The lead writes the task files one at
> a time, each from this plan, the consult or ADR the slice names, and the previous task's Handoff, as in Phase 0. Where
> a later consult, ADR or Handoff differs from this plan, they win and this plan is the stale one.
>
> **Authority.** `docs/PRODUCT.md`, `docs/PRD.md`, `docs/ROADMAP.md` and `docs/BOUNDARIES.md` are the contract;
> `docs/ARCHITECTURE.md` and the ten accepted ADRs (001 to 007, 009 to 011) bind; `.agent/DECISIONS.md` holds the
> owner's rulings. Nothing here changes any of them. Where this plan finds the contract silent or wrong, it states the
> question in section 8 and does not assume the answer; the proposed wording is in ARCH-017's Handoff.
>
> **How to read the marks.** *Decided* means a contract document, an accepted ADR or a DECISIONS line says so, and the
> source is named. *Recommended* is this architect's proposal, which a consult, an ADR or the owner may overturn.
> *Owner question* points to section 8.

## 1. Scope

### 1.1 ROADMAP Phase 1, item by item

ROADMAP's Phase 1 (`docs/ROADMAP.md:60-81`) reads: "Everything a manager sets up before a single order exists. All of
it lives in the back-office client." Each bullet, with what the PRD and the screen inventory say about it and the slice
(section 3) that owns it:

| ROADMAP bullet | PRD | Screens | What the check found | Slice |
|---|---|---|---|---|
| Desktop back-office navigation and dense management layouts | NFR-5; PRODUCT "Two clients" | SITEMAP §3 chrome; BO-02 frame (DESIGN-015) | The Phase 0 frame has an empty rail (`apps/back-office/src/OfficeApp.tsx`). The rail gains an entry per destination that exists, and the first dense table arrives with the first list | S1 |
| Settings: currency and minor-unit precision, tax rate, service charge rate, business details, versioned (FR-B1) | FR-B1, FR-M1, FR-M5; §4 | BO-08 | Currency and precision are FR-B1 settings but the installation is fixed at IDR and 0 (PRD §4, §9; DECISIONS 2026-09-10): owner question Q5. Which business details exist is PRD §9 question 1: owner question Q12. The rate range is already ruled (Q2) | S2 |
| Categories, items, variants, modifiers, prices (FR-B4, C1–C4) | FR-B4, FR-C1 to C4, FR-C8 (archive half) | BO-03, BO-04 | Consistent | S4 |
| 86 toggle (FR-B6, C5) | FR-B6, FR-C5, FR-G13 (Phase 4 half) | BO-03 row action | Consistent. FR-G13's rejection against a leased quick-sale order needs a lease, which is Phase 4 | S5 |
| Tables, with deactivation blocked while an order is open (FR-B2, C8) | FR-B2, FR-C8 | BO-05 | **No order can exist in Phase 1**, so the refusal cannot be exercised; see gap G1 | S1 |
| Discount presets (FR-B5) | FR-B5, FR-F5, FR-M5, FR-C7 (presets advance the catalog version) | BO-07 | Consistent | S6 |
| Users, including a manager's back-office username and password; deactivation or a reset invalidates every session (FR-B3) | FR-B3, FR-A1, A3, A4; ADR-009 | BO-06 | The inventory and the sitemap name PIN operations only; neither names the username and password, the own-password change, or ADR-009's warning that a reset ends every session (gap G5). ADR-009's three open items block it (Q1) | S8 |
| Catalog-revision propagation into the POS client, two-second poll (FR-C6) | FR-C6; ARCHITECTURE §4.3 | POS-03 menu, M-2 | The POS menu is fixtures today (`apps/pos/src/menuFixtures.ts`). The "empty menu" state the POS meets on a fresh installation is not drawn (gap G6) | S7 |
| Catalog-version handling and `CATALOG_CHANGED` rejection (FR-C7) | FR-C7; ARCHITECTURE §4.3, §8, §13 | POS-03 *CATALOG_CHANGED* | **No POS command exists in Phase 1**, so a POS command cannot be rejected; see gap G2 | S4 |

ROADMAP's acceptance line, "**AC-12, AC-31, AC-32** pass here", and its *Demonstrable* line:

| Item | Slice that proves it | What Phase 1 can prove |
|---|---|---|
| *Demonstrable:* a real menu is loaded in the back office and browsable at the POS; an 86 reaches the other client within three seconds | S7 | All of it, in the browser harness with two profiles. The 86 control exists only in the back office (BO-03 *Must not invent*), so "one client" is the back office and "the other" the POS |
| AC-12 | S7 | The propagation and the presentation: disabled in place within three seconds, the open dialog keeping its choices with Add disabled. **Not** "adding and firing independently reject unavailable items": the add-line command is Phase 2 and fire is Phase 3 (gap G3) |
| AC-31 | S4, for the part Phase 1 can prove | Every catalog change advances the catalog version, and a stale catalog command is refused with nothing written. **Not** "a POS command … no line is added at the stale price": there is no POS command and no line until Phase 2 (gap G2) |
| AC-32 | S8, first sentence | Deactivating a user ends that user's sessions, POS and back office, on their next authenticated request. **Not** the second sentence, "deactivating a table holding an open order is rejected": no order exists until Phase 2 (gap G1) |

### 1.2 Gaps found, in both directions

**G1 — FR-C8's table refusal cannot be exercised in Phase 1.** There is no order table and no command that opens an
order until Phase 2 (ROADMAP Phase 2, FR-D1). A table deactivation in Phase 1 is never wrong, because no table can hold
an open order. *Recommended:* S1 builds deactivation and states, for Phase 2, the lock both commands take (the
DiningTable row, so a deactivation and an order opening on the same table serialise); the refusal itself and AC-32's
second sentence are built and proved with Phase 2's open-order command, in the same task that creates the order table.
This is a ROADMAP change: owner question Q13.

**G2 — AC-31 and FR-C7's rejection need a POS command, and the first is Phase 2's.** ADR-010 rule 1 adds a further
constraint: "a code enters that list in the task that first emits it and tests it; a code with no emitter is an
untested promise." `CATALOG_CHANGED` cannot enter `packages/contracts` in Phase 1 unless a Phase 1 command emits it.
Whether back-office catalog commands carry an expected version, and so whether they are that emitter, is the ADR's
question (section 7, ADR-012): ARCHITECTURE §17.9 rejects blind last-write-wins for "catalog-sensitive" state, which
argues that they should. Either way, AC-31 as worded passes only with Phase 2's add-line command. Owner question Q13.

**G3 — AC-12's last sentence is Phase 2's and Phase 3's.** "Adding and firing independently reject unavailable items"
needs the add-line command (Phase 2) and the fire command (Phase 3, FR-E4). Owner question Q13.

**G4 — FR-C6 appears in two phases.** Phase 1 has "Catalog-revision propagation into the POS client, two-second poll
(FR-C6)" and Phase 3 has "Two-second availability polling, three-second AC-12 budget (FR-C6)". They describe one
mechanism. *Recommended:* Phase 3's line becomes the fire-time revalidation (FR-C6's last sentence, FR-E4), which is
what Phase 3 actually adds. Owner question Q13.

**G5 — BO-06 in the inventory and the sitemap predates ADR-009.** `docs/design/SCREEN-INVENTORY.md` BO-06 says
"create, assign role, set and reset PIN, deactivate", and `docs/design/SITEMAP.md` BO-06 lists the same. FR-B3 (owner,
2026-10-07) adds setting and resetting a manager's username and password and the own-password exception, and ADR-009's
*Consequences* says "the users screen must say so before the reset is confirmed". The designer's slice E2 must add
them (section 4). This is a design-document gap, not a contract gap.

**G6 — the POS has no drawn state for an empty or unreachable catalog.** POS-03's states include *loading — catalog
fetch* but not "the menu has no items yet", which is the state a new installation starts in (B-24), nor a catalog read
that failed while an order is on screen. A POS design addition is needed before S7's client task (section 4).

**G7 — FR-B7 (tender types) is in the PRD and in no ROADMAP phase.** `docs/PRD.md:137` defines it; the sitemap puts
custom payment methods on BO-08 (`SITEMAP.md` BO-08, ruling I-9) and DESIGN-011's slice F draws them with settings.
ROADMAP Phase 4's "Tender types including custom named methods (FR-G1)" is the tender model, which uses them, not their
configuration. *Recommended:* Phase 1, as slice S3. Owner question Q4.

**G8 — the PRD's open-question list is stale on rates.** PRD §9 question 3 still lists the permitted rate range as
open, ARCHITECTURE §16 and §19 item 3 call it "unresolved", and ADR-004's last consequence says the owner must still set
it. The owner ruled on 2026-10-06 that no permitted range is needed (DECISIONS). Phase 1 is bound by the ruling; the
documents need the stale lines closed (wording in ARCH-017's Handoff). ARCHITECTURE §19 items 1 (time zone, ruled
2026-09-24 and 2026-10-06) and 5 (kitchen-ticket reprint audit, ruled I-8, now FR-J3) are stale the same way.

**G9 — the screen inventory's BO-08 calls the rate range "Open Question 4"** and tells the designer it is not theirs to
settle. Since the 2026-10-06 ruling the range is settled (no range), and the designer needs that before slice F. The
sentence is the designer's to correct.

**G10 — FR-B3 reads as if a username could be reset.** FR-B3 says "set and reset a manager's back-office username and
password". ADR-009 §2 and §3 make a username unchangeable and never reusable, and the application role has no `UPDATE`
on it (`0007`). The only reading consistent with the accepted ADR is "set the username and password; reset the
password". S8 builds that reading; the wording that says it is in ARCH-017's Handoff, with Q1.

No gap found the other way: every PRD requirement that section B and C place in the back office is either in a slice
below or in the table that follows.

### 1.3 Not Phase 1

| Item | Belongs to | Why |
|---|---|---|
| Server add-line with availability revalidation; `CATALOG_CHANGED` on a POS command (AC-31); AC-12's add rejection | Phase 2 | The order and line model is Phase 2 (FR-D1 to D5) |
| The table-deactivation refusal (FR-C8) and AC-32's second sentence | Phase 2 | G1 |
| `SettingsVersion` captured when an order opens; currency and precision immutable after the first order (FR-B1, FR-M1) | Phase 2 | ROADMAP Phase 2 lists it; it needs an order. Q5 may make the immutability rule moot |
| Archiving or changing an item or preset never alters an order snapshot (FR-C8 second sentence, B-8, AC-17) | Phase 2 (snapshots), Phase 6 (AC-17's integration proof) | No snapshot exists in Phase 1 |
| Applying a preset at the POS, the free-form gate (FR-F1 to F8) | Phase 2 | ROADMAP Phase 2 |
| AC-12's fire rejection (FR-E4) and the fire-time revalidation | Phase 3 | G3, G4 |
| A back-office 86 refused against a leased quick-sale order (FR-G13, AC-29) | Phase 4 | Needs the CheckoutLease. S5 leaves the lock order that Phase 4 needs (section 3, S5) |
| Tendering with the configured tender types (FR-G1) | Phase 4 | ROADMAP Phase 4 |
| BO-02's business day, open orders and incidents | Phase 3 (incidents), Phase 5 (business day) | Section 4 |
| End of day, reports, the audit viewer (BO-09 to BO-12), BO-13 | Phases 3 and 5 | ROADMAP |
| The approval items: AC-27's second sentence, AC-19's approval class through a route, M-1 for real, the idempotency design, ARCH-013's owner items 2 and 3 | Phase 2 | No Phase 1 command is approval-gated or among ARCHITECTURE §8's seven idempotent commands. None needs to move earlier (section 5) |
| ADR-008 (database roles and structural immutability) | Deferred by the owner (2026-10-06) | Phase 1 can be built safely without it: section 7 says why |

One heads-up for the Phase 2 plan, not a Phase 1 item: Phase 2's open-order command needs a settings version to
capture, which S2 makes exist, and a business day to belong to (FR-I1), which ROADMAP places in Phase 5. The Phase 2
plan has to resolve that ordering; Phase 1 does not.

## 2. What exists to build on

Read from the code and the Handoffs at `development` `82876b4`, not from the Phase 0 plan, whose code and SQL are
superseded.

**Database (`db/migrations/0001` to `0008`).** `staff_user` (name, role `CASHIER` or `MANAGER`, `pin_hash` and
`pin_lookup` both `NOT NULL`, `is_active`, `credential_version`; the PIN lookup unique among active rows since `0006`);
`back_office_credential` (lower-case username unique and never reusable, password hash, the per-account throttle; the
application role may update only the hash and the throttle columns and may delete nothing); `client_instance`;
`actor_session` (token hash, audience, credential version, activity and absolute stamps, release); `audit_entry` and
`security_event` (append-only, trigger-protected; `actor_id NOT NULL`); `pin_throttle_bucket` (the two seeded rows, the
only seeded data). The application connects as `pos_app`; grants are written in the migration that creates each table;
`apps/server/test/schema.test.ts` holds the complete privilege set for `pos_app` table by table and fails on a table it
does not name, and `harness-race.test.ts` holds the exact table list. No column is `real`, `double precision`,
`numeric` or `money` (schema case 14).

**Domain (`apps/server/src/domain/`).** `createStaffUser` (cashier or manager, with a PIN) and
`createBackOfficeCredential` exist; no function changes a role, sets or resets a PIN or a password, deactivates or
reactivates. The session's validity already requires an active user whose credential version equals the session's
(`session.ts`), so a deactivation or a version increment ends every session on its next authenticated request with no
new session code. `reauthenticateSession` renews one row for the user it names. The throttles, the audit and
security-event writers, and the approval primitive (unused by any production route) are built.

**HTTP (`apps/server/src/http/`).** One API context with the hooks `no-store`, origin refusal, client instance, session
guard; every route declares `config.access` and the server refuses to start on a missing or malformed declaration, an
audience off its surface, or a registration outside the context (ADR-011 rule 1). The back-office guard requires
`MANAGER` on every `ACTIVE` request. Validation is one zod helper that throws `VALIDATION_FAILED` with no details and
drops the issues (rule 9). The error envelope has no message field; the logger never sees a body, header or cookie, and
its redaction is a backstop over listed names only (ADR-010 rules 1 and 2). Ten routes exist: health and the two
surfaces' sign-in, `me`, `activity`, and release, logout or re-authentication.

**Contracts and the transport core.** `packages/contracts` holds the error codes (fifteen, each with an emitter), their
per-code details, the session views, the request schemas and `ROUTE_TABLE`, whose methods are `GET` and `POST` and
whose paths are all fixed strings. `packages/api-client` addresses a request by route-table entry and keys each
route's request and response specification by its path (`specs.ts`); a route added to the table fails to compile there
and in each client's API module until it is declared. `packages/money` has `Money` (`bigint`), the string codecs that
refuse a JSON number, `divHalfUp`, the `Rate` brand in parts per million with `rateFromPercent` and `rateFromPpm`, and
`formatMoney` with a precision argument.

**Back office (`apps/back-office/`).** BO-01 sign-in, the Phase 0 frame (top bar, empty rail, empty pane) and M-6. The
working area is keyed by the signed-in `staffUserId`, stays mounted and inert under M-6 and at BO-01 after an
announced change, and is destroyed by a confirmed logout, `FORBIDDEN`, a reload, or a sign-in as anyone else
(`OfficeApp.tsx`; ADR-011 rule 22). Phase 0 mounts no form in it.

**POS (`apps/pos/`).** POS-01 signs in for real; POS-02 to POS-07 are fixture screens and approval stand-ins under that
sign-in (owner, 2026-10-13). The menu region reads `menuFixtures.ts` and the item sheets `sheetFixtures.ts`; the 86
presentation (disabled in place, ruling C-3) and the open-sheet unavailable notice (FR-C6) are drawn from fixture
states selected by `?state=`. The client order store (`orderStore.ts`) adds, removes and requantifies lines without
checking the settlement lock, relying on the screen (ARCH-004).

**Browser harness (`e2e/`).** Its own database, port, lock and server; schema reset before every test; people made
through the domain functions with random credentials; both clocks moved together; requests made by the page;
assertions on state attributes, accessible names and codes; no artefact with a credential; a credential scan after
every test; Chromium and WebKit; outside `verify` (ADR-011 rules 27 and 28). It reads only error bodies, because a 2xx
sign-in body holds the anti-CSRF token (PHASE0-012b Handoff).

**The seams Phase 1 extends.**

1. *New tables and their grants*, each stated in its creating migration, each named in the privilege-equality test and
   the table list. The first immutable non-audit table (the settings versions) gets `SELECT` and `INSERT` only.
2. *`staff_user`*, loosened for kitchen staff who have no role and no PIN (owner, 2026-10-06: kitchen staff are user
   records), and the first domain functions that change a user and increment the credential version.
3. *The route declaration and the route table*, for the first configuration routes on both surfaces. The table has no
   way today to address one record (no path parameter, no query string); the first-form consult decides how (C2).
4. *`VALIDATION_FAILED` details*, left by ADR-011 to "the first form's consult".
5. *The back office's route manifest and rail*, and the first form inside the keyed working area.
6. *The POS's menu source*, from fixtures to the server's projection in served mode, chosen by the build-command constant
   that already chooses the session source (ADR-011 rule 23).
7. *The session module's re-stamp of the acting session*, which ADR-009 §5 says "is designed with the Phase 1 users
   screen".
8. *The harness*, for the first tests with two profiles of different clients acting on each other's data, and the
   first that read a 2xx body (in the page, never by the harness directly).

## 3. The slices, in order

A slice is something one task, or one task split in two or three, can make true and prove. Each names its goal, what it
closes, what it waits on, its `touches` flags (for the lead's review tier), whether it adds a browser test, its size,
and why it needs a consult or does not. Every task that touches a client, the transport core, the contracts, the HTTP
layer, the session or credential domain, or a migration runs the browser suite before merge (ADR-011 rule 27), so
"browser harness" below means "adds or changes a browser test".

### 3.0 Order

```
S0 housekeeping ─► S1 tables + first form (a server, b client) ─┬─► S2 settings ─► S3 tender types
                                                                │
           ADR-012 (written beside S0/S1, accepted before S2) ──┼─► S4 catalog (a, b, c) ─► S5 86 ─► S7 POS catalog (a, b)
                                                                │                   └────► S6 presets ──┘
                                                                └─► S8 users (a, b, c), when Q1, Q7–Q11 are answered and C3 is written
S9 POS-03 Release, S10 BO-01 from design slice B: independent, any time
```

The critical path to the *Demonstrable* is S1 (the pattern) → ADR-012 → S4 → S5 → S7. S8 is off that path but carries
AC-32, and it waits on the owner; the earlier the answers in section 8 arrive, the earlier it can run beside S4.

### S0 — Housekeeping before the first Phase 1 migration

- **Goal.** A clone or worktree in any directory reaches the one development database, and the server refuses to start
  against a database whose applied migrations differ from the files on disk.
- **Closes.** Two Phase 0 carry-forwards: the compose file's missing project `name:` (gate report, *The run*); no schema
  check at startup (gate report, *Known defects*). Phase 1 adds about eight migrations across parallel worktrees, which
  is when both bite.
- **Depends on.** Nothing.
- **Touches.** None of the four flags. The startup refusal is one more member of ADR-010 rule 2's closed set of startup
  errors, with a fixed sentence naming no value read from the environment.
- **Browser harness.** No new test; the harness's own server must still start after its schema reset, which proves the
  check accepts a fully migrated database.
- **Size.** One builder task.
- **Consult.** Not needed: no money, identity or audit, and both behaviours are lead rulings in the task file (what "differ"
  means: a migration on disk not applied, or applied and not on disk; the refusal before any socket, after the
  certificate check).

### S1 — Tables, the first back-office form, and the navigation

- **Goal.** A manager creates, edits and deactivates tables in BO-05, from the populated rail, through the first
  configuration routes; the pattern every later configuration slice copies is set here.
- **Closes.** ROADMAP bullets *desktop navigation and dense layouts* and *tables* (FR-B2; FR-C8 as far as G1 allows).
  The Phase 0 carry-forwards *AC-35's last sentence* (a real form, idled and resumed by the same manager, destroyed for
  another, in the browser) and *`VALIDATION_FAILED` details*.
- **Depends on.** S0; consult **C2**; design **E1** (BO-05) for S1b; owner question Q10 (reactivation of a table) only if
  the owner wants it in this slice.
- **Touches.** `boundaries` (FR-A2c route declarations on a new surface prefix; B-24, no seeded table; FR-A2b and the
  owner's 2026-10-05, 10-14 and 10-16 draft rulings, through AC-35), `identity` for S1b (the draft and M-6).
- **Browser harness.** S1b: yes. AC-35's last sentence closes here, in Chromium and WebKit, under rules 27 and 28.
- **Size.** Split. **S1a, server:** the table record, its grants, the domain commands, the routes, the details shape.
  **S1b, client:** the back-office route manifest and rail, the dense table, BO-05's list and form, unsaved-work
  departure, and AC-35 in the harness. S1b's builder records how long a `vite build --watch` reload takes against the
  real routes, which answers ADR-011's "faster development loop" question.
- **Consult C2 decides** (section 7): how a route addresses one record within ADR-011 rule 16; the details type of
  `VALIDATION_FAILED`, built as ADR-011 *Not decided here* requires (issue paths intersected with the schema's own keys,
  typed as a union of literals); what a configuration command returns (the authoritative record, per ARCHITECTURE §13);
  whether a list read is interactive; label uniqueness among active tables; the DiningTable lock that Phase 2's guard
  will share (G1); and how the client presents an unknown outcome without resending (ADR-011 rule 20; DESIGN-011 Q11).

### S2 — Settings versions

- **Goal.** A manager sets the tax rate, the service-charge rate and the business details; every change is a new
  immutable settings version, and the current one is unambiguous.
- **Closes.** ROADMAP bullet *settings* (FR-B1), except the capture at order opening (Phase 2).
- **Depends on.** **ADR-012** accepted; S1 (the pattern); design **F** (BO-08) for S2b; owner questions **Q5** (currency
  and precision), **Q3** (a non-zero service charge), **Q12** (which business details). Q2 is already answered by the
  owner: no permitted range (2026-10-06).
- **Touches.** `money` (rates in parts per million; B-1 at every layer, the rate typed as text and converted exactly by
  `packages/money`, never by a float), `boundaries` (B-8 and B-9: versions are never retroactive; B-24: no seeded
  settings row; FR-M5's rate precision).
- **Browser harness.** No new test expected; the suite runs.
- **Size.** Split: **S2a** server (the version table with `SELECT` and `INSERT` only, the domain, the routes); **S2b**
  BO-08's settings section.
- **Consult.** ADR-012 decides the mechanism (section 7). The task-level details (the column list once Q12 is answered,
  the refusals) come from ADR-012's consult section. The refusal for a rate under the owner's ruling is representational
  only: not a whole number of parts per million, negative, or typed with more decimal places of a percent than the
  design allows (DESIGN-011 Q6 proposes four).

### S3 — Tender types (if the owner places FR-B7 in Phase 1)

- **Goal.** A manager creates, renames and deactivates custom named tender methods beside cash and card, so that a
  cashier never types a tender name (B-24, FR-B7).
- **Closes.** FR-B7, which no ROADMAP phase holds today (G7).
- **Depends on.** Owner question **Q4**; S2b (the same screen); the C2 pattern; design **F** (BO-08's payment methods).
- **Touches.** `boundaries` (B-24; whether cash and card are fixed kinds or configuration rows).
- **Browser harness.** No.
- **Size.** One task, server and BO-08 section together, because the record is small.
- **Consult.** C2 covers the pattern. One question for C2: cash and card are fixed by FR-G1 and carry rules of their own
  (cash may exceed the balance; B-5), so they look like the throttle buckets (seeded because they are not restaurant
  configuration) rather than like a menu; *recommended:* fixed kinds that the application never creates, renames or
  deactivates, with only custom methods configurable, as FR-B7's "alongside cash and card" reads.

### S4 — The catalog and its version

- **Goal.** A manager builds the menu in BO-03 and BO-04: categories, items with a tax-inclusive base price, single-select
  variants with a signed delta, multi-select modifiers with a non-negative delta, archive in place of delete; every
  change advances the catalog version, and a command built on a stale version is refused with nothing written.
- **Closes.** ROADMAP bullets *categories, items, variants, modifiers, prices* (FR-B4, FR-C1 to C4) and *catalog-version
  handling* (FR-C7) as far as G2 allows; AC-31's Phase 1 part.
- **Depends on.** **ADR-012** accepted; the C2 pattern; design **D** (BO-03, BO-04) for S4c.
- **Touches.** `money` (prices and deltas as integer minor units and canonical strings; FR-M5's line and order bounds as
  they apply to a stored price; FR-C2's floor applies when a line is priced, Phase 2, not when a delta is stored),
  `boundaries` (B-1; B-8: an archived item is retained, never deleted; B-24: an empty catalog is the starting state;
  FR-C4: no nested modifier groups, no stock link; FR-C7).
- **Browser harness.** No new test expected; the suite runs. S7 is where the catalog crosses clients.
- **Size.** Split in three: **S4a** schema, grants and domain with the version advance and the stale-command refusal;
  **S4b** the back-office catalog routes; **S4c** BO-03 (list, categories, archive) and BO-04 (the item editor), which may
  itself split by screen.
- **Consult.** ADR-012 decides the version (section 7); its consult section gives S4a the task-level rules. The
  architecture already fixes the coordination point: catalog commands and the later add, fire and quick-sale-close
  commands use one catalog coordination row, and the catalog precedes the business day, which precedes the order
  (ARCHITECTURE §8).

### S5 — The 86 toggle

- **Goal.** A manager marks an item unavailable or available again from its BO-03 row; the change advances the catalog
  revision the POS polls.
- **Closes.** ROADMAP bullet *86 toggle* (FR-B6, FR-C5).
- **Depends on.** S4 (a and c); ADR-012; design **D** (BO-03's 86 action and its states).
- **Touches.** `boundaries` (B-17: an unavailable item never reaches the kitchen; in Phase 1 that means the flag is
  authoritative and propagates, since no server add or fire exists yet).
- **Browser harness.** No new test; S7 proves the propagation.
- **Size.** One task, the command and the row action together.
- **Consult.** ADR-012 decides whether availability advances the same version a stale command is checked against or a
  separate revision the POS polls (section 7). The task file must also carry, for Phase 4, the lock order the command
  will need when FR-G13 adds its lease check (catalog, then business day, then order, then lease; ARCHITECTURE §8), so
  that Phase 4 adds a check rather than reorders a command.

### S6 — Discount presets

- **Goal.** A manager creates, edits and deactivates named percentage and fixed-amount presets in BO-07; each change
  advances the catalog version (FR-C7).
- **Closes.** ROADMAP bullet *discount presets* (FR-B5).
- **Depends on.** ADR-012; S4a (the version); the C2 pattern; design **F** (BO-07); owner question Q10 for reactivation.
- **Touches.** `money` (a percentage as a rate from 0 to 100 percent; a fixed amount in minor units within FR-M5's
  bounds; B-1), `boundaries` (B-21: no date, time or automatic trigger field; B-22; FR-F5: a deactivated preset leaves
  the picker and stays readable, which Phase 2 proves on an order).
- **Browser harness.** No.
- **Size.** Split: **S6a** server; **S6b** BO-07.
- **Consult.** ADR-012 for the version; C2 for the pattern. The preset's value bounds are representational (FR-M5) and
  belong in the task file; no new owner question.

### S7 — The POS reads the catalog, and an 86 reaches it within three seconds

- **Goal.** In served mode the POS menu and item sheets come from the server; the POS polls the catalog revision every
  two seconds while signed in and refreshes on tab focus; an item 86'd in the back office is disabled in place within
  three seconds, and an item sheet open on it keeps its choices, marks it unavailable and disables Add.
- **Closes.** ROADMAP bullet *catalog-revision propagation* (FR-C6); the *Demonstrable*; AC-12's Phase 1 part.
- **Depends on.** S4, S5 (and S6 if the POS picker reads real presets); consult **C4**; the POS design addition for G6;
  owner question **Q14** (what a cashier may do with a real item in Phase 1).
- **Touches.** `money` (prices cross as canonical strings and are decoded by the shared codec; nothing in the POS
  computes a committed figure), `boundaries` (B-17's presentation; B-24: the fixture menu leaves the served bundle,
  proved on the built bundle as the fixture session is; FR-A2c: the first POS routes beyond sign-in).
- **Browser harness.** Yes: two profiles, the back office and the POS, with the page clock driving the POS poll (no real
  waits, rule 27). The first harness test that needs a 2xx body reads it in the page.
- **Size.** Split: **S7a** the POS catalog and revision routes; **S7b** the POS client and the browser test.
- **Consult C4 decides** (section 7): the POS projection and the revision read, their access declarations (`ACTIVE`,
  POS, not interactive, so polling never extends the 90 seconds, FR-A2b and AC-28); what the poll does while locked; how
  served and fixture modes choose the menu source without mixing (rule 23); which `?state=` pictures stay fixture-only
  and how they keep working (ADR-011 *Not decided here*); whether Add feeds the client order stand-in (Q14), and if it
  does, closing ARCH-004's unchecked `addLine` in the same task; whether the POS discount picker reads real presets; and
  the version the POS keeps for Phase 2's commands.

### S8 — Users

- **Goal.** A manager creates staff (cashier, manager, or kitchen with no PIN), assigns and changes the role, sets and
  resets PINs and a manager's username and password, deactivates and reactivates; deactivation and every reset end that
  user's sessions on both surfaces on their next authenticated request, except the back-office session from which a
  manager changes their own password (FR-B3). A username is set once and never changed (ADR-009; G10).
- **Closes.** ROADMAP bullet *users* (FR-B3); AC-32's first sentence; the Phase 0 carry-forwards *AC-32's POS half* and
  *the users screen's warning that a PIN or password reset ends all that manager's sessions* (ADR-009 *Consequences*);
  PHASE0-007b's *a password set or reset bumps the version and does not touch the throttle columns*; the re-stamp of
  ADR-009 §5.
- **Depends on.** Owner questions **Q1** (ADR-009's three items) and **Q7 to Q11**; consult **C3**; design **E2**
  (BO-06, with the gap G5 filled).
- **Touches.** `identity` (credentials, the credential version, sessions), `audit` (only if Q11 extends FR-J3; otherwise
  the slice must prove it writes no audit entry, ADR-009 §7), `boundaries` (B-11, B-12: a PIN and a password now travel
  in back-office request bodies for the first time; B-13; FR-A4).
- **Browser harness.** Yes, in S8c: a deactivated cashier's open POS session and a reset manager's open back-office
  session each end on their next request, in a second profile, presented as POS-01 *session invalidated* and BO-01
  *Session ended*; the credential scan covers every new credential route.
- **Size.** Split in three. **S8a** staff records: the kitchen classification (a forward migration that loosens
  `staff_user` without letting a row hold a role and no PIN), create, role change, deactivate, reactivate. **S8b**
  credentials: PIN set and reset, username and password set, password reset, the own-password change with the re-stamp,
  and the log-scan and redaction cases for every new field name. **S8c** BO-06 and the browser test.
- **Consult C3 decides** (section 7), after the owner's answers.

### S9 — POS-03's actor group and Release

- **Goal.** The order workspace draws the actor group the Frost artifact draws
  (`docs/design/visual-directions/frost/pos/order.html:77`), with Release going to POS-01 as it does on the floor and
  POS-05 and POS-06.
- **Closes.** The queued gap PHASE0-011c2 left out (its task file `:560-566`, ruling 2).
- **Depends on.** Nothing; the design exists and the release mechanism is built.
- **Touches.** `identity` (explicit release, FR-A2).
- **Browser harness.** No new test needed; the existing identity spec may gain a case if the task file asks.
- **Size.** One small task.
- **Consult.** Not needed: it places a reviewed drawing on a built mechanism, under ADR-011 rules 19 and 22, as
  PHASE0-011c2 did.

### S10 — BO-01 from design slice B

- **Goal.** The sign-in screen matches DESIGN-016 once the owner accepts it; BO-02 stays the frame (section 4).
- **Closes.** PHASE0-011d1's sign-in layout findings (gate report, *Known defects*); the deferred BO-01 retained-draft
  sentence after the eight hours (PHASE0-011d2 Handoff), if DESIGN-016 places it.
- **Depends on.** DESIGN-016 reviewed and accepted.
- **Touches.** `identity` (the sign-in screen and its states).
- **Browser harness.** No new test; the existing B-cases must still pass by accessible name.
- **Size.** One small task.
- **Consult.** Not needed: copy and layout from the design documents onto a built flow (ADR-011 rule 24).

## 4. The design dependencies

A screen with no reviewed Frost design gets a design task before any code (WORKFLOW's design gate; owner,
2026-09-14). DESIGN-011's proposed slices (`.agent/reviews/DESIGN-011-back-office-audit.md:452-470`) assign BO-03 and
BO-04 to slice D, BO-05 and BO-06 to slice E, BO-07 and BO-08 to slice F. Slice A (the shell, M-6) is done as
DESIGN-012; slice B (BO-01, BO-02) runs now as DESIGN-016; slices C (BO-13) and I (BO-12) are drawn and belong to
Phases 3 and 5.

| Build slice | Needs | From design slice |
|---|---|---|
| S1b | BO-05, the rail with its first entries, the dense table, form errors with field-level placement, unsaved-work departure | **E1** (BO-05 alone) |
| S2b, S3 | BO-08: rates entered as a percent and converted exactly, the version-change confirmation, currency and precision as Q5 decides, business details as Q12 decides, custom payment methods | **F** (BO-08 half) |
| S4c, S5 | BO-03 (list, categories, archive, the 86 action and its states, the lease refusal drawn for Phase 4), BO-04 (variants and modifiers as two structures) | **D** |
| S6b | BO-07 (both kinds, validation, deactivation) | **F** (BO-07 half) |
| S7b | POS-03's empty catalog and failed catalog read (G6); M-2 drawn for an arbitrary server item rather than the twelve fixture sheets (owner, 2026-09-24: one sheet per item, modelled on the existing one) | a **POS addition**, paired with D, as DESIGN-011 asks D to pair the 86 with the POS's unavailable state |
| S8c | BO-06 with G5 filled: username and password set and reset, the own-password change (and the current password if Q1 says so), the warning before a reset, kitchen without a PIN, role change as Q9 decides | **E2** (BO-06 alone) |
| S10 | BO-01 | **B** (DESIGN-016, running) |

**Recommended order for the designer, so the build does not wait:** E1 (BO-05) first, because S1 sets the pattern and
waits on nothing else; then F's BO-08 half, with the payment methods; then D, the largest, with the POS addition beside
it; then F's BO-07 half; E2 last, unless the owner answers Q1 and Q7 to Q11 early, in which case E2 moves up beside D.
This splits DESIGN-011's slices E and F, which the audit allows ("proposed task boundaries"); the reason is that E's
BO-06 waits on owner answers and F's two screens feed slices months apart on the critical path.

**BO-02 Today has no Phase 1 content.** Its states are the business day (FR-I1, Phase 5), open orders outstanding
(FR-I2, Phase 5; no order exists before Phase 2) and the emergency incident (FR-E3, Phase 3). *Recommended:* it stays the
Phase 0 frame of DESIGN-015, with the rail now populated and the pane empty, until Phase 3 brings incidents. Whether a
signed-in manager lands on that empty pane or on the first destination in the rail is the designer's call in
DESIGN-016; either needs no Phase 1 route.

## 5. Carry-forwards placed

Every item the Phase 0 consults and Handoffs left for Phase 1, and the Phase 2 items the task names.

| Item | Source | Placed | Reason |
|---|---|---|---|
| AC-32's POS half: a deactivated user's open POS session ends on its next request, in the harness | ARCH-014 §10; PHASE0-012a/012b Handoffs | **S8c** | The first deactivation is S8a's |
| AC-35's last sentence: unsaved work found after M-6 by the same manager, not by another, in a real form | ARCH-014 §10; PHASE0-011d2 and 012b Handoffs | **S1b** | The first real form |
| The harness's standing rules bind every Phase 1 browser test (ADR-011 rules 27 and 28; the 012a and 012b Handoffs: fixtures, schema reset, people through domain functions, both clocks, requests by the page, state and codes, no artefacts, the credential scan, sign-ins through the helpers so the ledger counts them) | ADR-011; PHASE0-012a/012b | **S1b, S7b, S8c**, and any later browser test | A rule of every test, not of one slice |
| A 2xx body is read in the page, never by the harness | PHASE0-012b Handoff | **S7b** (first to need one) | The POS catalog projection is a 2xx body |
| `VALIDATION_FAILED` details | ADR-011 *Not decided here*; PHASE0-009b | **C2 → S1a** | The first form |
| A faster development loop | ADR-011 *Not decided here*; ARCH-014 *For the lead* 9 | **S1b measures; the lead decides** | Designed only if the watch build proves too slow (section 7, C5) |
| The users screen warns that a PIN or password reset ends all that person's sessions | ADR-009 *Consequences* | **E2 → S8c** | Copy is the designer's |
| Setting or resetting a password increments the credential version and does not touch the throttle columns, with its own test | PHASE0-007b Handoff | **S8b** | |
| The own-password re-stamp of the acting session wants a consult | ADR-009 §5; PHASE0-007b | **C3 → S8b** | |
| The session module must not assume M-6 is its only verifier (an own-password change may verify the current password for the session's user) | ARCH-012 §8; PHASE0-009b | **C3 → S8b** | Only if Q1 requires the current password |
| A reactivation command; a reactivated user keeps their PIN unless an active user took it since (owner, 2026-10-07) | PHASE0-006b | **S8a** | PRD wording owed (Q6) |
| Kitchen staff as user records (owner, 2026-10-06) | ARCH-006 *For the owner* 3 | **S8a** | Needs the `staff_user` loosening |
| POS-03's actor group and Release | PHASE0-011c2 task file `:560-566` | **S9** | Independent |
| The three client-store line mutations that rely on the screen not offering them under a lock | ARCH-004 | **S7b for `addLine`**, if C4 keeps Add feeding the stand-in; **deferred to Phase 2 for `removeLine` and `setQuantity`** | S7b is the only Phase 1 slice that touches the add path; the other two are replaced by server commands in Phase 2 |
| The compose file's missing project `name:` | Gate report *The run* | **S0** | |
| No schema check at startup | Gate report *Known defects* | **S0** | |
| The BO-01 retained-draft sentence after the eight hours, still unplaced | PHASE0-011d2 Handoff | **DESIGN-016 → S10** | Copy |
| 011d1's sign-in layout findings | Gate report *Known defects* | **S10** | |
| AC-27's second sentence, AC-19's approval class through a route, M-1 for real, the idempotency design (with ADR-011's `CSRF_REFUSED` retry treated as the same attempt), ARCH-013's owner items 2 and 3, ARCH-013's FR-J3/AC-18/FR-A5 wording | Gate report; ARCH-013; ADR-011 | **Phase 2** | No Phase 1 command is approval-gated or duplicate-sensitive. A manual retry of a create after "something went wrong" can at worst make a visible duplicate configuration record, which the manager can deactivate; none needs to move earlier |
| The other POS screens' `?state=` pictures gated by `import.meta.env.DEV` | ADR-011 *Not decided here* | **Phase 2**, each with its stand-in; **C4** decides what POS-03's menu pictures do in S7 | |
| The closed-day banner's clearing | ARCH-014 *For the lead* 8 | **Deferred to the phase with a real business day (Phase 5)** | It is fixture data until a day can close |
| `closeOrder` accepts a non-cash draft above the balance | Gate report | **Deferred to Phase 4** | Unreachable; settlement becomes the server's |
| The `session_replication_role` bypass | Gate report; STATE | **ADR-008, deferred by the owner** | Section 7 |
| The PIN timing leak | ARCH-013 §7 | **The §3.2 gate review list** (already there) | S8 adds no PIN verification path |
| One development-only npm advisory | Gate report | **S0, if a fix exists without a major upgrade; otherwise deferred** | |

## 6. The Phase 1 Definition of Done

In the form of the Phase 0 plan's (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:3752-3761`, as amended on
2026-10-19). Each line is checked by a passing test or a compiler check, never by inspection; where the test does not
exist yet, the line names the slice whose task adds it. Lines marked *(subject to Q13)* assume the owner accepts the
ROADMAP change in section 8; if not, they fail until Phase 1 is extended.

- [ ] `npm run verify` passes from a clean checkout **in a directory not named `restaurant-pos`** after
  `npm run db:up && npm run db:migrate`, and `npm run test:e2e:all` passes after it. *(S0 makes the directory name
  irrelevant; the gate run proves it, as Phase 0's first line was proved.)*
- [ ] The server refuses to start against a database whose applied migrations differ from `db/migrations`. *(A server
  test, S0.)*
- [ ] **Demonstrable:** a menu built through the back-office routes is browsable at the POS, and an 86 in the back office
  disables the item in place at a separately signed-in POS within three seconds of page time, with no restart and no
  real wait. *(A two-profile browser test, S7b.)*
- [ ] **AC-12, Phase 1 part:** the 86'd tile keeps its slot, greys, carries the 86 marker and cannot be selected; an
  item sheet already open on it keeps its choices, marks it unavailable, disables Add and explains the change. *(The same
  browser test, S7b; the in-place layout by the POS's component tests, which exist for the fixture path and move to the
  served path in S7b.)* *(subject to Q13)*
- [ ] **AC-31, Phase 1 part:** every catalog change (category, item, variant, modifier, price, availability as ADR-012
  rules, preset) advances the catalog version; a catalog command carrying a stale version is refused with nothing
  written; the POS projection carries the version. *(PostgreSQL integration tests in S4a, S5 and S6a; a route test in
  S7a.)* *(subject to Q13)*
- [ ] **AC-32, first sentence:** deactivating a user, resetting their PIN, or setting or resetting their password ends
  every session of that user, POS and back office, on its next authenticated request; a manager who changes their own
  password keeps that one back-office session and loses every other. *(Integration tests in S8a and S8b; a two-profile
  browser test in S8c.)*
- [ ] **AC-35, last sentence:** after a 30-minute idle the same manager resumes with their password alone and finds
  their unsaved BO-05 edit; a different manager who signs in instead does not. *(A browser test, S1b.)*
- [ ] **FR-B1:** a rate or business-detail change creates a new settings version, earlier versions are unchanged, and
  exactly one version is current. *(Integration tests, S2a.)*
- [ ] **B-1:** no `number` touches a monetary or rate value in `packages/money`, `packages/contracts` or `apps/server`;
  every new price, delta, preset amount and rate crosses the API as a canonical string and a JSON number is refused; no
  new column is floating-point, `numeric` or `money`. *(The money package's type tests; contract schema tests added by
  S2a, S4a and S6a; `schema.test.ts` case 14, which covers new tables without change.)*
- [ ] **B-7:** the application role still cannot UPDATE, DELETE or TRUNCATE `audit_entry`, and the privilege-equality
  test names every Phase 1 table with exactly its grants; the settings-version table grants only `SELECT` and `INSERT`.
  *(`schema.test.ts`, extended by each slice that adds a table.)*
- [ ] **B-12:** no PIN or password value appears in a log, audit row, telemetry row, error body, URL or browser storage,
  including the new back-office routes that carry a PIN or a password in their body. *(The log-scan tests extended to
  every new credential route and field name in S8b; the harness credential scan in S8c.)*
- [ ] **B-13:** every audit entry Phase 1 writes names a specific actor; if Q11 leaves FR-J3 as it is, Phase 1 writes
  none. *(Integration tests in S8a/S8b: either the entries name the acting manager, or the audit table is unchanged by
  every users command.)*
- [ ] **B-24:** no menu, price, rate, table, preset, tender type or business detail is hard-coded or seeded outside the
  test fixtures; every new configuration table is empty after migration; the served POS bundle contains no fixture menu.
  *(Schema tests in each slice that adds a table; a built-bundle marker test in S7b, made as the fixture-session proof
  is.)*
- [ ] **FR-A2c and ADR-011 rule 1:** every Phase 1 route declares its access, back-office configuration routes accept
  only a back-office session and POS catalog routes only a POS session, and the route table equals the registered
  routes. *(The existing route-table and access tests, extended by each slice that adds a route.)*
- [ ] **NFR-5 and ADR-011 rule 26:** the two clients still import nothing from each other. *(The existing boundary
  tests.)*

## 7. ADRs and consults needed

| ID | Kind | Question | Why not in a task file | Slices waiting |
|---|---|---|---|---|
| **ADR-012** (the next free number) | **ADR**, Proposed, owner accepts | **Versioned configuration: the settings versions and the catalog version.** Settings: an append-only version per change; how the current one is identified (ARCH-006 §5 found a key and a timestamp cannot order two versions made in one transaction); whether every settings change or only a rate change makes a version (FR-B1 names rates; a receipt prints the business fields of the version the order opened under, ARCHITECTURE §5.2); the calculation-policy version's value; currency and precision as Q5 decides. Catalog: one counter or two (FR-C7's list omits availability, ARCHITECTURE §5.1 includes it, §4.3 polls it); global or per record; what a command carries; whether back-office catalog commands are version-checked (§17.9) and with which code (G2); the coordination row and its place in the lock order for Phase 2's add, Phase 3's fire and Phase 4's quick-sale close and 86-versus-lease | It binds Phase 2 (capture at open, add-line), Phase 3 (fire), Phase 4 (close, receipt fields, FR-G13) and both clients. ARCH-006 §5 deliberately left the settings table to Phase 1 because four of its questions were open; this is where they close | S2, S4, S5, S6, S7 |
| **C1** | Consult, the task-level half of ADR-012 | The schema rules, refusals, test cases and red proofs for S2a, S4a, S5 and S6a, reconciled with ARCH-006 §5 (representational checks only: rate ≥ 0, precision ≥ 0, a currency code's shape; no business ceiling, per the owner's 2026-10-06 ruling) | Task detail, not a decision for the owner. *Recommended:* one architect task writes ADR-012 and C1 together, C1 marked as not binding, as ARCH-006 wrote migrations for a task file | S2a, S4a, S5, S6a |
| **C2** | Consult | **The first back-office form.** Addressing one record within ADR-011 rule 16 (a path template in the route table, or an id in the body of a `POST`, and how the core and the route-table equality test treat it; no query string reaches a credential route); `VALIDATION_FAILED`'s details per ADR-011; what a configuration command answers; whether a list read is interactive; label uniqueness among active records; the DiningTable lock Phase 2 shares (G1); unknown outcomes presented without a resend (ADR-011 rule 20); the cash-and-card question for S3 | It sets the pattern every back-office form in every later phase copies (S1, S2, S3, S4, S6, S8; Phase 5's end of day) | S1, then S2, S3, S4b, S6 by inheritance |
| **C3** | Consult, after the owner answers Q1 and Q7 to Q11 | **Users and credentials.** The `staff_user` loosening for kitchen staff that keeps "a role and no credential" impossible; role changes between kitchen and the two roles (Q9); the credential-version increments, including a role change if Q1 says so; the re-stamp of the acting session in the same transaction as the hash change (ADR-009 §5), and the same for an own PIN change if Q1 says so; verifying a current password through the account's throttle; refusing self-deactivation or self-demotion if Q8 says so; reactivation and a taken PIN; the PIN-in-use refusal as an oracle (below); the new request field names under ADR-010 rule 2's redaction backstop, which matches listed names only, so `newPassword` or a nested `pin` would pass it; the column grants on `staff_user` | Identity and boundaries; ADR-009 §5 assigns the re-stamp to "the Phase 1 users screen" and PHASE0-007b asks for "a short architect consult first" | S8 |
| **C4** | Consult | **The POS catalog.** The projection and revision routes and their declarations; the poll's behaviour while locked and on focus; the three-second proof with the page clock; served and fixture menu sources under rule 23; POS-03's `?state=` pictures; Add into the client stand-in or browse-only (Q14) and ARCH-004's `addLine`; the POS preset picker; the version kept for Phase 2; how the open sheet learns of an 86 between polls | It crosses both clients and decides which Phase 0 stand-ins go (owner, 2026-10-13) | S7 |
| **C5** | Consult, only if needed | **A faster development loop**: the server proxying a bundle path to Vite behind an explicit flag, with the browser on the one origin (ADR-010 *Consequences*; ADR-011 *Not decided here*). If the design changes what ADR-011 Part 2 says is served outside `/api`, it needs an ADR that supersedes those rules | Only S1b's measurement says whether it is needed | None blocks |

**No ADR for users.** ADR-009 left the three items as product questions in *Not decided here* and assigned the re-stamp
to Phase 1; answering them supersedes no decision of ADR-009, so C3 suffices. The owner's answers land in FR-B3's
wording (ARCH-017's Handoff), not in an ADR. If the owner answers Q1 by making an own PIN change keep the back-office
session, that extends ADR-009 §5's "the single place where a user-management command writes a session row" to two
places; C3 must say so plainly, and if the lead judges that a change to ADR-009's decision rather than an answer to
its open question, ADR-009 is superseded on that one point.

**One risk C3 must present to the owner, not decide.** FR-A4 makes a PIN unique among active users, and the users screen
refuses a PIN already in use (BO-06 *PIN not unique*). A manager setting PINs therefore learns which six-digit values
some active colleague holds, and can sign in at the POS with one to learn whose it is. Since managers set the PINs, they
already know the ones they set; the oracle adds the ones another manager set. *Recommended:* accept it for the loopback
MVP and add it to the §3.2 gate review list.

**ADR-008 is not needed for Phase 1.** Phase 1's one new immutable table is the settings versions. The rules that keep
it immutable are already practised: grants in the creating migration, `SELECT` and `INSERT` only, and the
privilege-equality test that fails on a table it does not name. The known bypass (`session_replication_role`) belongs to
the owner role, not to `pos_app`, and is the same for `audit_entry` today. Nothing in Phase 1 becomes unsafe for lack of
ADR-008; the owner's deferral stands.

## 8. Questions for the owner

Each names the slice it blocks and a proposed answer with reasons. None is assumed by this plan. The exact contract
wording each would need is in ARCH-017's Handoff.

**Q1. ADR-009's three open items** (blocks S8, design E2).
(a) *Does changing one's own password require the current password?* **Proposed: yes.** It is the one credential change
whose victim keeps working in the same session and so does not notice at once, and it is cheap. It does not protect an
unattended back office in general: that session can still create a new manager or reset another's password, which the
30-minute idle bounds. The verification counts on the account's own throttle (ADR-009 §4).
(b) *Does a manager who resets their own PIN from the back office stay signed in there?* **Proposed: yes, and it also
requires the current password**, for the same reasons as (a): the manager is evidently at the desk, and ending their desk
session for their own PIN is friction with no protection in it. Their POS sessions end.
(c) *Does a role change increment the credential version?* **Proposed: yes.** A role change is a change of authority;
failing closed ends a demoted manager's back-office session cleanly (`UNAUTHENTICATED`, BO-01 *Session ended*) instead
of leaving a session that answers `FORBIDDEN` on every request, and a promoted cashier starts fresh. The guard's role
check stays as the control.

**Q2. The permitted tax and service-charge range** (blocks nothing). **Already ruled: no range is needed** (DECISIONS
2026-10-06). BO-08 ships with representational refusals only: a rate that is not a whole number of parts per million, a
negative rate, or more decimal places than the design accepts. PRD §9 question 3, ARCHITECTURE §16 and §19 item 3 are
stale (G8). **One proposal to reconsider:** a ceiling of 100 percent on both rates as a typing guard, the same bound a
discount has (FR-M5). A service charge mistyped as 110 percent instead of 11 would charge customers more than double,
and the cashier is the only check. If the owner keeps "no range", S2 builds exactly that.

**Q3. May a non-zero service charge be stored in Phase 1?** (blocks S2a's refusal rule). **Proposed: yes.** The owner's
ruling (2026-10-09) is that the rate stays adjustable and that the Pasal 8 question is ruled "before a non-zero rate is
used". Nothing uses a rate until Phase 2 opens an order under a settings version, so Phase 1 harms nothing by storing
one, and refusing it would be a hard-coded rate restriction (B-24). The ruling on Pergub 35/2024 Pasal 8 then becomes an
entry condition of the Phase 2 slice that captures the settings version at order opening.

**Q4. Which phase holds FR-B7, tender types?** (blocks S3). **Proposed: Phase 1, as S3**, with a ROADMAP bullet. It is
back-office configuration that exists "before a single order exists", the sitemap and DESIGN-011 put it on BO-08, and
Phase 4 then tenders with methods that already exist. This is a ROADMAP wording change.

**Q5. Currency and minor-unit precision in Phase 1** (blocks S2, design F). **Proposed: fixed and shown, never editable.**
The owner ruled the installation is IDR at precision 0 (2026-09-10), every client format and design assumes it
(no `Rp` symbol, whole rupiah), and an editable currency before the first order would invite a choice the product has
already made and that the screens cannot render. BO-08 shows the locked state from the first run, which is "the state
this screen spends its life in" (BO-08 *Must not invent*). This changes FR-B1's and FR-M1's wording ("configured once"),
so it is the owner's; the alternative is an editable pair, before the first order only, with the clients made
precision-general.

**Q6. PRD wording owed** (blocks nothing in Phase 1 except its contract text).
(a) *Reactivation keeps the PIN* (owner, 2026-10-07): **needed before S8a**, because S8a builds reactivation and FR-B3
does not mention it. Proposed wording in the Handoff.
(b) *FR-M3 and B-2's "half-up" below zero against the code's half away from zero* (`packages/money`): **not needed in
Phase 1.** Phase 1 converts a percent to parts per million exactly and rounds nothing. Phase 2's totals round only
non-negative values, where the two rules agree; the difference appears only for a negative fraction, which no defined
calculation produces. Recommended for settling before Phase 2's totals all the same, so the contract and the code say
the same thing.

**Q7. May a manager set another user's PIN, or must the person type it?** (blocks design E2 and S8b). **Proposed: the
manager's screen sets it, typed by whoever is at the desk**, as BO-06's *Set / reset PIN* modal implies; the server
cannot tell who typed it and does not try. This is asked so that the PIN-oracle risk in section 7 is accepted knowingly.

**Q8. May a manager deactivate or demote their own account?** (blocks S8a). **Proposed: no; the server refuses it.** It
guarantees that the back office always has at least the acting manager, so no screen action can leave the restaurant
without a manager; recovery would otherwise need `create-manager` at the host. Deactivating or demoting another manager
stays allowed.

**Q9. Can a person move between kitchen and the two roles?** (blocks S8a, design E2). **Proposed: yes.** Kitchen to
cashier or manager sets a PIN in the same command (and a username and password for a manager, who cannot otherwise sign
in to the back office); cashier or manager to kitchen removes the PIN from use and ends every session. A former
manager's credential row stays, because the application deletes none, and never verifies, because verification requires
an active manager (ADR-009 §1).

**Q10. Reactivation and seats** (DESIGN-011 Q5; blocks designs D, E1, F and the reactivation half of S1, S4, S6).
Users may be reactivated (owner, 2026-10-07). **Proposed: reactivation for tables, presets, items and categories too**,
because deactivation is the only removal and a record deactivated by mistake would otherwise have to be re-created under
a new identity; **no seat count on a table**, because nothing in the MVP reads one. FR-B2 and FR-B5 say "deactivate"
and not "reactivate", so this is a PRD change.

**Q11. Are user-management changes audited?** (blocks S8; `audit`). FR-J3's list is closed and includes none of Phase 1's
commands; ADR-009 §7 says creating a user is not audited. **Proposed: audit the credential and status changes of a user
(deactivation, reactivation, PIN set or reset, password set or reset, role change), and nothing else in Phase 1.** B-13's
worth rests on a PIN being known to its holder, and a manager who sets or resets a PIN knows it; an entry naming that
manager and the person is the only record that the knowledge exists. Menu, settings, table and preset changes stay
unaudited, because none of them moves money or bears on who an actor is, and snapshots already protect history (B-8). If
the owner says no, S8 proves it writes no audit entry.

**Q12. Which business details does a settings version hold?** (blocks the business-details half of S2 and design F's
BO-08). PRD §9 question 1 (receipt content) is open and blocks the final receipt, but FR-B1 stores "the business details
printed on receipts" now. **Proposed:** the lead's research list (`.agent/reviews/RESEARCH-receipt.md`, *Proposal*):
outlet name, address and phone, an optional NPWPD, and a footer line, all text the manager types, none seeded. The rest
of question 1 (numbering, reprint marking, refund slip, language, tax label) stays open for Phase 4. If the owner would
rather not decide now, S2 ships rates only and the business details join with a later version of the table.

**Q13. ROADMAP's Phase 1 acceptance line cannot be met as worded** (blocks the Definition of Done). AC-31 and AC-12's
last sentence need POS commands that are Phase 2's and Phase 3's (G2, G3); AC-32's second sentence needs an open order
(G1); FR-C6 is listed twice (G4). **Proposed:** ROADMAP's Phase 1 acceptance names what Phase 1 can prove (AC-32's first
sentence, AC-35's last, AC-12's presentation and the catalog version), and Phases 2 and 3 take the rest, in the wording
in ARCH-017's Handoff. The alternative, moving the open-order and add-line commands into Phase 1, drags in the order
model, the settings capture and the business day, which is Phase 2 by another name.

**Q14. In Phase 1, may a cashier add a real menu item to the POS's client order?** (blocks C4 and S7b). The served POS
shows fixture orders under a real sign-in until each server command arrives (owner, 2026-10-13); the add-line command
arrives in Phase 2. **Proposed: yes, into the client stand-in, as today with fixture items**, so the owner can try the
real menu end to end. A line is a snapshot of names and prices, so fixture orders and real items sit together without
contradiction; nothing is stored; the stand-in goes when Phase 2's command arrives. The alternative is a browse-only
menu, with Add absent, until Phase 2. The floor (POS-02) stays fixture until Phase 2 either way, because it pictures
orders on tables, and orders do not exist.

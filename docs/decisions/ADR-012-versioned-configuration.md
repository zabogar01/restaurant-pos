# ADR-012: Versioned configuration — settings versions and the catalog version

**Status:** Proposed

**Date:** 2026-10-20

**Proposed by:** `architect18` (ARCH-018), for the product owner

Nothing is superseded by this record. ARCHITECTURE §5.1 names a SettingsVersion
and a CatalogRevision, §4.3 and §8 describe what they are for, and ADR-003 and
ADR-004 require both to exist; no accepted record says how either is stored,
identified, advanced, checked or locked. ARCH-006 §5 deliberately left the
settings table to Phase 1 because four of its questions were open, and the
Phase 1 plan (accepted 2026-10-20) names this record as the one ADR Phase 1
needs before slices S2, S4, S5, S6 and S7. ADR-008 remains reserved for the
deferred database-roles decision.

The task-level half of this record, the schema rules, grants, refusals and test
cases for slices S2a, S4a, S5 and S6a, is consult C1,
`.agent/reviews/ARCH-018-c1-configuration-schema.md`. C1 is not binding: where it
and this record differ, this record wins, and where C1 and a task file differ,
the task file wins.

A second consult, C2 (ARCH-019, the first back-office form), is written at the
same time. It owns the route shape, the details of `VALIDATION_FAILED`, what a
configuration command answers, and the table lock. Where this record needs one
of those, it says what it needs and names C2 as the place it is settled.

## Context

Configuration in this product has two kinds of history, and they need different
mechanisms.

**Settings are captured by reference.** An order captures the SettingsVersion it
opened under (ARCHITECTURE §5.2, ADR-004, FR-B1), and every later figure on that
order is computed from that version's rates. A rate change must therefore never
alter a version an order already refers to: the version is immutable, and a
change makes a new one. FR-C7 adds that "settings changes need no equivalent" of
the catalog version, because the order already holds its version.

**The catalog is captured by copy, and checked for staleness.** A line copies the
names and prices it was priced at (B-8, FR-D4), so a later menu edit cannot
rewrite it. But the POS builds a command from a menu it read seconds or minutes
earlier, and FR-C7 requires that "a line is never added at a price other than
the one displayed". So the server must know which state of the catalog a command
was built on, and refuse it when that state is gone. That is the catalog version
(ARCHITECTURE §4.3). Availability adds a third need: an 86 must reach the POS
within three seconds by a two-second poll (FR-C6), and must be revalidated by the
server when a line is added and when work is fired, because polling is never the
integrity control (§4.3).

The questions this record answers are the Phase 1 plan's section 7 row for
ADR-012. For settings: an append-only version per change; how the current one is
identified, given ARCH-006 §5's finding that a `uuid` key and a `created_at`
timestamp cannot order two versions made in one transaction; whether every
settings change or only a rate change makes a version; the calculation-policy
version's value; and currency and precision. For the catalog: one counter or
two, since FR-C7's list omits availability while ARCHITECTURE §5.1 includes it and
§4.3 polls it; global or per record; what a later POS command carries; whether
back-office catalog commands are checked against a version, and with which code;
and the coordination row and its place in the lock order for Phase 2's add-line,
Phase 3's fire, and Phase 4's quick-sale close and 86-versus-lease (§8).

The owner's rulings of 2026-10-20 (`.agent/DECISIONS.md`) bind this record and
override the plan's text where the plan predates them:

- **Q2.** Tax and service-charge rates are bounded from zero to 100 percent, as a
  typing guard, besides the representational refusals (a whole number of parts
  per million, not negative). PRD FR-M5 reads "tax and service-charge rates
  0–100%". The plan's S2 and C1 rows, which say "no business ceiling", are stale
  on this point; this record follows the ruling.
- **Q3.** A non-zero service charge may be stored in Phase 1. The owner's ruling
  on Pergub 35/2024 Pasal 8 becomes an entry condition of the Phase 2 slice that
  captures the settings version when an order opens.
- **Q5.** The installation's currency and minor-unit precision are fixed at IDR
  and 0; the back office shows them and never offers to change them; the clients
  stay IDR-specific (PRD FR-B1, FR-M1).
- **Q10.** Tables, discount presets, items and categories may be reactivated.
- **Q12.** A settings version holds the outlet name, address and phone, an
  optional NPWPD, and a footer line, all typed by the manager and none seeded.
- **Q13.** No Phase 1 POS command carries the catalog version; AC-31 and the
  `CATALOG_CHANGED` rejection of a POS command pass in Phase 2. ROADMAP Phase 1
  now reads "every menu, option, price, availability and preset change advances
  the catalog version that later POS commands carry (FR-C7)".
- **Q14.** In Phase 1 a cashier may add a real item to the POS's client order
  stand-in; nothing is stored.
- **B-24**: no seeded settings row and no seeded catalog. ADR-008 stays deferred.

## Decision

### Part 1. Settings versions

#### 1. Every settings change makes a whole new, immutable version

Settings live in one append-only table of versions. A version holds the complete
settings: both rates, the five business details and the calculation-policy
version. A change of any one field writes a new row carrying every field, and no
row is ever updated or deleted. The application role has `SELECT` and `INSERT`
only, the insert limited to the columns the application may supply, and the
creating migration states those grants (ARCH-006 §3). A trigger refuses
`UPDATE`, `DELETE` and `TRUNCATE` for every role, as on `audit_entry`, so that a
migration, a test or a mistake cannot rewrite a version an order refers to.

No version is seeded (B-24). A new installation has no settings until a manager
saves them, and BO-08's first run is the screen that creates version 1.

#### 2. The current version is the one with the highest number

Each version carries a **version number**, an integer that is the table's primary
key. The first version is 1. The server assigns each new number as the current
number plus one; the client never chooses it. **The current version is the
version with the highest number.** Nothing else marks it: no flag, no pointer
row, no timestamp.

The primary key is what makes "current" unambiguous under concurrency. Two
changes built on the same current version both try to insert the same next
number. Under `READ COMMITTED` the second insert waits on the first transaction's
index entry, and fails with a unique violation if the first commits (the
librarian confirmed this from the PostgreSQL 16 source, `_bt_doinsert`). The
loser is refused as stale (rule 3); it never becomes a second "current".

`created_at` is kept, from the database clock, for display ("in force since"). It
does not order versions and nothing reads it as an order.

#### 3. A settings change carries the version it was built on

The settings command carries the number of the version the manager's form was
read from, or none for the very first save. The server reads the current number
inside the command's transaction; if it differs from the one carried, or a
version exists when none was carried, the command writes nothing and is refused
with a new code, **`SETTINGS_CHANGED`** (status 409, no details). The same code
answers the unique violation of rule 2, which is the same condition reached
concurrently. The client keeps the manager's draft, reads the current settings
again, and the manager decides; nothing resends by itself (ADR-011 rule 20).

This is a back-office rule. FR-C7's "settings changes need no equivalent" is about
POS commands, and stays true: no POS command carries a settings version, because
an order holds its own.

`SETTINGS_CHANGED` enters `packages/contracts` in S2a, the task that first emits
and tests it (ADR-010 rule 1). It carries no details: the client reads the
current settings to learn what changed. What the read answers and what a
successful command returns are C2's (rule 15 below says what this record needs
from them).

#### 4. Every settings change makes a version, rates and business details alike

A change to a business detail makes a version exactly as a rate change does. FR-B1
names rate changes as making a version and does not exempt the others, so this
reading is within it.

A submission identical to the current version writes nothing, advances nothing,
and is not refused: the command succeeds and the current version stays current.
A stale submission is refused under rule 3 before this comparison is made, so an
identical-looking form built on an old version still learns that something
changed.

**A receipt's business fields come from the settings version its order
captured.** ARCHITECTURE §5.2 requires a Receipt to capture every business field
it prints, so that a reprint is identical (FR-G7); it did not say which version
supplies them. This record decides it: the order's own version, the one that
already supplies its rates. One order then has one source of configuration, and
the lead's receipt research (`.agent/reviews/RESEARCH-receipt.md`, *Proposal*)
reads the same way. The consequence is that a corrected phone number reaches
orders opened after the correction and not an order already open, which is the
same rule a rate change follows. The rest of the receipt's content stays open for
Phase 4 (PRD §9 question 1).

#### 5. Currency and precision are installation constants, not stored

The installation's currency (`IDR`) and minor-unit precision (`0`) are constants
in the shared code, read by the server and both clients. **No settings version
stores them.** The settings view the back office reads carries them, from the
same constants, so BO-08 shows them as the server states them; no command accepts
them.

FR-B1 says settings "hold" currency and precision and, since 2026-10-20, that they
are fixed and the back office shows them and never offers to change them; FR-M1
says they "never change". A column whose value can never differ between two rows
records nothing about the version it is in. The constant states the one fact
there is, and it removes a mechanism the product no longer needs: ARCH-006 §5
noted that "immutable after the first order" in an append-only table would be a
check at insert against other rows. With constants there is nothing to check.

If an installation ever needs another currency, that is a product change and a
new ADR. All history written before it is IDR at precision 0, so a later
migration that adds the columns can fill them exactly.

#### 6. The calculation-policy version is 1, and the server writes it

Every settings version stores a **calculation-policy version**, an integer the
server writes from a constant in its own code and that no request carries. Its
only value is **1**, which names the calculation in ARCHITECTURE §10 and ADR-004
(nett, the order of operations, half-up rounding once) as Phase 2 implements it in
`packages/money`. A check in the database pins the column to 1.

The value exists so that the arithmetic an order is totalled with is a fact the
order holds through its settings version, as ADR-004 intends ("a
calculation-policy version"). Pinning it means a second policy cannot appear by a
change of code alone: it needs a migration, and that migration is the place to
decide how open orders under policy 1 are totalled and when policy 2 takes effect.
Policy 1 is defined by what Phase 2 ships. If the owner settles the wording of
FR-M3 and B-2 (half-up below zero, plan Q6(b)) before the first order exists, as
DECISIONS records for Phase 2, no policy 2 is needed.

The column is created now, with the table, so that Phase 2 does not have to alter
an immutable table to add it.

#### 7. Rates: parts per million, zero to 100 percent

A rate is stored as an integer number of parts per million in a `bigint` column
(B-1, ADR-004), checked in the database to lie **from 0 to 1,000,000 inclusive**,
that is from zero to 100 percent (FR-M5, owner 2026-10-20). Both bounds are also
checked at the HTTP boundary, where an out-of-range rate is `VALIDATION_FAILED`
with C2's details. The check in the database is the backstop, and the lower bound
is ARCH-006 §5's representational check, kept.

On the wire a rate is a canonical base-10 integer string of parts per million,
exactly as money is (ADR-004): a JSON number is refused. The back office lets the
manager type a percent and converts it with `rateFromPercent` from
`packages/money`, which is exact and refuses more than four decimal places of a
percent (one part per million), so the design's four-place limit (DESIGN-011 Q6)
and the representation agree. No float touches a rate at any layer.

A non-zero service-charge rate is accepted (owner, Q3). Nothing uses a rate until
Phase 2 opens an order under a settings version, so storing one harms nothing.

#### 8. The business details

A settings version holds the five business details the owner ruled on (Q12):
**outlet name, address, phone, NPWPD and footer line.** The NPWPD is optional;
the other four are required and may not be blank. This is a reading of the
ruling, which marks only the NPWPD as optional; C1 records it and the Handoff
asks the lead to confirm it.

Every one of them is printed on paper by an ESC/POS printer in Phase 4, and
ESC/POS treats control characters as printer commands. **No business detail may
contain a control character**, except a line feed in the address. The same rule
applies to every catalog name that reaches a kitchen ticket or a receipt (rule
12). The lengths are representational guards, recommended in C1 and settled with
the design (BO-08); which characters a given printer can render is Phase 3's.

### Part 2. The catalog version

#### 9. One global catalog version, on one coordination row

The catalog has **one version**, a non-negative integer held in **one row** of its
own table, `catalog_revision`, which is ARCHITECTURE §5.1's CatalogRevision. The
row is created by the migration that creates the table, at version 0, and is the
only row the table can hold. It is not configuration: it holds no menu, price or
name, only a counter and a lock point, and it is seeded for the reason the two
throttle rows are (ARCH-006 §5): so that every command only ever updates it, with
no creation race and no "no row yet" case. Version 0 is the empty catalog, which
is the starting state (B-24). The application role may read the row and update
its counter, and nothing else.

The row is both things §4.3 and §8 need: the number the POS polls and commands
carry, and the coordination point that catalog commands and the commands that
depend on the catalog lock (rule 14).

The words "catalog revision" (FR-C6, §4.3's poll) and "catalog version" (FR-C7,
§4.3's check) name **the same number**. ARCHITECTURE §4.3 and §5.1 are amended to
say so.

#### 10. Every committed catalog write advances it by exactly one

A command that writes any catalog row advances the version by exactly one in the
same transaction, however many rows it writes. "Catalog row" means a category, an
item, a variant, a modifier or a discount preset; "write" includes:

- creating, editing, reordering, archiving and restoring a category or an item;
- creating, editing, reordering and removing a variant or a modifier;
- **marking an item unavailable or available again** (an 86 and its reversal);
- creating, editing, deactivating and reactivating a discount preset.

**Availability advances the version.** ROADMAP Phase 1 says so ("every menu,
option, price, availability and preset change advances the catalog version that
later POS commands carry"), ARCHITECTURE §5.1 says so, and §4.3 polls the number
for availability. FR-C7's list omits availability but does not exclude it; the
contract is read whole.

**A restore advances the version** (Q10). It changes what the POS may offer, the
POS learns of it only by the poll, and a uniform rule ("every committed write")
is one that no command can be forgotten by.

A command that changes nothing (an item marked unavailable that already is, an
edit whose values equal the stored ones) writes nothing and advances nothing.

Tables, tender types, users and settings are not catalog rows. They do not advance
the catalog version.

#### 11. A read that reports the version reads it in the same snapshot as the contents

Every read that returns catalog contents together with the catalog version (the
POS menu projection, the back office's menu and item reads) reads both **in one
snapshot**: one `REPEATABLE READ READ ONLY` transaction, or one statement. Under
`READ COMMITTED` each statement sees its own snapshot, so separate queries could
pair new prices with an old version, or old prices with the current version. The
second pairing is the dangerous one: the POS would show an old price with a
version the server accepts, and a line would be added at a price other than the
one displayed, which is exactly what FR-C7 forbids. A snapshot read needs no lock
and no `UPDATE` privilege.

The revision poll reads the version alone and needs nothing more.

#### 12. What a later POS command carries

A POS command that is built on catalog contents carries **one integer, the catalog
version of the projection it was built on**. In Phase 2 these are add-line and
applying a preset discount. The server compares it with the current version under
the coordination row's shared lock (rule 14) and refuses a mismatch with
`CATALOG_CHANGED`, writing nothing (AC-31). After the version matches, add-line
still checks that the item is active and available and refuses otherwise with
`ITEM_UNAVAILABLE`: a client may send a command for an item its own screen
disabled, and the version proves only that the client's view is current, not that
the client respected it.

Fire and quick-sale close do not carry the catalog version. They act on lines that
already hold their snapshots, so a later price or name change does not matter to
them; availability does, and they recheck it under the shared lock (FR-C6, FR-E4,
B-17). Table settlement does not touch the catalog at all: every line of a table
order is already fired when it closes.

No Phase 1 POS command carries the version (Q13). What the POS keeps between its
poll and its Phase 2 commands, and the projection and revision routes themselves,
are C4's.

#### 13. Back-office catalog edits are checked against the version; state changes are not

ARCHITECTURE §17.9 rejects blind last-write-wins for catalog-sensitive state. A
price is money. A form opened before another tab changed the same item, and saved
afterwards, would silently put the old price back. So:

- **An edit carries the catalog version its form was read at**, and is refused
  with **`CATALOG_CHANGED`** (status 409, no details), writing nothing, when the
  current version differs. An edit is a command that writes field values onto an
  existing record: renaming, repricing, moving to another category, changing or
  removing a variant or a modifier, reordering, editing a preset's name, kind or
  value. The client keeps the draft, reads the catalog again, and the manager
  decides (ADR-011 rule 20).
- **A state command does not carry it**: marking an item unavailable or available,
  archiving or restoring an item or category, deactivating or reactivating a
  preset. Each states the target the manager wants, overwrites no field, and is
  right whatever else changed meanwhile. An 86 in particular is urgent, and must
  not be refused because a price was edited in another tab.
- **A create does not carry it.** It overwrites nothing. Its preconditions (the
  category it names exists and is active) are checked against current state.

State commands and creates still advance the version (rule 10).

The code is `CATALOG_CHANGED` because the condition is the one FR-C7 names: a
command built on stale catalog data. Its first emitter is the back-office catalog
routes, so **`CATALOG_CHANGED` enters `packages/contracts` in S4b**, with a route
test, and S4a's domain refusal is proved by integration tests before it. Phase 2's
add-line is then its second emitter, with the same meaning.

The check is coarse: an edit of one item is refused when any catalog row changed,
an 86 included. That is deliberate (the alternatives below say why); the price is
a refusal that only another back-office tab, or a second manager, can cause.

#### 14. The coordination row comes first in the lock order

All catalog coordination goes through the one `catalog_revision` row, which comes
**first** in ARCHITECTURE §8's lock order: catalog, then BusinessDay, then Order,
then CheckoutLease, then ReceiptSeries.

- **Every catalog write command takes the row `FOR UPDATE` before it reads
  anything it validates**, checks the expected version if it carries one, writes,
  and increments the counter. Catalog writes therefore run one at a time; the
  affected catalog rows need no locks of their own, because every writer passes
  through the one row first.
- **Every command that depends on current catalog state takes the row `FOR
  SHARE`**, first: Phase 2's add-line and preset-discount apply, Phase 3's fire,
  and in Phase 4 **acquiring a CheckoutLease on a quick-sale order** and closing a
  quick-sale order. Shared locks do not block one another, so POS commands never
  wait on each other here; a catalog write waits for them, and they wait for a
  catalog write. `FOR KEY SHARE` must not be used: it does not conflict with the
  lock an `UPDATE` of a non-key column takes, so it would let the counter move
  under a command that believes it is current (PostgreSQL 16, §13.3.2, confirmed
  through the librarian).
- **86 versus lease (FR-G13, AC-29, Phase 4).** The 86 command holds the row `FOR
  UPDATE`, and then refuses if any active CheckoutLease is held on a quick-sale
  order with a pending line for that item, naming the order. This is sound only
  because lease acquisition on a quick-sale order takes the same row `FOR SHARE`:
  an 86 and an acquisition then serialise, so the 86 either sees the committed
  lease and refuses, or commits first and the acquisition sees the item
  unavailable and refuses before any payment begins. Phase 4 adds the lease check
  to S5's command after the lock it already takes; it does not reorder anything.
  Table-order leases need none of this, because a table order cannot close with a
  pending line.
- A POS command never upgrades its shared lock, and a catalog command never takes
  the row in shared mode, so the row cannot deadlock against itself.
- Locking the row `FOR UPDATE` or `FOR SHARE` requires `UPDATE` privilege on at
  least one of its columns besides `SELECT` (PostgreSQL 16, `SELECT`, confirmed
  through the librarian). The application role holds `UPDATE` on the counter
  only, which suffices.

Settings versions need no lock. A settings change is serialised by rule 2's
primary key. Phase 2's open-order command reads the current version inside its
own transaction and records it; an order whose opening overlaps a settings change
may capture either version, and both are correct, since neither the order nor the
change existed before.

#### 15. What this record needs from C2

C2 decides how a configuration route addresses one record, what a configuration
command answers, the details of `VALIDATION_FAILED`, and the table lock. This
record needs three things of whatever it decides:

- a successful settings command answers with the new current version's number,
  and a successful catalog command answers with the catalog version it produced,
  so that a tab continuing to edit carries the right number without a re-read;
- the settings read and every catalog read used to build a form return the version
  number they were read at (rule 11);
- `SETTINGS_CHANGED` and `CATALOG_CHANGED` carry no details, so C2's details
  design for `VALIDATION_FAILED` need not consider them.

## Options considered

### How the current settings version is identified

- **A `uuid` key with the latest `created_at` as current.** Rejected:
  `created_at` defaults to `now()`, the transaction's start time, so two versions
  made in one transaction tie, and two concurrent transactions can commit in the
  opposite order to their start times. ARCH-006 §5's finding.
- **`clock_timestamp()` instead of `now()`.** Rejected: a wall clock is not
  monotonic, can tie at its resolution, and still says nothing about which
  concurrent change should win.
- **An `is_current` flag with a partial unique index.** Rejected: switching the
  flag is an `UPDATE` of an immutable table, so the application would need the
  very privilege rule 1 denies.
- **A mutable pointer row naming the current version.** Rejected: a second source
  of truth that can disagree with the versions, an `UPDATE` grant, and either a
  seeded row (B-24's spirit, if not its letter) or a creation race.
- **An identity column, current = highest id, with no expected-version check.**
  Rejected: sequence values are allocated at insert, not at commit, so the highest
  id is not necessarily the last change committed, and without the check a stale
  form silently replaces a newer rate, which is the last-write-wins §17.9 rejects
  for money.
- **A server-assigned version number as primary key, with the expected version
  carried by the command (chosen).** The key orders versions, makes the next
  number unique so that concurrency cannot produce two "current" rows, gives the
  manager a meaningful number ("version 4"), and needs no lock.

### Which settings changes make a version

- **Only rate changes; business details in a separate mutable row.** Rejected: a
  second table, with an `UPDATE` grant and a seed or upsert, for fields that end
  up on an immutable receipt; and the version an order captured would no longer
  describe the details it is printed with, so the receipt would need a second rule
  for where its details come from.
- **Separate version tables for rates and for details.** Rejected: an order would
  capture two versions, and "current settings" would be two answers.
- **Every change makes a whole version (chosen).** One table, one current version,
  one reference per order; receipts take everything from the order's version.

### Currency and precision

- **Stored in each version, checked to be IDR and 0.** Rejected: two columns that
  can hold one value each record nothing, invite the reading that a version could
  differ, and bring back the "repeat the last version's currency once an order
  exists" mechanism FR-M1 no longer needs.
- **Stored and editable before the first order**, with precision-general clients.
  Rejected by the owner's Q5 ruling.
- **Installation constants, shown by the back office (chosen).**

### The calculation-policy version

- **Not stored until Phase 2 computes a total.** Viable, because adding a column
  with a default of 1 to the table would be exact. Rejected because Phase 2 would
  then alter an immutable table that already has rows, and ARCHITECTURE §5.1
  already lists the field.
- **A free integer the server writes, with no database check.** Rejected: a code
  change alone could then start writing policy 2, with no migration and no
  decision about the orders still open under policy 1.
- **Stored, pinned to 1 by a check (chosen).**

### One catalog counter or two

- **Two counters on the one row: a content version, advanced by names, prices,
  options and presets and carried by commands; and a revision, advanced also by
  availability and polled.** This has a real merit: an 86 during service would
  not make an add of an unrelated item fail with `CATALOG_CHANGED` for the up to
  two seconds before the POS polls, and availability would be refused only where
  it matters, with `ITEM_UNAVAILABLE`. Rejected because ROADMAP Phase 1 now states
  that availability advances "the catalog version that later POS commands carry",
  because ARCHITECTURE §5.1 and §4.3 describe one number, and because what it
  saves is small: a cashier whose add lands in that window sees the menu refresh
  and taps again. If the owner prefers it, it is a ROADMAP wording change and an
  amendment of rules 9, 10 and 12, not a new mechanism.
- **One counter, availability included (chosen).**

### Global or per-record versions

- **A version per catalog record, carried per record by POS commands.** Rejected:
  an add-line would carry versions for an item, a variant and several modifiers;
  the POS would still need a global revision to know when to refetch; and §8
  already requires one coordination row for the locks. Every advantage it has
  over a global version is a refusal avoided while the menu is being edited
  during service, which is rare.
- **One global version (chosen).**

### Whether back-office catalog commands are version-checked

- **No check: each command applies to current state.** Rejected by §17.9: a form
  saved after another tab repriced the same item would silently restore the old
  price.
- **A version per record, checked only for edits of that record, with
  `VERSION_CONFLICT`.** Precise: only a change to the same record refuses an edit.
  Rejected because it adds a second versioning concept and a column to every
  catalog table, to avoid refusals that the supported runtime shape (one
  back-office client, ARCHITECTURE §3.1) produces only from a manager's second
  tab or a second manager. It also leaves Phase 1 without an emitter of
  `CATALOG_CHANGED`, so the code would enter the contracts only in Phase 2.
- **Every catalog command checked, state changes included.** Rejected: an urgent
  86 refused because someone edited a price elsewhere is worse than useless, and
  a state command overwrites nothing.
- **Edits checked against the global version with `CATALOG_CHANGED`; state
  commands and creates unchecked (chosen).**

### The settings conflict code

- **`VERSION_CONFLICT`**, which §13 lists for an order's aggregate version.
  Rejected: Phase 2 will give that code details carrying the current order
  (§8, "a structured conflict with current state"), and a back-office settings
  refusal would then share a code whose details describe an order.
- **`CATALOG_CHANGED`.** Rejected: settings are not catalog, and FR-C7 says so.
- **`SETTINGS_CHANGED` (chosen)**, a code of its own with no details.

### The coordination point

- **Advisory locks keyed by name.** Rejected: invisible in the schema, not covered
  by the privilege test, and easy to take in the wrong order.
- **A lock on each affected catalog row instead of one row.** Rejected: an
  add-line would lock an item, a variant and its modifiers in an order that must
  match every catalog command's, and FR-G13 would need to lock every item on a
  quick-sale order; one row is §8's design and is enough for one restaurant.
- **The counter's own row, `FOR UPDATE` by writers and `FOR SHARE` by readers
  (chosen).**

## Consequences

- **ARCHITECTURE.md is amended in the same branch**, so that the owner accepts the
  amendments with this record, as with ADR-010 and ADR-011. The amendments:
  - **§4.3**: the catalog paragraphs say that the revision the POS polls and the
    version commands carry are one number, that availability advances it, that a
    projection reports it from the same snapshot as its contents, and that
    back-office catalog edits carry it.
  - **§5.1**: the SettingsVersion row names the version number, the five business
    details and the calculation-policy version, and says currency and precision
    are installation constants; the CatalogRevision row describes the one
    coordination row and its version; the Variant and Modifier rows say each
    belongs to one item (Modifier's "applicability" made exact).
  - **§5.2**: "Currency and precision become immutable after the first order"
    becomes "Currency and precision are fixed for the installation (IDR, 0) and
    are not stored in a SettingsVersion"; the Receipt bullet says its business
    fields come from the SettingsVersion its order captured.
  - **§8**: the lock-order paragraph names the `FOR UPDATE` and `FOR SHARE` modes,
    the commands that take each, quick-sale lease acquisition, and the 86-versus-
    lease serialisation, and that a settings version needs no lock; the
    constraint list gains the single catalog coordination row, unique settings
    version numbers with rates from zero to 1,000,000 parts per million, and
    settings versions among the immutable records.
  - **§13**: the codes paragraph gains `SETTINGS_CHANGED`, says what carries the
    catalog and settings versions, and says rates cross as canonical integer
    strings of parts per million.
  - **§16**: the row "Permitted rate range is unresolved" is deleted; the owner
    ruled it (2026-10-06, 2026-10-20).
  - **§19**: item 1 (restaurant time zone), item 3 (rates, with the zero to 100
    percent bound) and item 5 (back-office kitchen-ticket reprint audit) are
    recorded as closed, in the wording ARCH-017's Handoff drafted, item 3 adjusted
    for the 2026-10-20 ruling; the section's opening sentence says that closed
    items are marked.
  - **§18** gains the ADR-012 row when the owner accepts this record, as for
    ADR-011.
- **ADR-004 is not edited.** Its last consequence, "the product owner must still
  set maximum permitted tax and service-charge rates", is answered by the owner's
  rulings of 2026-10-06 and 2026-10-20, and §19 item 3 records the closure.
- **Phase 2 entry conditions.** The Phase 2 slice that captures the settings
  version when an order opens may not start until the owner has ruled on Pergub
  35/2024 Pasal 8, which puts a service charge inside the PBJT base (owner, Q3,
  2026-10-20). The same slice must refuse to open an order when no settings
  version exists, which is the state of a new installation; its refusal code is
  Phase 2's. The FR-M3 and B-2 wording on half-up rounding is settled before
  Phase 2's totals (owner, Q6(b)), which defines policy 1.
- **The POS keeps its fixture rates** (`apps/pos/src/discount.ts`) until Phase 2
  supplies a settings version; ARCH-006 §7 already lists them for removal then.
- **Two new codes**, each entering `packages/contracts` with its first emitter:
  `SETTINGS_CHANGED` in S2a and `CATALOG_CHANGED` in S4b. Each makes both
  clients' exhaustive code maps fail to compile until it is given a state
  (ADR-011's *Consequences*); the POS, which never receives either in Phase 1,
  places them with its other unexpected codes.
- **The first seeded row since Phase 0**, `catalog_revision` at version 0, is
  proved by a schema test as the throttle rows are. It is not configuration, so
  the Phase 1 Definition of Done's B-24 line ("every new configuration table is
  empty after migration") holds for it.
- **Every name that reaches paper refuses control characters**, settings and
  catalog alike, in the database and at the HTTP boundary.
- **A preserved back-office draft is likely to be stale** when its manager returns
  from M-6 after thirty minutes; its save is then refused with `CATALOG_CHANGED`
  or `SETTINGS_CHANGED`, the draft kept. Design slices D and F should draw that
  state on BO-04, BO-07 and BO-08.
- **Catalog writes are serialised installation-wide.** For one back office that is
  invisible; it is reconsidered with the rest of real-floor concurrency at the
  gate (ARCHITECTURE §3.2).
- Phase 4's FR-G13 is a check added to S5's command after the lock it already
  takes, plus the shared lock in quick-sale lease acquisition; nothing in Phase 1
  is reordered later.

### Trade-offs accepted

- **An 86, or any catalog edit, refuses a POS command built in the two seconds
  before the POS polls** (from Phase 2). The cashier sees the menu refresh and
  repeats the action. Accepted because the contract makes availability part of
  the version, and the refusal is recovered by a tap.
- **A back-office edit is refused when any catalog row changed since its form was
  read**, not only its own. Accepted because only a second back-office tab or a
  second manager can cause it in the supported shape.

### Not decided here

- **C2 (ARCH-019):** how a route addresses one record; what a configuration
  command answers, beyond rule 15; `VALIDATION_FAILED`'s details; whether a list
  read is interactive; name uniqueness among active records, which C1 applies to
  categories, items and presets by inheritance; the DiningTable lock.
- **C4 (S7):** the POS projection and revision routes and their declarations;
  what the POS keeps between polls for Phase 2's commands; the poll while locked;
  how an open item sheet learns of an 86.
- **Phase 2:** the open-order refusal when no settings version exists; whether a
  variant choice is required when an item has variants (FR-C2's "single-select"
  is read as exactly one, but the add-line command is where it is enforced);
  `VERSION_CONFLICT`'s details for the order.
- **Phase 3:** which characters a kitchen printer can render, beyond the control
  characters refused here.
- **Phase 4:** the receipt's content beyond the five business details (PRD §9
  question 1); the lease-acquisition command, of which this record fixes only the
  shared lock on a quick-sale order.
- **Whether a removed variant or modifier can be restored.** The owner's Q10 names
  tables, presets, items and categories; a removed option is re-added as a new one.
- **Whether `created_by` is recorded on a settings version.** C1 recommends it;
  it is attribution, not an audit entry, and the owner ruled settings changes
  unaudited (Q11). The lead decides whether S2a carries it.

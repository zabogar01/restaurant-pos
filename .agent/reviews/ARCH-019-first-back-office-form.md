# ARCH-019 — Consult C2: the first back-office form (tables, plan slice S1)

Author: `architect19`, 2026-10-20. Read-only consult for S1a and S1b (neither written yet), on
`agent/arch-019` cut from `development` at `ffe0bb2`. Nothing was edited except this report and the
task file's Handoff.

## Summary

S1 can be built inside every accepted rule as written. **Nothing here needs a superseding ADR, and
no change to PRODUCT.md, PRD.md, ROADMAP.md or BOUNDARIES.md is proposed.** One owner question is
raised, and it blocks only S3.

The decisions, in the order of the task's ten items:

1. **A record is addressed by an id in the body of a `POST`**, never by a path parameter or a
   query string. Every route-table path stays a fixed string, so the transport core, the
   route-table equality test and ADR-011 rule 16 are unchanged, and a contracts test makes "no
   `?`, `#` or `:` in any route-table path" a checked property. S1 needs no single-record read.
2. **`VALIDATION_FAILED` stays without details on the wire.** The form needs a field list, and it
   gets one from its own check against the shared schema before anything is sent: issue paths
   intersected with the schema's own keys, typed as a union of those literal keys, exactly as
   ADR-011's *Not decided here* specifies. ADR-011 rule 9 ("`VALIDATION_FAILED` carries no
   details") therefore stays literally true and no rule changes. A server-side field list is
   deferred to the first slice that has a representational rule the shared schema cannot hold;
   S1 has none.
3. **Every configuration command answers the authoritative record** (`{ table }`), and the one
   list read answers `{ tables }`. **Reads are not interactive; commands are.**
4. **A label is unique among active tables, compared case-insensitively, enforced by a partial
   unique index** that is the only authority. Reactivating a table whose label an active table
   now holds is refused with a new code, `DUPLICATE` (409), with nothing written; the manager
   renames the inactive table (allowed) and reactivates it. Inactive tables may share labels.
5. **The DiningTable row is the lock.** Update, deactivation and reactivation open with
   `SELECT … FOR UPDATE` on the row before reading its state; Phase 2's open-order command takes
   the same lock after the BusinessDay row and before inserting the Order. Phase 2 then adds one
   check after the lock in deactivation, and reorders nothing. S1a can prove the lock is taken
   first, through the no-op path.
6. **An unknown outcome keeps the draft, rereads, says it could not confirm, and never resends.**
   S1's commands are built so that a manager's own resend is always harmless: a repeated create
   is refused `DUPLICATE`, a repeated rename sets the same label, and a repeated deactivation or
   reactivation is a no-op answered with the record.
7. **The back office gets a small route manifest of its own and a rail that lists only built
   destinations; BO-05 lives inside the keyed working area.** One hazard must be designed out:
   per the HTML specification, a modal `<dialog>` under a `display: none` ancestor still blocks
   the whole document while drawing nothing, so a table form left open when BO-01 appears would
   make BO-01's own fields inert. A working-area dialog is therefore closed (its React state
   kept) whenever the frame is not shown, and reopened for the same manager. S1b's browser test
   proves AC-35's last sentence through M-6 and through BO-01, in both engines.
8. **Cash and card are fixed kinds** that the application never creates, renames or
   deactivates; only custom methods are configuration rows. FR-B7 ("alongside cash and card")
   and B-5 ("Card and custom tenders may not") already read that way.
9. **The `vite build --watch` measurement is the right trigger, measured as edit-to-visible**,
   and C5 is justified if the median over ten warm edits exceeds five seconds.
10. **S1a is the server, the contracts and the compile-required one-line client changes; S1b is
    the back office's screens and the browser test.** Each is specified under *For the lead*.

Two architecture texts are owed, neither by S1: ARCHITECTURE §8's lock order should name the
DiningTable row (wording in *Stale text*), and BO-05's inventory and sitemap entries need the
reactivation and label-in-use states (the designer's, through E1).

## What I verified, and what I could not

Read in this worktree at `525778f`: the task file; the Phase 1 plan whole
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`); `.agent/DECISIONS.md` from
2026-10-05 to the end; ADR-011 whole; ADR-010 rules 1 to 5 and its *Options* and *Not decided
here*; ADR-009's references to configuration and Phase 1; ARCHITECTURE §4, §5, §8, §11, §13, §14 and
§17.9; PRD FR-A1 to FR-A4, FR-B1 to FR-B7, FR-C1 to FR-C8, FR-G1, the edge-case list and AC-27,
AC-28, AC-32, AC-35; BOUNDARIES B-5, B-19 to B-24; SCREEN-INVENTORY BO-05 to BO-08; SITEMAP §3;
DESIGN-011's BO-05 and BO-08 sections, its pattern table and Q5 and Q11; DESIGN-012's Part C and its
round-2 rulings (F1, N1, N2); DESIGN-016's task file (the one-`<main>` question, the rail, BO-02);
ARCH-012 §9; ARCH-014 §3, §5 and §9 and *For the lead* 9; the *For the next agent* sections of
PHASE0-009a, 011b, 011d2, 012a and 012b.

The code read: `packages/contracts/src/` (all), `packages/api-client/src/` (all),
`apps/server/src/http/` (`access.ts`, `errors.ts`, `server.ts`, `validate.ts`, the session guard's
exports, `routes/back-office-auth.ts`), `apps/server/test/route-table.test.ts` and the structure of
`schema.test.ts` and `harness-race.test.ts`, `db/migrations/0002`, `0006` and `0007`,
`apps/back-office/src/` (`OfficeApp.tsx`, `session/api.ts`, `activity.ts`, `source.ts`,
`types.ts`, `useSession.tsx`, the error switch in `realSession.ts`), and `e2e/` (support exports,
`reauthenticate.spec.ts`).

Library and platform facts, from the librarian (`.agent/bin/ask.sh librarian`) and one local run:

- **zod 4.6.5**, run in Node against the repository's installed copy: `Object.keys(schema.shape)`
  and `schema.keyof().options` both list a strict object's declared keys in order; a failed parse
  gives `too_small` at `["label"]`, `invalid_type` at `["area"]`, `invalid_format` at
  `["tableId"]` for a bad UUID, and `unrecognized_keys` at path `[]` with the extra name in
  `keys`; no issue had an `input` property; the unrecognised-key message quotes the client's key
  name. The librarian confirmed from zod.dev that the input is attached only under `reportInput`,
  that a `.refine()` without a path reports path `[]`, and that `z.uuid()` accepts RFC versions 1
  to 8, so a `gen_random_uuid()` value passes.
- **HTML `<dialog>`** (WHATWG HTML §6.3.1 "blocked by a modal dialog", CSS Position 4 §3.1): the
  topmost modal dialog in the top layer makes every other node inert; a top-layer element whose
  ancestor is `display: none` is not rendered but keeps its place in the top layer. The librarian
  found nothing in the specification that ends the blocking when an ancestor is hidden, and did
  not check browser behaviour. Section 7 designs so that either behaviour is safe, and S1b's
  browser test is the evidence.
- **Fastify 5**: `maxParamLength` defaults to 100 and exceeding it takes the not-found path; the
  librarian could not confirm from the documentation that `onRoute`'s `url` keeps a `:id`
  template. Both matter only to the rejected alternative in section 1.

Not done: no code was run except the zod check; no browser was opened; no test was run.

## 1. Addressing one record

**Decided (by the existing rules):** ADR-011 rule 16 requires every request to be addressed by
route-table entry, never by a free URL string, and says the core has no way to add a query string
to a credential route. The route table's paths are fixed strings today, the core sends
`entry.path` exactly (`packages/api-client/src/client.ts`, `transmit`), and `route-table.test.ts`
compares `method path` strings in both directions.

**Recommended: the id travels in the body of a `POST`.** The routes S1a registers:

| Method | Path | Body | Answers | `interactive` |
|---|---|---|---|---|
| `GET` | `/api/back-office/config/tables` | none | `{ tables: TableView[] }` | `false` |
| `POST` | `/api/back-office/config/tables/create` | `{ label }` | `{ table: TableView }` | `true` |
| `POST` | `/api/back-office/config/tables/update` | `{ tableId, label }` | `{ table: TableView }` | `true` |
| `POST` | `/api/back-office/config/tables/deactivate` | `{ tableId }` | `{ table: TableView }` | `true` |
| `POST` | `/api/back-office/config/tables/reactivate` | `{ tableId }` | `{ table: TableView }` | `true` |

Every one is `{ session: 'ACTIVE', audience: 'BACK_OFFICE', interactive }`, under the
`/api/back-office/config/` prefix ARCHITECTURE §13 names. The guard already requires `MANAGER` and,
on the four `POST`s, the anti-CSRF token.

Why the body:

- **Nothing changes in the core, the table or the equality test.** A route-table entry is still a
  fixed string the core sends verbatim. The test needs no notion of a template.
- **The id is validated by the same one helper as every other field** (ADR-011 rule 9). A
  malformed id is the same `VALIDATION_FAILED` as a malformed label, and there is no second
  validator for parameters, no Fastify parameter-length behaviour to classify, and no encoding
  question.
- **It is a command, not a resource replacement** (ARCHITECTURE §13, §17.9). The verb is in the
  path, the subject is in the body, and the server derives the result.
- **Phase 2's idempotency fingerprint covers the subject for free**, because the subject is in the
  body the fingerprint is computed over.
- Ids in a URL are not a secret, so the log rule of ADR-010 rule 2 (path logged, query dropped)
  would not have been broken by a path parameter. That is not the reason; uniformity is.

**Alternatives.**

- *A path template* (`/api/back-office/config/tables/:tableId/deactivate`). It is the common REST
  shape. It loses because it changes three things that every Phase 0 test relies on: the path the
  core sends would no longer equal a table string (the core would need a parameter argument, a
  template literal type and `encodeURIComponent` of a validated id); the equality test would have
  to compare templates, and the librarian could not confirm from the documentation what `onRoute`
  reports for one; and parameters would need their own validation path beside the body helper. In
  my reading this does not contradict the words of rule 16 (a filled template is still addressed
  by entry), but it removes the property "the path sent is a table string", so it is a design for
  a consult, never a builder's improvisation.
- *A query string.* Rejected outright: rule 16 forbids the core a way to add one to a credential
  route, and the simplest way to keep that true is that the core cannot add one to any route.

**What S1 does not need: a single-record read.** BO-05 edits from the list it read, and every
command answers the record it changed. When a later slice needs to read one record (S4c's item
editor after a reload is the likely first), its task chooses between reading it from a list or
parent projection and a `GET` path template; the template then needs the consult described above.
I do not recommend a `POST` read, which would require the anti-CSRF token for a read and blur the
rule that `GET` reads and `POST` acts.

**One cheap guard, new in S1a:** a contracts test asserting that no `ROUTE_TABLE` path contains
`?`, `#` or `:`. It makes "no query string reaches any route, credential routes included" a
checked property instead of a convention, and it fails the day someone adds a template without
the consult.

## 2. `VALIDATION_FAILED` and field placement

**Decided:** ADR-011 rule 9: one helper parses, throws `VALIDATION_FAILED` and drops the result;
`reportInput` is never set; no custom messages; "`VALIDATION_FAILED` carries no details". Its *Not
decided here*: "If a Phase 1 form needs a field list, its consult should build it by intersecting
issue paths with the schema's own keys, so a client's unrecognised key can never appear in it,
typed as a union of those literal keys."

**The form needs a field list. It does not need the server to send one.** ARCH-012 §9 already
observed that "both clients hold the same schema and can say which field is wrong before sending".
The core checks every body against the shared schema before sending it and returns
`invalid-request` without sending (rule 16, rule 20). For an honest client the server's
`VALIDATION_FAILED` is therefore reachable only when the bundle and the server disagree (a tab
left open across a server update), and S1 has no representational rule that the shared schema
cannot express: label length, whitespace and character rules, and the id's format, are all schema.
Uniqueness is not representational; it is a domain refusal with its own code (section 4).

**Recommended:**

- **The field list is built in the back office, from the form's own check, before the core is
  called.** One helper in one module of `apps/back-office` (for example
  `src/forms/fieldsInError.ts`): given a request schema from `@pos/contracts` and a candidate
  body, it runs `schema.safeParse`, takes `issue.path[0]` of each issue, keeps only values that
  are among `Object.keys(schema.shape)`, deduplicates, and returns them **in the schema's key
  order**. Its return type is `ReadonlyArray<keyof S['shape'] & string>`, the union of the
  schema's literal keys. An `unrecognized_keys` issue has path `[]` and so can never contribute;
  the issue objects, their messages and their `keys` are read for nothing else and are never
  stored, rendered or logged. The back office needs no zod dependency for this: the schema and its
  `safeParse` come from `@pos/contracts` (rule 9 keeps zod a dependency of the contracts only).
- **The form places each listed field's error from the design's copy** (rule 24): the field is
  marked `aria-invalid="true"` and described by its own designed sentence, as DESIGN-012's field
  pattern draws it. No message from zod, no message from the server, and no value appears in any
  error text; the value the manager typed stays in their own field and nowhere else.
- **Only when the list is empty does the form call the core.** An `invalid-request` from the core
  after that is a defect (the helper and the core disagree) and is shown as the general failure,
  draft kept.
- **A server `VALIDATION_FAILED` is shown as the general failure, draft kept**, with the designed
  "something went wrong" state that ARCH-014 §9 assigned to the codes an honest client never
  causes. The draft is not cleared and nothing is resent.
- **The server is unchanged:** `parseBody` keeps dropping the result, and `VALIDATION_FAILED`
  keeps no entry in `ErrorDetailsByCode`.

Why this rather than server-sent details:

- **No rule of an accepted ADR changes.** A field list in the envelope would make rule 9's
  sentence "`VALIDATION_FAILED` carries no details" untrue on configuration routes, and the task
  rightly says that a change to a rule's words is a superseding ADR and the owner's call. The ADR's
  own *Not decided here* foresaw a field list, but it did not say it must be on the wire, and the
  version that keeps the wire unchanged needs no question to the owner.
- **The first details type whose content derives from what the client sent** (ARCH-012 §9's
  concern) never comes into existence.
- **One mapping path, not two.** A server list would be a second route to the same field errors,
  exercised only in the rare skew case, and so the path least tested.
- **Server-sent details would buy nothing in S1**: there is no server-only representational rule
  for them to report.

**Alternatives.**

- *Server details, built exactly as the ADR says*: the helper intersects issue paths with
  `Object.keys(schema.shape)`, and `ErrorDetailsByCode` gains `VALIDATION_FAILED: { fields }`,
  typed as the union of the literal keys of every form schema, so the envelope schema refuses an
  unknown name and the client narrows the list to its route's keys before placing it. It is safe
  if built that way, and it is the right design **for the first slice that has a representational
  rule the shared schema cannot hold**. It loses in S1 because it buys nothing there and it puts
  rule 9's wording in front of the owner. When a slice needs it, that slice's consult specifies it
  as above and raises the rule-9 question then.
- *Putting the field list in the core* (`invalid-request` carrying `fields`, typed per route). It
  is elegant, and it moves a form concern into the security-critical transport core that both
  clients depend on, for a need only the back office has; two core tests that assert
  `{ kind: 'invalid-request' }` exactly would change too. Rejected for a back-office helper; a
  later consult can move it if the POS ever has a form.
- *Field validation on every keystroke.* Not an architecture question. The helper can be called on
  blur as well as on submit if E1 draws it; submit-time placement is the floor.

## 3. What a configuration command answers, and which routes are interactive

**Decided:** ARCHITECTURE §13: "Responses return authoritative state". ADR-010 rule 1: a success
can carry warnings, which is why the error envelope is under a named key; success bodies should not
put a record at the top level for the same reason. ADR-011 rule 1: `interactive` has no default,
`true` means a person did this, polling, `me` and health are `false`. ADR-011 *Consequences*: each
command is itself interactive.

**Recommended:**

- **`TableView` is `{ tableId, label, isActive }`**, a strict schema in `@pos/contracts`, with
  `tableId` a UUID string. Nothing else: no timestamps (nothing reads them), no seat count
  (owner's Q10), and no area (below).
- **Every command answers `{ table: TableView }`**, the row as committed, read in the command's own
  transaction (`RETURNING`, or the locked row on a no-op). The list read answers
  `{ tables: TableView[] }`, all tables active and inactive, in a stable order (`created_at`, then
  `id`). How the list is sorted and grouped on screen is E1's.
- **The client replaces its copy of the record with the answer** (or inserts it, for a create).
  It does not reread the list after a successful command; it rereads after `DUPLICATE` (so the
  manager sees the table that holds the label), after `NOT_FOUND`, and after an unknown outcome
  (section 6). BO-05 does not poll.
- **The list read is not interactive; the four commands are.** A person's click that opens BO-05
  already reports activity through the one input listener (rule 21). The list is also reread by
  the page itself, after an unknown outcome or a refusal, and a read marked interactive would let
  those page-initiated reads extend a session (FR-A2b, AC-28). A command is always a person
  pressing a control.

**Alternatives.** *Commands that answer 204 and a list reread after each*: an extra request per
command, and a window in which the screen shows a state the server does not hold. *The whole list
from every command*: it hides which record changed and grows with the table count. *An interactive
list read*: rejected above.

**Area.** ARCHITECTURE §5.1 gives DiningTable an "optional area". Nothing in the PRD, the screen
inventory, the sitemap or any Frost or prototype artifact reads or draws one (`P/tables.html` draws
name, seats, status and current order; `F/pos/floor.html` has no grouping). By the owner's Q10
reasoning for seats ("nothing in the MVP reads one"), **S1 does not build it.** "Optional" in §5.1
is satisfied by its absence; a later slice whose screen groups tables adds a nullable column by a
forward migration. This is a lead ruling, not an owner question, because the contract never names
an area.

## 4. Label uniqueness and reactivation

**Decided:** FR-B2 "create, edit, deactivate and reactivate" (Q10); B-24: no seeded table, an empty
list is the starting state; B-20: no partial state.

**Recommended (lead rulings for S1a's task file; none contradicts the contract):**

- **A label is 1 to 32 characters, with no leading or trailing whitespace and no control
  character** (Unicode category Cc). The schema is the precise rule; the length is in UTF-16
  units, as zod's `max` counts. The form trims before checking, and the schema refuses an
  untrimmed label rather than transforming it, so the server stores exactly what it validated and
  a request schema's input and output types stay the same. The database backstop is a check
  constraint on `char_length(label)` between 1 and 32 (code points never exceed UTF-16 units, so
  the backstop never refuses what the schema accepts) and on no leading or trailing whitespace.
  If E1 draws a different length, E1 wins; 32 fits "Terrace 12" with room.
- **Uniqueness is among active tables only, compared case-insensitively, across the whole floor.**
  "T1" and "t1" are the same label to a cashier choosing a table, and nothing groups tables
  (section 3), so there is no second key to scope it by. The authority is one partial unique
  index, `dining_table_active_label_key ON dining_table (lower(label)) WHERE is_active`, under the
  database's default collation. No pre-check is made: a read-then-insert is a race, and the index
  is not.
- **The refusal is a new code, `DUPLICATE`, status 409, with no details.** The domain catches
  SQLSTATE `23505` on that constraint by name and raises `DUPLICATE`; any other unique violation
  is a fault (500). The PostgreSQL error is never logged or copied (its `detail` quotes the
  label); ADR-010 rule 2's serializer would log only the constraint name in any case. The client
  places the refusal on the label field, because the label is the route's one unique field; a
  later form with two unique fields adds a details type then (details are optional, so adding them
  breaks nothing). The name is generic on purpose: S3's custom tender names and S6's preset names
  (if their slices make them unique) reuse it, with copy per screen.
- **Create, rename to a label an active table holds, and reactivation into a held label are each
  refused `DUPLICATE` with nothing written.** Renaming an inactive table is allowed, even to a
  label an active table holds, because the index ignores inactive rows. That gives the manager
  the way out of a refused reactivation: rename the inactive table, then reactivate it, or
  deactivate the other one first. E1 draws that state; reactivation does not take a new label in
  the same command, which would be a second way to rename.
- **Several inactive tables may share a label.** They are history, and a deactivated table's label
  may be reused, as a deactivated user's PIN may (FR-A4).

**Alternatives.** *Case-sensitive comparison*: lets two tables look identical on the floor.
*Uniqueness across all rows, inactive included*: a table deactivated by mistake and re-created
would collide with itself, and a restaurant that renumbers its floor could never reuse "T1".
*No uniqueness*: two "T1"s on the floor make a table order ambiguous to staff, and a manual resend
after an unknown outcome (section 6) could create a second table. *A reactivation that silently
renames, or that deactivates the holder*: changes something the manager did not ask for.

**Not decided here:** Unicode normalisation (two visually identical labels in different
normalisation forms). The keyboard at a restaurant desk produces one form; not addressed.

## 5. The DiningTable lock (plan G1, owner's Q13)

**Decided:** ARCHITECTURE §8: `READ COMMITTED` with explicit row locks; a documented lock order in
which CatalogRevision precedes BusinessDay, BusinessDay precedes Order, and Order precedes
CheckoutLease and ReceiptSeries; order creation and end-of-day close share the BusinessDay row; a
constraint allows at most one `OPEN` order per DiningTable. FR-C8: a DiningTable holding an `OPEN`
order cannot be deactivated. Q13: that refusal arrives with orders in Phase 2.

**The race to prevent.** Under `READ COMMITTED`, a deactivation that checks "no open order" and an
order opening that checks "table active" can each pass its check before the other commits, leaving
an inactive table holding an open order. Both must serialise on one row, and each must read the
state it checks **after** taking the lock.

**Recommended, for S1a now and Phase 2 later:**

- **The DiningTable row is the lock, taken `FOR UPDATE`.** In S1a one domain function, for example
  `lockDiningTable(tx, tableId)`, runs `SELECT … FROM dining_table WHERE id = $1 FOR UPDATE` and
  returns the row or nothing (`NOT_FOUND`). Update, deactivation and reactivation each call it as
  the first statement of their transaction, then decide, then write, then answer. Create needs no
  lock; the unique index serialises it.
- **Deactivation in S1a: lock, then (if already inactive) answer the record and write nothing,
  else set `is_active = false` and answer.** Phase 2 inserts exactly one step between the lock and
  the write: "if an `OPEN` order references this table, refuse", with its own code and the
  order's identity in its details (BO-05 *Must not invent*: the refusal names the order). Because
  that read follows the lock, a concurrent open-order either committed before (its order is seen)
  or waits until after (and then sees the table inactive).
- **Phase 2's open-order command takes the same row lock, after the BusinessDay row and before
  inserting the Order**, and reads `is_active` from the locked row. The lock order becomes:
  CatalogRevision → BusinessDay → **DiningTable** → Order → CheckoutLease, ReceiptSeries. No command
  takes DiningTable and then BusinessDay, so no cycle exists: deactivation, reactivation and rename
  take DiningTable alone, and settlement, void, refund and close never write the table row (a
  closed order frees its table by its own state). Two concurrent order openings on one table also
  serialise on the lock, and the second meets the first's order; the partial unique index on
  orders stays the backstop.
- **Reactivation and rename take the lock too**, for one shape across the commands. Rename gains
  nothing in Phase 2 (renaming a table with an open order is harmless: orders reference the id, and
  any document that prints a table label snapshots it, per §5.2's receipt rule).

**What S1a can prove now.** In Phase 1 an `UPDATE` takes the row lock anyway, so on the paths that
write, an explicit `FOR UPDATE` is indistinguishable from none. The no-op path tells them apart:
with another connection holding `FOR UPDATE` on an **already inactive** table's row, a
deactivation must not return until that connection ends. Without the explicit lock it reads the
row, sees nothing to change and returns at once. That test is the red proof that the lock comes
before the read, which is the property Phase 2 depends on. The same test for reactivation of an
already active table. The deactivation-versus-open-order race test itself belongs to Phase 2's
task, which creates the order table.

**Alternatives.** *`FOR SHARE` in open-order*: two openings on one table would then both pass and
the second would fail on the unique index, a worse refusal than a serialised check; one lock mode
is simpler. *An advisory lock keyed by table id*: a second locking vocabulary beside the row locks
§8 documents, and invisible to the constraint the index holds. *`SERIALIZABLE`*: §8 rejects it for
a documented lock protocol.

**ARCHITECTURE §8 should say this** before Phase 2's plan is written (wording in *Stale text*).
S1a builds to it now; it changes no decision of §8, it fills a gap in its list.

## 6. Unknown outcomes, without a resend

**Decided:** ADR-011 rule 20: a fault, an unparseable body, a timeout or no response leads to one
health read; the result is *failed* (200) or *unavailable*; "the original request is never resent
automatically: a command may have been applied". DESIGN-012 Part C 5: pending, saved, refused (a
definite refusal, edits kept), and outcome unknown ("the page rereads before saying anything, and
never offers to send it again automatically"); its F1 ruling: during pending and unknown,
navigation goes through the leave decision, whose copy says the outcome is not known and that
leaving does not send it again. DESIGN-011 Q11.

**Recommended, the client rule S1b builds and every later form copies:**

| The core's result for a command | Applied? | What BO-05 does |
|---|---|---|
| `ok` | Yes | Replace or insert the record; close the form; *saved* |
| `refused` with `DUPLICATE` | No | Keep the draft; place the refusal on the label; reread the list |
| `refused` with `NOT_FOUND` | No | Keep the draft; the general failure; reread the list |
| `refused` with `VALIDATION_FAILED` | No | Keep the draft; the general failure (section 2) |
| `refused` with `SESSION_IDLE` | No (the guard refused before the handler) | M-6 opens over the form; after the same manager resumes, the draft is there and **nothing is resent**; the manager presses Save again |
| `refused` with `UNAUTHENTICATED` or `FORBIDDEN`, or `session-gone` | No (refused before the handler, or not retried) | The session's own handling (BO-01; the working area kept or destroyed by rule 22) |
| `failed` or `unavailable` | **Unknown** | Keep the draft and the form open; reread the list (a `GET`, not interactive); then show *outcome unknown* with the reread list behind it; offer Save and Cancel as ever, and no "send again" control |

- **The client never infers success from the reread.** A row that now carries the new label may be
  this command or another manager's. The notice says the outcome could not be confirmed and the
  list is current; the manager judges.
- **One command at a time per form**: while one is pending, Save is inert and a second press sends
  nothing (rule 19's discipline, applied to commands).
- **A manager's own resend is always harmless in S1, by design of the commands**: a repeated
  create is refused `DUPLICATE` (the uniqueness rule is also the duplicate guard), a repeated
  rename sets the label it already has, and a repeated deactivation or reactivation is a no-op
  answered with the record. This is why S1 needs no idempotency key (ARCHITECTURE §8 lists none for
  configuration, and plan §5 places the idempotency design in Phase 2). **A command that would
  change nothing writes nothing and answers the record**: deactivating an inactive table,
  reactivating an active one, renaming to the same label.
- **By the ARCH-002 test** (does the step prevent an irreversible harm the server cannot prevent?),
  neither deactivation nor reactivation needs a confirmation step: both are reversible, and in
  Phase 2 the server itself refuses the one harmful case. E1 may still draw one; architecture does
  not require it.

**Alternatives.** *Resend once after a fault*: forbidden by rule 20. *Report failure after a fault*:
untrue when the command committed and the response was lost. *Infer the outcome from the reread*:
wrong when two managers act at once, and the pattern is copied into S2's settings, where a wrong
"saved" would be worse.

## 7. The route manifest, the rail, the keyed working area and AC-35

**Decided:** ADR-011 rule 11 (the reserved shapes: a first segment `assets`, a last segment with a
dot), rule 16 (one core instance in one module, one API module per client), rule 21 (activity only
from the input listener), rule 22 (the keyed working area), rule 23 (fixtures chosen by the build
command, proved absent from a served build), rule 24 (copy from the design), rules 27 and 28 (the
harness). NFR-5 (each client its own route manifest). DESIGN-012 Part C 6 (a stay-or-discard
decision before leaving unsaved work) and its F1 and N2 rulings. PHASE0-011d2's *For Phase 1's
first form*: mount it inside the keyed working area and it inherits M-6.

**The manifest and the rail.**

- **A route manifest of the back office's own**, one module (for example `src/routes.ts`): a
  constant list of `{ path, screen }` with an exhaustive screen type, routed by `history.pushState`
  and `popstate`, with no router dependency for two destinations. A test holds every manifest path
  under `/back-office/`, none with a first segment `assets` and none with a dot in its last segment
  (rule 11). An unknown client path is replaced (`replaceState`) by the landing, which needs no
  copy. **A client path names a screen and nothing else**: no record id, no draft, no query
  string; nothing is read from `location.search` in either build.
- **The rail lists only destinations that exist** (DESIGN-016 Part B 4): Tables from S1b, and the
  landing if DESIGN-016's Handoff places one. Whether a signed-in manager lands on BO-02's empty pane
  or on Tables is DESIGN-016's call (plan §4).
- **The screen is mounted inside the keyed working area** (`children` of `OfficeApp`'s keyed
  `div`), so a different manager's sign-in destroys BO-05's state with the key, as rule 22 says.
  The current path may live outside the key: the path holds no draft.

**How the screen reaches the one core instance.** The core is constructed in `realSession.ts`,
which also holds the API module (rule 16). The session store gains one member, for example
`config`, typed as the API module's configuration routes only (a mapped type over the paths under
`/api/back-office/config/`), so a screen can call the table routes and **cannot** call sign-in,
logout, re-authentication or `activity`. That keeps the existing source scan's property that the
input listener is the only caller of `activity`. Screens read it through a hook beside
`useSession`.

**Fixture mode** (rule 23: the Vite server, no API call). The fixture session's `config` answers
every call `unavailable`, so BO-05 shows its designed failed-to-load state there, writes nothing
and imports no request module. It lives in the fixture-session module, so the existing built-bundle
marker proof covers it. *Rejected*: an in-memory fake of the table commands, which would
reimplement uniqueness and no-ops in a second place and drift from the server; E1's Frost artifact
is where BO-05's states are reviewed, and served mode is where they are built.

**The hazard: a modal dialog in a hidden working area.** The sitemap draws *Table create / edit*
as a modal, and DESIGN-012's dialog pattern is a native modal dialog. Per HTML §6.3.1, the topmost
modal dialog in the top layer makes every other node inert, and CSS Position 4 §3.1 says a
top-layer element under a `display: none` ancestor is not rendered while it keeps its top-layer
place. At BO-01 the working area's `<main>` is `hidden` (`OfficeApp.tsx`). A table form left open
there would, by the specification, draw nothing and still block BO-01's username and password
fields: the manager could not sign in to get their draft back. Under M-6 the problem does not
arise, because M-6's own dialog is opened later and is topmost.

**Rule for S1b and every later working-area dialog:** a modal dialog inside the working area is
open only while the frame is shown. When the session leaves `signed-in` or `idle` for BO-01, the
dialog is closed with `close()`, its React state left mounted, and the `close` event is not treated
as Cancel; when the same manager signs in again it is reopened with `showModal()` before focus is
restored. Under M-6 it stays open behind M-6, visible and inert, as DESIGN-012's `reauth` state
draws. A different manager's sign-in destroys it with the key. The browser test below is the
evidence, because jsdom cannot show a modal's inertness.

**For E1, not decided here:** DESIGN-012's F1 ruling says no page state makes *Log out* or the
kitchen emergency action inert, and its N2 sentence lets a modal decision defer the emergency
action. A native modal table form makes the top bar's *Log out* unreachable while it is open. E1
must say whether the table form is a modal decision under N2 (and whether *Log out* is deferred the
same way) or a non-modal panel. Either is buildable under the rule above.

**Unsaved-work departure.** The form is dirty when its draft differs from the record it was opened
from (or from empty, for a create). With a dirty form, every in-app departure goes through
DESIGN-012's stay-or-discard decision: Cancel, *Escape* (the dialog's `cancel` event is
prevented and replaced by the decision), a rail entry if the form is non-modal, and browser
back or forward (on `popstate` the client restores the path with `pushState` and shows the
decision). While a command is pending or its outcome unknown, the decision's copy says so and that
leaving does not send it again (DESIGN-012 F1). **No `beforeunload` prompt**: its wording is the
browser's, not the design's (rule 24), and rule 22 already states that a reload destroys the
working area. Log out with a dirty form follows E1.

**What S1b's browser test asserts for AC-35** (rules 27 and 28; people through the domain
functions with random credentials; both clocks; requests by the page; state, accessible names and
codes; the credential scan runs as in every test):

- **C1, the same manager through M-6.** Manager A signs in, opens Tables from the rail, sees the
  empty state (B-24), creates a table through the form (a random label) and sees its row. A opens
  that table's edit form, types a new label, and leaves the caret in the field without saving. The
  session is aged by the policy's idle limit plus one second and the page clock moved by the same
  amount; `#root[data-session]` becomes `idle` and M-6's dialog is shown. A enters their password.
  Then: `data-session` is `signed-in`, the edit dialog is open, its label field holds the unsaved
  value and has focus, and pressing Save succeeds and the row shows the new label (the first
  command after a renewal, under the new anti-CSRF token).
- **C2, another manager through M-6.** As C1 up to M-6; manager B uses *Sign in as a different
  manager*. Then: `data-session` is `signed-in`, no edit dialog is open, no input on the page holds
  A's unsaved value, and the list shows the table under its saved label only.
- **C3, the same and another manager through BO-01 with the form open.** As C1 up to the unsaved
  edit; the session's absolute stamp is aged past the policy's absolute limit (relatively, one row,
  from `SESSION_POLICY`, never a literal; a new harness helper beside `ageSession`), and the tab's
  next request is caused the way the existing specs cause one (an input after the activity window,
  with both clocks moved by the same amount), which the server answers `UNAUTHENTICATED`, so the
  tab reaches BO-01 *Session ended* with the working area held. Then: BO-01's
  username and password fields accept typing and its sign-in succeeds (the hazard above). Signing
  in as A shows the edit dialog with the unsaved value (owner, 2026-10-14); a second run signing in
  as B shows none of it (owner, 2026-10-20).
- **Red proofs**, each reverted: a constant working-area key makes C2 and C3's B variant fail;
  leaving the dialog open at BO-01 makes C3 fail at BO-01's fields in at least one engine (if it
  does not fail in either, the Handoff says so, and the rule stays as defence in depth).

Validation placement, `DUPLICATE`, unknown outcomes and departure are **client tests**, not browser
tests (rule 28): they are a component's behaviour against stubbed responses, which jsdom proves.

## 8. Cash and card for S3

**Recommended: fixed kinds the application never creates, renames or deactivates; only custom
methods are rows.**

- **The contract already distinguishes them.** FR-B7 configures "custom named methods alongside
  cash and card"; FR-G1 lists "cash, card, and any custom named method"; B-5 says "Cash may exceed
  the balance … Card and custom tenders may not." Cash carries a rule of its own (change, FR-G4),
  so the code must know which tender is cash; a configurable "Cash" row would make that a row the
  code depends on and a manager could deactivate, leaving the POS unable to take cash.
- **They are like the throttle buckets, not like a menu**: product definitions, not restaurant
  configuration. B-24's list (menu, prices, staff, tax rate, service charge, tables, presets) does
  not include them, and nothing is seeded: the kinds live in code and their display names are
  client copy (rule 24).
- **S3's shape, recommended for its task file:** a `tender_method` table (id, name, active state,
  created time) holding custom methods only, empty after migration (B-24), following this consult
  in every respect: id in the body, the record in the answer, a unique name among active methods
  compared case-insensitively and refused `DUPLICATE`, rename allowed while inactive, the row lock
  first, no-op commands writing nothing. Phase 4's Tender then records a kind of `CASH`, `CARD` or
  `CUSTOM` with the method id for `CUSTOM` and the name snapshot §5.2 requires. Tender types are not
  in FR-C7's catalog list, so they carry no catalog version.
- **For S3 to decide:** whether a custom name may equal the display name of cash or card ("Card").
  The display names are copy, so the server cannot refuse them without knowing the copy; I
  recommend not refusing them and leaving it to the manager.

**Alternative:** cash and card as seeded rows with a `kind` column and protections against renaming
or deactivating them. It needs a seed (which B-24's spirit and the "empty after migration" proof
both dislike), guards that exist only to undo the configurability it introduced, and it still needs
the kind in code. Rejected.

**Owner question for S3 (OQ1, below):** FR-B7 says create, rename and deactivate; Q10's
reactivation ruling named tables, presets, items and categories, not tender types.

## 9. The faster development loop (C5): the trigger and the number

**Decided:** ADR-011 rule 23: served mode is the server with `vite build --watch` beside it and a
reload; fixture mode is Vite with no API call; *Not decided here*: C5 is designed only if the watch
build proves too slow once Phase 1 has screens against real routes.

**The measurement is the right trigger, if it measures what a developer waits for.** S1b's builder
records, on their machine, with the server and the back office's watch build running and BO-05 open
and signed in:

1. ten consecutive warm edits, each a one-line visible change to a BO-05 component, timing from the
   file save to the watch build's completion line and from the save to the reloaded page showing
   the change, signed in, at BO-05;
2. the median and the slowest of each, the first (cold) build separately, the machine, and the
   built bundle's size;
3. in words, what the reload loses: the open form and its draft are destroyed by every reload
   (rule 22), so working on a form state means re-opening and re-typing it each time.

**C5 is justified if the median save-to-visible exceeds five seconds**, or if any warm rebuild is a
full rebuild over ten seconds. Below that, the served loop is a reload away, and fixture mode keeps
hot reload for layout work against E1's artifact. Item 3 is not a number and is not a trigger on
its own: C5 would bring hot replacement that keeps component state, but it also brings a second
serving path the rule-23 separation must survive, which is a cost to weigh only when the time
number says the loop hurts. The lead decides from the Handoff.

## 10. The split

**S1a, server**, is the record, its grants, the domain commands with the lock, the routes, the
contracts, and the one-line client changes the compiler forces (the back office's API module must
declare every back-office route, and both clients' code switches must place `DUPLICATE`). It waits
on S0 (the migration-on-disk check) and on nothing in design. **S1b, client**, is the manifest,
the rail, BO-05 and its form, departure, the store's `config` member, and the browser test. It
waits on S1a, E1 and DESIGN-016's accepted Handoff. The full items are under *For the lead*.

## For the owner

**OQ1. May a deactivated custom tender method be reactivated?** (blocks S3 only; nothing in S1.)
FR-B7 reads "create, rename, and deactivate custom named methods alongside cash and card". Your Q10
ruling (2026-10-20) restored tables, presets, items and categories, for the reason that
deactivation is the only removal and a record deactivated by mistake would otherwise be re-created
under a new identity; tender types were not named. **Proposed: yes, for the same reason**, with
FR-B7 reading "Manage tender types: create, rename, deactivate and reactivate custom named methods
alongside cash and card. B-24 makes this configuration, so a cashier never types a tender name as
free text on the fastest screen in the product." The alternative is FR-B7 as it stands, and a
method deactivated by mistake is created again under its name.

Two readings the lead may confirm with the owner if it wishes, and which I do not think need it:
cash and card are fixed and always offered (section 8, as FR-B7 and B-5 read); and a table label
is unique among active tables, case-insensitively, across the whole floor (section 4).

## What the pattern needs from ADR-012

Tables have no version. Where the pattern meets a versioned record (S2's settings, S4's catalog,
S5's 86, S6's presets), it needs ADR-012 to say, and leaves the mechanism to it:

1. **What a command carries and what it answers.** Each versioned command carries the version its
   form was built on, and answers the authoritative record together with the version after the
   change, so the client's next command carries the right one without a reread. The list read
   carries the version it was read at.
2. **That a manual resend of an applied command is refused, not applied twice.** With an expected
   version, the resend after an unknown outcome is stale and refused (section 6's table relies on
   uniqueness and no-ops instead). For settings, ADR-012 must also say whether a change identical
   to the current version makes a new version; I recommend not.
3. **The stale refusal's code and details**, and whether the refusal carries the current state or
   the client rereads. Section 6's table gains a row for it; the client rereads either way.
4. **The order of checks**: the expected version against uniqueness (`DUPLICATE`) and against
   `NOT_FOUND`. I recommend lock, then version, then the domain checks, so a stale command is
   refused as stale before it is judged on stale assumptions.
5. **The lock order**: the catalog coordination row first, then the affected record's row, as §8
   already says for catalog commands; this consult's "lock, decide, write, answer" shape holds with
   the coordination row prepended.
6. **Whether reactivation and the 86 advance the version** (Q10 made items, categories and presets
   reactivatable; FR-C7's list and §4.3's poll are ADR-012's open question).

Nothing else of this consult depends on ADR-012: addressing, validation placement, the answers'
shape, `DUPLICATE`, the no-op rule, the unknown-outcome presentation and the manifest apply to the
versioned slices unchanged.

## Stale text found

None in the four contract documents. Three architecture and design texts:

1. **ARCHITECTURE §8, the lock order** (mine to amend, but not in a read-only consult; it fits
   ADR-012's ARCHITECTURE amendments, which touch the same paragraph, or a small architect task
   before the Phase 2 plan). Replace "BusinessDay precedes Order; Order precedes CheckoutLease and
   ReceiptSeries." with: "BusinessDay precedes DiningTable, and DiningTable precedes Order; Order
   precedes CheckoutLease and ReceiptSeries. Opening a table order, and deactivating, reactivating
   or renaming a table, lock the DiningTable row before reading its state, so a deactivation and an
   order opening on the same table serialise and the deactivation's open-order check (FR-C8) sees
   any order committed before it."
2. **SCREEN-INVENTORY BO-05 and SITEMAP BO-05** (the designer's, for E1). The inventory's purpose
   says "create, edit, deactivate tables" and its states have no reactivation and no refused label;
   since Q10 and this consult it should read, for the purpose, "Define the floor: create, edit,
   deactivate and reactivate tables." and gain the states *label in use — create, rename or
   reactivation refused* (FR-B2) and *reactivated table*; the state *deactivation rejected — table
   holds an OPEN order* stays, marked as arriving with Phase 2's orders (Q13), so S1b does not
   build a state no Phase 1 server can emit. The sitemap's BO-05 gains "[INLINE] Label in use —
   refused" and a reactivate action beside the create/edit modal. Q10 also removed seats, which
   `P/tables.html` still draws.
3. **The Phase 1 plan's S1 goal** says "creates, edits and deactivates tables". Q10 added
   reactivation; the plan says later consults win, so this is recorded, not edited.

Not stale, recorded so it is not mistaken for an oversight: ARCHITECTURE §5.1's "optional area" is
not built (section 3), and ADR-011 rule 9 stays true word for word (section 2).

## For the lead

Each item below is written to be copied into a task file.

### S1a — server: the table record, the commands, the routes

- **Touches:** `boundaries` (FR-A2c: five new back-office route declarations; B-24: an empty table
  after migration; B-20: one transaction per command, nothing written on a refusal). Not
  `identity`: the guard, the session and the credential domain are untouched. The browser suite
  runs before merge (rule 27: a migration, the contracts and the HTTP layer).
- **Depends on:** S0 merged (the migration-on-disk check), this consult. Not on E1.
- **Owns** (globs): `db/migrations/<next>_dining_table.sql`; `apps/server/src/domain/dining-table.ts`;
  `apps/server/src/http/routes/back-office-tables.ts` and its registration in
  `apps/server/src/http/server.ts`; `packages/contracts/src/tables.ts`, `routes.ts`, `errors.ts`,
  `index.ts`; `packages/api-client/src/specs.ts` and `client.ts` (`ROUTES` names only);
  `apps/back-office/src/session/api.ts` (the five functions, declared, not called by any screen);
  the `DUPLICATE` case in `apps/back-office/src/session/realSession.ts` and
  `apps/pos/src/session/realSession.ts` (placed in each switch's general-failure group);
  `apps/server/test/**`, `packages/contracts/test/**`, `packages/api-client/test/**`.
- **Scope.**
  1. Migration: `dining_table` (`id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `label text NOT
     NULL`, `is_active boolean NOT NULL DEFAULT true`, `created_at timestamptz NOT NULL DEFAULT
     now()`), the label check constraint of section 4, the partial unique index
     `dining_table_active_label_key ON dining_table (lower(label)) WHERE is_active`, and the grants
     in the same file: `SELECT, INSERT` on the table and `UPDATE (label, is_active)` only; no
     `DELETE`. No row is inserted.
  2. Contracts: `TableView` (`{ tableId, label, isActive }`, strict); the four request schemas
     (`create { label }`, `update { tableId, label }`, `deactivate { tableId }`,
     `reactivate { tableId }`, strict, no transforms, no custom messages, `tableId` as `z.uuid()`,
     the label rule of section 4 as one shared schema value); the two response schemas
     (`{ table }`, `{ tables }`); the five route-table entries of section 1; `DUPLICATE` (409) with
     no details, in `ErrorCode`, the `ErrorBody` union and its completeness check.
  3. Domain: create, update, deactivate, reactivate and list, each one transaction. Update,
     deactivate and reactivate start with the one locking read (`lockDiningTable`); a missing row
     is `NOT_FOUND`; a command that would change nothing writes nothing and answers the record; a
     unique violation on `dining_table_active_label_key` is `DUPLICATE`, any other is a fault; the
     PostgreSQL error is never logged or copied. No audit entry (owner's Q11).
  4. Routes: the five, each `{ session: 'ACTIVE', audience: 'BACK_OFFICE', interactive }` (list
     `false`, commands `true`), parsing with the existing `parseBody` unchanged, answering
     `{ table }` or `{ tables }`.
  5. The compile-forced client lines: `SPECS` entries, `ROUTES` names, the five back-office API
     functions, and `DUPLICATE` in both clients' general-failure groups. No screen.
- **Acceptance criteria, each with its red proof** (the builder reverts each and says so):
  1. The route table equals the registered routes and each route's `interactive` equals its
     declaration (`route-table.test.ts`, data-driven, unedited). *Red:* remove one new entry from
     `ROUTE_TABLE`: case 8 fails.
  2. No `ROUTE_TABLE` path contains `?`, `#` or `:` (new contracts test). *Red:* append `?x` to
     one path: the test fails (and so does the equality test, which is expected).
  3. Each new route refuses a request with no back-office cookie or with a POS session's token in
     it (401 `UNAUTHENTICATED`), a back-office session whose user is no longer a manager (403
     `FORBIDDEN`), and, on the four `POST`s, a missing or wrong anti-CSRF header (403
     `CSRF_REFUSED`) with nothing written. One loop over the new entries. *Red:* declare one
     command `{ session: 'OPTIONAL', audience: 'BACK_OFFICE' }`: the loop's no-cookie case fails
     (and `access.test.ts` case 7's explicit list, which is expected).
  4. `dining_table` is empty after migration, and `pos_app` has exactly `SELECT, INSERT` and
     `UPDATE (label, is_active)` on it; a `pos_app` `DELETE` and an `UPDATE` of `id` or
     `created_at` are refused (`schema.test.ts`, the privilege map and new cases;
     `harness-race.test.ts`'s table list). *Red:* add `DELETE` to the grant: case 1 fails.
  5. Create, rename and reactivation each answer `DUPLICATE` (409, body exactly
     `{ "error": { "code": "DUPLICATE" } }`) when an active table holds the label in any case, and
     write nothing (the table's rows are unchanged). Two inactive tables may share a label, and an
     inactive table may be renamed to a label an active table holds. *Red:* create the index on
     `label` instead of `lower(label)`: the case-variant test fails.
  6. Two concurrent creates of one label (two connections, a barrier) end with exactly one row and
     one `DUPLICATE`; the same for two concurrent reactivations of two inactive tables sharing a
     label. *Red:* drop the index: both succeed.
  7. The log-scan marker test: a create refused `DUPLICATE` whose label is a marker string leaves
     the marker in no log line and no response. *Red:* copy the database error's `detail` into the
     log line: the marker appears.
  8. With another connection holding `FOR UPDATE` on an inactive table's row, a deactivation of
     that table does not return before the other connection commits (observed by a deadline the
     test sets, then by the call completing after the commit); the same for reactivating an active
     table. *Red:* remove the locking read: the no-op returns at once and the test fails.
  9. A no-op deactivation or reactivation answers the record and does not write the row (its
     `xmin` is unchanged). *Red:* make the write unconditional: `xmin` changes.
  10. Each command answers the record as committed, and a following list read contains exactly
      that record; an unknown `tableId` is 404 `NOT_FOUND` with nothing written; a malformed
      `tableId`, an empty, over-long, untrimmed or control-character label and an extra key are each
      400 `VALIDATION_FAILED` with no details. *Red:* accept an untrimmed label in the schema: its
      case fails.
  11. No table command writes an audit entry (the count of `audit_entry` is unchanged across all
      five). *Red:* not needed; it is a guard against a later change, and the Handoff says so.
  12. `error-details.types.ts` gains the `DUPLICATE` block: a details argument does not compile.
  13. `npm run verify` green; `npm run test:e2e:all` green (no browser test changes).
- **Tests expected to change:** `schema.test.ts` (the privilege map, new cases),
  `harness-race.test.ts` (the table list), `error-details.types.ts` (additions). Nothing else
  should change; a change elsewhere is reported in the Handoff with its reason.
- **The Handoff must carry forward:** the exact route names, schema names and `TableView`; that
  `lockDiningTable` is the lock Phase 2's open-order and deactivation checks share, and where
  Phase 2's check goes; the no-op rule; that `DUPLICATE` is generic and reusable.

### S1b — client: the manifest, the rail, BO-05, and AC-35 in the browser

- **Touches:** `boundaries` (B-24: the empty list as the starting state; FR-A2b and the owner's
  2026-10-05, 10-14, 10-16 and 10-20 draft rulings through AC-35), `identity` (the keyed working
  area, M-6, BO-01 with the draft held). The browser suite runs before merge.
- **Depends on:** S1a merged; design **E1** (BO-05, with the reactivation and label-in-use states,
  the decision on a modal or non-modal form and *Log out* under it, the unsaved-departure copy and
  the outcome-unknown copy) reviewed; DESIGN-016's accepted Handoff (the rail and the landing).
- **Owns** (globs): `apps/back-office/src/**`, `apps/back-office/test/**`, `e2e/tests/<new spec>`,
  and additions to `e2e/support/**` (the absolute-stamp helper).
- **Scope.**
  1. The route manifest and the rail (section 7); the landing per DESIGN-016.
  2. The store's `config` member, typed to the configuration routes only, and its hook; the fixture
     session's `config` answering `unavailable`.
  3. BO-05: loading, empty, failed to load with *Try again*, the list (active and inactive), create,
     rename, deactivate and reactivate, all copy from E1.
  4. The form: the field-list helper of section 2 before every call; placement on fields; the
     result table of section 6; one command at a time; the departure decision; the dialog rule at
     BO-01.
  5. The browser spec C1 to C3 (section 7), in Chromium and WebKit.
  6. The C5 measurement (section 9), in the Handoff.
- **Acceptance criteria, each with its red proof:**
  1. The rail shows Tables, and pressing it shows BO-05 at its manifest path; a manifest test holds
     every path under `/back-office/`, none with a first segment `assets` and none with a dot in the
     last segment. *Red:* add `/back-office/tables.html`: the test fails.
  2. A screen cannot name an `/auth/` route through `config` (a type test with `@ts-expect-error`),
     and the existing source scans still pass (one core instance, `activity` sent only from the
     listener).
  3. BO-05 against stubbed responses: the empty state when the list is empty; the failed state and
     *Try again* when it fails; a create, a rename, a deactivation and a reactivation each replacing
     the row with the record answered.
  4. Field placement: a draft with an empty label sends nothing and marks the label field invalid
     with its designed sentence; the error text contains no zod message and not the typed value; a
     body with an extra key never puts that key's name anywhere in the DOM. *Red:* return every
     `path[0]`, unfiltered: the extra-key case fails.
  5. `DUPLICATE` keeps the draft, places the refusal on the label and rereads the list.
  6. A command answered 500 (health 200) and one with no response (health unreachable) each keep
     the draft, send exactly one list reread and no second command, and show *outcome unknown*.
     *Red:* resend the command once after a fault: the count of command requests becomes 2.
  7. A second Save press while a command is pending sends nothing.
  8. `SESSION_IDLE` on Save opens M-6 over the form; after the same manager resumes, the draft is
     there and no command was resent.
  9. With a dirty form, Cancel, *Escape* and browser back each show the stay-or-discard decision,
     and *Stay* keeps the draft and the path; with a clean form none does.
  10. A working-area dialog open when the session reaches BO-01 is closed with its state kept, and
      reopened for the same manager; a different manager's sign-in destroys it (client test with
      stubs).
  11. In the browser (C1 to C3, both engines): the three cases of section 7, with their red proofs.
  12. Fixture mode: BO-05 shows the failed-to-load state and makes no request; the built-bundle
      proofs (plain and with `NODE_ENV=development`) still find no fixture marker.
  13. `npm run verify` green; `npm run test:e2e:all` green, the new spec included.
- **Tests expected to change:** `apps/back-office/test/sign-in.test.tsx` (its assertion that the
  rail is empty, `:57`); `OfficeApp.tsx`'s header comment ("there is no navigation entry"). The
  e2e specs that select `.bonav`, `.botop` and `.bocontent` should pass unchanged; if one does not,
  the Handoff says why.
- **The Handoff must carry forward:** the accessible names the spec drives (from E1); the dialog
  rule at BO-01 and whether either engine showed the blocking; the C5 numbers; what a later form
  copies (the helper, the result table, the departure decision, the dialog rule).

### For the lead, beyond the two task files

1. **ARCHITECTURE §8's lock order** (*Stale text* 1) is owed before the Phase 2 plan; it can ride
   with ADR-012's ARCHITECTURE amendments.
2. **E1's brief** should carry section 7's modal-dialog finding, the *Log out* question under
   DESIGN-012 F1 and N2, the label-in-use and reactivation states, that no confirmation is
   required by architecture for deactivation or reactivation, and *Stale text* 2.
3. **OQ1** goes to the owner before S3's task file.
4. **S3's task file** takes section 8 whole, and **S2, S4b and S6** take sections 1, 2, 3 and 6 and
   the field-list helper, with ADR-012's answers to the six points above.

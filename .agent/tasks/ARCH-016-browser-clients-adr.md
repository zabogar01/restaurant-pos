---
id: ARCH-016
title: ADR-011 (Proposed), the browser clients, their sessions and what is served to them, with the ARCHITECTURE.md amendments it needs
category: arch
touches: [identity, boundaries]
depends_on: [PHASE0-012a]
owns: [docs/decisions/**, docs/ARCHITECTURE.md]
status: not-started
cycles: 0
---
# ARCH-016 — The browser-clients ADR

**Written** 2026-10-17 by the lead. **Owner:** `architect16`, Claude Opus 5.5, opened by hand.
**Branch and place:** `agent/arch-016`, cut from `development` at `33eb910`, in the worktree
`../restaurant-pos-wt/ARCH-016`. Write only `docs/decisions/ADR-011-*.md`, `docs/ARCHITECTURE.md` and this task file's
Handoff. ADR-008 is reserved (deferred by the owner, 2026-10-06), so the next number is **ADR-011**.

## Why this task exists

Three consults each found rules that bind every client screen and every route in every later phase, and each
recommended recording them in an ADR rather than in task files that one builder reads once:

- **ARCH-012** (plan Task 9), *For the owner* 1: a sessions-over-HTTP ADR: the route declaration and its startup
  refusals; that no route accepts either cookie; the two cookies, their paths and their lack of a lifetime; the derived
  anti-CSRF token, its header and where it is checked; that the sign-in routes carry none, and why; the six codes and
  the rule that none reveals the other surface. It would amend §7.2 and §13.
- **ARCH-014** (plan Task 11), *For the owner* 3: an ADR on the browser clients and what is served to them: the bundles,
  their fallback, cache headers and the content-security policy (left open by ADR-010's *Not decided here*); one
  request path; the retry that must not change the actor; the server as the only clock; fixtures chosen by the build
  and proved absent from a served bundle; copy owned by the design documents. It would amend §3.1, §4.3, §7.2, §13 and
  §14.4.
- **ARCH-015** (plan Task 12), §8: the same ADR should cite 012a's case A2 (the `Secure; HttpOnly; SameSite=Strict`
  cookies stored and resent under a certificate exception, automated, in Chromium and WebKit) instead of a hand check,
  and carry a section amending §14.3 and §14.4 with the harness's standing rules.

The owner commissioned **one** ADR taking in ARCH-012's on 2026-10-13, and on 2026-10-17 said to open it now, beside
PHASE0-012b. All of the above is built and merged: PHASE0-009a and 009b (routes and sessions), 011a to 011d2 (the
served bundles and both clients), 012a (the harness). The ADR records what is built and why; it does not redesign it.

## Decided: do not reopen (`.agent/DECISIONS.md`)

1. **2026-10-08:** `localhost` is one cookie jar shared with every local server, accepted for the MVP; the kit makes
   the certificate and never installs trust; the browser warning is clicked through once per profile.
2. **2026-10-13:** in Phase 0 the served POS shows fixture screens and approval stand-ins under a real sign-in, each
   stand-in going when its server command arrives.
3. **2026-10-13:** accepted for the loopback MVP: a browser may offer to save a manager's back-office password. "A
   review of browser-saved back-office passwords on machines that staff share" joins the §3.2 gate list; **the
   architect writes it there** (this task).
4. **2026-10-13:** one ADR, `Proposed`, on the browser clients and what is served to them, taking in ARCH-012's.
5. **2026-10-14:** from M-6, a different manager signing in destroys the idled manager's unsaved draft; after the
   eight-hour limit, the same manager signing in again in that tab gets their draft back.
6. **2026-10-14:** the transport core supports one cookie-changing request (sign-in, re-authentication, release,
   logout) at a time per tab; the screens enforce it; the two-tab case stays under ADR-010's accepted shared-jar risk,
   "for the §3.2 gate and the commissioned browser-clients ADR".

## Not decided: the owner has not answered these (state them as the ADR's proposal, and flag them)

- **ARCH-012 *For the owner* 2, the FR-A2c reading:** "shared read routes may accept either" read as a permission the
  architecture does not use; a read both clients need is served under both prefixes by the same code, and no route
  accepts both cookies. The lead recommends confirming.
- **ARCH-012 *For the owner* 3, sign-in without a pre-session anti-CSRF token:** accepted for the loopback MVP and added
  to §3.2 as *"a review of sign-in without a pre-session anti-CSRF token, which rests on the same-origin refusal
  alone"*. The lead recommends accepting.

Write both into the ADR as what it decides, and list them in the Handoff as the two points the owner's acceptance of
the ADR would settle. If you think either is wrong, say so with reasons; do not quietly drop it.

## What to write

1. **`docs/decisions/ADR-011-browser-clients.md`** (or a closer name), `Status: Proposed`, in the form of ADR-009 and
   ADR-010: context, decision, alternatives considered and why they lost, consequences, risks accepted for the MVP,
   *Not decided here*. The decision covers, as rules with their reasoning:
   1. **Sessions over HTTP** (ARCH-012's list above), from what 009a and 009b built.
   2. **What is served outside `/api`**: the two bundle prefixes, the fallback, cache headers, the content-security
      policy, and that a client's first import switches zod to `jitless` so the policy is never violated (012a round 2,
      `@pos/contracts/browser`). Decide, or name as not decided, the two 011a findings: outside-prefix 404s (`/`) carry no
      `Cache-Control`, and `assets` is a reserved first segment under each bundle prefix.
   3. **The client rules** (ARCH-014's list above), including the one-cookie-changing-request rule and the actor rule
      (B-13: a retry never continues as a different person).
   4. **The harness's standing rules** (ARCH-015 §8): its own database and port; no installed trust,
      `ignoreHTTPSErrors`, and what it does and does not prove; reset by schema, never by `DELETE`; people through the
      domain functions in test code; both clocks moved together; requests made by the page; assertions on state and
      codes; no traces; and that Playwright writes `error-context.md` for every failure whatever the configuration
      says, so credentials are protected at the source (012a round 3).
   Alternatives to name at least: `__Host-` cookies against path scoping; a route accepting either cookie; a token
   bound to the client instance before sign-in (FR-A7 forbids it); a Vite proxy or second origin in development; a
   client-side idle decision; fixtures selected at run time; the plan's Task 12 harness (`webServer`, a seeder in
   `src`, `DELETE` resets); trusting the leaf certificate in the browser.
2. **The amendments to `docs/ARCHITECTURE.md`** that the decision makes necessary, edited in place: §3.1, §4.3, §7.2,
   §13, §14.3, §14.4 wherever they state less than the ADR or contradict it; §3.2, the browser-saved-password clause
   (decided), the pre-session anti-CSRF clause (proposed) and the two-tab sign-in race if it is not already covered by
   the shared-jar clause; §16 if a risk row is needed. Change nothing else. **Do not add ADR-011 to §18 or change §1's
   count**: the owner accepts the ADR and its amendments together.
3. **Exact replacement wording** in your Handoff for anything stale you find elsewhere (another document, an accepted
   ADR, never edited, only a proposed superseding note; the plan's Definition of Done, `docs/superpowers/plans/
   2026-09-08-phase-0-foundations.md:3752-3766`, against ARCH-015 *For the lead* 4), not as an edit.

## Read

- The consults: `.agent/reviews/ARCH-012-auth-routes.md`, `ARCH-014-client-shells.md`, `ARCH-015-browser-harness.md`
  in full; ARCH-010's §10 and *For the owner* for ADR-010's origin.
- The Handoffs (and lead rulings) of PHASE0-009a, 009b, 011a, 011b, 011c1, 011c2, 011d1, 011d2, 012a in `.agent/tasks/`.
- The code where the Handoffs leave a rule ambiguous: `apps/server/src/http/` (`session-guard.ts`, `access.ts`,
  `bundles.ts`, `origin.ts`, `client-instance.ts`), `packages/api-client/src/client.ts`, both clients' `src/session/`,
  `packages/contracts/src/browser.ts`, `e2e/support/`.
- `docs/ARCHITECTURE.md` §1, 2, 3, 4, 7, 13, 14, 16, 18; ADR-001 to ADR-010 for form and for any conflict (ADR-009 and
  ADR-010 above all); `docs/PRD.md` FR-A1 to FR-A7, NFR-1, NFR-5, AC-18, AC-19, AC-27, AC-28, AC-35;
  `docs/BOUNDARIES.md` B-7, B-11 to B-14, B-24; `.agent/DECISIONS.md`, the 2026-10-08 to 2026-10-17 lines.
- **Never print `db/dev.env`'s values.** If you need to know what it holds, list its variable names only.

## Acceptance criteria

1. The ADR exists as `Proposed`, states each rule with its reasoning, the accepted risks, and every alternative listed
   above with why it lost; it cites 012a's A2 as the automated evidence for the cookie premise.
2. `git diff -- docs/ARCHITECTURE.md` touches only the sections the decision makes necessary, and the Handoff names
   each hunk and why.
3. Nothing in the ADR or the amendments contradicts the contract (PRODUCT, PRD, ROADMAP, BOUNDARIES) or an accepted ADR.
   Where you think the contract is wrong, say so in the Handoff with exact wording.
4. No accepted ADR is edited. `git diff --check` is clean.
5. The Handoff lists the two owner points above, anything the ADR leaves *Not decided here* and which phase must decide
   it, and anything PHASE0-012b (running in parallel) would contradict if it lands as its task file says.

## Commit and report

Commit on `agent/arch-016` only, after `git diff --check` is clean, and never push. Write the Handoff below in full
prose, ending with `DONE` or `BLOCKED: <one question>`. Then run exactly one of:

    herdr agent prompt lead "architect16: ARCH-016 done — <one line>"
    herdr agent prompt lead "architect16: BLOCKED — <question>"

## Acceptance (owner, 2026-10-19)

The owner accepted ADR-011 with its ARCHITECTURE.md amendments, as written at `1698711`, in the lead session of
2026-10-19 ("accept ADR-011"; the lead's `.agent/DECISIONS.md` line, on `agent/lead-1017b`). The acceptance settles the
FR-A2c reading (rule 3), sign-in without a pre-session token (rule 5), and the two-tab risk filed as its own §3.2 and §16
entries, all as you wrote them. Apply, in the form ADR-010's acceptance took:

1. ADR-011's status block: `**Status:** Accepted`, `**Date:** 2026-10-19`, `**Approved by:** Product owner` in place
   of `**Proposed by:**`. The two "(proposed)" markers, and the opening paragraph that lists them, become one sentence
   recording that the owner accepted both on 2026-10-19. The body is otherwise unchanged.
2. ARCHITECTURE.md §18: a dated sentence "ADR-011 was accepted on 2026-10-19:" and a table with the ADR-011 row (*The
   browser clients, their sessions and what is served to them*), after the ADR-010 table, leaving the earlier tables as
   they are. §1 (`:22`): "the nine consequential decisions" becomes "the ten consequential decisions".
3. Where an amendment of yours marks the pre-session-token §3.2 clause or any other text as proposed, remove the marker.
   Rule 12 (root 404s `no-store`) stays stated ahead of the code; the lead queues its task. Nothing else changes.
4. Do not edit AGENTS.md, CLAUDE.md or `.agent/roles/`: the lead updates their "nine ADRs" lines.

Add an **Acceptance** note at the end of the Handoff saying what was applied (keep `DONE` as the file's last line),
commit on `agent/arch-016` after `git diff --check`, and report with the `architect16` lines above.

## Handoff

**Author:** `architect16`, 2026-10-17, on `agent/arch-016` from `16f393a`. Two files changed besides this
Handoff: `docs/decisions/ADR-011-browser-clients.md` (new, `Status: Proposed`) and `docs/ARCHITECTURE.md`
(fifteen hunks, listed below). No accepted ADR is edited. §1's count and §18 are untouched, as the task says.
`git diff --check` is clean. Nothing was run but `git`; this is documentation, and no `npm run verify` was needed.

### What I read

The three consults whole (ARCH-012, ARCH-014, ARCH-015); the lead rulings and Handoffs of PHASE0-009a, 009b,
011a, 011b, 011c1, 011c2, 011d1, 011d2 and 012a; ADR-009 and ADR-010 whole and ADR-001 to ADR-007 for conflicts;
ARCHITECTURE whole; PRD FR-A1 to FR-A7, NFR-1, NFR-5 and the criteria named; BOUNDARIES B-7, B-11 to B-14, B-24;
DECISIONS 2026-10-08 to 2026-10-16 (there is no 2026-10-17 line yet). Code where a Handoff left a rule ambiguous:
`bundles.ts`, `session-guard.ts`, `access.ts`, `client-instance.ts`, `errors.ts`, `packages/contracts/src/{browser,
errors,headers,routes}.ts`, the core's request options in `packages/api-client/src/client.ts`, both clients'
activity windows, `e2e/playwright.config.ts`, `e2e/tests/premises.spec.ts`, and `apps/server/test/server.test.ts`
cases 16 and 31. For acceptance criterion 5 I also read the PHASE0-012b task file, which is not in this worktree:
it is uncommitted in the `restaurant-pos-kit` worktree (`.agent/tasks/PHASE0-012b-browser-acceptance.md`). I read
nothing in `db/dev.env`.

### What the ADR decides

Twenty-eight rules in four parts: sessions over HTTP (rules 1 to 9, from 009a and 009b), what is served outside
`/api` (10 to 15, from 011a and 012a's round 2), the client rules (16 to 26, from 011b to 011d2), and the browser
harness (27 and 28, from 012a). Every alternative the task lists is in *Options considered* with why it lost:
`__Host-` against path scoping, a route accepting either cookie, a token bound to the client instance before
sign-in, a Vite proxy or second origin, a client-side idle decision, fixtures selected at run time, the plan's Task
12 harness, and trusting the leaf certificate; and about twenty more the consults and builds rejected. The cookie
premise cites 012a's case A2, and says precisely what A2 covers (`rpos_cid`'s attributes, stored and resent, in
Chromium and WebKit) and what covers the session cookies (A4's `activity` answered 204, A5's sign-in; 012b's B3
will assert their names and paths). Safari stays the owner's hand check.

### The two points the owner's acceptance would settle

1. **The FR-A2c reading (rule 3): no route accepts either cookie; a read both clients need is one handler
   registered under both surfaces.** I agree with the lead's recommendation, and add one reason the consult did
   not give: with path-scoped cookies, a route outside both surface paths receives *neither* cookie, so an
   "either" route is not merely unused but unbuildable without reopening the cookie design. Rule 3 says that a
   literal either-route needs a superseding ADR.
2. **Sign-in without a pre-session anti-CSRF token (rule 5), and the §3.2 clause** *"a review of sign-in without a
   pre-session anti-CSRF token, which rests on the same-origin refusal alone"*. I agree, with two additions in the
   ADR. First, `SameSite=Strict` is no defence here at all, because every `https://localhost` port is the same site;
   the refusal that matters is ADR-010's origin check, which does tell ports apart. Second, the client rules add a
   line a token would not: a forced sign-in looks to an open tab exactly like a sign-in in another tab, so the
   tab's next mutation is refused, `me` names someone else, and the tab returns to its sign-in screen instead of
   acting as the attacker's account (rule 18).

Both are marked **(proposed)** in the ADR where they appear, and in its opening.

### Where I push back: the two-tab case is not part of the shared-jar risk

DECISIONS 2026-10-14 puts the two-tab case "under ADR-010's accepted shared-cookie-jar risk". The risk is
accepted, and I have not reopened that. But the shared-jar clause in §3.2 says the risk "ends when the origin
becomes a real host name", and the two-tab case does not: two tabs of one profile share one cookie per surface on
any host. Filed under that clause, it would look closed at the gate when it is not. So the ADR lists it as its own
accepted risk, and §3.2 and §16 each gain a separate entry for it, worded *"a review of two tabs of one client in
one browser profile sharing one session cookie, accepted for the loopback MVP, which a real host name does not
end"*. If the owner prefers it folded into the shared-jar clause, delete that §3.2 bullet and §16 row and add to
the shared-jar bullet: *", and of two tabs of one client in one profile sharing one session cookie, which a real
host name does not end"*.

### The two 011a findings, decided

- **Outside-prefix 404s carry no `Cache-Control`: decided, `no-store`** (rule 12). Not built. It makes "no error
  and no miss outside `/api` is cacheable" true without exception. The change is one line in `notFoundHandler`
  (`apps/server/src/http/errors.ts:131-136`) and one assertion, `apps/server/test/server.test.ts:222`
  (`expect(res.headers['cache-control']).toBeUndefined()` in case 31, "stays a plain 404"), which becomes
  `toBe('no-store')`. Case 16 asserts nothing about the header outside `/api` and is unaffected. **§3.1's amendment states
  the rule ahead of the code**; the lead should queue the small task with the acceptance, or the owner may tell me
  to mark the row "not yet built" in §3.1 too.
- **`assets` as a reserved first segment: decided, and widened.** A first segment `assets` and a last segment
  containing a dot are both answered as file lookups, so a client's route manifest may use neither (rule 11, §3.1).

### `docs/ARCHITECTURE.md`, hunk by hunk

1. **§3.1, the cookie sentence** (`:120`): the session cookies are path-scoped and never sent to the other surface
   or a bundle. Rule 2.
2. **§3.1, a new paragraph** (`:128-139`): where the bundles are, the two reserved path shapes, the cache classes,
   the content-security policy, no cookie and no database on a bundle request, the 503. Rules 10 to 14. §3.1 said
   only "Fastify serves both built frontend bundles", and ADR-010 left the rest undecided.
3. **§3.2, three clauses** (`:182-188`): the two-tab case (see above), browser-saved passwords (decided by the
   owner, 2026-10-13, worded as the decision says), sign-in without a pre-session token (proposed, worded as the
   lead recommended). The task asked me to write the second one there.
4. **§4.3, a new paragraph** (`:249-262`): the shared transport core, the retry and actor rule, one
   cookie-changing request, the server as the only clock, fixtures by the build command, copy from the design
   documents. Rules 16 to 24. §4.3 said nothing about how either client talks to the server.
5. **§7.2, the opening paragraph** (`:542-550`): it said "mutating routes also validate an anti-CSRF token", which
   the sign-in routes contradict as built. Now: the derived token, on every non-`GET`/`HEAD` request to a route
   with a session, checked before resolution; the sign-ins carry none; cookies path-scoped with no lifetime; no
   route accepts either. Rules 2 to 5.
6. **§7.2, the unsaved-state bullet** (`:563-565`): the state is kept under the identity of the manager it belongs
   to, which carries the owner's 2026-10-14 ruling that the same manager gets it back after the eight hours. Rule 22.
7. **§13, the two `auth` rows** (`:813`, `:819`): "activity" added; the route exists on both surfaces and §13
   omitted it.
8. **§13, the route declaration** (`:832-841`): the three shapes, the startup refusals, one handler under both
   surfaces, the route table. Rules 1, 3 and 16.
9. **§13, the six codes** (`:855-862`): statuses, details, no cross-surface code, no attempts count, switch on the
   code. Rule 7.
10. **§14.3, two list items and a paragraph** (`:912-935`): what the browser suite covers that the list lacked
    (the premises, the actor rule), and the harness's standing rules. Rules 27 and 28, and ARCH-015 §8.
11. **§14.4, a paragraph** (`:962-969`): the two development modes, the fixture switch, the harness's own database.
    Rule 23.
12. **§14.4, the clock paragraph** (`:973-975`): the client's countdown from PostgreSQL's durations on a monotonic
    clock, asking rather than deciding. Rule 21.
13. **§16, three rows** (`:1017-1019`): the three accepted risks above, in the form of the shared-jar row.
14. **§16, the certificate row** (`:1025`): it said "Script and document local certificate creation/trust", which
    contradicts ADR-010 and the owner's 2026-10-08 reading (nothing installs trust) and rule 27's rejection of a
    trusted leaf. Now: "Script local certificate creation; nothing installs trust, and the warning is clicked
    through once per browser profile; do not substitute loopback HTTP". This is the one hunk outside the sections
    the task listed by name; §16 is listed for rows, and the row contradicts the decision.

(Fifteen `@@` hunks in `git diff -U0`: item 7 is two of them, one per table row. Line numbers are in the amended
file.)

### Against the contract and the accepted ADRs

I found no contradiction. FR-A2c's "may accept either" is a permission (rule 3 does not use it). FR-A2b and ADR-009
§6: "another manager" at M-6 never receives the draft, and the keyed working area guarantees that; the idled
manager typing their own username into M-6's other-manager form is not another manager, keeps the draft (owner,
2026-10-16), and gets a fresh session by an ordinary password sign-in, which is what Login after eight hours gives
anyway. ADR-010 rule 3 called the anti-CSRF token "required on mutating routes" and listed what protects a sign-in
as not decided; rule 5 decides it. ADR-010's consequence that browser-test API calls set `Origin` is made stricter
(no such calls at all), not contradicted. ADR-001 and ADR-002 agree.

### Not decided here, and which phase decides

- Telling "certainly not applied" from "unknown", and any resend: **Phase 2**, with the idempotency design. The ADR
  adds one consequence for that consult: a `CSRF_REFUSED` retry resends the same command with the same idempotency
  key, so the design must treat it as the same attempt.
- A role field on a POS route: the phase that first needs one, if any.
- `VALIDATION_FAILED` details: **Phase 1**, the first form's consult.
- A faster development loop (the server proxying a bundle path to Vite): **Phase 1**, if the watch build is too slow.
- The other POS screens' `?state=` navigation gated by `import.meta.env.DEV`: removed with each stand-in in
  **Phase 2**.
- Reconciling cookie-changing requests across tabs: **the §3.2 gate**.
- Case-insensitive file systems serving `/pos/Index.html`: no phase needs it.
- A non-JSON success response: the phase that first wants one (carried from ADR-010).

### PHASE0-012b against this ADR

Nothing in its task file contradicts the ADR if it lands as written. Its rules are ARCH-015's, which rules 27 and
28 record: requests by the page, assertions on state and codes, limits from `idleSeconds` or `SESSION_POLICY`, a
relative `ageSession` with `page.clock`, no artefact with a credential, people from the harness factory, no
approval stand-in driven, no two cookie-changing requests in one tab, B11 asserting only that tab 1 never shows
or acts as B. Two notes, neither a conflict. Its AC-18 scan (ruling 5) is rule 28's scan, made exact; the ADR
states the rule more loosely ("only in the request bodies of its own credential route") and does not pin the count,
which is the task's. And B3 is what will assert the session cookies' names and paths in a browser; the ADR says so
in its evidence paragraph, so if B3 changes, that sentence should be corrected.

### Exact replacement wording for stale text elsewhere (not edited)

**The plan's Phase 0 Definition of Done** (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md`), ARCH-015
*For the lead* 4:

- `:3754`, replace with: *"- [ ] `npm run verify` passes from a clean checkout after `npm run db:up && npm run
  db:migrate`, and `npm run test:e2e:all` passes after it."*
- `:3756`, replace with: *"- [ ] No path writes a PIN or password value to a log, audit row, telemetry row, or
  error message (B-12), proven by the log-scan tests (`apps/server/test/log-scan.test.ts`,
  `apps/server/test/session-scan.test.ts`) and the browser harness's credential scan, not by a grep."*
- `:3758`, replace with: *"- [ ] The server refuses to start when `POS_LISTEN_HOST` is not a loopback IP literal
  (NFR-1, ADR-010 rule 5)."*

**AGENTS.md, *What exists*** (the lead's file; stale since 011d and 012a merged):

- `:12-13`, replace with: *"- `apps/pos` — the POS client (React, Vite). POS-01 to POS-07 are built against
  fixtures and a client order store; POS-01 signs in for real. `apps/back-office` — the back-office client: BO-01
  sign-in, the empty frame, and M-6."*
- `:21-22`, replace the last sentence with: *"The server serves both built bundles under `/pos/` and
  `/back-office/`. `packages/api-client` is the one transport core both clients use, and `e2e/` is the browser
  harness (`npm run test:e2e`)."*

**On the owner's acceptance of ADR-011**, for the accepting commit (I did not make these, as the task says):

- `docs/ARCHITECTURE.md:22`, "preserve the nine consequential decisions" becomes "preserve the ten consequential
  decisions".
- `docs/ARCHITECTURE.md` §18 gains, after the ADR-010 table: *"ADR-011 was accepted on <date>:"* and a table row
  *"| [ADR-011](decisions/ADR-011-browser-clients.md) | The browser clients, their sessions and what is served to
  them |"*.
- The ADR's `Status:` becomes `Accepted`, `**Proposed by:**` becomes `**Approved by:** Product owner`, the date
  is the acceptance date, and the two "(proposed)" markers and the opening paragraph that lists them are reduced
  to a sentence recording what the owner ruled.
- AGENTS.md `:107`, the architect role prompt and CLAUDE.md's standing facts say "nine accepted ADRs"; each becomes
  ten.

No accepted ADR needs a superseding note: ADR-011 supersedes nothing, and its opening says which of ADR-010's
*Not decided here* items it settles.

### What the next agent needs and does not have

The owner's ruling on the two proposed points and on where the two-tab risk is filed. Nothing else blocks
acceptance. After acceptance, one small task is owed: the root 404's `no-store` (above).

DONE

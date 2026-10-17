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

## Handoff

---
id: ARCH-011
title: ADR-010 (Proposed), the HTTP boundary, with the ARCHITECTURE.md amendments it needs
category: arch
touches: [identity, boundaries]
depends_on: [ARCH-010]
owns: [docs/decisions/**, docs/ARCHITECTURE.md]
status: active
cycles: 0
---
# ARCH-011 — The HTTP boundary ADR

**Written** 2026-10-08 by the lead. **Owner:** `architect11`, Claude Opus 5.5, opened by hand.
**Branch and place:** `agent/arch-011`, cut from `development` at `d0865bf`, in the worktree
`../restaurant-pos-wt/ARCH-011`. Write only `docs/decisions/ADR-010-*.md`, `docs/ARCHITECTURE.md`
and this task file's Handoff.

## Why this task exists

The consult ARCH-010 (plan Task 8) found six rules that bind every route in every later phase,
and recommended recording them in an ADR rather than in one builder's task file. The owner
commissioned it on 2026-10-08. The consult is not on `development` yet. Read it, read-only, at
its absolute path:

    /Users/fajars/Work/Dev/POS System/restaurant-pos-kit/.agent/reviews/ARCH-010-https-server.md

Its §10 *An ADR* names the six rules; §§2, 3, 5, 6, 7 and 9 hold their reasoning; *For the owner*
item 1 holds the cookie-jar risk and its proposed §16 row.

## Decided: do not reopen (owner, 2026-10-08, `.agent/DECISIONS.md`)

1. **Accepted for the MVP:** `localhost` is one cookie jar shared with every other local server,
   whatever its port. Mitigated by project-specific cookie names, `HttpOnly`, `Secure` and
   `SameSite=Strict`; reconsidered at the pre-production gate (§3.2), where the origin becomes a
   real host name.
2. **Confirmed readings:** the kit creates the local certificate and never installs trust; the
   browser warning is clicked through once per profile, and the owner may trust the non-CA leaf on
   their own machine. FR-A7's "first contact" is the browser's first API request.
3. **ADR-010 is commissioned** for the six rules below, with item 1 as a §16 row and a §3.2
   clause.

## What the build has already shown (PHASE0-008a, not yet merged)

PHASE0-008a built the process from ARCH-010. Its review found that **Fastify writes some
responses itself, before the application's error handler runs** (a malformed URL got Fastify's
own 400 body, quoting the URL and its query string, with no `Cache-Control`), and that an error
`details` type left open accepts an exception's message. Both are being fixed in its round 2
through Fastify's `frameworkErrors` option and a per-code details map in `@pos/contracts`. The
ADR's error rule must therefore cover **every response the server sends, including those the
framework produces before routing**, and say that details are typed per code and never carry text
from an exception.

## What to write

1. **`docs/decisions/ADR-010-http-boundary.md`**, `Status: Proposed`, in the form of ADR-001 to
   ADR-009: context, decision, alternatives considered and why they lost, consequences, risks
   accepted for the MVP. The decision states the six rules:
   1. **The error envelope:** every non-2xx API response is `{ "error": { "code", "details"? } }`;
      no `message` field; `details` typed per code; no string from an exception, the framework's
      own early responses included.
   2. **The logging allow-list:** no request body, header or cookie is handed to a logger; the URL
      is logged without its query string; an error is logged by type, code, schema-level names
      and stack frames, never its message; redaction is a backstop only.
   3. **One origin and its guard:** `https://localhost:<port>`; the Host check on every request;
      the same-origin check on every API request; passing it grants nothing (FR-A2c).
   4. **JSON only, no CORS:** no other body type is parsed; no `Access-Control-*` header; no
      answer to a preflight.
   5. **One listening function:** TLS required, a loopback IP literal checked before and after
      binding, no flag to disable it.
   6. **No HSTS**, ever, on `localhost`.
   Alternatives to name at least: Fastify's default error handler and a `message` field; redaction
   paths as the control; a Vite proxy with a second trusted origin in development; accepting
   `localhost` as a bind name; an HTTP fallback or generation at startup; `__Host-` cookies (state
   it is Task 9's to settle, not this ADR's).
2. **The amendments to `docs/ARCHITECTURE.md`** that the decision makes necessary, edited in
   place: §16, the cookie-jar row as ARCH-010 *For the owner* 1 proposes; §3.2, a clause in the
   gate's review list for the shared cookie jar; and wherever §2.1, §3.1, §7.2, §11, §12 or §13
   states less than the ADR or contradicts it. Change nothing else. Do not add ADR-010 to §18 or
   change §1's count: it is Proposed, and the owner accepts the ADR and its amendments together.
3. **Exact replacement wording** in your Handoff for anything stale you find elsewhere — another
   document, an accepted ADR (never edit one; propose a superseding note), the plan's Tasks 9 to
   12 — not as an edit.

## Read

ARCH-010 in full (path above); `docs/ARCHITECTURE.md` §1, 2, 3, 5.1, 7, 11, 12, 13, 14, 16, 18;
ADR-001 to ADR-009 for form and for any conflict (ADR-001 and ADR-009 above all); `docs/PRD.md` §2,
NFR-1, FR-A2c, FR-A7; `docs/BOUNDARIES.md` B-11 to B-14, B-24; `.agent/DECISIONS.md`, the
2026-10-08 lines.

## Acceptance criteria

1. The ADR exists as `Proposed`, states each of the six rules with its reasoning, the accepted
   cookie-jar risk, and every alternative listed above with why it lost.
2. `git diff -- docs/ARCHITECTURE.md` touches only the sections the decision makes necessary, and
   the Handoff names each hunk and why.
3. Nothing in the ADR or the amendments contradicts the contract (PRODUCT, PRD, ROADMAP,
   BOUNDARIES). Where you think the contract is wrong, say so in the Handoff with exact wording.
4. No accepted ADR is edited. `git diff --check` is clean.
5. The Handoff lists what the Task 9 consult must take from the ADR (cookie names, CSRF, route
   declarations, the auth codes in the envelope).

## Commit and report

Commit on `agent/arch-011` only, after `git diff --check` is clean, and never push. Write the
Handoff below in full prose, ending with `DONE` or `BLOCKED: <one question>`. Then run exactly one
of:

    herdr agent prompt lead "architect11: ARCH-011 done — <one line>"
    herdr agent prompt lead "architect11: BLOCKED — <question>"

## Handoff

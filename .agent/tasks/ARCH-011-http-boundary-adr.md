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

Author: `architect11`, 2026-10-08. Two files changed besides this Handoff:
`docs/decisions/ADR-010-http-boundary.md` (new, `Status: Proposed`) and
`docs/ARCHITECTURE.md` (ten places, in the nine items listed below; item 8 covers two, and git
shows the second of them as two hunks at zero context). No accepted ADR was edited, no product document was edited,
ADR-010 is not in §18, and §1's count is unchanged. `git diff --check` was clean before the commit.
No contract change is proposed: I found nothing in PRODUCT, PRD, ROADMAP or BOUNDARIES that the ADR
contradicts or that I think is wrong.

### What the ADR decides

The six rules as commissioned, each with its reasoning; the alternatives the task names, each with
why it lost, plus six more that were live in ARCH-010 or in the build (Problem Details, a flat
`{ code }` body, an open `details` object, a handler-only rule, a CORS allow-list, a dedicated
host name); the cookie-jar risk as accepted; and the two confirmed readings, recorded as readings
and not as risks. `__Host-` is named and explicitly left to Task 9.

### Where the ADR says more than the six-line brief, so the owner can strike any of it

1. **Rule 1 reaches below the framework.** The task asked for "every response the server sends,
   including those the framework produces before routing". The librarian (`ask.sh`, Fastify 5 and
   Node documentation) reports three sources of responses that never reach `setErrorHandler`:
   (a) router errors (`FST_ERR_BAD_URL`, `FST_ERR_MAX_PARAM_LENGTH`, `FST_ERR_ASYNC_CONSTRAINT`),
   taken over by `frameworkErrors`, which PHASE0-008a round 2 is already doing; (b) Fastify's
   default `clientErrorHandler`, which answers a request the HTTP parser rejects by writing
   `{"error":"Bad Request","message":"Client Error","statusCode":400}` to the socket, and is
   replaceable through the `clientErrorHandler` option; (c) Node's own 408 on a request timeout
   and Fastify's 503 while closing, neither of which has a body the application writes. The ADR
   holds (b) and (c) to "the envelope with a fixed code, or no body at all; never the default
   body". **(b) is very likely not covered by 008a round 2.** It leaks nothing, since the text is
   fixed, but it is a second error shape with a `message` field. The lead should add to 008a, or
   to a small follow-up: replace `clientErrorHandler` with one that writes a bodyless 400 (or the
   envelope with `VALIDATION_FAILED`), and a test that sends a malformed request line over a raw
   socket. Not verified by me: the exact default bodies for (a), which the librarian could not
   establish; the rule does not depend on them.
2. **Rule 1 also says what happens outside `/api`.** ARCH-010 has a "plain 404" there. Fastify's
   default 404 body quotes the method and URL, so "plain" has to mean "nothing from the request".
   The ADR says a response outside `/api` is not the envelope but obeys the same prohibition, and
   that a framework error raised before routing is answered with the envelope whatever the path,
   because an unparsable path cannot say which surface it belongs to.
3. **`Cache-Control: no-store` on every API response** is written into rule 1. It is ARCH-010's
   008a rule 11 and its absence was one of the two review findings; it is not one of the six by
   name.
4. **Rule 2 distinguishes three kinds of error.** The task says an error is logged "never its
   message". ARCH-010 contradicts itself here (question 5: an `AppError` logs its code; 008a rule
   9: the message is never logged "unless the error is an `AppError`"), and its startup design
   needs fixed sentences an operator can read ("refusing to listen on …", the certificate
   refusals). The ADR therefore says: an error the server did not define is never logged by its
   message; an application error raised while handling a request is logged by its code; and a
   closed set of the server's own startup and configuration errors may have their sentences
   logged, because each is fixed wording plus values that are neither secrets nor taken from a
   request. **If 008a logs an `AppError`'s message, that now contradicts the ADR** and should be
   changed to the code.
5. **`trustProxy` off and no forwarded header read** is in rule 3, because with it on the Host
   check compares a value the client chose.
6. **The cookie-name stem `rpos_`** is fixed in rule 3, since "project-specific names" is the
   accepted risk's first mitigation and ARCH-010 already uses `rpos_cid`. The rest of each name
   is Task 9's.
7. **Rule 4 binds request bodies and error bodies only.** Whether a later API response may be
   something other than JSON (an export, a rendered document) is listed under *Not decided here*
   rather than closed by architecture.

### The `docs/ARCHITECTURE.md` hunks, and why each

1. **§3.1, the listener bullet.** It said only "reject a hostname or address that could accept
   inbound connections". Now also: a loopback IP literal, names refused with `localhost` included,
   one caller of `listen`, TLS required, checked before and after binding, no flag (rule 5).
2. **§3.1, the "One origin avoids CORS" paragraph.** Adds the exact origin, that `127.0.0.1` is
   refused, no `Access-Control-*`, no preflight, no development origin (rules 3 and 4), and that
   every cookie has a project-specific name with a pointer to the §16 row.
3. **§3.1, the certificate paragraph.** Adds: created by an explicit command, validated at
   startup, no HTTP fallback, no generation at startup, nothing installs trust, the warning is
   clicked through once per profile (rule 5 and the owner's confirmed reading), and no HSTS
   (rule 6).
4. **§3.2, the gate list.** One new clause for the shared cookie jar, as decided item 1 requires.
5. **§3.2, the last sentence.** "merely by changing `HOST=0.0.0.0`" became "a bind address such as
   `HOST=0.0.0.0`, an environment variable, or a flag". The old sentence stated less than rule 5,
   and the variable is no longer called `HOST`.
6. **§7.2, the first paragraph.** It said "mutating routes also validate origin and an anti-CSRF
   token", which is less than the ADR: the Host check is on every request and the same-origin
   check on every API request, reads included. It now says so, says that passing grants nothing,
   keeps the anti-CSRF token on mutating routes, and says cookie names are project-specific.
7. **§11, the last paragraph.** One sentence: the application log is held to the same exclusion
   by an allow-list, not by redaction (rule 2). The architecture had no statement about logs
   other than section 7.3's list.
8. **§12, the errors bullet, and §13, a closing paragraph.** §12 gains: a code, per-code details,
   no message field, no string from an exception, on every response including the framework's own.
   §13 gains the envelope's shape, JSON as the only parsed request body, and `no-store`.
9. **§16.** The cookie-jar row, word for word as ARCH-010 *For the owner* 1 proposes, placed after
   the two other "Accepted for the MVP" rows.

**§2.1 is unchanged.** It already lets the repository share API schemas, which covers the codes
and details types; nothing there contradicts the ADR. Sections 14 and 18 and §1 are untouched.

The amendments cite "(ADR-010)" in five places. If the owner does not accept the ADR, those hunks
are withdrawn with it; they are not meant to stand alone.

### Stale text elsewhere: exact replacement wording, not edits

1. **`docs/ARCHITECTURE.md` §16, the certificate row** (I did not change it; the task limits §16
   to the new row). Its mitigation reads "Script and document local certificate creation/trust".
   The plan read that as "Trust it once in your OS keychain". Proposed, for the owner with the
   ADR: *"Script local certificate creation and document the one-time browser warning; nothing
   installs trust; do not substitute loopback HTTP"*.
2. **`docs/ARCHITECTURE.md` §14.4** says one command sequence should "issue or validate the
   localhost certificate". That is still true of the sequence (`npm run cert` issues, the server
   validates), so I left it. If the lead wants it unambiguous: *"create the localhost certificate
   if it is missing (the server only validates it)"*.
3. **No accepted ADR is stale.** ADR-001 ("one loopback-only Fastify modular monolith", "separate
   … session cookies") and ADR-009 (a database error from the credential table "is replaced,
   never wrapped") agree with ADR-010. No superseding note is needed.
4. **The Phase 0 plan, `docs/superpowers/plans/2026-09-08-phase-0-foundations.md`.** Tasks 9 to
   12 are to be rewritten from their consults; until then, these lines contradict ADR-010 and
   must not be copied:
   - `:1875-1877` and every use (`:2394` to `:2696`): cookie names `pos_sid`, `bo_sid`. Replace
     with: *"Session cookie names are project-specific and built on the stem `rpos_` (ADR-010
     rule 3); the Task 9 consult fixes the names."*
   - `:2509`, `:2514`, `:2552`, `:2570`, `:2638`, `:2655`, `:2662` and the test at `:2400`
     (`res.json().code`): flat `reply.code(n).send({ code })`. Replace with: *"A handler never
     writes an error body. It throws the server's application error with a code from
     `@pos/contracts`, and the body is `{ "error": { "code", "details"? } }` (ADR-010 rule 1);
     tests read `res.json().error.code`."*
   - `:2583`, `:2673`: `sameSite: 'lax'`. Replace with `sameSite: 'strict'` (ARCHITECTURE 7.2).
   - `:2012`, `:2015`: `INVALID_PIN` and `WRONG_AUDIENCE` are not carried forward by ARCH-010;
     the Task 9 consult names the codes.
   - `:3443`: "One origin, two path roots — no CORS, one certificate, one CSRF model." Replace
     with: *"One origin, two path roots. No CORS header and no preflight answer; the Host check
     already covers both bundles; no `Strict-Transport-Security`; a miss outside `/api` echoes
     nothing from the request (ADR-010)."*
   - `:3427-3440`: bundle roots joined from `process.cwd()`. Anchor to the file, as ARCH-010 §8
     says. Not an ADR-010 matter, noted because it is on the same lines.
   - `:3452`, `:3511`, `:3560`, `:3699`: a `PIN_PEPPER` literal on a command line or in a
     configuration file. That is B-24 and ARCH-006, not ADR-010; ARCH-010 already flagged it.
   - `:3502-3510`: Playwright against `https://localhost:8443` with `ignoreHTTPSErrors`. This
     stays correct. Add: *"`baseURL` is `https://localhost:<port>` and never `127.0.0.1`, which
     the Host check refuses. A mutating call through `page.request` or `request` must set
     `Origin` to the base URL explicitly, or be made by the page itself; a request with no
     `Origin` is refused (ADR-010 rule 3)."* I have not verified what Playwright's API request
     context sends by default; the rule holds either way, and the Task 12 consult should ask the
     librarian.
   - `:3649`: the test opens `psql` as `pos_owner` with a password literal to age a session.
     Outside this ADR; noted for the Task 12 consult.

### What the Task 9 consult must take from ADR-010

- **Cookie names.** Both session cookies are named on the stem `rpos_`, differ from each other
  and from `rpos_cid`, and are `Secure` (the literal `true`), `HttpOnly`, `SameSite=Strict`.
  `__Host-` against path scoping (`/api/pos`, `/api/back-office`) is the consult's to choose,
  deliberately; the ADR records that it is open. Lifetime, and clearing on release and on no
  session, are the consult's.
- **CSRF.** The same-origin guard already covers every API route Task 9 adds, and it is not the
  anti-CSRF token: section 7.2 still requires the token on mutating routes. The consult settles
  its shape and what protects the two sign-in routes, which have no session to bind a token to.
  Whatever it chooses, passing the origin guard may not be treated as evidence of anything
  (FR-A2c), and the token may not be the client-instance id.
- **Route declarations.** Every Task 9 route registers inside the one `/api` context, which is
  what gives it the guard, the envelope, `no-store` and the logging rules. The consult defines
  the declaration (`audience`, `interactive`, the manager requirement, FR-A2c's shared read
  routes) and how an undeclared route fails at startup. A route outside that context has none of
  the ADR's protections, so the declaration check should also refuse an API path registered
  outside it.
- **The authentication codes in the envelope.** Each new code enters `@pos/contracts` in the task
  that emits and tests it, with a details type if it has details. `retryAfterSeconds` on a
  cooldown is the worked example. The consult names the code and status for a failed
  verification, a cooldown, no session, an idle back-office session (M-6 must tell idle from
  none), a role refusal and a CSRF refusal, on both surfaces, with an unknown username
  indistinguishable from a wrong password (ADR-009). No code may tell a caller that a token is
  valid on the other surface.
- **Validation.** A schema failure becomes the validation code without echoing the input: no
  field value, and no library-composed message, goes into `details`. If `details` names fields,
  it names them by the schema's own keys, and its type is declared in the contracts.
- **No credential in a URL**, ever. The path-only request log is the backstop for that, not the
  permission.
- **Handlers never write an error body and never read a cookie other than through the route's
  audience.**

### What I could not do, and what the lead should check

- **The three owner rulings are not in this branch's `.agent/DECISIONS.md`.** The file here has
  two 2026-10-08 lines (ADR-009's acceptance and the FR-B3/FR-A5 wording). The cookie-jar
  acceptance, the two confirmed readings and the commissioning of ADR-010 are stated in this task
  file under *Decided*, and I relied on that. The ADR says "the owner ruled on 2026-10-08"; the
  lead should confirm those lines are recorded before the ADR goes to the owner.
- I did not read PHASE0-008a's code or review; neither is on this branch. Items 1 and 4 under
  *Where the ADR says more* are where the built code may now disagree with the ADR.
- One statement in the ADR is recalled, not verified: that a security-header plugin's defaults
  can include HSTS. The ADR's rule (no such plugin on its defaults, and a test for the header's
  absence) does not depend on it.
- Acceptance is the owner's: on acceptance, §18 gains the ADR-010 row, §1's "eight" becomes
  "nine", AGENTS.md's and the architect role prompt's counts follow, and the ADR's status block
  takes the form ADR-009's has. I made none of those changes.

DONE

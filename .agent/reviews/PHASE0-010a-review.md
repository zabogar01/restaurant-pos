# PHASE0-010a review

## Verdict

**findings** — one finding. Reviewed `agent/phase0-010a` at `7706c54f8d412b9977084cfddbc33dcc8f126050` against `development` at `cb23a29f9e0a6c9dc5ea372bcfdc782fa66ee7d1`, the task's binding ARCH-013 excerpts, its cited requirements, boundaries, architecture sections, ADR-007, and owner rulings.

## Findings

### 1. P2 — Preserve the verified approver and original subject across the work callback

**Locations:** `apps/server/src/domain/approval.ts:79`, `apps/server/src/domain/approval.ts:83`, and `apps/server/src/domain/approval.ts:48`.

The primitive passes its mutable `approver` object to the work and then reads `approver.id` back for the audit entry. It also retains the caller's mutable `subject` object rather than copying its fields. Consequently, the work can change the person or subject recorded in the combined entry after verification. These assignments are permitted by the declared types. Destructuring protects primitive string fields, such as action, but does not protect the nested subject or the callback's approver object.

**Authority:** FR-J2 requires the entry to record the action's approver and subject; FR-J3 and ADR-007 require the combined successful entry to name actor and approver. The binding task's question 3, lines 281–283, explicitly requires the action and subject to be fixed before verification and says the work cannot change what the entry says was approved. This is the task's implementation of FR-A6 and B-14's one-specific-action approval.

**Failing scenario:** Manager A supplies the PIN for order X. The callback assigns `approver.id = otherStaff.id` and changes the retained request's `subject.id` to order Y before returning. The primitive reports `APPROVED` and writes a success entry naming the other staff member and order Y. Choosing another existing staff UUID satisfies the database foreign key; no database constraint binds that UUID to the verified PIN. No HTTP caller exists in this slice, so this is a defect in the primitive's promised callback isolation, not a demonstrated client exploit.

I reproduced the JavaScript behavior in memory using the unchanged approval and audit modules, with controlled throttle and transaction dependencies. Verification returned `verified-manager`, the original subject was `original-order`, and the captured audit INSERT parameters instead contained `different-person` and `different-order`. There was exactly one verification and the outcome was `APPROVED`.

**Proposed fix:** Capture the verified manager ID in a private string and use that string for the audit entry; give the callback a separate object. Copy the subject's type and ID before the first asynchronous boundary while retaining the existing runtime validation behavior. Add regression coverage that mutates the callback argument and original subject and proves the entry still names the verified manager and original subject. Readonly types may help callers, but the audit writer should consume the private snapshots.

## What I ran and what I did not

- I ran `npm run verify`: typecheck passed; **65 test files and 3,234 tests passed**, with Vitest reporting 53.23 seconds. This matches the Handoff and adds one file and 23 tests to the task's recorded baseline of 64 files and 3,211 tests. The client files are unchanged in the reviewed diff.
- Before and after that green run, `git diff --stat` was empty, HEAD and development retained the hashes above, and the branch diff remained six files, 1,610 insertions and six deletions. The source tree was stable. The only subsequent file written by this review is this report.
- I ran `git diff --check development...agent/phase0-010a`; it passed. I inspected the complete source, migration and test changes and the supporting audit, throttle, transaction, migration and test-helper implementations.
- I ran the callback alias reproduction described above. It used the real source and audit parameter construction with dependency doubles; it did not insert those reproduction rows into PostgreSQL.
- I also re-proved the Handoff's early-validation mutation against the final source in memory. A blank action on the current implementation threw `invalid audit entry: action` with zero verification calls. Moving verification before validation in the in-memory source produced the same error after one verification call, failing the no-verification invariant. This was a focused dependency-double probe, not a rerun of Vitest case 16 against PostgreSQL. No source file was edited.
- I did not independently rerun the other mutation proofs, the three consecutive approval-only runs, or the two development-database migration commands. Their recorded results remain builder evidence. The full suite did exercise the real migrations and approval integration cases through the existing PostgreSQL harness. I ran no browser or HTTP approval test; routes are explicitly deferred to PHASE0-010b. I used neither Context7 nor the librarian because no external library fact needed resolution.

## Cleared

The successful work and audit entry share one transaction, including the deferred-constraint COMMIT-failure case. Failed work rolls back without an entry; failed evidence surfaces an error, and previously committed throttle enforcement remains intact. FAILED and THROTTLED have distinct audit outcomes, null approvers, and no reason or amounts. Cancellation writes its own evidence without verification or bucket changes. Self-approval and the cashier/deactivated-manager failures follow the cited rules.

The tests cover cooldown entry, expiry, concurrent attempts, and isolation from LOGIN in both directions. I specifically checked the shared reason field across success, failure and throttling: the implementation includes it only on success. The mutable approver and subject are the uncovered shared-value problem described above.

Migration 0008 widens the outcome constraint and changes only the audit timestamp default to `clock_timestamp()`; existing migrations, append-only protections and grants remain unchanged. Schema cases 10 and 11 are the only existing tests changed, and the count adjustment follows from the added accepted row. The source scans and secret-path tests passed as part of verification. AC-18, AC-19 and AC-27 retain the task's domain-versus-route limits; this review does not close their deferred HTTP or real-command coverage.

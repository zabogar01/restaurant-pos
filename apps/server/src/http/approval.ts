import type { FastifyRequest } from 'fastify';
import { ErrorCode } from '@pos/contracts';
import type { ApprovalOutcome, ApprovalRequest } from '../domain/approval.js';
import { AppError } from './errors.js';
import { actorOf } from './session-guard.js';

/**
 * The HTTP half of inline manager approval (ARCH-013 section 6). A gated command
 * takes `managerPin` in its own body, builds its request with `approvalRequest`,
 * calls `withManagerApproval` with a literal action, and returns `approved(...)`.
 * Nothing here is a hook, a decorator or state.
 */

/**
 * The domain request for a gated command. The actor is the session's, read from the
 * guard and never from a body; the client instance is the one the hook resolved.
 * The fields are named one by one so that nothing else a caller holds, a parsed
 * body included, can ride along into the request.
 */
export function approvalRequest(
  request: FastifyRequest,
  input: {
    /** From the command's strict body schema, which composes `ManagerPin`. */
    managerPin: string;
    /** A literal at the call site, never a value the client chose. */
    action: string;
    subject?: { type: string; id: string };
    reason?: string;
  }
): ApprovalRequest {
  return {
    actorId: actorOf(request).staffUserId,
    managerPin: input.managerPin,
    action: input.action,
    subject: input.subject,
    reason: input.reason,
    clientInstanceId: request.clientInstanceId,
  };
}

/**
 * The one mapping from an approval outcome to the HTTP answer. `FAILED` is a 403
 * `APPROVAL_FAILED` for every kind of PIN that did not verify (nobody's, a
 * cashier's, a deactivated user's), with `retryAfterSeconds` only when this failure
 * started the cooldown; `THROTTLED` is a 429 with it always. A 403, not a fourth
 * 401: the cashier's own session is untouched and stays signed in. No count of
 * attempts is reported, and the handler writes no error body.
 */
export function approved<T>(outcome: ApprovalOutcome<T>): T {
  switch (outcome.outcome) {
    case 'APPROVED':
      return outcome.result;
    case 'THROTTLED':
      throw new AppError(ErrorCode.APPROVAL_THROTTLED, 429, {
        retryAfterSeconds: outcome.retryAfterSeconds,
      });
    case 'FAILED':
      if (outcome.retryAfterSeconds === null) throw new AppError(ErrorCode.APPROVAL_FAILED, 403);
      throw new AppError(ErrorCode.APPROVAL_FAILED, 403, {
        retryAfterSeconds: outcome.retryAfterSeconds,
      });
  }
}

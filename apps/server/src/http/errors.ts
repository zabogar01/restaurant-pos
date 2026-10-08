import type { FastifyReply, FastifyRequest } from 'fastify';
import { ErrorCode } from '@pos/contracts';
import type { ErrorBody, ErrorDetailsOf } from '@pos/contracts';

/**
 * The only way a code reaches a client. The message is the code itself: no
 * string from an exception is ever copied into one of these.
 */
export class AppError<C extends ErrorCode = ErrorCode> extends Error {
  readonly code: C;
  readonly status: number;
  readonly details: ErrorDetailsOf<C> | undefined;

  // A code that declares no details takes no third argument.
  constructor(
    code: C,
    status: number,
    ...details: [ErrorDetailsOf<C>] extends [never] ? [] : [details?: ErrorDetailsOf<C>]
  ) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details[0] as ErrorDetailsOf<C> | undefined;
  }
}

/**
 * A refusal to start, whose message is a fixed sentence written in this
 * repository (a configuration variable's name, a file path, a bind address; never
 * a secret or file contents). It is the one kind of non-AppError whose message
 * the log serializer prints, because an operator needs to read why the process
 * would not start.
 */
export class StartupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StartupError';
  }
}

// The router matches on the path after it has decoded the escapes of unreserved
// characters (%61 is "a"), so a miss is classified the same way. Reserved
// escapes such as %2F stay as they are, as in the router.
const UNRESERVED = /^[A-Za-z0-9\-._~]$/;

/** True for `/api` and everything under it, as the router would read the path. */
export function isApiPath(url: string): boolean {
  const raw = url.split(/[?#]/, 1)[0] ?? '';
  const path = raw.replace(/%([0-9A-Fa-f]{2})/g, (escape, hex: string) => {
    const char = String.fromCharCode(parseInt(hex, 16));
    return UNRESERVED.test(char) ? char : escape;
  });
  return path === '/api' || path.startsWith('/api/');
}

// A framework error is known by its status alone; its message is dropped.
const FRAMEWORK_STATUS: Record<number, ErrorCode> = {
  400: ErrorCode.VALIDATION_FAILED,
  404: ErrorCode.NOT_FOUND,
  413: ErrorCode.PAYLOAD_TOO_LARGE,
  415: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
};

function send(reply: FastifyReply, status: number, code: ErrorCode, details?: unknown) {
  // The relation between a code and its details is held by AppError's type; by
  // here the pair is already checked.
  const body = { error: details === undefined ? { code } : { code, details } } as ErrorBody;
  return reply.code(status).header('cache-control', 'no-store').send(body);
}

/** Only a code the server chose reaches a response (ARCHITECTURE 12). */
export function errorHandler(err: unknown, request: FastifyRequest, reply: FastifyReply) {
  if (err instanceof AppError) {
    request.log.info({ err }, 'request refused');
    return send(reply, err.status, err.code, err.details);
  }
  const status =
    typeof err === 'object' && err !== null && 'statusCode' in err
      ? (err as { statusCode: unknown }).statusCode
      : undefined;
  const code = typeof status === 'number' ? FRAMEWORK_STATUS[status] : undefined;
  if (code !== undefined && typeof status === 'number') {
    request.log.info({ err }, 'request rejected');
    return send(reply, status, code);
  }
  request.log.error({ err }, 'request failed');
  return send(reply, 500, ErrorCode.INTERNAL);
}

/** Under /api a miss is the envelope; elsewhere it is a plain 404. */
export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  if (isApiPath(request.url)) {
    return send(reply, 404, ErrorCode.NOT_FOUND);
  }
  return reply.code(404).type('text/plain').send('Not Found');
}

/**
 * Fastify writes a response itself, before routing, for a malformed URL, an
 * over-long parameter and a failed async constraint. Left alone, the first two
 * quote the whole URL, query string included, and none sets Cache-Control.
 * Registered as the `frameworkErrors` option, this sends the envelope instead and
 * sets no-store itself, because it runs before any hook. Nothing from the
 * framework error is copied; the log line carries its code and frames only.
 */
export function frameworkErrorHandler(err: unknown, request: FastifyRequest, reply: FastifyReply) {
  request.log.info({ err }, 'request rejected before routing');
  const code = (err as { code?: unknown } | null)?.code;
  if (code === 'FST_ERR_ASYNC_CONSTRAINT') return send(reply, 500, ErrorCode.INTERNAL);
  return send(reply, 400, ErrorCode.VALIDATION_FAILED);
}

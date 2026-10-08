import type { FastifyReply, FastifyRequest } from 'fastify';
import { ErrorCode } from '@pos/contracts';
import type { ErrorBody, ErrorDetails } from '@pos/contracts';

/**
 * The only way a code reaches a client. The message is the code itself: no
 * string from an exception is ever copied into one of these.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: ErrorDetails | undefined;

  constructor(code: ErrorCode, status: number, details?: ErrorDetails) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
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

/** True for `/api` and everything under it. The query string is not part of the path. */
export function isApiPath(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0] ?? '';
  return path === '/api' || path.startsWith('/api/');
}

// A framework error is known by its status alone; its message is dropped.
const FRAMEWORK_STATUS: Record<number, ErrorCode> = {
  400: ErrorCode.VALIDATION_FAILED,
  404: ErrorCode.NOT_FOUND,
  413: ErrorCode.PAYLOAD_TOO_LARGE,
  415: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
};

function send(reply: FastifyReply, status: number, code: ErrorCode, details?: ErrorDetails) {
  const body: ErrorBody = { error: details === undefined ? { code } : { code, details } };
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

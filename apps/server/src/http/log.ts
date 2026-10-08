import type { Writable } from 'node:stream';
import type { FastifyServerOptions } from 'fastify';
import { AppError, StartupError } from './errors.js';

// What may leave the process about an error is an allow-list. PostgreSQL
// messages quote values, `detail` holds the failing row, a JSON parse error can
// quote the body, and `new URL()` keeps its input (a DATABASE_URL, password
// included) on the error. So `message`, `detail`, `where`, `hint`, `input`,
// `cause` and every other property are never read.
const PG_NAMES = ['constraint', 'table', 'column', 'routine'] as const;
const SAFE_NAME = /^[A-Za-z0-9_.$-]{1,64}$/;
const FRAME = /^\s+at\s/;

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' && SAFE_NAME.test(value) ? value : undefined;
}

/** The `at …` lines of a stack, never the leading message lines. */
function frames(err: Error): string[] {
  if (typeof err.stack !== 'string') return [];
  // A message may itself contain newlines and something shaped like a frame.
  const messageLines = new Set(
    (typeof err.message === 'string' ? err.message : '').split('\n').map((l) => l.trimEnd())
  );
  return err.stack
    .split('\n')
    .filter((line) => FRAME.test(line) && !messageLines.has(line.trimEnd()));
}

export function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof AppError) {
    return { type: 'AppError', code: err.code, status: err.status, stack: frames(err) };
  }
  if (err instanceof StartupError) {
    return { type: 'StartupError', msg: err.message };
  }
  if (err instanceof Error) {
    const out: Record<string, unknown> = {
      type: safeString(err.constructor?.name) ?? 'Error',
    };
    const props = err as unknown as Record<string, unknown>;
    const code = safeString(props.code);
    if (code !== undefined) out.code = code;
    for (const name of PG_NAMES) {
      const value = safeString(props[name]);
      if (value !== undefined) out[name] = value;
    }
    out.stack = frames(err);
    return out;
  }
  return { type: typeof err };
}

function stripQuery(url: unknown): string {
  return typeof url === 'string' ? (url.split(/[?#]/, 1)[0] ?? '') : '';
}

// The request serializer emits the method and the path. The URL's query string
// is where a credential would end up if a later task put one there.
const serializers = {
  req: (req: { method?: string; url?: string }) => ({
    method: req.method,
    path: stripQuery(req.url),
  }),
  res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
  err: serializeError,
};

// pino takes an object's `err.message` as the line's message when none is
// given, and does so before any serializer runs. Always give it one.
function logMethod(
  this: unknown,
  args: unknown[],
  method: (...a: unknown[]) => void
): void {
  const [first, second] = args;
  if (first instanceof Error) {
    method.call(this, { err: first }, 'error');
  } else if (typeof first === 'object' && first !== null && 'err' in first && typeof second !== 'string') {
    method.call(this, first, 'error', ...args.slice(2));
  } else {
    method.apply(this, args);
  }
}

// BACKSTOP ONLY. Redaction removes the listed paths and nothing else: a field
// called `newPassword`, or a `pin` two levels down, passes straight through.
// The control is that a body, a header or a cookie is never handed to the
// logger at all. B-12 forbids a value in any form, including partially masked,
// so the censor removes the key outright.
const SECRET_KEYS = ['pin', 'password', 'managerPin', 'token', 'cookie'];
const redact = {
  paths: [
    'req.headers.cookie',
    'req.headers.authorization',
    'res.headers["set-cookie"]',
    ...SECRET_KEYS,
    ...SECRET_KEYS.map((key) => `*.${key}`),
  ],
  remove: true,
};

type LoggerOptions = Exclude<FastifyServerOptions['logger'], boolean | undefined> & {
  stream?: Writable;
};

/** JSON lines on standard output, or on `stream` in a test. No file, no transport. */
export function loggerOptions(level: string, stream?: Writable): LoggerOptions {
  return {
    level,
    serializers: serializers as unknown as LoggerOptions['serializers'],
    redact,
    hooks: { logMethod: logMethod as never },
    ...(stream ? { stream } : {}),
  };
}

/**
 * One log line from outside a request (startup, shutdown, the pool). The error
 * goes through the same serializer, and `msg` is a fixed string.
 */
export function logLine(level: 'info' | 'warn' | 'error', msg: string, err?: unknown): void {
  const line: Record<string, unknown> = {
    level: level === 'error' ? 50 : level === 'warn' ? 40 : 30,
    time: Date.now(),
    msg,
  };
  if (err !== undefined) line.err = serializeError(err);
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

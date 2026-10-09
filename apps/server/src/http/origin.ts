import type { FastifyRequest } from 'fastify';
import { ErrorCode } from '@pos/contracts';
import { AppError, StartupError } from './errors.js';

// The host name is a constant: the server answers for one origin, and a second
// spelling of it (127.0.0.1) is a second cookie jar and a second client instance
// for the same browser. Only the port is configuration.
const HOST_NAME = 'localhost';

export interface OwnOrigin {
  /** `https://localhost:<port>`, exactly as a browser sends it in `Origin`. */
  origin: string;
  /** `localhost:<port>`, exactly as a browser sends it in `Host`. */
  host: string;
}

/** Reads the port out of the configured origin and refuses any other shape. */
export function ownOrigin(configured: string): OwnOrigin {
  let port = '';
  try {
    const url = new URL(configured);
    if (url.protocol === 'https:' && url.hostname === HOST_NAME) port = url.port;
  } catch {
    // fall through to the refusal; the input is not echoed
  }
  if (!/^[1-9][0-9]{0,4}$/.test(port) || Number(port) > 65535) {
    throw new StartupError(
      `the server origin must be https://${HOST_NAME}:<port> with an explicit port (ARCHITECTURE 7.2)`
    );
  }
  return { origin: `https://${HOST_NAME}:${port}`, host: `${HOST_NAME}:${port}` };
}

function refuse(): never {
  throw new AppError(ErrorCode.ORIGIN_REFUSED, 403);
}

/**
 * The root-level check, run on every request the server receives: an
 * absolute-form request target is refused (the router would otherwise read the
 * path out of it, and a miss in that form would skip the API policy), then the
 * Host header must be exactly `localhost:<port>`. No allow-list, no mode.
 */
export function checkHost(own: OwnOrigin) {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.raw.url?.startsWith('/')) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 400);
    }
    if (request.headers.host !== own.host) refuse();
  };
}

/**
 * The API-context check, run before anything else the context does. Passing it
 * grants nothing (FR-A2c): these headers are only ever a reason to refuse.
 *
 * GET and HEAD are refused when `Sec-Fetch-Site` is present and is neither
 * `same-origin` nor `none`; absent is allowed. Every other method needs an
 * `Origin` equal to the server's own, and `Sec-Fetch-Site`, when present, must be
 * `same-origin`.
 */
export function checkOrigin(own: OwnOrigin) {
  return async (request: FastifyRequest): Promise<void> => {
    const site = request.headers['sec-fetch-site'];
    if (request.method === 'GET' || request.method === 'HEAD') {
      if (site !== undefined && site !== 'same-origin' && site !== 'none') refuse();
      return;
    }
    if (request.headers.origin !== own.origin) refuse();
    if (site !== undefined && site !== 'same-origin') refuse();
  };
}

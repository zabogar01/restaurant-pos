import type { FastifyInstance, InjectOptions } from 'fastify';
import { inject } from './request.js';

type Response = Awaited<ReturnType<typeof inject>>;

interface Stored {
  name: string;
  path: string;
  value: string;
}

export interface SentRequest {
  method: string;
  url: string;
  /** The Cookie header this request carried, or undefined when none. */
  cookie: string | undefined;
}

function surfaceOf(url: string): string {
  return (url.split(/[?#]/, 1)[0] ?? '').split('/').slice(0, 3).join('/');
}

/**
 * One browser profile over inject(): it keeps the cookies a response sets, by name
 * and path; sends on each request only those whose path matches, longest path
 * first, as a browser would; remembers the last `csrfToken` a response gave it;
 * and adds `X-RPOS-CSRF` to mutating requests. Two clients are two profiles acting
 * at once. One client holding both sessions is one profile with the POS and the
 * back office in two tabs.
 */
export class JarClient {
  private readonly jar = new Map<string, Stored>();
  readonly sent: SentRequest[] = [];
  // One token per surface: a profile with both sessions holds two.
  private readonly tokens = new Map<string, string>();

  constructor(private readonly app: FastifyInstance) {}

  /** Plants a cookie directly, as another local server could. */
  plant(name: string, path: string, value: string): void {
    this.jar.set(`${name}|${path}`, { name, path, value });
  }

  /** The last csrfToken a response on this surface (`/api/pos`, `/api/back-office`) gave. */
  csrfFor(surface: string): string | undefined {
    return this.tokens.get(surface);
  }

  valueOf(name: string, path?: string): string | undefined {
    for (const cookie of this.jar.values()) {
      if (cookie.name === name && (path === undefined || cookie.path === path)) return cookie.value;
    }
    return undefined;
  }

  private cookieHeaderFor(url: string): string | undefined {
    const pathname = url.split(/[?#]/, 1)[0] ?? '';
    const matching = [...this.jar.values()]
      .filter(
        (c) =>
          c.path === '/' ||
          pathname === c.path ||
          pathname.startsWith(c.path.endsWith('/') ? c.path : `${c.path}/`)
      )
      .sort((a, b) => b.path.length - a.path.length);
    return matching.length === 0 ? undefined : matching.map((c) => `${c.name}=${c.value}`).join('; ');
  }

  async request(options: InjectOptions): Promise<Response> {
    const method = String(options.method ?? 'GET').toUpperCase();
    const url = String(options.url);
    const headers: Record<string, unknown> = { ...options.headers };
    const cookie = this.cookieHeaderFor(url);
    if (cookie !== undefined && headers.cookie === undefined) headers.cookie = cookie;
    const mutating = method !== 'GET' && method !== 'HEAD';
    const token = this.tokens.get(surfaceOf(url));
    if (mutating && token !== undefined && headers['x-rpos-csrf'] === undefined) {
      headers['x-rpos-csrf'] = token;
    }
    this.sent.push({ method, url, cookie: headers.cookie as string | undefined });

    const res = await inject(this.app, { ...options, headers: headers as InjectOptions['headers'] });
    this.absorb(res, url);
    return res;
  }

  get(url: string, headers?: Record<string, string>) {
    return this.request({ method: 'GET', url, ...(headers ? { headers } : {}) });
  }

  post(url: string, headers?: Record<string, string>) {
    return this.request({ method: 'POST', url, ...(headers ? { headers } : {}) });
  }

  /** A POS sign-in. A 200 keeps the returned `csrfToken` for later mutating calls. */
  signInPos(pin: unknown) {
    return this.request({ method: 'POST', url: '/api/pos/auth/login', payload: { pin } });
  }

  /** A back-office sign-in. A 200 keeps the returned `csrfToken`. */
  signInBackOffice(username: unknown, password: unknown) {
    return this.request({
      method: 'POST',
      url: '/api/back-office/auth/login',
      payload: { username, password },
    });
  }

  /** M-6: the password alone, for the session this profile's cookie names. */
  reauthenticate(password: unknown) {
    return this.request({
      method: 'POST',
      url: '/api/back-office/auth/reauthenticate',
      payload: { password },
    });
  }

  private absorb(res: Response, url: string): void {
    const header = res.headers['set-cookie'];
    const lines = Array.isArray(header) ? header : header === undefined ? [] : [String(header)];
    for (const line of lines) {
      const [pair, ...attributes] = line.split(';').map((part) => part.trim());
      const eq = pair?.indexOf('=') ?? -1;
      if (pair === undefined || eq === -1) continue;
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      const path = attributes.find((a) => a.toLowerCase().startsWith('path='))?.slice(5) ?? '/';
      const maxAge = attributes.find((a) => a.toLowerCase().startsWith('max-age='))?.slice(8);
      if (value === '' || (maxAge !== undefined && Number(maxAge) <= 0)) {
        this.jar.delete(`${name}|${path}`);
      } else {
        this.jar.set(`${name}|${path}`, { name, path, value });
      }
    }
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        const body = res.json() as { csrfToken?: unknown };
        if (typeof body.csrfToken === 'string') this.tokens.set(surfaceOf(url), body.csrfToken);
      } catch {
        // not JSON: nothing to remember
      }
    }
  }
}

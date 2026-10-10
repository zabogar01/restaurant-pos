import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { ErrorCode } from '@pos/contracts';
import { closePool } from '../src/db/pool.js';
import { createBackOfficeCredential } from '../src/domain/back-office-credential.js';
import { createStaffUser, findUserByPin } from '../src/domain/pin.js';
import { createSession } from '../src/domain/session.js';
import type { Audience, VerifiedUser } from '../src/domain/session.js';
import { buildServer } from '../src/http/server.js';
import { JarClient } from './support/client.js';
import { resetDatabase } from './support/database.js';
import { TEST_ORIGIN, inject } from './support/request.js';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

function csrfOf(token: string): string {
  return createHmac('sha256', token).update('rpos-csrf-v1').digest('base64url');
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts'))
    .map((file) => join(dir, file));
}

let counter = 0;
async function makeUser(role: 'CASHIER' | 'MANAGER'): Promise<VerifiedUser> {
  counter += 1;
  const pin = String(500000 + counter);
  const { id } = await createStaffUser({ name: `Scan ${counter}`, role, pin });
  if (role === 'MANAGER') {
    await createBackOfficeCredential({
      staffUserId: id,
      username: `scan-manager-${counter}`,
      password: `scan long password ${counter}`,
    });
  }
  const found = await findUserByPin(pin);
  return { id, credentialVersion: found!.credentialVersion };
}

async function session(audience: Audience, user: VerifiedUser) {
  return createSession({ audience, user });
}

const MARK = {
  badCsrf: 'MARK-BAD-CSRF-HEADER-5521',
  badCookie: 'MARK-BAD-SESSION-COOKIE-6632',
  // 009b: a PIN, a username and a password through each credential route.
  pinWellFormed: '918273',
  pinMalformed: 'MARK-PIN-MALFORMED-7741',
  pinQuery: 'MARK-PIN-QUERY-5509',
  username: 'mark-username-8852',
  usernameLong: `MARK-USERNAME-LONG-9917-${'x'.repeat(300)}`,
  usernameExtra: 'MARK-USERNAME-EXTRA-3306',
  password: 'MARK-PASSWORD-9963-ok',
  passwordMalformed: 'MARK-PASSWORD-MALFORMED-2271',
  passwordRenew: 'MARK-PASSWORD-RENEW-4418',
};

describe('what a session leaves behind', () => {
  let app: FastifyInstance;
  let lines: string[];
  const everyResponse: { url: string; status: number; headers: Record<string, unknown>; body: string }[] = [];
  const secrets: Record<string, string> = {};

  async function send(options: InjectOptions) {
    const res = await inject(app, options);
    everyResponse.push({
      url: String(options.url),
      status: res.statusCode,
      headers: res.headers,
      body: res.body,
    });
    return res;
  }

  beforeAll(async () => {
    await resetDatabase();
    lines = [];
    const logStream = new Writable({
      write(chunk, _encoding, done) {
        lines.push(...chunk.toString().split('\n').filter(Boolean));
        done();
      },
    });
    app = buildServer({ origin: TEST_ORIGIN, logLevel: 'trace', logStream });
    await app.ready();

    const cashier = await makeUser('CASHIER');
    const manager = await makeUser('MANAGER');
    const pos = await session('POS', cashier);
    const office = await session('BACK_OFFICE', manager);
    secrets.posToken = pos.token;
    secrets.posCsrf = csrfOf(pos.token);
    secrets.officeToken = office.token;
    secrets.officeCsrf = csrfOf(office.token);

    const posCookie = `rpos_pos_sid=${pos.token}`;
    const officeCookie = `rpos_bo_sid=${office.token}`;
    const posHeaders = { cookie: posCookie, 'x-rpos-csrf': secrets.posCsrf };
    const officeHeaders = { cookie: officeCookie, 'x-rpos-csrf': secrets.officeCsrf };

    // Every route, with the tokens sent the way a browser sends them.
    await send({ method: 'GET', url: '/api/health', headers: { cookie: `${posCookie}; ${officeCookie}` } });
    await send({ method: 'GET', url: '/api/pos/auth/me', headers: posHeaders });
    await send({ method: 'POST', url: '/api/pos/auth/activity', headers: posHeaders });
    await send({ method: 'GET', url: '/api/back-office/auth/me', headers: officeHeaders });
    await send({ method: 'POST', url: '/api/back-office/auth/activity', headers: officeHeaders });
    // Refused ones: wrong token, no token, a cookie that is not a token at all.
    await send({ method: 'POST', url: '/api/pos/auth/activity', headers: { cookie: posCookie } });
    await send({
      method: 'POST',
      url: '/api/back-office/auth/activity',
      headers: { cookie: officeCookie, 'x-rpos-csrf': MARK.badCsrf },
    });
    await send({
      method: 'GET',
      url: '/api/pos/auth/me',
      headers: { cookie: `rpos_pos_sid=${MARK.badCookie}` },
    });
    await send({ method: 'GET', url: '/api/back-office/auth/me', headers: { cookie: posCookie } });
    await send({
      method: 'GET',
      url: '/api/pos/auth/me',
      headers: { cookie: `${posCookie}; ${posCookie}` },
    });
    await send({ method: 'GET', url: '/api/pos/nope', headers: posHeaders });
    // The credential routes (009b, case 27): each channel, well formed and malformed.
    await send({ method: 'POST', url: '/api/pos/auth/login', payload: { pin: MARK.pinWellFormed } });
    await send({ method: 'POST', url: '/api/pos/auth/login', payload: { pin: MARK.pinMalformed } });
    await send({
      method: 'POST',
      url: '/api/pos/auth/login',
      payload: { pin: MARK.pinWellFormed, username: MARK.usernameExtra },
    });
    await send({
      method: 'POST',
      url: '/api/back-office/auth/login',
      payload: { username: MARK.username, password: MARK.password },
    });
    await send({
      method: 'POST',
      url: '/api/back-office/auth/login',
      payload: { username: MARK.usernameLong, password: MARK.passwordMalformed },
    });
    await send({
      method: 'POST',
      url: '/api/back-office/auth/login',
      payload: { username: 12, password: MARK.passwordMalformed },
    });
    await send({
      method: 'POST',
      url: '/api/back-office/auth/reauthenticate',
      headers: officeHeaders,
      payload: { password: MARK.passwordRenew },
    });
    await send({
      method: 'POST',
      url: '/api/back-office/auth/reauthenticate',
      headers: officeHeaders,
      payload: { username: MARK.usernameExtra, password: MARK.passwordRenew },
    });
    await send({
      method: 'POST',
      url: '/api/back-office/auth/reauthenticate',
      headers: { cookie: officeCookie },
      payload: { password: MARK.passwordRenew },
    });
    await send({ method: 'POST', url: '/api/pos/auth/login?pin=MARK-PIN-QUERY-5509' });
    // The routes that end a session come last, so the earlier requests had one.
    await send({ method: 'POST', url: '/api/pos/auth/release', headers: posHeaders });
    await send({ method: 'POST', url: '/api/pos/auth/release' });
    await send({ method: 'POST', url: '/api/back-office/auth/logout', headers: officeHeaders });
    await send({ method: 'POST', url: '/api/back-office/auth/logout', headers: { cookie: officeCookie } });
    await send({
      method: 'POST',
      url: '/api/pos/auth/activity',
      headers: { origin: 'https://evil.example', ...posHeaders },
    });
  });

  afterAll(async () => {
    await app.close();
    await closePool();
  });

  it('23. no session token and no CSRF token appears in any log line or any error body', () => {
    expect(lines.length).toBeGreaterThan(10);
    const log = lines.join('\n');
    const errorBodies = everyResponse.filter((r) => r.status >= 400).map((r) => r.body);
    expect(errorBodies.length).toBeGreaterThanOrEqual(8);
    const leaked: string[] = [];
    for (const [channel, secret] of [...Object.entries(secrets), ...Object.entries(MARK)]) {
      if (log.includes(secret)) leaked.push(`${channel} in the log`);
      if (errorBodies.some((body) => body.includes(secret))) leaked.push(`${channel} in an error body`);
    }
    expect(leaked).toEqual([]);
  });

  it('26. no response carries Access-Control-* or Strict-Transport-Security, and every one is no-store', () => {
    expect(everyResponse.length).toBeGreaterThan(10);
    for (const res of everyResponse) {
      const names = Object.keys(res.headers).map((name) => name.toLowerCase());
      expect(names.filter((n) => n.startsWith('access-control-')), res.url).toEqual([]);
      expect(names, res.url).not.toContain('strict-transport-security');
      expect(res.headers['cache-control'], res.url).toBe('no-store');
    }
  });
});

describe('the rules of the source', () => {
  it('24. only session-guard.ts names the session cookies, and no route touches a cookie', () => {
    const named = sourceFiles(SRC).filter((file) => /rpos_pos_sid|rpos_bo_sid/.test(readFileSync(file, 'utf8')));
    expect(named.map((file) => relative(SRC, file))).toEqual(['http/session-guard.ts']);

    const touching = /cookies|setCookie|clearCookie|headers\.cookie|headers\[['"]cookie['"]\]/;
    const routes = sourceFiles(join(SRC, 'http', 'routes'));
    expect(routes.length).toBeGreaterThanOrEqual(3);
    expect(routes.filter((file) => touching.test(readFileSync(file, 'utf8')))).toEqual([]);

    // Under src/http only client-instance.ts and session-guard.ts read or write one.
    // (log.ts's redaction path 'req.headers.cookie' is a string, not a read.)
    const reading = /\.cookies\b|\.setCookie\(|\.clearCookie\(|request\.headers\.cookie|headers\[['"]cookie['"]\]/;
    const allowed = new Set(['http/client-instance.ts', 'http/session-guard.ts']);
    const others = sourceFiles(join(SRC, 'http'))
      .filter((file) => !allowed.has(relative(SRC, file)))
      .filter((file) => reading.test(readFileSync(file, 'utf8')));
    expect(others.map((file) => relative(SRC, file))).toEqual([]);
  });

  it('24. no route writes an error status itself: handlers throw AppError', () => {
    for (const file of sourceFiles(join(SRC, 'http', 'routes'))) {
      const text = readFileSync(file, 'utf8');
      expect(text, relative(SRC, file)).not.toMatch(/\.(code|status)\(\s*[45]/);
    }
  });

  it('24. nothing under src/http reads the database clock with now()', () => {
    // log.ts's JavaScript `Date.now()` is not the SQL function; a bare call is.
    for (const file of sourceFiles(join(SRC, 'http'))) {
      expect(readFileSync(file, 'utf8'), relative(SRC, file)).not.toMatch(/(?<![.\w])now\(\)/);
    }
  });

  it('25. error-details.types.ts has a block for every code', () => {
    const text = readFileSync(fileURLToPath(new URL('./error-details.types.ts', import.meta.url)), 'utf8');
    for (const code of Object.values(ErrorCode)) {
      expect(text, code).toContain(`new AppError(ErrorCode.${code}, `);
      expect(text, code).toContain(`const ${code.toLowerCase()}Text: ErrorBody`);
    }
  });
});

describe('two profiles, one profile with two tabs', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await resetDatabase();
    app = buildServer({ origin: TEST_ORIGIN, logLevel: 'silent' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await closePool();
  });

  async function profile(roles: [Audience, 'CASHIER' | 'MANAGER'][]) {
    const client = new JarClient(app);
    const user = await makeUser(roles.some(([, role]) => role === 'MANAGER') ? 'MANAGER' : 'CASHIER');
    for (const [audience] of roles) {
      const issued = await session(audience, user);
      if (audience === 'POS') client.plant('rpos_pos_sid', '/api/pos', issued.token);
      else client.plant('rpos_bo_sid', '/api/back-office', issued.token);
    }
    return client;
  }

  it('27. two clients hold two POS sessions at once and neither displaces the other', async () => {
    const one = await profile([['POS', 'CASHIER']]);
    const two = await profile([['POS', 'CASHIER']]);
    const meOne = await one.get('/api/pos/auth/me');
    const meTwo = await two.get('/api/pos/auth/me');
    expect(meOne.statusCode).toBe(200);
    expect(meTwo.statusCode).toBe(200);
    expect((meOne.json() as { staffUserId: string }).staffUserId).not.toBe(
      (meTwo.json() as { staffUserId: string }).staffUserId
    );

    expect((await one.post('/api/pos/auth/activity')).statusCode).toBe(204);
    expect((await one.post('/api/pos/auth/release')).statusCode).toBe(204);
    expect((await one.get('/api/pos/auth/me')).statusCode).toBe(401);
    expect((await two.get('/api/pos/auth/me')).statusCode).toBe(200);
    expect((await two.post('/api/pos/auth/activity')).statusCode).toBe(204);
  });

  it('27. one client with a POS and a back-office session sends each route only its own cookie', async () => {
    const tabs = await profile([
      ['POS', 'MANAGER'],
      ['BACK_OFFICE', 'MANAGER'],
    ]);
    expect((await tabs.get('/api/pos/auth/me')).statusCode).toBe(200);
    expect((await tabs.get('/api/back-office/auth/me')).statusCode).toBe(200);
    expect((await tabs.post('/api/back-office/auth/activity')).statusCode).toBe(204);
    expect((await tabs.post('/api/pos/auth/activity')).statusCode).toBe(204);
    expect((await tabs.get('/api/health')).statusCode).toBe(200);

    const toOffice = tabs.sent.filter((r) => r.url.startsWith('/api/back-office/'));
    const toPos = tabs.sent.filter((r) => r.url.startsWith('/api/pos/'));
    expect(toOffice.length).toBeGreaterThan(0);
    expect(toPos.length).toBeGreaterThan(0);
    for (const request of toOffice) {
      expect(request.cookie).toContain('rpos_bo_sid=');
      expect(request.cookie).not.toContain('rpos_pos_sid');
    }
    for (const request of toPos) {
      expect(request.cookie).toContain('rpos_pos_sid=');
      expect(request.cookie).not.toContain('rpos_bo_sid');
    }
    const health = tabs.sent.find((r) => r.url === '/api/health');
    expect(health?.cookie ?? '').not.toMatch(/rpos_(pos|bo)_sid/);

    // Releasing one tab's session leaves the other tab signed in.
    expect((await tabs.post('/api/pos/auth/release')).statusCode).toBe(204);
    expect((await tabs.get('/api/pos/auth/me')).statusCode).toBe(401);
    expect((await tabs.get('/api/back-office/auth/me')).statusCode).toBe(200);
  });
});

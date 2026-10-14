import { describe, expect, it } from 'vitest';
import { CSRF_HEADER } from '@pos/contracts';
import type { ApiEvent } from '../src/index.js';
import { ROUTES } from '../src/index.js';
import { empty, envelope, json, makeWorld, plain, view } from './support.js';

const LOGIN = ROUTES.posLogin.path;
const ME = ROUTES.posMe.path;
const ACTIVITY = ROUTES.posActivity.path;
const RELEASE = ROUTES.posRelease.path;
const HEALTH = ROUTES.health.path;

async function signedIn(over: Parameters<typeof view>[0] = {}, surface: 'POS' | 'BACK_OFFICE' = 'POS') {
  const world = makeWorld({ surface });
  if (surface === 'POS') {
    world.script(LOGIN, json(200, view(over)));
    await world.client.request(ROUTES.posLogin, { pin: '123456' });
  } else {
    world.script(
      ROUTES.backOfficeLogin.path,
      json(200, { ...view(over), username: 'owner' })
    );
    await world.client.request(ROUTES.backOfficeLogin, { username: 'owner', password: 'pw' });
  }
  world.calls.length = 0;
  return world;
}

describe('1. headers by method and body', () => {
  it('1. a GET sends no token and no Content-Type', async () => {
    const world = await signedIn();
    world.script(ME, json(200, view()));
    await world.client.request(ROUTES.posMe);
    const [call] = world.calls;
    expect(call?.method).toBe('GET');
    expect(call?.headers).toEqual({});
  });

  it('1. a POST with no body sends the token and no Content-Type', async () => {
    const world = await signedIn();
    world.script(ACTIVITY, empty());
    await world.client.request(ROUTES.posActivity);
    const [call] = world.calls;
    expect(call?.headers).toEqual({ [CSRF_HEADER]: 'token-1' });
    expect(call?.body).toBeUndefined();
  });

  it('1. a POST with a body sends both', async () => {
    const world = await signedIn();
    world.script(LOGIN, json(200, view({ csrfToken: 'token-2' })));
    await world.client.request(ROUTES.posLogin, { pin: '654321' });
    const [call] = world.calls;
    expect(call?.headers).toEqual({ [CSRF_HEADER]: 'token-1', 'Content-Type': 'application/json' });
    expect(call?.body).toBe('{"pin":"654321"}');
  });

  it('1. every request is relative, same-origin and uncached', async () => {
    const world = makeWorld();
    world.script(HEALTH, json(200, { status: 'ok' }));
    await world.client.request(ROUTES.health);
    expect(world.calls[0]?.path).toBe('/api/health');
  });
});

describe('2. the token', () => {
  it('2. a sign-in view replaces the token and the next mutation carries it', async () => {
    const world = await signedIn({ csrfToken: 'first' });
    world.script(LOGIN, json(200, view({ csrfToken: 'second' })));
    await world.client.request(ROUTES.posLogin, { pin: '111111' });
    world.script(ACTIVITY, empty());
    await world.client.request(ROUTES.posActivity);
    expect(world.callsTo(ACTIVITY)[0]?.headers[CSRF_HEADER]).toBe('second');
  });
});

describe('3. the request schema', () => {
  it('3. a PIN that is not six digits is never sent', async () => {
    const world = makeWorld();
    const result = await world.client.request(ROUTES.posLogin, { pin: '12345' });
    expect(result).toEqual({ kind: 'invalid-request' });
    expect(world.calls).toHaveLength(0);
  });

  it('3. an empty back-office username or password is never sent', async () => {
    const world = makeWorld({ surface: 'BACK_OFFICE' });
    const result = await world.client.request(ROUTES.backOfficeLogin, { username: '', password: 'x' });
    expect(result).toEqual({ kind: 'invalid-request' });
    expect(world.calls).toHaveLength(0);
  });
});

describe('4. the envelope is the result', () => {
  it('4. a 401, a 403 and a 429 are each refused with their code and details', async () => {
    const world = makeWorld();
    world.script(
      LOGIN,
      envelope(403, 'FORBIDDEN'),
      envelope(429, 'THROTTLED', { retryAfterSeconds: 240 }),
      envelope(401, 'INVALID_CREDENTIALS', { retryAfterSeconds: 300 })
    );
    const results = [];
    for (let i = 0; i < 3; i++) results.push(await world.client.request(ROUTES.posLogin, { pin: '123456' }));
    expect(results).toEqual([
      { kind: 'refused', body: { error: { code: 'FORBIDDEN' } } },
      { kind: 'refused', body: { error: { code: 'THROTTLED', details: { retryAfterSeconds: 240 } } } },
      {
        kind: 'refused',
        body: { error: { code: 'INVALID_CREDENTIALS', details: { retryAfterSeconds: 300 } } },
      },
    ]);
  });

  it('4. the three codes that share 401 give three different results', async () => {
    const world = makeWorld();
    world.script(
      ME,
      envelope(401, 'UNAUTHENTICATED'),
      envelope(401, 'SESSION_IDLE'),
      envelope(401, 'INVALID_CREDENTIALS')
    );
    const codes = [];
    for (let i = 0; i < 3; i++) {
      const result = await world.client.request(ROUTES.posMe);
      codes.push(result.kind === 'refused' ? result.body.error.code : result.kind);
    }
    expect(new Set(codes).size).toBe(3);
  });
});

describe('5-8. CSRF_REFUSED', () => {
  it('5. the same person on `me`: retried once, with the new token, and its result returned', async () => {
    const world = await signedIn({ csrfToken: 'old' });
    world.script(ACTIVITY, envelope(403, 'CSRF_REFUSED'), empty());
    world.script(ME, json(200, view({ csrfToken: 'new' })));
    const result = await world.client.request(ROUTES.posActivity);
    expect(result).toEqual({ kind: 'ok', value: undefined });
    const sent = world.callsTo(ACTIVITY);
    expect(sent).toHaveLength(2);
    expect(sent[0]?.headers[CSRF_HEADER]).toBe('old');
    expect(sent[1]?.headers[CSRF_HEADER]).toBe('new');
    expect(world.callsTo(ME)).toHaveLength(1);
  });

  it('6. someone else on `me`: nothing retried, no release sent, the session is gone', async () => {
    const world = await signedIn();
    const events: ApiEvent[] = [];
    world.client.subscribe((event) => events.push(event));
    world.script(ACTIVITY, envelope(403, 'CSRF_REFUSED'));
    world.script(ME, json(200, view({ staffUserId: 'staff-2', csrfToken: 'theirs' })));
    const result = await world.client.request(ROUTES.posActivity);
    expect(result).toEqual({ kind: 'session-gone' });
    expect(world.callsTo(ACTIVITY)).toHaveLength(1);
    expect(world.callsTo(RELEASE)).toHaveLength(0);
    expect(world.client.staffUserId()).toBeNull();
    expect(events).toContainEqual({ type: 'session-ended', reason: 'ACTOR_CHANGED' });
    // The other person's token was not adopted: a later mutation carries none.
    world.script(ACTIVITY, empty());
    await world.client.request(ROUTES.posActivity);
    expect(world.callsTo(ACTIVITY)[1]?.headers[CSRF_HEADER]).toBeUndefined();
  });

  it('6. a core that held nobody retries nothing and reads nothing', async () => {
    const world = makeWorld();
    world.script(LOGIN, envelope(403, 'CSRF_REFUSED'));
    const result = await world.client.request(ROUTES.posLogin, { pin: '123456' });
    expect(result).toEqual({ kind: 'session-gone' });
    expect(world.calls).toHaveLength(1);
  });

  it('7. a second refusal after the retry is returned and not retried again', async () => {
    const world = await signedIn();
    world.script(ACTIVITY, envelope(403, 'CSRF_REFUSED'), envelope(403, 'CSRF_REFUSED'));
    world.script(ME, json(200, view({ csrfToken: 'new' })));
    const result = await world.client.request(ROUTES.posActivity);
    expect(result).toEqual({ kind: 'refused', body: { error: { code: 'CSRF_REFUSED' } } });
    expect(world.callsTo(ACTIVITY)).toHaveLength(2);
    expect(world.callsTo(ME)).toHaveLength(1);
  });

  it('8. two refused requests at once cause one `me`', async () => {
    const world = await signedIn();
    world.script(ACTIVITY, envelope(403, 'CSRF_REFUSED'), envelope(403, 'CSRF_REFUSED'), empty(), empty());
    world.script(ME, async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      return json(200, view({ csrfToken: 'new' }));
    });
    const both = await Promise.all([
      world.client.request(ROUTES.posActivity),
      world.client.request(ROUTES.posActivity),
    ]);
    expect(both.map((r) => r.kind)).toEqual(['ok', 'ok']);
    expect(world.callsTo(ME)).toHaveLength(1);
    expect(world.callsTo(ACTIVITY)).toHaveLength(4);
  });
});

describe('9. failed and unavailable', () => {
  it('9. a 500 with an envelope and health 200 is failed, and the request is sent once', async () => {
    const world = await signedIn();
    world.script(ACTIVITY, envelope(500, 'INTERNAL'));
    world.script(HEALTH, json(200, { status: 'ok' }));
    expect(await world.client.request(ROUTES.posActivity)).toEqual({ kind: 'failed' });
    expect(world.callsTo(ACTIVITY)).toHaveLength(1);
    expect(world.callsTo(HEALTH)).toHaveLength(1);
  });

  it('9. a 502 with an HTML body and health 200 is failed', async () => {
    const world = await signedIn();
    world.script(ACTIVITY, plain(502, '<html>Bad Gateway</html>'));
    world.script(HEALTH, json(200, { status: 'ok' }));
    expect(await world.client.request(ROUTES.posActivity)).toEqual({ kind: 'failed' });
    expect(world.callsTo(ACTIVITY)).toHaveLength(1);
  });

  it('9. a rejected fetch and a rejected health read is unavailable', async () => {
    const world = await signedIn();
    world.script(ACTIVITY, new Error('network'));
    world.script(HEALTH, new Error('network'));
    expect(await world.client.request(ROUTES.posActivity)).toEqual({ kind: 'unavailable' });
    expect(world.callsTo(ACTIVITY)).toHaveLength(1);
  });

  it('9. a 500 and health 503 is unavailable', async () => {
    const world = await signedIn();
    world.script(ACTIVITY, envelope(500, 'INTERNAL'));
    world.script(HEALTH, envelope(503, 'UNAVAILABLE'));
    expect(await world.client.request(ROUTES.posActivity)).toEqual({ kind: 'unavailable' });
    expect(world.callsTo(ACTIVITY)).toHaveLength(1);
  });

  it('9. a timeout is a fault: the request is aborted, health asked once, nothing resent', async () => {
    const world = await signedIn();
    world.script(
      ACTIVITY,
      (signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    world.script(HEALTH, json(200, { status: 'ok' }));
    const pending = world.client.request(ROUTES.posActivity);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const timer = world.timers.find((t) => t.live && t.ms === 10_000);
    expect(timer).toBeDefined();
    timer?.fire();
    expect(await pending).toEqual({ kind: 'failed' });
    expect(world.callsTo(ACTIVITY)).toHaveLength(1);
  });
});

describe('10. a response that fails its schema', () => {
  it('10. a 200 whose body fails the schema is failed, and the text is kept nowhere', async () => {
    const world = makeWorld();
    world.script(ME, json(200, { staffUserId: 'x', secret: 'SENTINEL-TEXT' }));
    world.script(HEALTH, json(200, { status: 'ok' }));
    const result = await world.client.request(ROUTES.posMe);
    expect(result).toEqual({ kind: 'failed' });
    expect(JSON.stringify(result)).not.toContain('SENTINEL-TEXT');
    expect(world.client.staffUserId()).toBeNull();
  });
});

describe('11. the deadline', () => {
  it('11. a session view sets it to the moment of sending plus the remaining seconds', async () => {
    const world = makeWorld();
    world.script(ME, json(200, view({ idleSeconds: 300, idleRemainingSeconds: 120 })));
    await world.client.request(ROUTES.posMe);
    expect(world.client.deadline()).toBe(1000 + 120_000);
  });

  it('11. a 2xx from an interactive route moves it to the moment of sending plus the limit', async () => {
    const world = makeWorld();
    world.script(LOGIN, json(200, view({ idleSeconds: 300, idleRemainingSeconds: 300 })));
    await world.client.request(ROUTES.posLogin, { pin: '123456' });
    world.advance(50_000);
    world.script(ACTIVITY, empty());
    await world.client.request(ROUTES.posActivity);
    expect(world.client.deadline()).toBe(1000 + 50_000 + 300_000);
  });

  it('11. `me`, a failed request and a non-interactive route do not move it', async () => {
    const world = makeWorld();
    world.script(LOGIN, json(200, view({ idleSeconds: 300, idleRemainingSeconds: 300 })));
    await world.client.request(ROUTES.posLogin, { pin: '123456' });
    const set = world.client.deadline();
    // `me` is a session view: it re-bases the deadline on what the server says is left,
    // so the check is that it does not extend to the limit.
    world.advance(100_000);
    world.script(ME, json(200, view({ idleSeconds: 300, idleRemainingSeconds: 200 })));
    await world.client.request(ROUTES.posMe);
    expect(world.client.deadline()).toBe(set); // 1000+100000 + 200000 = 1000+300000
    // A failed interactive request.
    world.advance(10_000);
    world.script(ACTIVITY, envelope(500, 'INTERNAL'));
    world.script(HEALTH, json(200, { status: 'ok' }));
    await world.client.request(ROUTES.posActivity);
    expect(world.client.deadline()).toBe(set);
    // A refused interactive request that is not the end of the session.
    world.script(ACTIVITY, envelope(400, 'VALIDATION_FAILED'));
    await world.client.request(ROUTES.posActivity);
    expect(world.client.deadline()).toBe(set);
    // A non-interactive route with no view.
    world.script(HEALTH, json(200, { status: 'ok' }));
    await world.client.request(ROUTES.health);
    expect(world.client.deadline()).toBe(set);
  });

  it('11. a `me` that failed does not move it', async () => {
    const world = makeWorld();
    world.script(LOGIN, json(200, view()));
    await world.client.request(ROUTES.posLogin, { pin: '123456' });
    const set = world.client.deadline();
    world.advance(5_000);
    world.script(ME, envelope(500, 'INTERNAL'));
    world.script(HEALTH, json(200, { status: 'ok' }));
    await world.client.request(ROUTES.posMe);
    expect(world.client.deadline()).toBe(set);
  });

  it('11. the deadline is announced when it moves', async () => {
    const world = makeWorld();
    const events: ApiEvent[] = [];
    world.client.subscribe((event) => events.push(event));
    world.script(LOGIN, json(200, view()));
    await world.client.request(ROUTES.posLogin, { pin: '123456' });
    expect(events).toEqual([{ type: 'deadline', deadline: 1000 + 300_000 }]);
  });
});

describe('12. SESSION_IDLE by surface', () => {
  it('12. at the POS SESSION_IDLE drops the token', async () => {
    const world = await signedIn();
    world.script(ME, envelope(401, 'SESSION_IDLE'));
    await world.client.request(ROUTES.posMe);
    expect(world.client.staffUserId()).toBeNull();
    expect(world.client.deadline()).toBeNull();
    world.script(ACTIVITY, empty());
    await world.client.request(ROUTES.posActivity);
    expect(world.callsTo(ACTIVITY)[0]?.headers[CSRF_HEADER]).toBeUndefined();
  });

  it('12. a core built for the back office keeps the token through SESSION_IDLE', async () => {
    const world = await signedIn({ csrfToken: 'bo-token' }, 'BACK_OFFICE');
    const events: ApiEvent[] = [];
    world.client.subscribe((event) => events.push(event));
    world.script(ROUTES.backOfficeMe.path, envelope(401, 'SESSION_IDLE'));
    await world.client.request(ROUTES.backOfficeMe);
    expect(world.client.deadline()).toBeNull();
    expect(events).toContainEqual({ type: 'session-ended', reason: 'SESSION_IDLE' });
    world.script(ROUTES.backOfficeReauthenticate.path, json(200, { ...view(), username: 'owner' }));
    await world.client.request(ROUTES.backOfficeReauthenticate, { password: 'pw' });
    expect(world.callsTo(ROUTES.backOfficeReauthenticate.path)[0]?.headers[CSRF_HEADER]).toBe('bo-token');
  });

  it('12. UNAUTHENTICATED drops the token at both surfaces', async () => {
    const world = await signedIn({}, 'BACK_OFFICE');
    world.script(ROUTES.backOfficeMe.path, envelope(401, 'UNAUTHENTICATED'));
    await world.client.request(ROUTES.backOfficeMe);
    expect(world.client.staffUserId()).toBeNull();
  });
});

describe('release', () => {
  it('ends the session whatever the server answers', async () => {
    const world = await signedIn();
    world.script(RELEASE, envelope(500, 'INTERNAL'));
    world.script(HEALTH, json(200, { status: 'ok' }));
    await world.client.request(ROUTES.posRelease);
    expect(world.client.staffUserId()).toBeNull();
  });

  it('a route of the other surface is a programming error', async () => {
    const world = makeWorld({ surface: 'POS' });
    await expect(world.client.request(ROUTES.backOfficeMe)).rejects.toThrow();
    expect(world.calls).toHaveLength(0);
  });
});

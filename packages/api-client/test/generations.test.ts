import { describe, expect, it } from 'vitest';
import { CSRF_HEADER } from '@pos/contracts';
import type { FetchResponse } from '../src/index.js';
import { ROUTES } from '../src/index.js';
import { empty, envelope, json, makeWorld, view } from './support.js';

const LOGIN = ROUTES.posLogin.path;
const ME = ROUTES.posMe.path;
const ACTIVITY = ROUTES.posActivity.path;
const RELEASE = ROUTES.posRelease.path;

/** A reply the test delivers by hand, so responses can arrive in any order. */
function held() {
  let deliver!: (response: FetchResponse) => void;
  const promise = new Promise<FetchResponse>((resolve) => {
    deliver = resolve;
  });
  return { reply: () => promise, deliver };
}

const settleMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

async function signedInAs(staffUserId: string, csrfToken: string) {
  const world = makeWorld();
  world.script(LOGIN, json(200, view({ staffUserId, csrfToken })));
  await world.client.request(ROUTES.posLogin, { pin: '123456' });
  world.calls.length = 0;
  return world;
}

describe('13. an obsolete response changes nothing', () => {
  it('13a. `me` delivered after release: nothing held, session-gone, the next mutation has no token', async () => {
    const world = await signedInAs('staff-A', 'token-A');
    const me = held();
    world.script(ME, me.reply);
    const pending = world.client.request(ROUTES.posMe);
    await settleMicrotasks();
    world.script(RELEASE, empty());
    await world.client.request(ROUTES.posRelease);
    me.deliver(json(200, view({ staffUserId: 'staff-A', csrfToken: 'token-A' })));
    expect(await pending).toEqual({ kind: 'session-gone' });
    expect(world.client.staffUserId()).toBeNull();
    expect(world.client.deadline()).toBeNull();
    world.script(ACTIVITY, empty());
    await world.client.request(ROUTES.posActivity);
    expect(world.callsTo(ACTIVITY)[0]?.headers[CSRF_HEADER]).toBeUndefined();
  });

  it('13b. UNAUTHENTICATED for an older request after signing in as B: B is still held', async () => {
    const world = await signedInAs('staff-A', 'token-A');
    const older = held();
    world.script(ACTIVITY, older.reply);
    const pending = world.client.request(ROUTES.posActivity);
    await settleMicrotasks();
    world.script(LOGIN, json(200, view({ staffUserId: 'staff-B', csrfToken: 'token-B' })));
    await world.client.request(ROUTES.posLogin, { pin: '654321' });
    older.deliver(envelope(401, 'UNAUTHENTICATED'));
    expect(await pending).toEqual({ kind: 'session-gone' });
    expect(world.client.staffUserId()).toBe('staff-B');
    expect(world.client.deadline()).not.toBeNull();
    world.script(ACTIVITY, empty());
    await world.client.request(ROUTES.posActivity);
    expect(world.callsTo(ACTIVITY)[1]?.headers[CSRF_HEADER]).toBe('token-B');
  });

  it('13c. an interactive 2xx delivered after release does not move the deadline', async () => {
    const world = await signedInAs('staff-A', 'token-A');
    const older = held();
    world.script(ACTIVITY, older.reply);
    const pending = world.client.request(ROUTES.posActivity);
    await settleMicrotasks();
    world.script(RELEASE, empty());
    await world.client.request(ROUTES.posRelease);
    world.advance(5_000);
    older.deliver(empty());
    expect(await pending).toEqual({ kind: 'ok', value: undefined });
    expect(world.client.deadline()).toBeNull();
    expect(world.client.staffUserId()).toBeNull();
  });

  it('13c. an interactive 2xx from an earlier session does not move a later session\'s deadline', async () => {
    const world = await signedInAs('staff-A', 'token-A');
    const older = held();
    world.script(ACTIVITY, older.reply);
    const pending = world.client.request(ROUTES.posActivity);
    await settleMicrotasks();
    world.script(RELEASE, empty());
    await world.client.request(ROUTES.posRelease);
    world.advance(5_000);
    world.script(
      LOGIN,
      json(200, view({ staffUserId: 'staff-B', csrfToken: 'token-B', idleSeconds: 60, idleRemainingSeconds: 60 }))
    );
    await world.client.request(ROUTES.posLogin, { pin: '654321' });
    const deadlineOfB = world.client.deadline();
    expect(deadlineOfB).toBe(world.clock + 60_000);
    world.advance(1_000);
    older.deliver(empty());
    await pending;
    expect(world.client.deadline()).toBe(deadlineOfB);
  });

  it('13d. the CSRF path\'s `me` delivered after release: no retry, nothing adopted', async () => {
    const world = await signedInAs('staff-A', 'token-A');
    world.script(ACTIVITY, envelope(403, 'CSRF_REFUSED'));
    const me = held();
    world.script(ME, me.reply);
    const pending = world.client.request(ROUTES.posActivity);
    await settleMicrotasks();
    expect(world.callsTo(ME)).toHaveLength(1);
    world.script(RELEASE, empty());
    await world.client.request(ROUTES.posRelease);
    me.deliver(json(200, view({ staffUserId: 'staff-A', csrfToken: 'token-new' })));
    expect(await pending).toEqual({ kind: 'session-gone' });
    expect(world.callsTo(ACTIVITY)).toHaveLength(1);
    expect(world.client.staffUserId()).toBeNull();
    expect(world.client.deadline()).toBeNull();
  });

  it('13e. a `me` joined by a request of a newer session is not shared with an older one', async () => {
    const world = await signedInAs('staff-A', 'token-A');
    world.script(ACTIVITY, envelope(403, 'CSRF_REFUSED'));
    const oldMe = held();
    world.script(ME, oldMe.reply);
    const first = world.client.request(ROUTES.posActivity);
    await settleMicrotasks();
    world.script(LOGIN, json(200, view({ staffUserId: 'staff-B', csrfToken: 'token-B' })));
    await world.client.request(ROUTES.posLogin, { pin: '654321' });
    world.script(ACTIVITY, envelope(403, 'CSRF_REFUSED'), empty());
    world.script(ME, json(200, view({ staffUserId: 'staff-B', csrfToken: 'token-B2' })));
    const second = world.client.request(ROUTES.posActivity);
    await settleMicrotasks();
    expect(world.callsTo(ME)).toHaveLength(2);
    oldMe.deliver(json(200, view({ staffUserId: 'staff-A', csrfToken: 'token-A2' })));
    expect(await first).toEqual({ kind: 'session-gone' });
    expect((await second).kind).toBe('ok');
    expect(world.client.staffUserId()).toBe('staff-B');
  });
});

describe('13f. sign-ins', () => {
  it('13f. two sign-ins in flight: the first to settle installs; the other is obsolete', async () => {
    const world = makeWorld();
    const a = held();
    const b = held();
    world.script(LOGIN, a.reply, b.reply);
    const first = world.client.request(ROUTES.posLogin, { pin: '111111' });
    const second = world.client.request(ROUTES.posLogin, { pin: '222222' });
    await settleMicrotasks();
    b.deliver(json(200, view({ staffUserId: 'staff-B', csrfToken: 'token-B' })));
    expect((await second).kind).toBe('ok');
    a.deliver(json(200, view({ staffUserId: 'staff-A', csrfToken: 'token-A' })));
    expect(await first).toEqual({ kind: 'session-gone' });
    expect(world.client.staffUserId()).toBe('staff-B');
  });

  it('13f. a release still in flight does not make a later sign-in obsolete', async () => {
    const world = await signedInAs('staff-A', 'token-A');
    const release = held();
    world.script(RELEASE, release.reply);
    const releasing = world.client.request(ROUTES.posRelease);
    await settleMicrotasks();
    world.script(LOGIN, json(200, view({ staffUserId: 'staff-B', csrfToken: 'token-B' })));
    const signing = await world.client.request(ROUTES.posLogin, { pin: '654321' });
    expect(signing.kind).toBe('ok');
    release.deliver(empty());
    expect(await releasing).toEqual({ kind: 'session-gone' });
    // The release was sent under the earlier session and settled under B's: it ends nothing.
    expect(world.client.staffUserId()).toBe('staff-B');
  });
});

describe('14. no result exposes the token', () => {
  const BO_VIEW = { ...view({ csrfToken: 'tok-bo' }), username: 'owner' };

  it('14. POS sign-in', async () => {
    const world = makeWorld();
    world.script(LOGIN, json(200, view({ csrfToken: 'tok-pos-login' })));
    const result = await world.client.request(ROUTES.posLogin, { pin: '123456' });
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect('csrfToken' in result.value).toBe(false);
    // @ts-expect-error the token is not part of a result
    void result.value.csrfToken;
    expect(result.value.staffUserId).toBe('staff-1');
    expect(JSON.stringify(result)).not.toContain('tok-pos-login');
    world.script(ACTIVITY, empty());
    await world.client.request(ROUTES.posActivity);
    expect(world.callsTo(ACTIVITY)[0]?.headers[CSRF_HEADER]).toBe('tok-pos-login');
  });

  it('14. POS me', async () => {
    const world = makeWorld();
    world.script(ME, json(200, view({ csrfToken: 'tok-pos-me' })));
    const result = await world.client.request(ROUTES.posMe);
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect('csrfToken' in result.value).toBe(false);
    // @ts-expect-error the token is not part of a result
    void result.value.csrfToken;
    world.script(ACTIVITY, empty());
    await world.client.request(ROUTES.posActivity);
    expect(world.callsTo(ACTIVITY)[0]?.headers[CSRF_HEADER]).toBe('tok-pos-me');
  });

  it('14. back-office sign-in', async () => {
    const world = makeWorld({ surface: 'BACK_OFFICE' });
    world.script(ROUTES.backOfficeLogin.path, json(200, BO_VIEW));
    const result = await world.client.request(ROUTES.backOfficeLogin, {
      username: 'owner',
      password: 'pw',
    });
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect('csrfToken' in result.value).toBe(false);
    // @ts-expect-error the token is not part of a result
    void result.value.csrfToken;
    expect(result.value.username).toBe('owner');
    world.script(ROUTES.backOfficeActivity.path, empty());
    await world.client.request(ROUTES.backOfficeActivity);
    expect(world.callsTo(ROUTES.backOfficeActivity.path)[0]?.headers[CSRF_HEADER]).toBe('tok-bo');
  });

  it('14. back-office me', async () => {
    const world = makeWorld({ surface: 'BACK_OFFICE' });
    world.script(ROUTES.backOfficeMe.path, json(200, BO_VIEW));
    const result = await world.client.request(ROUTES.backOfficeMe);
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect('csrfToken' in result.value).toBe(false);
    // @ts-expect-error the token is not part of a result
    void result.value.csrfToken;
    world.script(ROUTES.backOfficeActivity.path, empty());
    await world.client.request(ROUTES.backOfficeActivity);
    expect(world.callsTo(ROUTES.backOfficeActivity.path)[0]?.headers[CSRF_HEADER]).toBe('tok-bo');
  });

  it('14. back-office re-authentication', async () => {
    const world = makeWorld({ surface: 'BACK_OFFICE' });
    world.script(ROUTES.backOfficeReauthenticate.path, json(200, BO_VIEW));
    const result = await world.client.request(ROUTES.backOfficeReauthenticate, { password: 'pw' });
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect('csrfToken' in result.value).toBe(false);
    // @ts-expect-error the token is not part of a result
    void result.value.csrfToken;
    world.script(ROUTES.backOfficeActivity.path, empty());
    await world.client.request(ROUTES.backOfficeActivity);
    expect(world.callsTo(ROUTES.backOfficeActivity.path)[0]?.headers[CSRF_HEADER]).toBe('tok-bo');
  });
});

describe('FORBIDDEN ends the session', () => {
  it('FORBIDDEN drops the actor and the token', async () => {
    const world = await signedInAs('staff-A', 'token-A');
    world.script(ME, envelope(403, 'FORBIDDEN'));
    const result = await world.client.request(ROUTES.posMe);
    expect(result.kind).toBe('refused');
    expect(world.client.staffUserId()).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { CSRF_HEADER } from '@pos/contracts';
import type { ApiEvent, FetchResponse } from '../src/index.js';
import { ROUTES } from '../src/index.js';
import { empty, envelope, json, makeWorld, view } from './support.js';

function held() {
  let deliver!: (response: FetchResponse) => void;
  const promise = new Promise<FetchResponse>((resolve) => {
    deliver = resolve;
  });
  return { reply: () => promise, deliver };
}

const settleMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

type World = ReturnType<typeof makeWorld>;
type Over = Parameters<typeof view>[0];

/** What differs between the two surfaces, as closures over a world. */
interface Surface {
  name: 'POS' | 'BACK_OFFICE';
  me: string;
  activity: string;
  end: string;
  login: string;
  wire(over?: Over): unknown;
  signIn(world: World): Promise<{ kind: string }>;
  readMe(world: World): Promise<{ kind: string }>;
  activate(world: World): Promise<{ kind: string }>;
  finish(world: World): Promise<{ kind: string }>;
}

const POS: Surface = {
  name: 'POS',
  me: ROUTES.posMe.path,
  activity: ROUTES.posActivity.path,
  end: ROUTES.posRelease.path,
  login: ROUTES.posLogin.path,
  wire: (over) => view(over),
  signIn: (w) => w.client.request(ROUTES.posLogin, { pin: '123456' }),
  readMe: (w) => w.client.request(ROUTES.posMe),
  activate: (w) => w.client.request(ROUTES.posActivity),
  finish: (w) => w.client.request(ROUTES.posRelease),
};

const BACK_OFFICE: Surface = {
  name: 'BACK_OFFICE',
  me: ROUTES.backOfficeMe.path,
  activity: ROUTES.backOfficeActivity.path,
  end: ROUTES.backOfficeLogout.path,
  login: ROUTES.backOfficeLogin.path,
  wire: (over) => ({ ...view(over), username: 'owner' }),
  signIn: (w) => w.client.request(ROUTES.backOfficeLogin, { username: 'owner', password: 'pw' }),
  readMe: (w) => w.client.request(ROUTES.backOfficeMe),
  activate: (w) => w.client.request(ROUTES.backOfficeActivity),
  finish: (w) => w.client.request(ROUTES.backOfficeLogout),
};

const SURFACES = [POS, BACK_OFFICE];

async function signedIn(s: Surface, over: Over = {}) {
  const world = makeWorld({ surface: s.name });
  world.script(s.login, json(200, s.wire(over)));
  await s.signIn(world);
  world.calls.length = 0;
  return world;
}

describe('15. a back-office SESSION_IDLE is not a session end', () => {
  it('15a. a re-authentication sent before the idle still installs; a 2xx sent before it starts no countdown', async () => {
    const world = await signedIn(BACK_OFFICE, { csrfToken: 'tok-1' });
    const reauth = held();
    world.script(ROUTES.backOfficeReauthenticate.path, reauth.reply);
    const reauthSentAt = world.clock;
    const reauthenticating = world.client.request(ROUTES.backOfficeReauthenticate, { password: 'pw' });
    const earlier = held();
    world.script(BACK_OFFICE.activity, earlier.reply);
    const activity = BACK_OFFICE.activate(world);
    await settleMicrotasks();

    world.script(BACK_OFFICE.me, envelope(401, 'SESSION_IDLE'), envelope(401, 'SESSION_IDLE'));
    await BACK_OFFICE.readMe(world);
    await BACK_OFFICE.readMe(world);
    expect(world.client.deadline()).toBeNull();
    expect(world.client.staffUserId()).toBe('staff-1');

    world.advance(1_000);
    earlier.deliver(empty());
    expect((await activity).kind).toBe('ok');
    expect(world.client.deadline()).toBeNull();

    world.advance(1_000);
    reauth.deliver(
      json(200, {
        ...view({ csrfToken: 'tok-2', idleSeconds: 300, idleRemainingSeconds: 300 }),
        username: 'owner',
      })
    );
    const result = await reauthenticating;
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect('csrfToken' in result.value).toBe(false);
    // Reckoned from the moment of sending, as question 6 says.
    expect(world.client.deadline()).toBe(reauthSentAt + 300_000);
    world.script(BACK_OFFICE.activity, empty());
    await BACK_OFFICE.activate(world);
    expect(world.callsTo(BACK_OFFICE.activity)[1]?.headers[CSRF_HEADER]).toBe('tok-2');
  });

  it('15a. a repeated back-office SESSION_IDLE is reported once, when it clears the deadline', async () => {
    const world = await signedIn(BACK_OFFICE);
    const events: ApiEvent[] = [];
    world.client.subscribe((event) => events.push(event));
    world.script(BACK_OFFICE.me, envelope(401, 'SESSION_IDLE'), envelope(401, 'SESSION_IDLE'));
    await BACK_OFFICE.readMe(world);
    await BACK_OFFICE.readMe(world);
    expect(events.filter((e) => e.type === 'session-ended')).toHaveLength(1);
    expect(world.client.staffUserId()).toBe('staff-1');
  });

  it('15a. at the POS the same SESSION_IDLE still ends the session', async () => {
    const world = await signedIn(POS);
    world.script(POS.me, envelope(401, 'SESSION_IDLE'));
    await POS.readMe(world);
    expect(world.client.staffUserId()).toBeNull();
  });
});

describe('16. a session recovered into an empty core', () => {
  for (const s of SURFACES) {
    for (const code of s.name === 'POS' ? ['UNAUTHENTICATED', 'SESSION_IDLE'] : ['UNAUTHENTICATED']) {
      it(`16b. ${s.name}: an earlier request's ${code} after \`me\` recovers A changes nothing`, async () => {
        const world = makeWorld({ surface: s.name });
        const x = held();
        world.script(s.activity, x.reply);
        const pending = s.activate(world);
        await settleMicrotasks();
        world.script(s.me, json(200, s.wire({ staffUserId: 'staff-A', csrfToken: 'tok-A' })));
        await s.readMe(world);
        const deadlineOfA = world.client.deadline();
        expect(world.client.staffUserId()).toBe('staff-A');
        const events: ApiEvent[] = [];
        world.client.subscribe((event) => events.push(event));
        world.advance(2_000);
        x.deliver(envelope(401, code));
        expect(await pending).toEqual({ kind: 'session-gone' });
        expect(events).toEqual([]);
        expect(world.client.staffUserId()).toBe('staff-A');
        expect(world.client.deadline()).toBe(deadlineOfA);
        world.script(s.activity, empty());
        await s.activate(world);
        expect(world.callsTo(s.activity)[1]?.headers[CSRF_HEADER]).toBe('tok-A');
      });
    }

    it(`16b. ${s.name}: a sign-in to B sent before the recovery and settling after it installs B`, async () => {
      const world = makeWorld({ surface: s.name });
      const login = held();
      world.script(s.login, login.reply);
      const signing = s.signIn(world);
      await settleMicrotasks();
      world.script(s.me, json(200, s.wire({ staffUserId: 'staff-A', csrfToken: 'tok-A' })));
      await s.readMe(world);
      login.deliver(json(200, s.wire({ staffUserId: 'staff-B', csrfToken: 'tok-B' })));
      expect((await signing).kind).toBe('ok');
      expect(world.client.staffUserId()).toBe('staff-B');
      // A `me` that settles after that sign-in is obsolete.
      const late = held();
      world.script(s.me, late.reply);
      const reading = s.readMe(world);
      await settleMicrotasks();
      world.script(s.login, json(200, s.wire({ staffUserId: 'staff-C', csrfToken: 'tok-C' })));
      await s.signIn(world);
      late.deliver(json(200, s.wire({ staffUserId: 'staff-B', csrfToken: 'tok-B' })));
      expect(await reading).toEqual({ kind: 'session-gone' });
      expect(world.client.staffUserId()).toBe('staff-C');
      world.script(s.activity, empty());
      await s.activate(world);
      expect(world.callsTo(s.activity)[0]?.headers[CSRF_HEADER]).toBe('tok-C');
    });
  }
});

describe('17. an obsolete release or logout', () => {
  for (const s of SURFACES) {
    it(`17c. ${s.name}: delivered after a sign-in as B it is session-gone and changes nothing`, async () => {
      const world = await signedIn(s, { staffUserId: 'staff-A', csrfToken: 'tok-A' });
      const end = held();
      world.script(s.end, end.reply);
      const ending = s.finish(world);
      await settleMicrotasks();
      world.script(s.login, json(200, s.wire({ staffUserId: 'staff-B', csrfToken: 'tok-B' })));
      await s.signIn(world);
      const deadlineOfB = world.client.deadline();
      const events: ApiEvent[] = [];
      world.client.subscribe((event) => events.push(event));
      world.advance(1_000);
      end.deliver(empty());
      expect(await ending).toEqual({ kind: 'session-gone' });
      expect(events).toEqual([]);
      expect(world.client.staffUserId()).toBe('staff-B');
      expect(world.client.deadline()).toBe(deadlineOfB);
      world.script(s.activity, empty());
      await s.activate(world);
      expect(world.callsTo(s.activity)[0]?.headers[CSRF_HEADER]).toBe('tok-B');
    });

    it(`17. ${s.name}: settled under its own session it is ok and ends it`, async () => {
      const world = await signedIn(s);
      world.script(s.end, empty());
      expect((await s.finish(world)).kind).toBe('ok');
      expect(world.client.staffUserId()).toBeNull();
    });
  }
});

import { describe, expect, it } from 'vitest';
import { CSRF_HEADER } from '@pos/contracts';
import type { ApiEvent } from '../src/index.js';
import { ROUTES } from '../src/index.js';
import { empty, envelope, json, makeWorld, plain, view } from './support.js';

// PHASE0-011d1, lead ruling 5: at the back office a logout that is not confirmed
// keeps the session as it was, so "Try again" can send it again with the token.
// The POS release ends the session whatever the server answers; both surfaces are
// held side by side so a change to one shows in the other.

type Surface = 'POS' | 'BACK_OFFICE';

const END = { POS: ROUTES.posRelease.path, BACK_OFFICE: ROUTES.backOfficeLogout.path } as const;
const LOGIN = { POS: ROUTES.posLogin.path, BACK_OFFICE: ROUTES.backOfficeLogin.path } as const;

async function signedIn(surface: Surface) {
  const world = makeWorld({ surface });
  const wire = surface === 'POS' ? view() : { ...view(), username: 'owner' };
  world.script(LOGIN[surface], json(200, wire));
  if (surface === 'POS') await world.client.request(ROUTES.posLogin, { pin: '123456' });
  else await world.client.request(ROUTES.backOfficeLogin, { username: 'owner', password: 'pw' });
  world.calls.length = 0;
  const events: ApiEvent[] = [];
  world.client.subscribe((event) => events.push(event));
  const end = () =>
    surface === 'POS' ? world.client.request(ROUTES.posRelease) : world.client.request(ROUTES.backOfficeLogout);
  return { world, events, end };
}

const endedEvents = (events: ApiEvent[]) => events.filter((e) => e.type === 'session-ended');

describe('a logout that is not confirmed, side by side', () => {
  it('the POS release ends the session on a 500', async () => {
    const { world, events, end } = await signedIn('POS');
    world.script(END.POS, envelope(500, 'INTERNAL'));
    world.script(ROUTES.health.path, json(200, { status: 'ok' }));
    expect((await end()).kind).toBe('failed');
    expect(world.client.staffUserId()).toBeNull();
    expect(world.client.deadline()).toBeNull();
    expect(endedEvents(events)).toEqual([{ type: 'session-ended', reason: 'SIGNED_OUT' }]);
  });

  it.each([
    ['a 500 with a healthy server', envelope(500, 'INTERNAL'), json(200, { status: 'ok' }), 'failed'],
    ['no answer and no health', new Error('network'), new Error('network'), 'unavailable'],
    ['an unparseable body', plain(502, '<html>'), json(503, {}), 'unavailable'],
  ] as const)('the back-office logout keeps the session on %s', async (_name, reply, health, kind) => {
    const { world, events, end } = await signedIn('BACK_OFFICE');
    world.script(END.BACK_OFFICE, reply);
    world.script(ROUTES.health.path, health);
    expect((await end()).kind).toBe(kind);
    expect(world.client.staffUserId()).toBe('staff-1');
    expect(world.client.deadline()).not.toBeNull();
    expect(endedEvents(events)).toEqual([]);
  });

  it('a kept session sends the token when the logout is tried again, and a 204 then ends it', async () => {
    const { world, events, end } = await signedIn('BACK_OFFICE');
    world.script(END.BACK_OFFICE, envelope(500, 'INTERNAL'), empty(204));
    world.script(ROUTES.health.path, json(200, { status: 'ok' }));
    await end();
    expect((await end()).kind).toBe('ok');
    const sent = world.callsTo(END.BACK_OFFICE);
    expect(sent).toHaveLength(2);
    expect(sent.map((c) => c.headers[CSRF_HEADER])).toEqual(['token-1', 'token-1']);
    expect(world.client.staffUserId()).toBeNull();
    expect(endedEvents(events)).toEqual([{ type: 'session-ended', reason: 'SIGNED_OUT' }]);
  });

  it('a refusal that does not end the session keeps it', async () => {
    const { world, events, end } = await signedIn('BACK_OFFICE');
    // The one permitted recovery: `me` names the same person, the retry is refused again.
    world.script(END.BACK_OFFICE, envelope(403, 'CSRF_REFUSED'), envelope(403, 'CSRF_REFUSED'));
    world.script(ROUTES.backOfficeMe.path, json(200, { ...view(), username: 'owner' }));
    const result = await end();
    expect(result.kind).toBe('refused');
    expect(world.client.staffUserId()).toBe('staff-1');
    expect(endedEvents(events)).toEqual([]);
  });

  it.each(['UNAUTHENTICATED', 'FORBIDDEN'] as const)(
    'a refusal of %s ends the session exactly as it did',
    async (code) => {
      const { world, events, end } = await signedIn('BACK_OFFICE');
      world.script(END.BACK_OFFICE, envelope(code === 'FORBIDDEN' ? 403 : 401, code));
      expect((await end()).kind).toBe('refused');
      expect(world.client.staffUserId()).toBeNull();
      expect(endedEvents(events).map((e) => (e as { reason: string }).reason)).toEqual([code]);
    }
  );

  it('SESSION_IDLE at the back office ends the session on a logout, token and all', async () => {
    const { world, end } = await signedIn('BACK_OFFICE');
    world.script(END.BACK_OFFICE, envelope(401, 'SESSION_IDLE'));
    expect((await end()).kind).toBe('refused');
    expect(world.client.staffUserId()).toBeNull();
    // The token is gone: a second logout carries none.
    world.script(END.BACK_OFFICE, envelope(401, 'UNAUTHENTICATED'));
    await end();
    expect(world.callsTo(END.BACK_OFFICE)[1]!.headers[CSRF_HEADER]).toBeUndefined();
  });
});

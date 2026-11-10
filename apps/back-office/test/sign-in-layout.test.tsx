// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DRAFT_ISOLATED, SESSION_ENDED } from '../src/copy.js';
import { SignIn } from '../src/SignIn.js';
import type { SessionSnapshot, SessionStore } from '../src/session/types.js';
import { workGuard, type WorkStatus } from '../src/work/guard.js';
import {
  ACTIVITY, HEALTH, ME, VIEW,
  childMounts, field, makeHarness, mount, ok, press, refusal, sessionState, text, type,
} from './session-harness.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// PHASE1-S10: BO-01's composition (DESIGN-016), its one main landmark and the isolated-draft
// sentence. Geometry is measured in a real browser, not here.

let h: ReturnType<typeof makeHarness>;
let view: ReturnType<typeof mount> | undefined;
let release: (() => void) | undefined;

beforeEach(() => {
  h = makeHarness();
  h.reply(HEALTH, ok({ status: 'ok' }));
  childMounts.count = 0;
});
afterEach(() => {
  view?.unmount();
  view = undefined;
  release?.();
  release = undefined;
});

async function open(me: ReturnType<typeof refusal> | ReturnType<typeof ok> | { status: number }) {
  h.reply(ME, me);
  view = mount(h.store);
  await h.settle();
  return view.host;
}

/** A screen in the working area that reports `status`, as BO-05 does. */
function holdWork(status: WorkStatus) {
  release = workGuard.register({ status: () => status, leave: () => 'left', focus: () => {} });
}

async function endSession(host: HTMLElement) {
  type(host.querySelector<HTMLInputElement>('#draft')!, 'half-typed note');
  h.reply(ACTIVITY, refusal('UNAUTHENTICATED'));
  press();
  await h.settle();
}

const mains = (host: HTMLElement) => [...host.querySelectorAll('main, [role="main"]')];
const pane = (host: HTMLElement) => host.querySelector<HTMLElement>('.bocontent')!;

describe('criterion 1. one main landmark', () => {
  it.each([
    ['resting', refusal('UNAUTHENTICATED')],
    ['refused', refusal('FORBIDDEN', undefined, 403)],
    ['a failed first lookup', { status: 502 }],
  ])('%s: the only main is BO-01’s and the pane is neither a main element nor a main role', async (_name, me) => {
    const host = await open(me);
    expect(sessionState(host)).toBe('signed-out');
    expect(host.querySelectorAll('main')).toHaveLength(1);
    expect(mains(host)).toHaveLength(1);
    expect(mains(host)[0]).toBe(host.querySelector('.login-page'));
    expect(pane(host).hidden).toBe(true);
    expect(pane(host).tagName).not.toBe('MAIN');
    expect(pane(host).hasAttribute('role')).toBe(false);
  });

  it('ended with the work held: one main, and the held working area is still mounted, hidden, with its typed value', async () => {
    const host = await open(ok(VIEW));
    await endSession(host);
    expect(sessionState(host)).toBe('signed-out');
    expect(host.querySelectorAll('main')).toHaveLength(1);
    expect(mains(host)).toHaveLength(1);
    expect(mains(host)[0]).toBe(host.querySelector('.login-page'));
    expect(pane(host).hidden).toBe(true);
    expect(pane(host).hasAttribute('inert')).toBe(true);
    expect(host.querySelector<HTMLInputElement>('#draft')!.value).toBe('half-typed note');
    expect(childMounts.count).toBe(1);
  });

  it('signed in: exactly one element has the main role and it is the content pane', async () => {
    const host = await open(ok(VIEW));
    expect(sessionState(host)).toBe('signed-in');
    expect(host.querySelectorAll('main')).toHaveLength(0);
    expect(mains(host)).toHaveLength(1);
    expect(mains(host)[0]).toBe(pane(host));
    expect(pane(host).getAttribute('role')).toBe('main');
  });
});

describe('criterion 6. the isolated-draft sentence', () => {
  it('ended, with the work held and unsaved, adds the sentence as its own paragraph after Session ended’s body', async () => {
    holdWork('dirty');
    const host = await open(ok(VIEW));
    await endSession(host);
    const notice = host.querySelector('.office-notice')!;
    expect([...notice.children].map((c) => c.tagName)).toEqual(['STRONG', 'P', 'P']);
    expect(text(notice.children[0] ?? null)).toBe(SESSION_ENDED.title);
    expect(text(notice.children[1] ?? null)).toBe(SESSION_ENDED.body);
    expect(notice.children[2]!.id).not.toBe('');
    expect(text(notice.children[2] ?? null)).toBe(DRAFT_ISOLATED);
  });

  it('ended, with the work held and an unfinished save, also adds it', async () => {
    holdWork('uncertain');
    const host = await open(ok(VIEW));
    await endSession(host);
    expect(host.querySelectorAll('.office-notice p')).toHaveLength(2);
  });

  it('ended, with the work held and clean, does not add it', async () => {
    holdWork('clean');
    const host = await open(ok(VIEW));
    await endSession(host);
    expect(text(host.querySelector('.office-notice'))).toBe(`${SESSION_ENDED.title}${SESSION_ENDED.body}`);
    expect(host.querySelectorAll('.office-notice p')).toHaveLength(1);
  });

  describe('on SignIn directly', () => {
    const store = { dismiss() {}, retry() {}, signIn() {} } as unknown as SessionStore;
    const signedOut = (over: Partial<Extract<SessionSnapshot, { phase: 'signed-out' }>>): Extract<SessionSnapshot, { phase: 'signed-out' }> => ({
      phase: 'signed-out', why: 'resting', attempt: { kind: 'none' }, waits: [], busy: false, held: null, ...over,
    });
    function render(snapshot: Extract<SessionSnapshot, { phase: 'signed-out' }>, unsavedWork: boolean) {
      const host = document.createElement('div');
      document.body.append(host);
      const root = createRoot(host);
      act(() => root.render(<SignIn snapshot={snapshot} store={store} unsavedWork={unsavedWork} />));
      return {
        host,
        done() {
          act(() => root.unmount());
          host.remove();
        },
      };
    }

    it.each([
      ['ended with unsaved work held', signedOut({ why: 'ended', held: 'm-1' }), true, true],
      ['ended with nothing held, whatever the guard says', signedOut({ why: 'ended', held: null }), true, false],
      ['ended with held work that is clean', signedOut({ why: 'ended', held: 'm-1' }), false, false],
      ['resting with unsaved work held', signedOut({ why: 'resting', held: 'm-1' }), true, false],
      ['refused with unsaved work held', signedOut({ why: 'refused', held: 'm-1' }), true, false],
    ])('%s', (_name, snapshot, unsaved, present) => {
      const { host, done } = render(snapshot, unsaved);
      expect(host.querySelector(`#${DRAFT_NOTE_ID}`) !== null).toBe(present);
      expect(host.textContent?.includes(DRAFT_ISOLATED)).toBe(present);
      done();
    });

    it('is not added to a notice that replaces Session ended (a lock, a refusal or a failure)', () => {
      const { host, done } = render(
        signedOut({ why: 'ended', held: 'm-1', attempt: { kind: 'error' } }),
        true
      );
      expect(host.textContent?.includes(DRAFT_ISOLATED)).toBe(false);
      done();
    });
  });
});

const DRAFT_NOTE_ID = 'bo-draft-note';

describe('criterion 7. the composition', () => {
  it('draws the panel in DESIGN-016’s order with its classes: heading, helper, notice, lock announcement, form', async () => {
    // A refused load draws a notice without needing a lost session.
    const host = await open(refusal('FORBIDDEN', undefined, 403));
    const page = host.querySelector('main')!;
    expect(page.className).toBe('login-page');
    expect([...page.children].map((c) => c.className)).toEqual(['login-panel']);
    const panel = page.firstElementChild!;
    expect([...panel.children].map((c) => c.tagName)).toEqual(['H1', 'P', 'SECTION', 'SPAN', 'FORM']);
    expect(panel.children[1]!.className).toBe('login-intro');
    expect(panel.children[2]!.className).toBe('office-notice office-notice--amber');
    expect(panel.children[3]!.getAttribute('role')).toBe('status');
    expect(panel.children[3]!.getAttribute('aria-atomic')).toBe('true');

    const form = panel.children[4] as HTMLFormElement;
    expect(form.getAttribute('method')).toBe('post');
    expect(form.noValidate).toBe(true);
    expect([...form.children].map((c) => c.className)).toEqual(['login-field', 'login-field', 'office-button primary login-submit']);
    const [usernameBlock, passwordBlock, submit] = [...form.children];
    expect([...usernameBlock!.children].map((c) => c.tagName)).toEqual(['LABEL', 'INPUT']);
    expect([...passwordBlock!.children].map((c) => c.tagName)).toEqual(['LABEL', 'INPUT']);
    expect(submit!.tagName).toBe('BUTTON');
    expect(usernameBlock!.querySelector('input')!.className).toBe('office-field');
    expect(field(host, 'Username')).toBe(usernameBlock!.querySelector('input'));
  });

  it('with no notice the status element is still there, empty, between the helper and the form', async () => {
    const host = await open(refusal('UNAUTHENTICATED'));
    const panel = host.querySelector('.login-panel')!;
    expect([...panel.children].map((c) => c.tagName)).toEqual(['H1', 'P', 'SPAN', 'FORM']);
    expect(panel.children[2]!.textContent).toBe('');
  });
});

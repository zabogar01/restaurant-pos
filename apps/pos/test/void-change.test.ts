import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { voidLine, voidOrder, type VoidFacts, type VoidResult } from '../src/voidChange.js';

// FE-036, the pure operations that stand in for the server's two void commands.
// What this file is for: the gate through both doors; the refusals in their
// order; what is not a refusal; exactly what each void writes and returns; and
// that the module stays pure.

const here = dirname(fileURLToPath(import.meta.url));
const raw = (f: string) => readFileSync(resolve(here, '../src', f), 'utf8');
const code = (f: string) => raw(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

type Status = 'pending' | 'fired' | 'voided';
type Line = { id: string; name: string; status: Status; amount: bigint; unitPrice: bigint; quantity: number; note?: string };
type Group = { kind: 'fired'; round: number; firedAt: string; delivery: string; lines: Line[] } | { kind: 'pending'; lines: Line[] };
type Held = { title: string; groups: Group[]; applied?: { name: string }; voided?: { voidedAt: string } };

const line = (id: string, status: Status, amount = 10_000n): Line => ({ id, name: id, status, amount, unitPrice: amount, quantity: 1, note: `note ${id}` });
const round = (n: number, lines: Line[]): Group => ({ kind: 'fired', round: n, firedAt: '19:4' + n, delivery: 'printed', lines });
const pending = (lines: Line[]): Group => ({ kind: 'pending', lines });
const order = (groups: Group[], applied?: { name: string }): Held => ({ title: 'Order · T1', groups, ...(applied && { applied }) });

const OPEN: VoidFacts = { open: true, locked: false };
const AT = '2026-10-03T12:00:00.000Z';

const withFired = () => order([round(1, [line('a', 'fired'), line('b', 'fired')]), pending([line('p', 'pending')])]);
const unfired = () => order([pending([line('p', 'pending')])]);
const refusal = <T>(r: VoidResult<T>) => r.refused;

describe('the gate, through both doors (1)', () => {
  it('a FIRED line: direct is refused needs-manager with the same order; the manager prompt applies', () => {
    const o = withFired();
    const direct = voidLine(o, 'a', 'customer left', 'direct', OPEN);
    expect(direct.refused).toBe('needs-manager');
    expect(direct.order).toBe(o);
    expect(voidLine(o, 'a', 'customer left', 'manager-prompt', OPEN).refused).toBeUndefined();
  });

  it('an order holding a FIRED line: the same', () => {
    const o = withFired();
    const direct = voidOrder(o, 'customer left', 'direct', AT, OPEN);
    expect(direct.refused).toBe('needs-manager');
    expect(direct.order).toBe(o);
    expect(voidOrder(o, 'customer left', 'manager-prompt', AT, OPEN).refused).toBeUndefined();
  });

  it('an order with nothing fired applies directly with no reason; a manager-prompt call for it applies too', () => {
    const o = unfired();
    expect(voidOrder(o, undefined, 'direct', AT, OPEN).refused).toBeUndefined();
    expect(voidOrder(o, undefined, 'manager-prompt', AT, OPEN).refused).toBeUndefined();
  });
});

describe('the refusals, in their order (2)', () => {
  it('not-open: the order is closed, refunded or voided, or there is none', () => {
    const o = withFired();
    const shut: VoidFacts = { open: false, locked: false };
    expect(refusal(voidLine(o, 'a', 'x', 'manager-prompt', shut))).toBe('not-open');
    expect(refusal(voidOrder(o, 'x', 'manager-prompt', AT, shut))).toBe('not-open');
  });

  it('locked: this order’s own session, or the place’s lock', () => {
    const o = withFired();
    const locked: VoidFacts = { open: true, locked: true };
    expect(refusal(voidLine(o, 'a', 'x', 'manager-prompt', locked))).toBe('locked');
    expect(refusal(voidOrder(o, 'x', 'manager-prompt', AT, locked))).toBe('locked');
  });

  it('unknown-line: a line that is not on the order', () => {
    expect(refusal(voidLine(withFired(), 'nope', 'x', 'manager-prompt', OPEN))).toBe('unknown-line');
  });

  it('not-fired: a VOIDED line answers it, and does not throw', () => {
    const o = order([round(1, [line('a', 'voided'), line('b', 'fired')])]);
    const r = voidLine(o, 'a', 'x', 'manager-prompt', OPEN);
    expect(r.refused).toBe('not-fired');
    expect(r.order).toBe(o);
  });

  it('not-fired: a PENDING line answers it, and the line is still there', () => {
    const o = withFired();
    const r = voidLine(o, 'p', 'x', 'manager-prompt', OPEN);
    expect(r.refused).toBe('not-fired');
    expect(r.order).toBe(o);
    expect(r.order.groups[1]!.lines.map((l) => l.id)).toEqual(['p']);
  });

  it('no-reason: a gated void with an empty or all-space reason', () => {
    const o = withFired();
    for (const reason of [undefined, '', '   ']) {
      expect(refusal(voidLine(o, 'a', reason, 'manager-prompt', OPEN))).toBe('no-reason');
      expect(refusal(voidOrder(o, reason, 'manager-prompt', AT, OPEN))).toBe('no-reason');
    }
  });

  it('no-reason is answered before needs-manager', () => {
    expect(refusal(voidLine(withFired(), 'a', '  ', 'direct', OPEN))).toBe('no-reason');
  });

  it('an input that is closed, locked, unknown and gated at once answers not-open', () => {
    const o = withFired();
    expect(refusal(voidLine(o, 'nope', undefined, 'direct', { open: false, locked: true }))).toBe('not-open');
  });

  it('locked is answered before unknown-line, which is answered before not-fired and the gate', () => {
    const o = withFired();
    expect(refusal(voidLine(o, 'nope', undefined, 'direct', { open: true, locked: true }))).toBe('locked');
    expect(refusal(voidLine(o, 'nope', undefined, 'direct', OPEN))).toBe('unknown-line');
    expect(refusal(voidLine(o, 'p', undefined, 'direct', OPEN))).toBe('not-fired');
  });
});

describe('what is not a refusal (3)', () => {
  it.each([
    ['an empty order', order([])],
    ['an order whose only lines are voided', order([round(1, [line('a', 'voided')])])],
    ['a quick sale', order([pending([line('q', 'pending')])])],
  ])('%s voids with no reason', (_name, o) => {
    const r = voidOrder(o, undefined, 'direct', AT, OPEN);
    expect(r.refused).toBeUndefined();
    expect(r.order.voided).toEqual({ voidedAt: AT });
  });
});

describe('what a line void writes (4)', () => {
  const discount = { name: 'Staff meal' };
  const o = order([round(1, [line('a', 'fired', 135_000n), line('b', 'fired', 30_000n)]), round(2, [line('c', 'fired')]), pending([line('p', 'pending')])], discount);
  const r = voidLine(o, 'a', 'customer left', 'manager-prompt', OPEN);

  it('changes only that line’s status', () => {
    expect(r.refused).toBeUndefined();
    const written = r.order.groups[0]!.lines[0]!;
    expect(written).toEqual({ ...o.groups[0]!.lines[0]!, status: 'voided' });
    expect(written.amount).toBe(135_000n);
    expect(written.unitPrice).toBe(135_000n);
    expect(written.note).toBe('note a');
  });

  it('keeps its round, with its number, time and delivery, and every other object the same', () => {
    const g0 = r.order.groups[0]!;
    expect(g0).toMatchObject({ kind: 'fired', round: 1, firedAt: '19:41', delivery: 'printed' });
    expect(g0.lines[1]).toBe(o.groups[0]!.lines[1]);
    expect(r.order.groups[1]).toBe(o.groups[1]);
    expect(r.order.groups[2]).toBe(o.groups[2]);
    expect(r.order.applied).toBe(discount);
    expect(r.order.voided).toBeUndefined();
  });

  it('keeps a round whose every line is voided, and never drops the line', () => {
    const single = order([round(1, [line('a', 'fired')])]);
    const done = voidLine(single, 'a', 'x', 'manager-prompt', OPEN);
    expect(done.order.groups).toHaveLength(1);
    expect(done.order.groups[0]!.lines.map((l) => [l.id, l.status])).toEqual([['a', 'voided']]);
  });

  it('leaves the subtotal lower by the line’s amount (a voided line is left out of it)', () => {
    const sum = (h: Held) =>
      h.groups
        .flatMap((g) => g.lines)
        .filter((l) => l.status !== 'voided')
        .reduce((t, l) => t + l.amount, 0n);
    expect(sum(o) - sum(r.order)).toBe(135_000n);
  });
});

describe('what an order void writes (5)', () => {
  it('sets voided.voidedAt to the instant passed and rewrites nothing else', () => {
    const o = order([round(1, [line('a', 'fired')]), pending([line('p', 'pending')])], { name: 'Staff meal' });
    const r = voidOrder(o, 'customer left', 'manager-prompt', AT, OPEN);
    expect(r.order.voided).toEqual({ voidedAt: AT });
    expect(r.order.groups).toBe(o.groups);
    expect(r.order.applied).toBe(o.applied);
    expect(r.order.title).toBe(o.title);
  });
});

describe('cancels (6)', () => {
  it('a line void returns that one id', () => {
    const r = voidLine(withFired(), 'a', 'x', 'manager-prompt', OPEN);
    expect(r.refused === undefined && r.cancels).toEqual(['a']);
  });

  it('an order void over fired, pending and voided lines returns exactly the lines still FIRED', () => {
    const o = order([round(1, [line('a', 'fired'), line('v', 'voided')]), round(2, [line('b', 'fired')]), pending([line('p', 'pending')])]);
    const r = voidOrder(o, 'x', 'manager-prompt', AT, OPEN);
    expect(r.refused === undefined && r.cancels).toEqual(['a', 'b']);
  });

  it('an FR-H3 void returns none', () => {
    const r = voidOrder(unfired(), undefined, 'direct', AT, OPEN);
    expect(r.refused === undefined && r.cancels).toEqual([]);
  });
});

describe('the module is clean (7)', () => {
  const src = code('voidChange.ts');

  it('imports no React and no fixtures module', () => {
    const imports = [...raw('voidChange.ts').matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
    expect(imports).toEqual(['./void.js']);
    expect(src).not.toMatch(/from 'react/);
    expect(src).not.toMatch(/Fixtures/);
  });

  it('holds no Date, no timer and no console', () => {
    expect(src).not.toMatch(/\bDate\b|setTimeout|setInterval|\bconsole\b/);
  });

  it('names no approval, confirmation or approver', () => {
    expect(src).not.toMatch(/approved|approver|confirmed/i);
  });
});

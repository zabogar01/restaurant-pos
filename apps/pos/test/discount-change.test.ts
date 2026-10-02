import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { discountAmount, orderTotals, snapshotOf, type DiscountSnapshot, type Preset } from '../src/discount.js';
import { changeDiscount, type DiscountCarrier, type DiscountChange, type DiscountFacts } from '../src/discountChange.js';
import { OTHER_15, PRESETS, STAFF_MEAL } from '../src/discountFixtures.js';

// FE-035, the pure operation that stands in for the server's discount command.
// What this file is for: FR-F8's eight rows through both doors; the refusals in
// their order; that a caller can ask for a preset by id and nothing more; that
// a value which would make a total throw never reaches an order (FR-M5); and
// that the module stays pure.

const here = dirname(fileURLToPath(import.meta.url));
const code = (f: string) =>
  readFileSync(resolve(here, '../src', f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

const open: DiscountFacts = { closed: false, locked: false, presets: PRESETS };
const REGULAR = PRESETS[1]!;
const SUBTOTAL = 405_000n;

const PRESET: DiscountChange = { kind: 'preset', presetId: 'regular' };
const FREE: DiscountChange = { kind: 'free-form', value: { kind: 'percent', percent: '20' } };
const REMOVE: DiscountChange = { kind: 'remove' };

const NOTE = 'Applied by Ana R. at 19:44. Preset, no approval.';
// An order as the store holds it: more than the two fields the operation writes.
type Held = DiscountCarrier & { title: string };
const carrying = (applied: DiscountSnapshot): Held => ({ title: 'Order · T1', applied, appliedNote: NOTE });
const bare: Held = { title: 'Order · T1' };

// What a change writes, as the operation builds it.
const REGULAR_SNAPSHOT = snapshotOf(REGULAR);
const FREE_SNAPSHOT: DiscountSnapshot = { source: 'free-form', name: 'Other discount', value: { kind: 'percent', percent: '20' } };

describe('FR-F8: the eight rows, through both doors', () => {
  const rows = [
    ['nothing → a preset', bare, PRESET, false, REGULAR_SNAPSHOT],
    ['nothing → a free-form', bare, FREE, true, FREE_SNAPSHOT],
    ['a preset → another preset', carrying(STAFF_MEAL), PRESET, false, REGULAR_SNAPSHOT],
    ['a preset → removed', carrying(STAFF_MEAL), REMOVE, false, undefined],
    ['a preset → a free-form', carrying(STAFF_MEAL), FREE, true, FREE_SNAPSHOT],
    ['a free-form → a preset', carrying(OTHER_15), PRESET, true, REGULAR_SNAPSHOT],
    ['a free-form → removed', carrying(OTHER_15), REMOVE, true, undefined],
    ['a free-form → another free-form', carrying(OTHER_15), FREE, true, FREE_SNAPSHOT],
  ] as const;

  it.each(rows)('%s: direct %s', (_row, order, change, gated, written) => {
    const direct = changeDiscount(order, change, 'direct', open);
    if (gated) {
      expect(direct.refused).toBe('needs-manager');
      expect(direct.order).toBe(order);
    } else {
      expect(direct.refused).toBeUndefined();
      expect(direct.order.applied).toEqual(written);
    }
  });

  it.each(rows)('%s: through the manager prompt it applies', (_row, order, change, _gated, written) => {
    const through = changeDiscount(order, change, 'manager-prompt', open);
    expect(through.refused).toBeUndefined();
    expect(through.order.applied).toEqual(written);
  });

  it('a manager-prompt call for a transition that is not gated applies as well', () => {
    expect(changeDiscount(carrying(STAFF_MEAL), PRESET, 'manager-prompt', open).order.applied).toEqual(REGULAR_SNAPSHOT);
  });

  it('decides on the order it is about to write, not on a name: a free-form called "Staff meal" is still gated', () => {
    const lookalike: DiscountSnapshot = { ...STAFF_MEAL, source: 'free-form' };
    expect(changeDiscount(carrying(lookalike), REMOVE, 'direct', open).refused).toBe('needs-manager');
  });
});

describe('the refusals, in their order', () => {
  it('closed', () => {
    expect(changeDiscount(bare, PRESET, 'direct', { ...open, closed: true }).refused).toBe('closed');
  });

  it('locked', () => {
    expect(changeDiscount(bare, PRESET, 'direct', { ...open, locked: true }).refused).toBe('locked');
  });

  it('nothing-to-remove, and it does not throw although needsManager does on that input', () => {
    const result = changeDiscount(bare, REMOVE, 'manager-prompt', open);
    expect(result.refused).toBe('nothing-to-remove');
    expect(result.order).toBe(bare);
  });

  it('unknown-preset', () => {
    expect(changeDiscount(bare, { kind: 'preset', presetId: 'nope' }, 'direct', open).refused).toBe('unknown-preset');
  });

  it('invalid-value', () => {
    const percent = (p: string): DiscountChange => ({ kind: 'free-form', value: { kind: 'percent', percent: p } });
    expect(changeDiscount(bare, percent('100.0001'), 'manager-prompt', open).refused).toBe('invalid-value');
  });

  it('needs-manager', () => {
    expect(changeDiscount(carrying(OTHER_15), REMOVE, 'direct', open).refused).toBe('needs-manager');
  });

  it('closed, locked and gated at once answers closed', () => {
    const result = changeDiscount(carrying(OTHER_15), REMOVE, 'direct', { ...open, closed: true, locked: true });
    expect(result.refused).toBe('closed');
  });

  it.each([
    ['locked before nothing-to-remove', bare, REMOVE, { locked: true }, 'locked'],
    ['nothing-to-remove before needs-manager', bare, REMOVE, {}, 'nothing-to-remove'],
    ['unknown-preset before needs-manager', carrying(OTHER_15), { kind: 'preset', presetId: 'nope' }, {}, 'unknown-preset'],
    [
      'invalid-value before needs-manager',
      bare,
      { kind: 'free-form', value: { kind: 'fixed', amount: -1n } },
      {},
      'invalid-value',
    ],
  ] as const)('%s', (_name, order, change, facts, expected) => {
    expect(changeDiscount(order, change, 'direct', { ...open, ...facts }).refused).toBe(expected);
  });

  it('a refusal returns the very order it was given', () => {
    const order = carrying(OTHER_15);
    for (const facts of [{ ...open, closed: true }, { ...open, locked: true }]) {
      expect(changeDiscount(order, PRESET, 'manager-prompt', facts).order).toBe(order);
    }
    expect(changeDiscount(order, PRESET, 'direct', open).order).toBe(order);
  });
});

describe('the caller cannot author what is written (B-8)', () => {
  it('a request has no source, name or value of a preset to supply', () => {
    // @ts-expect-error a preset is asked for by id; its name and value are the preset's
    const named: DiscountChange = { kind: 'preset', presetId: 'regular', name: 'Free lunch' };
    // @ts-expect-error the source is the operation's to set
    const sourced: DiscountChange = { kind: 'free-form', value: { kind: 'percent', percent: '1' }, source: 'preset' };
    expect(changeDiscount(bare, named, 'direct', open).order.applied).toEqual(REGULAR_SNAPSHOT);
    expect(changeDiscount(bare, sourced, 'manager-prompt', open).order.applied?.source).toBe('free-form');
  });

  it('a preset that is not active is refused, as one that does not exist is (FR-F5)', () => {
    const retired: Preset[] = PRESETS.map((p) => (p.id === 'regular' ? { ...p, active: false } : p));
    expect(changeDiscount(bare, PRESET, 'direct', { ...open, presets: retired }).refused).toBe('unknown-preset');
  });

  it('writes the preset as the back office holds it now, with the reference for reporting', () => {
    const repriced: Preset[] = PRESETS.map((p) => (p.id === 'regular' ? { ...p, value: { kind: 'percent', percent: '7' } } : p));
    expect(changeDiscount(bare, PRESET, 'direct', { ...open, presets: repriced }).order.applied).toEqual({
      source: 'preset',
      name: 'Regular customer',
      value: { kind: 'percent', percent: '7' },
      presetId: 'regular',
    });
  });
});

describe('validity is the value’s own (FR-M5)', () => {
  const free = (value: Extract<DiscountChange, { kind: 'free-form' }>['value']): DiscountChange => ({ kind: 'free-form', value });

  it.each([
    ['a percent above 100%', free({ kind: 'percent', percent: '100.0001' })],
    ['a percent that does not parse', free({ kind: 'percent', percent: 'ten' })],
    ['a negative percent', free({ kind: 'percent', percent: '-5' })],
    ['an empty percent', free({ kind: 'percent', percent: '' })],
    ['a negative fixed amount', free({ kind: 'fixed', amount: -1n })],
  ])('refuses %s', (_name, change) => {
    const result = changeDiscount(bare, change, 'manager-prompt', open);
    expect(result.refused).toBe('invalid-value');
    expect(result.order).toBe(bare);
  });

  it('accepts exactly 100%, and a fixed amount of nothing', () => {
    expect(changeDiscount(bare, free({ kind: 'percent', percent: '100' }), 'manager-prompt', open).refused).toBeUndefined();
    expect(changeDiscount(bare, free({ kind: 'fixed', amount: 0n }), 'manager-prompt', open).refused).toBeUndefined();
  });

  it('a fixed amount above the subtotal applies, and the figures cap it', () => {
    const result = changeDiscount(bare, free({ kind: 'fixed', amount: 500_000n }), 'manager-prompt', open);
    expect(result.refused).toBeUndefined();
    const applied = result.order.applied!;
    expect(applied.value).toEqual({ kind: 'fixed', amount: 500_000n });
    expect(discountAmount(SUBTOTAL, applied.value)).toBe(SUBTOTAL);
    expect(orderTotals(SUBTOTAL, applied).total).toBe(0n);
  });
});

describe('the note belongs to one application', () => {
  it('every applied change clears it, a removal clears both fields, and a refusal leaves it', () => {
    const order = carrying(STAFF_MEAL);
    const replaced = changeDiscount(order, PRESET, 'direct', open).order;
    expect(replaced).not.toHaveProperty('appliedNote');
    expect(replaced.title).toBe('Order · T1');
    const removed = changeDiscount(order, REMOVE, 'direct', open).order;
    expect(removed).not.toHaveProperty('appliedNote');
    expect(removed).not.toHaveProperty('applied');
    const refused = changeDiscount(carrying(OTHER_15), PRESET, 'direct', open);
    expect(refused.refused).toBe('needs-manager');
    expect(refused.order.appliedNote).toBe(NOTE);
  });

  it('records the snapshot and nothing else: no actor, approver, flag or time', () => {
    const written = changeDiscount(bare, FREE, 'manager-prompt', open).order;
    expect(Object.keys(written).sort()).toEqual(['applied', 'title']);
    expect(Object.keys(written.applied!).sort()).toEqual(['name', 'source', 'value']);
  });
});

describe('the module is a pure stand-in', () => {
  const source = code('discountChange.ts');

  it('imports no React and no fixture', () => {
    expect(source).not.toMatch(/from\s+['"]react['"]|from\s+['"]react-dom/);
    expect(source).not.toMatch(/from\s+['"][^'"]*Fixtures(\.js)?['"]/);
  });

  it('reads no clock, starts no timer and writes no log', () => {
    expect(source).not.toMatch(/\bDate\b|performance\.|setTimeout|setInterval|requestAnimationFrame|\bconsole\b/);
  });

  it('does no arithmetic of its own on money', () => {
    expect(source).not.toMatch(/\bNumber\s*\(|parseFloat|parseInt|Math\./);
  });
});

import { describe, expect, it } from 'vitest';
import { listChanges } from '../src/item/changes.js';
import { keepRows, lostSentence, lostRows } from '../src/item/keep.js';
import type { Row } from '../src/item/options.js';

// Keep my changes over the child rows (PHASE1-S4c2b ruling 10; DESIGN-020 round 2, F1 to F4 and the
// lead's ruling 4): a row the draft touched keeps the draft's values, whole; a row it did not touch
// follows the current item. Each walk is the artifact's, as a unit test of the pure rebuild.

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const saved = (n: number, name: string, change = '0'): Row => ({
  id: id(n), key: id(n), name, change, removed: false, moved: false,
});
const fresh = (key: string, name: string, change = '0'): Row => ({
  id: null, key, name, change, removed: false, moved: false,
});
const names = (rows: readonly Row[]) => rows.map((r) => r.name);

let counter = 0;
const next = () => `new-${(counter += 1)}`;
const keep = (original: Row[], draft: Row[], current: Row[]) => keepRows('variant', original, draft, current, next);

const REGULAR = saved(1, 'Regular');
const LARGE = saved(2, 'Large', '5000');
const SMALL = saved(3, 'Small', '-2000');
const original = [REGULAR, LARGE, SMALL];

describe('F1. a position that shifted is not a change', () => {
  it('remove variant 1 while variant 3 is removed meanwhile', () => {
    const draft = [{ ...REGULAR, removed: true }, LARGE, SMALL];
    const current = [REGULAR, LARGE];
    expect(lostRows(original, draft, current, 'variant')).toEqual([]);
    const kept = keep(original, draft, current);
    expect(names(kept)).toEqual(['Regular', 'Large']);
    expect(kept[0]!.removed).toBe(true);
    expect(kept.some((r) => r.name === 'Small')).toBe(false);
  });
});

describe('F2. the order after Keep', () => {
  it('the draft adds Kids while another manager reorders: the current order, Kids last', () => {
    const draft = [REGULAR, LARGE, SMALL, fresh('new-90', 'Kids')];
    const current = [SMALL, REGULAR, LARGE];
    const kept = keep(original, draft, current);
    expect(names(kept)).toEqual(['Small', 'Regular', 'Large', 'Kids']);
    expect(kept[3]!.id).toBeNull();
    const changes = listChanges(current, kept, 'variant');
    expect(changes).toEqual({
      added: [{ key: 'new-90', name: 'Kids', priceDelta: '0' }],
      order: [{ id: SMALL.id }, { id: REGULAR.id }, { id: LARGE.id }, { key: 'new-90' }],
    });
  });

  it('a draft that moved a row keeps its order; the current item’s new row goes last', () => {
    const draft = [LARGE, { ...REGULAR, moved: true }, SMALL];
    const jumbo = saved(4, 'Jumbo', '9000');
    const current = [REGULAR, LARGE, SMALL, jumbo];
    const kept = keep(original, draft, current);
    expect(names(kept)).toEqual(['Large', 'Regular', 'Small', 'Jumbo']);
  });

  it('Undo after Keep returns a pending row in place, and the order is unchanged', () => {
    const draft = [REGULAR, { ...LARGE, removed: true }, SMALL];
    const current = [REGULAR, LARGE, SMALL];
    const kept = keep(original, draft, current);
    expect(names(kept)).toEqual(['Regular', 'Large', 'Small']);
    const undone = kept.map((r) => ({ ...r, removed: false }));
    expect(listChanges(current, undone, 'variant')).toBeNull();
  });
});

describe('F3. a row the draft touched is copied whole', () => {
  it('the draft changes Large’s price while it is renamed Grande: Large, with the draft’s price', () => {
    const draft = [REGULAR, { ...LARGE, change: '25.000' }, SMALL];
    const current = [REGULAR, { ...LARGE, name: 'Grande' }, SMALL];
    const kept = keep(original, draft, current);
    expect(kept[1]).toMatchObject({ id: LARGE.id, name: 'Large', change: '25.000' });
  });

  it('an untouched row takes the current values, and leaves if it is gone', () => {
    const draft = [REGULAR, LARGE, SMALL];
    const current = [{ ...REGULAR, name: 'Plain', change: '1000' }, SMALL];
    const kept = keep(original, draft, current);
    expect(kept.map((r) => [r.name, r.change])).toEqual([['Plain', '1000'], ['Small', '-2000']]);
  });
});

describe('4(b). a touched row removed meanwhile comes back as a new row', () => {
  const draft = [REGULAR, { ...LARGE, name: 'Grande', change: '6.000' }, SMALL];
  const current = [REGULAR, SMALL];

  it('is new, with a fresh key, its draft values and no old id, and the next Save adds it', () => {
    const kept = keep(original, draft, current);
    const back = kept.find((r) => r.name === 'Grande')!;
    expect(back.id).toBeNull();
    expect(back.key).toMatch(/^new-/);
    expect(back.key).not.toBe(LARGE.key);
    expect(back.change).toBe('6.000');
    expect(listChanges(current, kept, 'variant')).toEqual({
      added: [{ key: back.key, name: 'Grande', priceDelta: '6000' }],
      order: [{ id: REGULAR.id }, { id: SMALL.id }, { key: back.key }],
    });
  });

  it('a pending-removal row leaves when it is gone, and stays pending when it is not', () => {
    const gone = keep(original, [REGULAR, { ...LARGE, removed: true }, SMALL], [REGULAR, SMALL]);
    expect(names(gone)).toEqual(['Regular', 'Small']);
    const there = keep(original, [REGULAR, { ...LARGE, removed: true }, SMALL], [REGULAR, LARGE, SMALL]);
    expect(there.find((r) => r.name === 'Large')!.removed).toBe(true);
  });

  it('a new row stays new, and the current item’s added rows are appended', () => {
    const jumbo = saved(4, 'Jumbo', '9000');
    const kept = keep(original, [...original, fresh('new-70', 'Kids')], [...original, jumbo]);
    expect(names(kept)).toEqual(['Regular', 'Large', 'Small', 'Jumbo', 'Kids']);
    expect(kept[4]!.key).toBe('new-70');
  });
});

describe('the sentence for a changed row removed meanwhile', () => {
  const draft = [REGULAR, { ...LARGE, name: 'Grande' }, SMALL];
  const current = [REGULAR, SMALL];

  it('lists a touched, not-removed saved row gone from the current item', () => {
    expect(lostRows(original, draft, current, 'variant')).toEqual([{ kind: 'variant', saved: 'Large', name: 'Grande' }]);
  });

  it('is not listed for an untouched row, nor for one the draft removes', () => {
    expect(lostRows(original, original, current, 'variant')).toEqual([]);
    expect(lostRows(original, [REGULAR, { ...LARGE, removed: true }, SMALL], current, 'variant')).toEqual([]);
  });

  it('one row: "named" when the name changed, omitted when it did not', () => {
    expect(lostSentence([{ kind: 'variant', saved: 'Large', name: 'Grande' }])).toBe(
      ' The current item no longer has variant Large, which your draft changes. Keep my changes adds it back as a new variant named Grande; Use current item leaves it out.'
    );
    expect(lostSentence([{ kind: 'variant', saved: 'Large', name: 'Large' }])).toBe(
      ' The current item no longer has variant Large, which your draft changes. Keep my changes adds it back as a new variant; Use current item leaves it out.'
    );
  });

  it('several rows take the plural form', () => {
    expect(
      lostSentence([
        { kind: 'variant', saved: 'A', name: 'A' },
        { kind: 'modifier', saved: 'B', name: 'B2' },
      ])
    ).toBe(
      ' The current item no longer has variant A and modifier B, which your draft changes. Keep my changes adds them back as new variants and modifiers; Use current item leaves them out.'
    );
    expect(
      lostSentence([
        { kind: 'variant', saved: 'A', name: 'A' },
        { kind: 'variant', saved: 'C', name: 'C' },
        { kind: 'variant', saved: 'D', name: 'D' },
      ])
    ).toBe(
      ' The current item no longer has variant A, variant C and variant D, which your draft changes. Keep my changes adds them back as new variants; Use current item leaves them out.'
    );
  });
});

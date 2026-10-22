import { OutletAddress, OutletName, OutletNpwpd, OutletPhone, ReceiptFooter } from '@pos/contracts';
import { describe, expect, it } from 'vitest';
import { checkText, type TextKey } from '../src/settings/fields.js';

// AC 4. The text fields: DESIGN-018's lengths table with DESIGN-018b's phone row. The form
// trims, refuses in the table's order, and sends a blank NPWPD as null. Its check and the
// contract's field schema agree on the boundary values of every row.

const SCHEMA = {
  outlet: OutletName,
  address: OutletAddress,
  phone: OutletPhone,
  npwpd: OutletNpwpd,
  footer: ReceiptFooter,
} as const;

const CANDIDATES: Record<TextKey, string[]> = {
  outlet: [
    '', ' ', 'a', 'Warung Sederhana', ' padded ', 'a'.repeat(63), 'a'.repeat(64), 'a'.repeat(65),
    '\u{1F600}'.repeat(32), '\u{1F600}'.repeat(33), '\u{1F600}'.repeat(64), '\u{1F600}'.repeat(65), 'Warung\u0007', 'x\u001by', 'x\u007fy', 'x\u0085y', 'x\ty', 'x\ny',
    'x y', ' x', 'x y',
  ],
  address: [
    '', ' ', 'Jl. Melati', 'a\nb', 'a\nb\nc', 'a\nb\nc\nd', 'a\n\nb', '\na', 'a\n', 'a\n\n\nb',
    'a'.repeat(200), 'a'.repeat(201), `${'a'.repeat(99)}\n${'b'.repeat(100)}`, `${'a'.repeat(100)}\n${'b'.repeat(100)}`,
    'a\tb', 'a\rb', 'a\r\nb', 'a\u0007\nb', 'a\u001b',
  ],
  phone: [
    '', ' ', '021 555 0134', '+62 (21) 555-0134', '021.555', '021/555', '021 / 555', 'WA 0812', 'a', '1'.repeat(32),
    '1'.repeat(33), '+62 (021) 5550-1340 0812-3456-78', '٣٢', '０２１', '021\t555', '021\n555',
    '021\u0007', '021_555', '021,555', '021#', ' 021 ',
  ],
  npwpd: [
    '', '   ', 'P.2.0012345.07.001', 'p-1/2', 'a'.repeat(32), 'a'.repeat(33), 'x\u0007', 'x\ty', 'x\ny', ' padded ',
    'P.2.0012345.07.001 / 2026-000123',
  ],
  footer: [
    '', ' ', 'Terima kasih', 'a'.repeat(119), 'a'.repeat(120), 'a'.repeat(121), 'a\nb', 'a\tb', 'a\u0007', ' padded ',
    '\u{1F600}'.repeat(60), '\u{1F600}'.repeat(61), '\u{1F600}'.repeat(120), '\u{1F600}'.repeat(121),
  ],
};

describe('the form’s checks and the contract’s field schemas agree', () => {
  for (const key of Object.keys(CANDIDATES) as TextKey[]) {
    describe(key, () => {
      for (const typed of CANDIDATES[key]) {
        it(`${JSON.stringify(typed.length > 40 ? `${typed.slice(0, 12)}…(${typed.length})` : typed)}`, () => {
          const checked = checkText(key, typed);
          const sent = checked.error === null ? checked.value : typed.trim();
          // A blank NPWPD is not an error: it is sent as null, which the schema accepts.
          const accepted = SCHEMA[key].safeParse(key === 'npwpd' && sent === '' ? null : sent).success;
          expect(accepted).toBe(checked.error === null);
        });
      }
    });
  }
});

describe('trimming, requirement and the blank NPWPD', () => {
  it('trims before checking and returns the trimmed value', () => {
    expect(checkText('outlet', '  Warung  ')).toEqual({ value: 'Warung', error: null });
    expect(checkText('address', '\n Jl. Melati\nJakarta \n')).toEqual({ value: 'Jl. Melati\nJakarta', error: null });
  });

  it('a blank NPWPD is null, and every other blank is a refusal', () => {
    expect(checkText('npwpd', '   ')).toEqual({ value: null, error: null });
    expect(checkText('npwpd', '')).toEqual({ value: null, error: null });
    for (const key of ['outlet', 'address', 'phone', 'footer'] as const) {
      expect(checkText(key, '  ').error, key).toBe('empty');
    }
  });
});

describe('the check order of each row: empty, too long, too many lines, phone charset, control character', () => {
  it('outlet name: too long before a control character', () => {
    expect(checkText('outlet', `${'a'.repeat(64)}\u0007`).error).toBe('long');
    expect(checkText('outlet', 'ab\u0007').error).toBe('control');
  });

  it('address: too long, then too many lines, then a control character', () => {
    expect(checkText('address', `a\nb\nc\nd${'x'.repeat(200)}`).error).toBe('long');
    expect(checkText('address', 'a\nb\nc\nd\u0007').error).toBe('lines');
    expect(checkText('address', 'a\u0007\nb').error).toBe('control');
    expect(checkText('address', 'a\tb').error).toBe('control');
    expect(checkText('address', 'a\nb\nc').error).toBeNull();
  });

  it('phone: too long, then the charset (a control character is a charset refusal)', () => {
    expect(checkText('phone', `${'1'.repeat(32)}/`).error).toBe('long');
    expect(checkText('phone', '021\u0007').error).toBe('charset');
    expect(checkText('phone', '021 / 555').error).toBe('charset');
    expect(checkText('phone', '+62 (021) 5550-1340 0812-3456-78').error).toBeNull();
  });

  it('npwpd: too long, then a control character; no charset', () => {
    expect(checkText('npwpd', `${'a'.repeat(32)}\u0007`).error).toBe('long');
    expect(checkText('npwpd', 'x\u0007').error).toBe('control');
    expect(checkText('npwpd', 'P.2.0012345.07.001 / 2026-000123').error).toBeNull();
  });

  it('footer: one line, so a line feed is a control character', () => {
    expect(checkText('footer', 'a\nb').error).toBe('control');
  });
});

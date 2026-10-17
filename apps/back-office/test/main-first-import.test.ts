import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

// Import order is evaluation order: the switch must run before anything builds a schema.
it("imports '@pos/contracts/browser' before anything else", () => {
  const source = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
  const first = /^\s*import\s[^;]*?['"]([^'"]+)['"]/m.exec(source);
  expect(first?.[1]).toBe('@pos/contracts/browser');
});

import { expect, it } from 'vitest';
import { z } from 'zod';
import '../src/browser.js';

it('turns zod off its eval probe, which the content-security policy would report', () => {
  expect(z.config().jitless).toBe(true);
});

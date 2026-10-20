import { describe, expect, it } from 'vitest';
import { ROUTE_TABLE } from '../src/routes.js';

// ADR-011 rule 16: a request is addressed by its route-table entry, so every path is
// a fixed string. A path with a query, a fragment or a parameter would put a value
// the server never chose into the URL.
describe('the route table', () => {
  it('2. no path contains ?, # or :', () => {
    for (const entry of ROUTE_TABLE) {
      expect(entry.path, entry.path).not.toMatch(/[?#:]/);
    }
  });

  it('lists the five table routes under /api/back-office/config/, with the list read not interactive', () => {
    const tables = ROUTE_TABLE.filter((e) => e.path.startsWith('/api/back-office/config/tables'));
    expect(tables.map((e) => `${e.method} ${e.path} ${e.interactive}`)).toEqual([
      'GET /api/back-office/config/tables false',
      'POST /api/back-office/config/tables/create true',
      'POST /api/back-office/config/tables/update true',
      'POST /api/back-office/config/tables/deactivate true',
      'POST /api/back-office/config/tables/reactivate true',
    ]);
  });
});

import type { CategoryView, ItemView } from '@pos/contracts';
import { describe, expect, it } from 'vitest';
import { activeItemScope, groups, hiddenReason, orderedCategories, scopeOfCategories } from '../src/menu/group.js';

// BO-03's grouping and order (PHASE1-S4c1 ruling 6, criterion 2): active categories first, then
// archived ones, each set in stored display order with ties broken by name (BO-05's collator),
// then by id; within a category, active items before archived ones by the same rule.

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const cat = (n: number, name: string, displayOrder: number, isActive = true): CategoryView => ({
  categoryId: id(n),
  name,
  displayOrder,
  isActive,
});
const item = (n: number, categoryId: string, name: string, displayOrder: number, isActive = true): ItemView => ({
  itemId: id(100 + n),
  categoryId,
  name,
  basePrice: '1000',
  displayOrder,
  isAvailable: true,
  isActive,
  variants: [],
  modifiers: [],
});

describe('orderedCategories', () => {
  it('puts active categories first, then archived ones, an archived one between two active ones notwithstanding', () => {
    const rows = [cat(1, 'Mains', 0), cat(2, 'Seasonal', 1, false), cat(3, 'Drinks', 2)];
    expect(orderedCategories(rows).map((c) => c.name)).toEqual(['Mains', 'Drinks', 'Seasonal']);
  });

  it('orders by stored display order, then by name with the natural case-insensitive collator, then by id', () => {
    const rows = [cat(1, 'b', 0), cat(2, 'A', 0), cat(3, 'a', 0), cat(4, 'Zeta', 1)];
    // 'A' and 'a' tie under the collator, so the id decides: 2 before 3.
    expect(orderedCategories(rows).map((c) => c.categoryId.slice(-1))).toEqual(['2', '3', '1', '4']);
  });

  it('breaks a display-order tie by name, naturally (10 after 2), not by code unit', () => {
    const rows = [cat(1, 'Group 10', 0), cat(2, 'Group 2', 0), cat(3, 'apple', 0)];
    expect(orderedCategories(rows).map((c) => c.name)).toEqual(['apple', 'Group 2', 'Group 10']);
  });

  it('does not change the list it is given', () => {
    const rows = [cat(1, 'b', 1), cat(2, 'a', 0)];
    orderedCategories(rows);
    expect(rows.map((r) => r.name)).toEqual(['b', 'a']);
  });
});

describe('groups', () => {
  const mains = cat(1, 'Mains', 0);
  const archived = cat(2, 'Seasonal', 1, false);
  const drinks = cat(3, 'Drinks', 2);

  it('lists active items before archived ones, each set by display order, then name, then id', () => {
    const items = [
      item(1, mains.categoryId, 'Apple', 5, false),
      item(2, mains.categoryId, 'Item 10', 1),
      item(3, mains.categoryId, 'Item 2', 1),
      item(4, mains.categoryId, 'Burger', 0),
      item(5, mains.categoryId, 'Tied', 3),
      item(6, mains.categoryId, 'tied', 3),
    ];
    const [group] = groups([mains, archived, drinks], items);
    // Burger (0), Item 2 and Item 10 (1, natural order), then the two 'Tied' (3, by id), then the archived Apple.
    expect(group!.items.map((r) => r.name)).toEqual(['Burger', 'Item 2', 'Item 10', 'Tied', 'tied', 'Apple']);
  });

  it('keeps every category and item visible, an archived category’s items included, in the categories’ order', () => {
    const items = [item(1, archived.categoryId, 'Pie', 0), item(2, drinks.categoryId, 'Soda', 0)];
    const result = groups([mains, archived, drinks], items);
    expect(result.map((g) => g.category.name)).toEqual(['Mains', 'Drinks', 'Seasonal']);
    expect(result.map((g) => g.items.length)).toEqual([0, 1, 1]);
  });
});

describe('the reorder scopes', () => {
  it('holds the active categories only, in display order, archived ones staying outside', () => {
    const rows = [cat(1, 'B', 1), cat(2, 'Gone', 0, false), cat(3, 'A', 0)];
    expect(scopeOfCategories(rows)).toEqual([id(3), id(1)]);
  });

  it('holds the active items of one category only', () => {
    const mains = id(1);
    const items = [
      item(1, mains, 'B', 1),
      item(2, mains, 'Gone', 0, false),
      item(3, mains, 'A', 0),
      item(4, id(2), 'Elsewhere', 0),
    ];
    expect(activeItemScope(items, mains)).toEqual([id(103), id(101)]);
  });
});

describe('hiddenReason', () => {
  const live = cat(1, 'Mains', 0);
  const archived = cat(2, 'Seasonal', 1, false);

  it('names the category first when both are archived', () => {
    expect(hiddenReason(item(1, archived.categoryId, 'Pie', 0, false), archived)).toBe('category');
  });

  it('names the category when only the category is archived, and the item when only the item is', () => {
    expect(hiddenReason(item(1, archived.categoryId, 'Pie', 0), archived)).toBe('category');
    expect(hiddenReason(item(2, live.categoryId, 'Apple', 0, false), live)).toBe('item');
  });

  it('names nothing for an offered item', () => {
    expect(hiddenReason(item(3, live.categoryId, 'Burger', 0), live)).toBeNull();
  });
});

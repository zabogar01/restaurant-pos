import { act } from 'react';
import { MENU_CATEGORIES, MENU_ITEMS } from '../src/menuFixtures.js';

// FE-023: a tile is drawn only under its own category, so a test that presses a
// tile selects that category first, as a cashier does.
export function tileFor(host: Element, id: string): Element {
  const item = MENU_ITEMS.find((i) => i.id === id)!;
  const name = MENU_CATEGORIES.find((c) => c.id === item.category)!.name;
  const rail = [...host.querySelectorAll<HTMLElement>('.menu-categories > .menu-category')].find((c) => c.textContent === name)!;
  act(() => rail.click());
  return host.querySelector(`.menu-tile[data-item="${id}"]`)!;
}

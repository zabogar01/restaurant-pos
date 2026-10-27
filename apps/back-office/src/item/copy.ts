// BO-04 Item editor, the item's own fields (PHASE1-S4c2a). Every sentence is a row of DESIGN-020's
// copy table (.agent/tasks/DESIGN-020-item-editor.md, "Exact copy and accessible names for S4c"),
// or the shared copy where DESIGN-020 says DESIGN-019's words are reused (`../menu/copy.ts`,
// `../copy.ts`). Braces in the table are the values here; a zod message, a server text, an error
// code or a submitted value never becomes visible text.
//
// The two option lists, with their own rows, are at the end of this file (PHASE1-S4c2b). Left out
// on purpose (S4c2a ruling 1): the standalone *saved* and *unchanged* rows with *Return to menu*,
// the kitchen-emergency sentences, BO-01's held-draft sentence.

import type { OptionKind } from './options.js';

export type NoticeCopy = { title: string; body: string };

export const ITEM_EDITOR = 'Item editor';
export const NEW_ITEM_TITLE = 'New item';
export const NOT_SAVED_YET = 'Not saved yet';

// The status line and the context paragraph.
export const ARCHIVED_PREFIX = 'Archived item · ';
export const AVAILABLE = 'Available';
export const UNAVAILABLE = '86 · Unavailable';
export const HIDDEN_FROM_POS = ' · Hidden from the POS · category archived';
export const CONTEXT_ORDINARY =
  'Save the item, its variants and its modifiers together. Existing orders keep their saved names and prices.';
export const CONTEXT_ARCHIVED =
  'Archived item. Saving does not restore it. Availability and archive actions are on Menu. Existing orders keep their saved names and prices.';
export const CONTEXT_EIGHTYSIX =
  '86 · Unavailable. Saving does not make it available. Availability and archive actions are on Menu. Existing orders keep their saved names and prices.';
export const CONTEXT_CATEGORY_ARCHIVED =
  'Its category is archived, so it stays hidden from the POS. Category actions are on Menu. Existing orders keep their saved names and prices.';
export const versionFacts = (version: number): string =>
  `Menu version ${version} · Availability and archive status are managed on Menu.`;
export const NEW_FACTS = 'Not saved yet. Nothing is created until you save.';

// The form.
export const DETAILS = 'Item details';
export const CURRENCY_TERM = 'Currency';
export const CURRENCY_VALUE = 'IDR · Indonesian rupiah';
export const DECIMALS_TERM = 'Decimal places';
export const DECIMALS_VALUE = '0 · amounts are whole rupiah';
export const MONEY_NOTE = 'Fixed for this installation. Prices include tax.';
export const NAME_LABEL = 'Item name';
export const NAME_HELP = '1–64 characters. Active item names are unique across the menu.';
export const CATEGORY_LABEL = 'Category';
export const CATEGORY_HELP = 'Choose an active category. An existing item may stay in its archived category.';
export const CATEGORY_FIRST = 'Choose a category';
export const archivedCategoryOption = (name: string): string => `${name} · Archived`;
export const PRICE_LABEL = 'Base price';
export const PRICE_HELP = 'Price the customer pays. 0–99.999.999; whole rupiah.';

// The footer.
export const HINT_DEFAULT = 'All changes are saved together.';
export const HINT_PENDING = 'Wait for the save result.';
export const HINT_STALE = 'Choose which version to keep before saving.';
export const HINT_CATEGORY = 'Choose an active category before saving.';
export const HINT_ERRORS = 'Correct the marked fields before saving.';
export const CANCEL = 'Cancel';
export const SAVE = 'Save';

// Field refusals.
export const NAME_EMPTY = 'Enter an item name.';
export const NAME_LONG = 'Use 64 characters or fewer.';
export const NAME_CONTROL = 'Remove control characters from the item name.';
export const NAME_DUPLICATE = 'An active item already uses this name. Choose another name.';
export const NAME_DUPLICATE_ARCHIVED =
  'An active item in an archived category still uses this name. Choose another name.';
export const CATEGORY_NONE = 'Choose a category.';
export const CATEGORY_ARCHIVED = 'This category is archived. Choose another category.';
export const PRICE_EMPTY = 'Enter a base price.';
export const PRICE_NEGATIVE = 'Use 0 or more.';
export const PRICE_FORMAT = 'Enter whole rupiah, such as 10.000.';
export const PRICE_BOUNDS = 'Use 99.999.999 or less.';

// The name's holder after a refused name was reread.
export const holderLine = (name: string, category: string, archived: boolean): string =>
  `Name held by ${name} in ${category}${archived ? ', an archived category' : ''}.`;
export const VIEW_ITEM = 'View item on Menu';

// The page's states.
export const LOADING = 'Loading item…';
export const READ_FAILED: NoticeCopy = { title: 'Item could not be loaded', body: 'Try again to read this item.' };
export const NOT_FOUND: NoticeCopy = {
  title: 'Item could not be found',
  body: 'Return to Menu and choose the item again.',
};
export const TRY_AGAIN = 'Try again';
export const RETURN_TO_MENU = 'Return to menu';
export const NO_SUBJECT = 'Choose an item on Menu to edit it.';

// What a save did.
export const SAVING: NoticeCopy = { title: 'Saving…', body: 'Wait for the result. Your draft is kept.' };
export const FAILURE: NoticeCopy = {
  title: 'Something went wrong',
  body: 'Nothing was saved. Your draft is kept. Press Save to try again.',
};
export const SESSION_REFUSED: NoticeCopy = {
  title: 'Nothing was saved',
  body: 'Your draft is kept. Press Save to try again.',
};
export const UNKNOWN: NoticeCopy = {
  title: 'Outcome not confirmed',
  body: 'The menu has been refreshed. Your draft is kept; nothing was sent again.',
};
export const UNKNOWN_UNREAD: NoticeCopy = {
  title: 'Outcome not confirmed',
  body: 'The menu could not be refreshed. Your draft is kept; nothing was sent again.',
};
const SAME_VALUES = ' The current item has the same values as your draft.';
const CHOOSE_WHICH = ' Choose which to keep.';
export const MOVE_ARCHIVED =
  ' The destination category was archived. Choose another category after deciding which version to keep.';
export const unknownNewer = (version: number, same: boolean, lost = ''): NoticeCopy => ({
  title: 'Outcome not confirmed',
  body: `The menu has been read again at version ${version}. It may include this save. Your draft is kept; nothing was sent again.${same ? SAME_VALUES : ''}${lost}${CHOOSE_WHICH}`,
});
export const stale = (version: number, same: boolean, destinationArchived: boolean, lost = ''): NoticeCopy => ({
  title: 'The menu changed while you were editing',
  body: `Nothing was saved. The menu has been read again at version ${version}. Your draft is kept.${same ? SAME_VALUES : ''}${lost}${CHOOSE_WHICH}${destinationArchived ? MOVE_ARCHIVED : ''}`,
});
export const STALE_UNREAD: NoticeCopy = {
  title: 'The menu changed while you were editing',
  body: 'Nothing was saved. Your draft is kept, but the current item could not be read. Try again to read it before choosing.',
};
export const CATEGORY_ARCHIVED_NOTICE: NoticeCopy = {
  title: 'The category was archived',
  body: 'Nothing was saved. Your draft is kept. Choose another category before saving.',
};
export const kept = (version: number, clean: boolean): NoticeCopy => ({
  title: 'Your changes are kept',
  body: `Your changes now build on menu version ${version}. Nothing has been saved yet. ${clean ? 'Press Save to save them.' : 'Correct the marked fields, then press Save.'}`,
});
export const used = (version: number): NoticeCopy => ({
  title: 'Current item loaded',
  body: `The form now shows menu version ${version}. Nothing was saved. Edit it and save, or Cancel to close.`,
});

// The comparison.
export const CURRENT_ITEM = 'Current item';
export const TERM_NAME = 'Item name';
export const TERM_CATEGORY = 'Category';
export const TERM_PRICE = 'Base price';
export const TERM_STATUS = 'Status';
export const DIFFERS = 'Differs from your draft';
export const CHOOSE_FIRST = 'Choose Keep my changes or Use current item before saving.';
export const KEEP = 'Keep my changes';
export const USE_CURRENT = 'Use current item';

// The two option lists (PHASE1-S4c2b). Each row is a line of DESIGN-020's copy table: *Variants*,
// *Modifiers*, *Lists*, *Empty list*, *Option row*, *New option*, *Variant preview*, *Floor*,
// *Over the line maximum*, *Preview not computable*, *Pending removal*, *Removal*, the
// *Variant name invalid* and *Modifier name invalid* rows, and *Money invalid*'s two columns.

export const VARIANTS = 'Variants';
export const VARIANTS_NOTE = 'Single-select · one choice, with a positive or negative price change.';
export const VARIANTS_HELP = 'Names: 1–32 characters. Type a minus sign for a reduction, such as -10.000.';
export const VARIANTS_FLOOR = 'The final unit price includes selected modifiers, then floors at zero.';
export const MODIFIERS = 'Modifiers';
export const MODIFIERS_NOTE = 'Multi-select · any number of choices, each adding zero or more.';
export const MODIFIERS_HELP = 'Names: 1–32 characters. Price changes: 0–99.999.999; whole rupiah.';
export const REMOVAL_NOTE =
  'Removed variants and modifiers stay on existing orders. After saving, they cannot be restored; adding the name again creates a new one.';
export const NEW_OPTION = 'New · not saved yet';
export const WILL_BE_REMOVED = 'Will be removed when you save.';
export const UNDO = 'Undo';
export const MOVE_UP = 'Move up';
export const MOVE_DOWN = 'Move down';
export const REMOVE = 'Remove';

const cap = (kind: OptionKind): string => (kind === 'variant' ? 'Variant' : 'Modifier');
export const addLabel = (kind: OptionKind): string => `Add ${kind}`;
export const emptyList = (kind: OptionKind): string => `No ${kind}s yet. Use Add ${kind} to add the first one.`;
export const nameLabel = (kind: OptionKind, n: number): string => `${cap(kind)} ${n} name`;
export const changeLabel = (kind: OptionKind, n: number): string => `${cap(kind)} ${n} price change`;
export const moveUpName = (kind: OptionKind, n: number): string => `Move up ${kind} ${n}`;
export const moveDownName = (kind: OptionKind, n: number): string => `Move down ${kind} ${n}`;
export const removeName = (kind: OptionKind, n: number): string => `Remove ${kind} ${n}`;
export const undoName = (kind: OptionKind, name: string): string => `Undo removal of ${kind} ${name}`;

export const optionNameEmpty = (kind: OptionKind): string => `Enter a ${kind} name.`;
export const OPTION_NAME_LONG = 'Use 32 characters or fewer.';
export const optionNameControl = (kind: OptionKind): string => `Remove control characters from the ${kind} name.`;
export const optionNameDuplicate = (kind: OptionKind): string => `Another ${kind} uses this name. Choose another name.`;

export const CHANGE_EMPTY = 'Enter a price change.';
export const CHANGE_NEGATIVE = 'Use 0 or more.';
export const changeFormat = (kind: OptionKind): string =>
  kind === 'variant' ? 'Enter whole rupiah, such as 10.000 or -10.000.' : 'Enter whole rupiah, such as 10.000.';
export const changeBounds = (kind: OptionKind): string =>
  kind === 'variant' ? 'Use a price change from -99.999.999 to 99.999.999.' : 'Use 99.999.999 or less.';

// The per-variant price without modifiers; the apostrophe is the table's.
export const withoutModifiers = (price: string): string => `Without modifiers: ${price}`;
export const PREVIEW_FLOOR =
  'Without modifiers: 0 · Base price plus this change is below zero, so the price floors at 0.';
export const previewOver = (price: string): string =>
  `Without modifiers: ${price} · More than the largest line total, 99.999.999.`;
export const PREVIEW_UNKNOWN = 'Enter a valid base price and price change to see this variant’s price.';

// The comparison's lists.
export const currentOrder = (kind: OptionKind): string => `${kind === 'variant' ? 'Variants' : 'Modifiers'} · current order`;
export const noneCurrent = (kind: OptionKind): string => `No ${kind}s.`;
export const REMOVED_FROM_CURRENT = 'Removed from the current item.';

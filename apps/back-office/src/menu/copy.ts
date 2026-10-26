// BO-03 Menu (PHASE1-S4c1). Every sentence is a row of DESIGN-019's copy table
// (.agent/tasks/DESIGN-019-menu.md, "Exact copy and accessible names for S4c and S5"), with the
// round 2 and round 3 rows. Braces in the table are the values here; a zod message, a server
// text, an error code or a submitted value never becomes visible text. The departure and logout
// decisions and M-6 stay the one source in `../copy.ts`.
//
// Left out on purpose (PHASE1-S4c1 ruling 1): the 86 and Make available rows (S5), the Edit and
// New item rows (S4c2), the kitchen-emergency sentences, BO-01's held-draft sentence and the
// Phase 4 lease refusal.

export type NoticeCopy = { title: string; body: string };

export const MENU = 'Menu';
export const counts = (categories: number, items: number): string => `${categories} categories · ${items} items`;
export const CONTEXT =
  'Prices include tax · Whole rupiah · IDR. Changes reach the POS within three seconds. Existing orders keep their saved names and prices.';
export const NEW_CATEGORY = 'New category';
export const REORDER_CATEGORIES = 'Reorder categories';
export const LIST_CAPTION = 'Active categories first · Archived items stay in their category';
export const COLUMN_ITEM = 'Item';
export const COLUMN_PRICE = 'Base price · IDR';
export const COLUMN_AVAILABILITY = 'Availability';
export const COLUMN_ACTIONS = 'Actions';
export const LIST_LABEL = 'Menu list';

// A category's group.
export const categoryHeading = (name: string, active: boolean): string =>
  active ? name : `${name} · Archived category`;
export const ACTIVE_NOTE = 'Archiving this category hides its items from the POS without changing them.';
export const ARCHIVED_NOTE =
  'Hidden from the POS. Item status and availability are kept. Restore this category to show its active, available items again.';
export const RENAME = 'Rename';
export const ARCHIVE = 'Archive';
export const RESTORE = 'Restore';
export const REORDER_ITEMS = 'Reorder items';
export const renameCategoryName = (name: string): string => `Rename category ${name}`;
export const archiveCategoryName = (name: string): string => `Archive category ${name}`;
export const restoreCategoryName = (name: string): string => `Restore category ${name}`;
export const reorderItemsName = (name: string): string => `Reorder items in ${name}`;
export const EMPTY_CATEGORY = 'No items in this category yet. Use New item to add the first one.';
export const EMPTY_CATEGORY_ARCHIVED = 'No items in this category yet. Restore the category before adding an item.';

// An item's row.
export const optionsLine = (variants: number, modifiers: number): string =>
  `${variants} variants · ${modifiers} modifiers`;
export const ARCHIVED_ITEM = 'Archived item';
export const AVAILABLE = 'Available';
export const UNAVAILABLE = '86 · Unavailable';
export const archiveItemName = (name: string): string => `Archive item ${name}`;
export const restoreItemName = (name: string): string => `Restore item ${name}`;
export const HIDDEN_CATEGORY = 'Hidden from the POS · category archived';
export const HIDDEN_ITEM = 'Hidden from the POS · item archived';

// The page's states.
export const EMPTY_TITLE = 'No menu yet';
export const EMPTY_BODY = 'Nothing is preloaded. Create a category, then add your first item.';
export const LOADING = 'Loading menu…';
export const READ_FAILED: NoticeCopy = { title: 'Menu could not be loaded', body: 'Try again to read the menu.' };
export const LIST_PARTIAL: NoticeCopy = {
  title: 'The menu list may be out of date',
  body: 'The menu could not be read again. The rows below are the ones this page knows, including your latest change. Try again to read the full list.',
};
export const TRY_AGAIN = 'Try again';
export const REFRESHED = 'The menu has been refreshed.';

// The category form.
export const renameTitle = (name: string): string => `Rename ${name}`;
export const CREATE_CONTEXT = 'Choose the category name staff will see at the POS.';
export const RENAME_CONTEXT = 'Rename this category. Existing orders keep their saved names.';
export const ARCHIVED_RENAME_CONTEXT = 'Archived category. Saving its name does not restore it.';
export const NAME_LABEL = 'Category name';
export const NAME_HELP = '1–32 characters. Active categories must have different names.';
export const CREATE = 'Create';
export const SAVE = 'Save';
export const CANCEL = 'Cancel';
export const NAME_EMPTY = 'Enter a name';
export const NAME_LONG = 'Use 32 characters or fewer.';
export const NAME_CONTROL = 'Remove control characters from the name.';
export const NAME_DUPLICATE = 'An active category already uses this name. Choose another name.';
export const NAME_IN_USE = 'Name in use';
export const categoryRestoreDuplicate = (name: string): string =>
  `${name} was not restored. An active category already uses this name. Rename this archived category, save, then restore it.`;
export const itemRestoreDuplicate = (name: string): string =>
  `${name} was not restored. An active item already uses this name. Rename this archived item in the item editor, save, then restore it.`;

// The reorder panel.
export const REORDER_CATEGORIES_TITLE = 'Reorder categories';
export const reorderItemsTitle = (category: string): string => `Reorder items in ${category}`;
export const REORDER_CONTEXT =
  'Move each row up or down, then save the full order. Archived records keep their stored order.';
export const orderRow = (position: number, name: string): string => `${position}. ${name}`;
export const MOVE_UP = 'Move up';
export const MOVE_DOWN = 'Move down';
export const moveUpName = (name: string): string => `Move up ${name}`;
export const moveDownName = (name: string): string => `Move down ${name}`;
export const SAVE_ORDER = 'Save order';

// What a save or a command did.
export const SAVING = 'Saving… Wait for the result. Your draft is kept.';
export const savedCategory = (name: string): string => `${name} saved.`;
export const CATEGORY_ORDER_SAVED = 'Category order saved.';
export const itemOrderSaved = (category: string): string => `Item order in ${category} saved.`;
export const unchanged = (version: number): string => `Nothing changed. Menu version ${version} is still current.`;

export const staleNotice = (version: number): string =>
  `The menu changed while you were editing. Nothing was saved. The menu has been read again at version ${version}. Your draft is kept. Choose which to keep.`;
export const STALE_UNREAD =
  'The menu changed while you were editing. Nothing was saved. Your draft is kept, but the current menu could not be read. Try again to read it before choosing.';
export const CURRENT_MENU = 'Current menu';
export const currentName = (name: string): string => `Current category name: ${name}`;
export const currentOrder = (names: readonly string[]): string => `Current order: ${names.join(' → ')}`;
export const KEEP = 'Keep my changes';
export const USE_CURRENT = 'Use current menu';
export const CHOOSE_FIRST = 'Choose Keep my changes or Use current menu first.';
export const keptNotice = (version: number, submit: string): string =>
  `Your changes now build on version ${version}. Nothing has been saved yet. Press ${submit} to save them.`;
export const usedNotice = (version: number): string =>
  `The form now shows version ${version}. Nothing was saved. Edit it and save, or Cancel to close.`;

export const formFailed = (submit: string): string =>
  `Something went wrong. Nothing was saved. Your draft is kept. Press ${submit} to try again.`;
export const formSessionRefused = (submit: string): string =>
  `Nothing was saved. Your draft is kept. Press ${submit} to try again.`;
export const UNKNOWN_EDIT = 'Outcome not confirmed. The menu has been refreshed. Your draft is kept; nothing was sent again.';
export const UNKNOWN_EDIT_UNREAD =
  'Outcome not confirmed. The menu could not be refreshed. Your draft is kept; nothing was sent again.';
export const unknownNewer = (version: number): string =>
  `Outcome not confirmed. The menu has been read again at version ${version}. It may include this save. Your draft is kept; nothing was sent again. Choose which to keep.`;

export const archiving = (name: string): string => `Archiving ${name}…`;
export const restoring = (name: string): string => `Restoring ${name}…`;
export const categoryArchived = (name: string): string =>
  `${name} archived. Its items are hidden from the POS; their status and availability are unchanged.`;
export const categoryRestored = (name: string): string =>
  `${name} restored. Its active, available items are shown at the POS again.`;
const ITEM_IN_ARCHIVED_CATEGORY = ' Its category is archived, so it stays hidden from the POS.';
export const itemArchived = (name: string, categoryArchivedToo: boolean): string =>
  `${name} archived. It is kept for history.${categoryArchivedToo ? ITEM_IN_ARCHIVED_CATEGORY : ''}`;
export const itemRestored = (name: string, categoryArchivedToo: boolean): string =>
  `${name} restored.${categoryArchivedToo ? ITEM_IN_ARCHIVED_CATEGORY : ''}`;
export const stateUnknown = (name: string): string =>
  `${name}: the outcome could not be confirmed. The menu has been refreshed. Nothing was sent again.`;
export const stateUnknownUnread = (name: string): string =>
  `${name}: the outcome could not be confirmed. The menu could not be refreshed. Nothing was sent again.`;
export const stateFailed = (name: string): string =>
  `Something went wrong. ${name} was not changed. Use its row action to try again.`;
export const stateSessionRefused = (name: string): string =>
  `${name} was not changed. Use its row action to try again.`;
export const WAITING = 'Waiting for an earlier save to finish. Nothing will be sent again.';

// The departure decision, when Archive or Restore opened it (round 2, F7; round 3): the draft is
// being continued from, not left. The ordinary and uncertain bodies are in `../copy.ts`.
export const DEPARTURE_CONTINUE = 'Your edits have not been saved. Stay to keep editing, or discard them to continue.';
export const DEPARTURE_CONTINUE_UNCERTAIN =
  'The save may or may not have succeeded. Continuing does not send it again. Stay to keep the draft, or discard it to continue.';

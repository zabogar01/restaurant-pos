import { Fragment, useEffect, useRef, useSyncExternalStore, type FormEvent } from 'react';
import { DEPARTURE_BODY, DEPARTURE_BODY_UNCERTAIN } from '../copy.js';
import { Decision } from '../forms/Decision.js';
import { useSession } from '../session/useSession.js';
import { workGuard } from '../work/guard.js';
import {
  ACTIVE_NOTE,
  ARCHIVE,
  ARCHIVED_ITEM,
  ARCHIVED_NOTE,
  ARCHIVED_RENAME_CONTEXT,
  AVAILABLE,
  CANCEL,
  CATEGORY_ORDER_SAVED,
  CHOOSE_FIRST,
  COLUMN_ACTIONS,
  COLUMN_AVAILABILITY,
  COLUMN_ITEM,
  COLUMN_PRICE,
  CONTEXT,
  CREATE,
  CREATE_CONTEXT,
  CURRENT_MENU,
  DEPARTURE_CONTINUE,
  DEPARTURE_CONTINUE_UNCERTAIN,
  EDIT,
  EIGHTY_SIX,
  EMPTY_BODY,
  EMPTY_CATEGORY,
  EMPTY_CATEGORY_ARCHIVED,
  EMPTY_TITLE,
  HIDDEN_CATEGORY,
  HIDDEN_ITEM,
  KEEP,
  LIST_CAPTION,
  LIST_LABEL,
  LIST_PARTIAL,
  LOADING,
  MAKE_AVAILABLE,
  MENU,
  MOVE_DOWN,
  MOVE_UP,
  NAME_CONTROL,
  NAME_DUPLICATE,
  NAME_EMPTY,
  NAME_HELP,
  NAME_IN_USE,
  NAME_LABEL,
  NAME_LONG,
  NEW_CATEGORY,
  NEW_ITEM,
  READ_FAILED,
  REFRESHED,
  RENAME,
  RENAME_CONTEXT,
  REORDER_CATEGORIES,
  REORDER_CATEGORIES_TITLE,
  REORDER_CONTEXT,
  REORDER_ITEMS,
  RESTORE,
  SAVE,
  SAVE_ORDER,
  SAVING,
  STALE_UNREAD,
  TRY_AGAIN,
  UNAVAILABLE,
  UNKNOWN_EDIT,
  UNKNOWN_EDIT_UNREAD,
  USE_CURRENT,
  WAITING,
  archiveCategoryName,
  archiveItemName,
  archiving,
  availableAgain,
  categoryArchived,
  categoryHeading,
  categoryRestoreDuplicate,
  categoryRestored,
  counts,
  currentName,
  currentOrder,
  editItemName,
  eightySixName,
  eightySixed,
  eightySixing,
  formFailed,
  formSessionRefused,
  itemArchived,
  itemOrderSaved,
  itemRestoreDuplicate,
  itemRestored,
  keptNotice,
  makeAvailableName,
  makingAvailable,
  moveDownName,
  moveUpName,
  newItemName,
  optionsLine,
  orderRow,
  renameCategoryName,
  renameTitle,
  reorderItemsName,
  reorderItemsTitle,
  restoreCategoryName,
  restoreItemName,
  restoring,
  savedCategory,
  stateFailed,
  stateSessionRefused,
  stateUnknown,
  stateUnknownUnread,
  staleNotice,
  unchanged,
  unknownNewer,
  usedNotice,
} from './copy.js';
import { activeItemScope, groups, hiddenReason, scopeOfCategories } from './group.js';
import { holderOf, type Editor, type FieldError, type MenuModel, type MenuState, type PageStatus } from './model.js';
import { priceText } from './money.js';

// BO-03, as DESIGN-019 draws it (docs/design/visual-directions/frost/back-office/menu.html): the
// catalog grouped by category, and above it a full-width non-modal panel for the one editor (the
// category form, or a reorder). The panel is a named `role="dialog"` with `aria-modal="false"`,
// so the rail, Log out and the list stay live while it is open. Only the stay-or-discard decision
// is a modal `<dialog>`, in `forms/Decision.tsx`. An off action is `aria-disabled`, never
// `disabled`, as in BO-05 and BO-08.

const fieldText: Record<FieldError, string> = {
  empty: NAME_EMPTY,
  long: NAME_LONG,
  control: NAME_CONTROL,
  duplicate: NAME_DUPLICATE,
};

function pageText(page: PageStatus): string {
  switch (page.kind) {
    case 'saved':
      return savedCategory(page.name);
    case 'order-saved':
      return page.scope === 'categories' ? CATEGORY_ORDER_SAVED : itemOrderSaved(page.category);
    case 'unchanged':
      return unchanged(page.version);
    case 'pending':
      return page.action === 'archive'
        ? archiving(page.name)
        : page.action === 'restore'
          ? restoring(page.name)
          : page.action === 'eighty-six'
            ? eightySixing(page.name)
            : makingAvailable(page.name);
    case 'eighty-sixed':
      return eightySixed(page.name, page.hidden);
    case 'made-available':
      return availableAgain(page.name, page.hidden);
    case 'archived':
      return page.subject === 'category' ? categoryArchived(page.name) : itemArchived(page.name, page.hidden);
    case 'restored':
      return page.subject === 'category' ? categoryRestored(page.name) : itemRestored(page.name, page.hidden);
    case 'failed':
      return stateFailed(page.name);
    case 'session':
      return stateSessionRefused(page.name);
    case 'unknown':
      return page.unread ? stateUnknownUnread(page.name) : stateUnknown(page.name);
    case 'duplicate':
      return page.subject === 'category' ? categoryRestoreDuplicate(page.name) : itemRestoreDuplicate(page.name);
    case 'refreshed':
      return REFRESHED;
    case 'waiting':
      return WAITING;
  }
}

const inertProps = (inert: boolean) => ({
  'aria-disabled': inert ? ('true' as const) : undefined,
  tabIndex: inert ? -1 : undefined,
});

/** The view of the working area's BO-03 model (made in `Screens`); it draws what the model holds. */
export function Menu({ model }: { model: MenuModel }) {
  const session = useSession();
  const state = useSyncExternalStore(model.subscribe, model.getState);
  const phase = session.phase;
  const signedIn = phase === 'signed-in';
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => model.shown(), [model]);
  useEffect(() => workGuard.register(model.guard), [model]);
  useEffect(() => model.subscribe(workGuard.changed), [model]);

  // Coming back from BO-01 as the same manager: the panel is shown again with the draft
  // control focused, unless a decision was restored, which takes focus on Stay. Coming back from
  // M-6: the frame has put focus back where it was; if that element is gone, the work takes it.
  const before = useRef(phase);
  useEffect(() => {
    const was = before.current;
    before.current = phase;
    if (phase !== 'signed-in') return;
    if (was === 'signed-out') {
      if (!model.getState().decision) model.refocus();
    } else if (was === 'idle' && (document.activeElement === null || document.activeElement === document.body)) {
      model.refocus();
    }
  }, [phase, model]);

  // Where the model asked focus to go. A request made while Menu was not on screen is not for
  // this mount, and one made while the session is away waits for the same manager's return.
  const focus = state.focus;
  const handled = useRef(focus?.n ?? 0);
  useEffect(() => {
    if (focus === null || focus.n <= handled.current) return;
    if (!signedIn || root.current === null) return;
    handled.current = focus.n;
    const area = root.current;
    const pick = (selector: string) => area.querySelector<HTMLElement>(selector);
    const target = focus.target;
    let found: HTMLElement | null;
    if (target === 'name') found = pick('#menu-name');
    else if (target === 'notice') found = pick('#form-notice');
    else if (target === 'status') found = pick('#page-status');
    else if (target === 'save') found = pick('#save-menu');
    else if (target === 'first-move') found = pick('#draft-order [data-move]:not([aria-disabled="true"])');
    else if (target === 'new-category') found = pick('#new-category');
    else if (target === 'reorder-categories') found = pick('#reorder-categories');
    else if ('move' in target) found = pick(`#draft-order [data-move="${target.move}"][data-delta="${target.delta}"]`);
    else if ('rename' in target) found = pick(`[data-rename="${target.rename}"]`) ?? pick('#new-category');
    else if ('itemAction' in target) found = pick(`[data-edit="${target.itemAction}"]`) ?? pick('#new-category');
    else if ('newItem' in target) found = pick(`[data-new-item="${target.newItem}"]`) ?? pick('#new-category');
    else found = pick(`[data-reorder="${target.reorderItems}"]`) ?? pick('#new-category');
    found?.focus();
  }, [focus, signedIn]);

  // Escape leaves the editor as Cancel does, unless a modal (M-6, the decision) is open.
  const live = useRef(signedIn);
  live.current = signedIn;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !live.current) return;
      const now = model.getState();
      if (now.editor === null || now.decision || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      model.cancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [model]);

  const { editor, command, page, read, categories, items } = state;
  // BO-04's save, left outstanding by Discard, takes the screen's one command slot too.
  const busy = command !== null || state.external;
  // The rows can be drawn when a read succeeded, or when an answer was applied to the rows the
  // client knew while a read stands failed (the alert stays, the counts are withheld).
  const usable = read === 'ready' || state.partial;
  const complete = read === 'ready';
  const holder = holderOf(state);
  const uncertain = model.guard.status() === 'uncertain';
  const body = state.continuing
    ? uncertain
      ? DEPARTURE_CONTINUE_UNCERTAIN
      : DEPARTURE_CONTINUE
    : uncertain
      ? DEPARTURE_BODY_UNCERTAIN
      : DEPARTURE_BODY;
  const activeCategories = categories.filter((c) => c.isActive).length;
  const grouped = groups(categories, items);
  const noVersion = state.version === null;
  // A reorder needs a complete read: not while loading, failed or partial (round 2, F3).
  const reorderCategoriesOff = busy || !complete || noVersion || activeCategories < 2;

  return (
    <div ref={root}>
      <div className="office-heading">
        <h1>{MENU}</h1>
        {read === 'ready' && <p id="menu-count">{counts(categories.length, items.length)}</p>}
      </div>
      <p className="menu-intro">{CONTEXT}</p>
      <div className="office-actions menu-toolbar">
        <button
          type="button"
          id="new-category"
          className="office-button primary"
          {...inertProps(read === 'loading' || busy)}
          onClick={() => model.openCreate()}
        >
          {NEW_CATEGORY}
        </button>
        <button
          type="button"
          id="reorder-categories"
          className="office-button"
          {...inertProps(reorderCategoriesOff)}
          onClick={() => model.openReorderCategories()}
        >
          {REORDER_CATEGORIES}
        </button>
      </div>

      {page !== null && (
        <div
          id="page-status"
          tabIndex={-1}
          className="office-notice"
          data-kind={page.kind === 'failed' || page.kind === 'duplicate' ? 'failure' : 'status'}
          role={page.kind === 'failed' || page.kind === 'duplicate' ? 'alert' : 'status'}
        >
          {pageText(page)}
        </div>
      )}

      {read === 'loading' && (
        <div id="read-state">
          <div className="office-notice" role="status">
            {LOADING}
          </div>
        </div>
      )}
      {read === 'failed' && (
        <div id="read-state">
          <div className="office-notice" role="alert">
            <strong>{(state.partial ? LIST_PARTIAL : READ_FAILED).title}</strong>
            <p>{(state.partial ? LIST_PARTIAL : READ_FAILED).body}</p>
            <button type="button" className="office-button" onClick={() => void model.retryRead()}>
              {TRY_AGAIN}
            </button>
          </div>
        </div>
      )}

      {editor !== null && <EditorPanel editor={editor} state={state} model={model} />}

      <section aria-label={LIST_LABEL}>
        {read === 'ready' && categories.length === 0 && (
          <div className="office-empty">
            <div className="office-empty-title">{EMPTY_TITLE}</div>
            <p>{EMPTY_BODY}</p>
          </div>
        )}
        {usable && categories.length > 0 && (
          <table className="office-table menu-table" id="menu-list">
            <caption>{LIST_CAPTION}</caption>
            <colgroup>
              <col className="item-col" />
              <col className="price-col" />
              <col className="availability-col" />
              <col className="actions-col" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{COLUMN_ITEM}</th>
                <th scope="col" className="num">
                  {COLUMN_PRICE}
                </th>
                <th scope="col">{COLUMN_AVAILABILITY}</th>
                <th scope="col">{COLUMN_ACTIONS}</th>
              </tr>
            </thead>
            <tbody id="menu-rows">
              {grouped.map(({ category, items: rows }) => {
                const id = category.categoryId;
                const marked = holder?.kind === 'category' && holder.id === id;
                const reorderOff = busy || !complete || noVersion || activeItemScope(items, id).length < 2;
                return (
                  <Fragment key={id}>
                    <tr className="category-row" data-category={id} data-active={category.isActive}>
                      <td colSpan={4}>
                        <div className="menu-category">
                          <h2>{categoryHeading(category.name, category.isActive)}</h2>
                          <div className="office-actions">
                            <button
                              type="button"
                              className="office-button small"
                              data-rename={id}
                              aria-label={renameCategoryName(category.name)}
                              {...inertProps(busy || noVersion)}
                              onClick={() => model.openRename(id)}
                            >
                              {RENAME}
                            </button>
                            <button
                              type="button"
                              className="office-button small"
                              data-category-state={id}
                              aria-label={category.isActive ? archiveCategoryName(category.name) : restoreCategoryName(category.name)}
                              {...inertProps(busy)}
                              onClick={() => model.changeCategoryState(id)}
                            >
                              {category.isActive ? ARCHIVE : RESTORE}
                            </button>
                            {category.isActive && (
                              <button
                                type="button"
                                className="office-button small"
                                data-reorder={id}
                                aria-label={reorderItemsName(category.name)}
                                {...inertProps(reorderOff)}
                                onClick={() => model.openReorderItems(id)}
                              >
                                {REORDER_ITEMS}
                              </button>
                            )}
                            {category.isActive && (
                              <button
                                type="button"
                                className="office-button small"
                                data-new-item={id}
                                aria-label={newItemName(category.name)}
                                {...inertProps(read === 'loading' || busy)}
                                onClick={() => model.openItemEditor({ kind: 'new', categoryId: id })}
                              >
                                {NEW_ITEM}
                              </button>
                            )}
                          </div>
                        </div>
                        <span className="menu-category-note">{category.isActive ? ACTIVE_NOTE : ARCHIVED_NOTE}</span>
                        {marked && <span className="table-holder">{NAME_IN_USE}</span>}
                      </td>
                    </tr>
                    {rows.length === 0 && (
                      <tr data-empty-category={id}>
                        <td colSpan={4}>{category.isActive ? EMPTY_CATEGORY : EMPTY_CATEGORY_ARCHIVED}</td>
                      </tr>
                    )}
                    {rows.map((item) => {
                      const reason = hiddenReason(item, category);
                      const variants = item.variants.filter((v) => v.isActive).length;
                      const modifiers = item.modifiers.filter((m) => m.isActive).length;
                      return (
                        <tr
                          key={item.itemId}
                          data-item={item.itemId}
                          data-active={item.isActive}
                          data-selected={state.selected === item.itemId ? 'true' : undefined}
                        >
                          <td>
                            {item.name}
                            {!item.isActive && <span className="menu-item-note">{ARCHIVED_ITEM}</span>}
                            <span className="menu-item-note">{optionsLine(variants, modifiers)}</span>
                            {holder?.kind === 'item' && holder.id === item.itemId && (
                              <span className="table-holder">{NAME_IN_USE}</span>
                            )}
                          </td>
                          <td className="num">{priceText(item.basePrice)}</td>
                          <td>
                            <span className="menu-availability">{item.isAvailable ? AVAILABLE : UNAVAILABLE}</span>
                            <button
                              type="button"
                              className="office-button small"
                              data-availability={item.itemId}
                              aria-label={item.isAvailable ? eightySixName(item.name) : makeAvailableName(item.name)}
                              {...inertProps(busy)}
                              onClick={() => model.changeItemAvailability(item.itemId)}
                            >
                              {item.isAvailable ? EIGHTY_SIX : MAKE_AVAILABLE}
                            </button>
                            {reason !== null && (
                              <span className="menu-item-note">{reason === 'category' ? HIDDEN_CATEGORY : HIDDEN_ITEM}</span>
                            )}
                          </td>
                          <td>
                            <div className="office-actions">
                              <button
                                type="button"
                                className="office-button small"
                                data-edit={item.itemId}
                                aria-label={editItemName(item.name)}
                                {...inertProps(read === 'loading' || busy)}
                                onClick={() => model.openItemEditor({ kind: 'edit', itemId: item.itemId })}
                              >
                                {EDIT}
                              </button>
                              <button
                                type="button"
                                className="office-button small"
                                data-item-state={item.itemId}
                                aria-label={item.isActive ? archiveItemName(item.name) : restoreItemName(item.name)}
                                {...inertProps(busy)}
                                onClick={() => model.changeItemState(item.itemId)}
                              >
                                {item.isActive ? ARCHIVE : RESTORE}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <Decision open={state.decision} body={body} onStay={() => model.stay()} onDiscard={() => model.discard()} />
    </div>
  );
}

/** What the notice of an open editor says, and how it is announced. */
function noticeOf(editor: Editor, pendingSave: boolean) {
  const submit = editor.kind === 'create' ? CREATE : editor.kind === 'categories' || editor.kind === 'items' ? SAVE_ORDER : SAVE;
  if (pendingSave) return { kind: 'pending', role: 'status', text: SAVING } as const;
  switch (editor.notice) {
    case null:
      return null;
    case 'failure':
      return { kind: 'failure', role: 'alert', text: formFailed(submit) } as const;
    case 'session':
      return { kind: 'failure', role: 'status', text: formSessionRefused(submit) } as const;
    case 'unknown':
      return { kind: 'unknown', role: 'status', text: UNKNOWN_EDIT } as const;
    case 'unknown-unread':
      return { kind: 'unknown', role: 'status', text: UNKNOWN_EDIT_UNREAD } as const;
    case 'unknown-newer':
      return { kind: 'unknown', role: 'status', text: unknownNewer(editor.offered?.version ?? editor.base ?? 0) } as const;
    case 'stale':
      return { kind: 'failure', role: 'alert', text: staleNotice(editor.offered?.version ?? editor.base ?? 0) } as const;
    case 'stale-unread':
      return { kind: 'failure', role: 'alert', text: STALE_UNREAD } as const;
    case 'kept':
      return { kind: 'kept', role: 'status', text: keptNotice(editor.base ?? 0, submit) } as const;
    case 'used':
      return { kind: 'used', role: 'status', text: usedNotice(editor.base ?? 0) } as const;
  }
}

function EditorPanel({ editor, state, model }: { editor: Editor; state: MenuState; model: MenuModel }) {
  const { command, categories, items } = state;
  const reorder = editor.kind === 'categories' || editor.kind === 'items';
  const pendingSave = command !== null && !command.discarded && command.editorKey === editor.key;
  const chooses = editor.offered !== null;
  const readOnlyRetry = editor.notice === 'stale-unread' || editor.notice === 'unknown-unread';
  const saveOff = pendingSave || chooses || editor.notice === 'stale-unread';
  const notice = noticeOf(editor, pendingSave);
  const nameOf = (id: string): string =>
    (editor.kind === 'categories' ? categories.find((c) => c.categoryId === id)?.name : items.find((i) => i.itemId === id)?.name) ?? '';
  const title =
    editor.kind === 'create'
      ? NEW_CATEGORY
      : editor.kind === 'rename'
        ? renameTitle(editor.openedName)
        : editor.kind === 'categories'
          ? REORDER_CATEGORIES_TITLE
          : reorderItemsTitle(editor.openedName);
  const context = reorder
    ? REORDER_CONTEXT
    : editor.kind === 'create'
      ? CREATE_CONTEXT
      : editor.active
        ? RENAME_CONTEXT
        : ARCHIVED_RENAME_CONTEXT;

  return (
    <section className="table-editor menu-editor" role="dialog" aria-modal="false" aria-labelledby="editor-title">
      <header className="office-dialog__head">
        <h2 id="editor-title">{title}</h2>
      </header>
      <form
        id="menu-form"
        method="post"
        noValidate
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          model.save();
        }}
      >
        <div className="office-dialog__body">
          <div>
            <p id="editor-context">{context}</p>
            {!reorder && (
              <div id="name-part">
                <label htmlFor="menu-name">{NAME_LABEL}</label>
                <input
                  id="menu-name"
                  name="name"
                  type="text"
                  className="office-field"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={editor.draft}
                  disabled={pendingSave}
                  aria-invalid={editor.error === null ? undefined : true}
                  aria-describedby={editor.error === null ? 'menu-name-help' : 'name-error menu-name-help'}
                  onChange={(event) => model.setDraft(event.currentTarget.value)}
                />
                {editor.error !== null && (
                  <span id="name-error" className="office-error">
                    {fieldText[editor.error]}
                  </span>
                )}
                <p id="menu-name-help">{NAME_HELP}</p>
              </div>
            )}
            {reorder && (
              <ol className="menu-reorder" id="draft-order">
                {editor.order.map((id, index) => {
                  const name = nameOf(id);
                  const first = index === 0;
                  const last = index === editor.order.length - 1;
                  return (
                    <li key={id} data-order-id={id}>
                      <span className="menu-order-name">{orderRow(index + 1, name)}</span>
                      <button
                        type="button"
                        className="office-button small"
                        data-move={id}
                        data-delta="-1"
                        aria-label={moveUpName(name)}
                        {...inertProps(first || command !== null)}
                        onClick={() => model.move(id, -1)}
                      >
                        {MOVE_UP}
                      </button>
                      <button
                        type="button"
                        className="office-button small"
                        data-move={id}
                        data-delta="1"
                        aria-label={moveDownName(name)}
                        {...inertProps(last || command !== null)}
                        onClick={() => model.move(id, 1)}
                      >
                        {MOVE_DOWN}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
          <div>
            {notice !== null && (
              <div id="form-notice" tabIndex={-1} className="office-notice" data-kind={notice.kind} role={notice.role}>
                <p>{notice.text}</p>
                {readOnlyRetry && (
                  <button type="button" className="office-button" id="retry-menu-read" onClick={() => void model.retryRead()}>
                    {TRY_AGAIN}
                  </button>
                )}
              </div>
            )}
            {editor.offered !== null && (
              <section id="comparison" aria-label={CURRENT_MENU}>
                <h3>{CURRENT_MENU}</h3>
                <div id="current-values">
                  {reorder
                    ? currentOrder(editor.offered.order.map(nameOf).filter((name) => name !== ''))
                    : currentName(editor.offered.name)}
                </div>
                <p id="choice-reason">{CHOOSE_FIRST}</p>
                <div className="office-actions">
                  <button type="button" className="office-button" id="keep-draft" onClick={() => model.keepMine()}>
                    {KEEP}
                  </button>
                  <button type="button" className="office-button" id="use-current" onClick={() => model.useCurrent()}>
                    {USE_CURRENT}
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
        <footer className="office-dialog__foot">
          <button type="button" id="cancel-edit" className="office-button" onClick={() => model.cancel()}>
            {CANCEL}
          </button>
          <button
            type="submit"
            id="save-menu"
            className="office-button primary"
            aria-disabled={saveOff ? 'true' : undefined}
            aria-describedby={chooses ? 'choice-reason' : editor.notice === 'stale-unread' ? 'form-notice' : undefined}
          >
            {editor.kind === 'create' ? CREATE : reorder ? SAVE_ORDER : SAVE}
          </button>
        </footer>
      </form>
    </section>
  );
}

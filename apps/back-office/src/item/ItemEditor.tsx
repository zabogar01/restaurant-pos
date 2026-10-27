import { useEffect, useRef, useSyncExternalStore, type FormEvent, type MouseEvent } from 'react';
import { DEPARTURE_BODY, DEPARTURE_BODY_UNCERTAIN } from '../copy.js';
import { Decision } from '../forms/Decision.js';
import { priceText } from '../menu/money.js';
import { PATHS } from '../routes.js';
import { useSession } from '../session/useSession.js';
import { workGuard } from '../work/guard.js';
import { categoryOptions } from './categories.js';
import {
  CANCEL,
  CATEGORY_ARCHIVED,
  CATEGORY_ARCHIVED_NOTICE,
  CATEGORY_FIRST,
  CATEGORY_HELP,
  CATEGORY_LABEL,
  CATEGORY_NONE,
  CHOOSE_FIRST,
  CURRENCY_TERM,
  CURRENCY_VALUE,
  CURRENT_ITEM,
  DECIMALS_TERM,
  DECIMALS_VALUE,
  DETAILS,
  DIFFERS,
  FAILURE,
  HINT_CATEGORY,
  HINT_DEFAULT,
  HINT_ERRORS,
  HINT_PENDING,
  HINT_STALE,
  ITEM_EDITOR,
  KEEP,
  LOADING,
  MONEY_NOTE,
  NAME_CONTROL,
  NAME_DUPLICATE,
  NAME_DUPLICATE_ARCHIVED,
  NAME_EMPTY,
  NAME_HELP,
  NAME_LABEL,
  NAME_LONG,
  NEW_FACTS,
  NEW_ITEM_TITLE,
  NO_SUBJECT,
  NOT_FOUND,
  NOT_SAVED_YET,
  PRICE_BOUNDS,
  PRICE_EMPTY,
  PRICE_FORMAT,
  PRICE_HELP,
  PRICE_LABEL,
  PRICE_NEGATIVE,
  READ_FAILED,
  RETURN_TO_MENU,
  SAVE,
  SAVING,
  SESSION_REFUSED,
  STALE_UNREAD,
  TERM_CATEGORY,
  TERM_NAME,
  TERM_PRICE,
  TERM_STATUS,
  TRY_AGAIN,
  UNKNOWN,
  UNKNOWN_UNREAD,
  USE_CURRENT,
  VIEW_ITEM,
  archivedCategoryOption,
  holderLine,
  kept,
  stale,
  unknownNewer,
  used,
  versionFacts,
  type NoticeCopy,
} from './copy.js';
import { contextText, itemFacts, statusText } from './facts.js';
import { holderOf, type FieldKey, type Form, type ItemModel, type ItemState } from './model.js';
import type { PriceError } from './price.js';
import { checkPrice } from './price.js';
import type { NameError } from '../menu/name.js';

// BO-04, as DESIGN-020 draws it (docs/design/visual-directions/frost/back-office/item-editor.html):
// one bordered form with *Item details* (the installation's currency, Item name, Category, Base
// price) and a sticky footer; in the stale state the form narrows and *Current item* sits beside
// it. It draws what the working area's model holds (made in `Screens`) and keeps nothing of its
// own. An off action is `aria-disabled`, never `disabled`; the fields are inert while a save is
// pending. The Variants and Modifiers sections arrive with PHASE1-S4c2b.

const nameText: Record<NameError | 'duplicate', string> = {
  empty: NAME_EMPTY,
  long: NAME_LONG,
  control: NAME_CONTROL,
  duplicate: NAME_DUPLICATE,
};

const priceText_: Record<PriceError, string> = {
  empty: PRICE_EMPTY,
  negative: PRICE_NEGATIVE,
  format: PRICE_FORMAT,
  bounds: PRICE_BOUNDS,
};

/** A link that goes to Menu by the router, as the rail's entries do; a new tab is the browser's own business. */
const goMenu = (go: () => void) => (event: MouseEvent<HTMLAnchorElement>) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  go();
};

/** What the notice of an open form says, and how it is announced. */
function noticeOf(form: Form, pending: boolean): { kind: string; role: 'status' | 'alert'; copy: NoticeCopy } | null {
  if (pending) return { kind: 'pending', role: 'status', copy: SAVING };
  const version = form.offered?.version ?? form.base ?? 0;
  const same = form.offered !== null && sameValues(form, form.offered.item);
  switch (form.notice) {
    case null:
      return null;
    case 'failure':
      return { kind: 'failure', role: 'alert', copy: FAILURE };
    case 'session':
      return { kind: 'failure', role: 'status', copy: SESSION_REFUSED };
    case 'unknown':
      return { kind: 'unknown', role: 'status', copy: UNKNOWN };
    case 'unknown-unread':
      return { kind: 'unknown', role: 'status', copy: UNKNOWN_UNREAD };
    case 'unknown-newer':
      return { kind: 'stale', role: 'alert', copy: unknownNewer(version, same) };
    case 'stale':
      return { kind: 'stale', role: 'alert', copy: stale(version, same, form.destinationArchived) };
    case 'stale-unread':
      return { kind: 'stale', role: 'alert', copy: STALE_UNREAD };
    case 'kept':
      return { kind: 'kept', role: 'status', copy: kept(form.base ?? 0, form.keptClean) };
    case 'used':
      return { kind: 'used', role: 'status', copy: used(form.base ?? 0) };
    case 'category-archived':
      return { kind: 'failure', role: 'alert', copy: CATEGORY_ARCHIVED_NOTICE };
  }
}

/** The current item has every value the draft has (the item's own fields, as the draft would send them). */
function sameValues(form: Form, item: { name: string; categoryId: string; basePrice: string }): boolean {
  const price = checkPrice(form.draft.price, 'base');
  return (
    form.draft.name.trim() === item.name &&
    form.draft.categoryId === item.categoryId &&
    price.error === null &&
    price.value === item.basePrice
  );
}

/** The view of the working area's BO-04 model (made in `Screens`); it draws what the model holds. */
export function ItemEditor({ model }: { model: ItemModel }) {
  const session = useSession();
  const state = useSyncExternalStore(model.subscribe, model.getState);
  const phase = session.phase;
  const signedIn = phase === 'signed-in';
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => model.shown(), [model]);
  useEffect(() => workGuard.register(model.guard), [model]);
  useEffect(() => model.subscribe(workGuard.changed), [model]);

  // Coming back from BO-01 as the same manager: the form is shown again with the field last
  // edited focused, unless a decision was restored, which takes focus on Stay. Coming back from
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

  // Where the model asked focus to go. A request made while BO-04 was not on screen is not for
  // this mount, and one made while the session is away waits for the same manager's return.
  const focus = state.focus;
  const handled = useRef(focus?.n ?? 0);
  useEffect(() => {
    if (focus === null || focus.n <= handled.current) return;
    if (!signedIn || root.current === null) return;
    handled.current = focus.n;
    const area = root.current;
    const pick = (selector: string) => area.querySelector<HTMLElement>(selector);
    const found =
      focus.target === 'name'
        ? pick('#item-name')
        : focus.target === 'category'
          ? pick('#item-category')
          : focus.target === 'price'
            ? pick('#item-price')
            : focus.target === 'notice'
              ? pick('#form-notice')
              : focus.target === 'save'
                ? pick('#save-item')
                : focus.target === 'retry-load'
                  ? pick('#retry-load')
                  : pick('#return-menu');
    found?.focus();
  }, [focus, signedIn]);

  // Escape leaves BO-04 as Cancel does, unless a modal (M-6, the decision) is open.
  const live = useRef(signedIn);
  live.current = signedIn;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !live.current) return;
      const now = model.getState();
      if (now.form === null || now.decision || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      model.cancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [model]);

  const { subject, form, read } = state;
  const uncertain = model.guard.status() === 'uncertain';
  const decision = <Decision open={state.decision} body={uncertain ? DEPARTURE_BODY_UNCERTAIN : DEPARTURE_BODY} onStay={() => model.stay()} onDiscard={() => model.discard()} />;
  const back = goMenu(() => model.returnToMenu());
  const returnLink = (
    <div className="office-actions">
      <a id="return-menu" className="office-button primary" href={PATHS.menu} onClick={back}>
        {RETURN_TO_MENU}
      </a>
    </div>
  );

  // The screen reached with no item chosen: a reload, a typed address, browser Forward after
  // leaving, or a different manager's sign-in. Nothing is read and nothing else is drawn.
  if (subject === null) {
    return (
      <div ref={root}>
        <div className="office-heading">
          <h1 id="item-title">{ITEM_EDITOR}</h1>
        </div>
        <p id="item-context">{NO_SUBJECT}</p>
        {returnLink}
        {decision}
      </div>
    );
  }

  if (form === null) {
    return (
      <div ref={root}>
        <div className="office-heading">
          <h1 id="item-title">{ITEM_EDITOR}</h1>
        </div>
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
              <strong>{READ_FAILED.title}</strong>
              <p>{READ_FAILED.body}</p>
              <button type="button" id="retry-load" className="office-button" onClick={() => model.retryLoad()}>
                {TRY_AGAIN}
              </button>
            </div>
          </div>
        )}
        {read === 'ready' && state.missing && (
          <div id="read-state">
            <div className="office-notice" role="alert">
              <strong>{NOT_FOUND.title}</strong>
              <p>{NOT_FOUND.body}</p>
              {returnLink}
            </div>
          </div>
        )}
        {decision}
      </div>
    );
  }

  const pending = state.command !== null && !state.command.discarded && state.command.formKey === form.key;
  const create = form.kind === 'create';
  const stored = form.stored;
  const storedCategory = stored === null ? undefined : state.categories.find((c) => c.categoryId === stored.categoryId);
  const notice = noticeOf(form, pending);
  const choosing = form.offered !== null;
  const readOnlyRetry = form.notice === 'stale-unread' || form.notice === 'unknown-unread';
  const errorsShown = form.errors.name !== null || form.errors.category !== null || form.errors.price !== null;
  const saveOff = pending || choosing || form.notice === 'stale-unread' || errorsShown;
  const hint = pending
    ? HINT_PENDING
    : choosing || form.notice === 'stale-unread'
      ? HINT_STALE
      : form.categoryRefused && form.errors.category !== null
        ? HINT_CATEGORY
        : errorsShown
          ? HINT_ERRORS
          : HINT_DEFAULT;
  const holder = holderOf(state);
  const holderArchived = holder !== null && holder.category?.isActive === false;
  const options = categoryOptions(state.categories, form.draft.categoryId, stored?.categoryId ?? null);
  const nameError =
    form.errors.name === null ? null : form.errors.name === 'duplicate' && holderArchived ? NAME_DUPLICATE_ARCHIVED : nameText[form.errors.name];
  const categoryError = form.errors.category === null ? null : form.errors.category === 'none' ? CATEGORY_NONE : CATEGORY_ARCHIVED;
  const priceError = form.errors.price === null ? null : priceText_[form.errors.price];
  const facts = create ? NEW_FACTS : readOnlyRetry ? '' : versionFacts(state.readVersion ?? form.base ?? 0);
  const describe = (id: string, error: string | null, help: string) => (error === null ? help : `${id}-error ${help}`);
  const field = (key: FieldKey) => () => model.noteField(key);

  return (
    <div ref={root}>
      <div className="office-heading">
        <h1 id="item-title">{create || stored === null ? NEW_ITEM_TITLE : stored.name}</h1>
        <p id="item-status">{create || stored === null ? NOT_SAVED_YET : statusText(stored, storedCategory)}</p>
      </div>
      <p id="item-context">{contextText(stored, storedCategory)}</p>
      <form
        id="item-form"
        className="settings-form"
        method="post"
        noValidate
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          model.save();
        }}
      >
        <div className="settings-form__body">
          {notice !== null && (
            <div id="form-notice" tabIndex={-1} className="office-notice" data-kind={notice.kind} role={notice.role}>
              <strong>{notice.copy.title}</strong>
              <p>{notice.copy.body}</p>
              {readOnlyRetry && (
                <button type="button" className="office-button" id="retry-read" onClick={() => void model.retryRead()}>
                  {TRY_AGAIN}
                </button>
              )}
            </div>
          )}
          <p id="version-facts" className="settings-help">
            {facts}
          </p>
          <div className="item-work">
            <div className="item-draft">
              <section aria-labelledby="details-title">
                <h2 className="item-section-title" id="details-title">
                  {DETAILS}
                </h2>
                <dl className="item-money">
                  <div>
                    <dt>{CURRENCY_TERM}</dt>
                    <dd>{CURRENCY_VALUE}</dd>
                  </div>
                  <div>
                    <dt>{DECIMALS_TERM}</dt>
                    <dd>{DECIMALS_VALUE}</dd>
                  </div>
                </dl>
                <p className="settings-help">{MONEY_NOTE}</p>
                <div className="item-fields">
                  <div className="settings-field item-name-field">
                    <label htmlFor="item-name">{NAME_LABEL}</label>
                    <input
                      id="item-name"
                      name="name"
                      type="text"
                      className="office-field"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={form.draft.name}
                      disabled={pending}
                      aria-invalid={nameError === null ? undefined : true}
                      aria-describedby={describe('item-name', nameError, 'item-name-help')}
                      onFocus={field('name')}
                      onChange={(event) => model.setName(event.currentTarget.value)}
                    />
                    {nameError !== null && (
                      <span id="item-name-error" className="office-error">
                        {nameError}
                      </span>
                    )}
                    <p className="settings-help" id="item-name-help">
                      {NAME_HELP}
                    </p>
                    {holder !== null && (
                      <div id="duplicate-holder">
                        {holderLine(holder.item.name, holder.category?.name ?? '', holderArchived)}{' '}
                        <a
                          href={PATHS.menu}
                          onClick={goMenu(() => model.viewHolder())}
                        >
                          {VIEW_ITEM}
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="settings-field">
                    <label htmlFor="item-category">{CATEGORY_LABEL}</label>
                    <select
                      id="item-category"
                      name="category"
                      className="office-field"
                      value={form.draft.categoryId}
                      disabled={pending}
                      aria-invalid={categoryError === null ? undefined : true}
                      aria-describedby={describe('item-category', categoryError, 'item-category-help')}
                      onFocus={field('category')}
                      onChange={(event) => model.setCategory(event.currentTarget.value)}
                    >
                      <option value="">{CATEGORY_FIRST}</option>
                      {options.map((option) => (
                        <option key={option.categoryId} value={option.categoryId} disabled={option.disabled}>
                          {option.archived ? archivedCategoryOption(option.name) : option.name}
                        </option>
                      ))}
                    </select>
                    {categoryError !== null && (
                      <span id="item-category-error" className="office-error">
                        {categoryError}
                      </span>
                    )}
                    <p className="settings-help" id="item-category-help">
                      {CATEGORY_HELP}
                    </p>
                  </div>
                  <div className="settings-field">
                    <label htmlFor="item-price">{PRICE_LABEL}</label>
                    <input
                      id="item-price"
                      name="price"
                      type="text"
                      inputMode="numeric"
                      className="office-field"
                      autoComplete="off"
                      spellCheck={false}
                      value={form.draft.price}
                      disabled={pending}
                      aria-invalid={priceError === null ? undefined : true}
                      aria-describedby={describe('item-price', priceError, 'item-price-help')}
                      onFocus={field('price')}
                      onBlur={() => model.blurPrice()}
                      onChange={(event) => model.setPrice(event.currentTarget.value)}
                    />
                    {priceError !== null && (
                      <span id="item-price-error" className="office-error">
                        {priceError}
                      </span>
                    )}
                    <p className="settings-help" id="item-price-help">
                      {PRICE_HELP}
                    </p>
                  </div>
                </div>
              </section>
            </div>
            {form.offered !== null && <Comparison form={form} offered={form.offered} state={state} model={model} />}
          </div>
        </div>
        <footer className="office-dialog__foot item-footer">
          <p id="save-hint" className="settings-foot-hint">
            {hint}
          </p>
          <button type="button" id="cancel-edit" className="office-button" onClick={() => model.cancel()}>
            {CANCEL}
          </button>
          <button
            type="submit"
            id="save-item"
            className="office-button primary"
            aria-disabled={saveOff ? 'true' : undefined}
            aria-describedby="save-hint"
          >
            {SAVE}
          </button>
        </footer>
      </form>
      {decision}
    </div>
  );
}

/** *Current item*: what a reread showed, each value that differs from the draft marked. */
function Comparison({ form, offered, state, model }: { form: Form; offered: NonNullable<Form['offered']>; state: ItemState; model: ItemModel }) {
  const { item } = offered;
  const category = state.categories.find((c) => c.categoryId === item.categoryId);
  const draftPrice = checkPrice(form.draft.price, 'base');
  const rows: Array<{ term: string; value: string; differs: boolean }> = [
    { term: TERM_NAME, value: item.name, differs: form.draft.name.trim() !== item.name },
    { term: TERM_CATEGORY, value: category?.name ?? '', differs: form.draft.categoryId !== item.categoryId },
    { term: TERM_PRICE, value: priceText(item.basePrice), differs: draftPrice.error !== null || draftPrice.value !== item.basePrice },
    { term: TERM_STATUS, value: itemFacts(item), differs: false },
  ];
  return (
    <aside id="comparison" className="item-current" aria-labelledby="current-title">
      <h2 id="current-title">{CURRENT_ITEM}</h2>
      <div id="current-values">
        <dl>
          {rows.map((row) => (
            <div key={row.term}>
              <dt>{row.term}</dt>
              <dd data-differs={row.differs ? 'true' : undefined}>
                {row.value}
                {row.differs && <span>{DIFFERS}</span>}
              </dd>
            </div>
          ))}
        </dl>
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
    </aside>
  );
}

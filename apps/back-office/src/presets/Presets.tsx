import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type FormEvent } from 'react';
import { DEPARTURE_BODY, DEPARTURE_BODY_UNCERTAIN } from '../copy.js';
import { Decision } from '../forms/Decision.js';
import { INSTALLATION_CURRENCY, INSTALLATION_MINOR_UNIT_PRECISION } from '@pos/money';
import { useSession } from '../session/useSession.js';
import { TERM_CURRENCY, TERM_PRECISION, currencyText, precisionText } from '../settings/copy.js';
import { workGuard } from '../work/guard.js';
import {
  AMOUNT_EMPTY,
  AMOUNT_FORMAT,
  AMOUNT_HELP,
  AMOUNT_LABEL,
  AMOUNT_NEGATIVE,
  AMOUNT_OVER,
  CANCEL,
  COLUMN_ACTIONS,
  COLUMN_DISCOUNT,
  COLUMN_NAME,
  COLUMN_STATUS,
  CONTEXT,
  CREATE_CONTEXT,
  DEACTIVATE,
  DEACTIVATE_BODY,
  EDIT,
  EMPTY_BODY,
  EMPTY_TITLE,
  FIXED_NOTE,
  FOOT_HINT,
  FOOT_HINT_PENDING,
  FOOT_HINT_STALE,
  FOOT_HINT_STALE_UNREAD,
  FORM_FAILED,
  INACTIVE_CONTEXT,
  KEEP,
  KEEP_ACTIVE,
  KIND_FIXED,
  KIND_LEGEND,
  KIND_PERCENTAGE,
  LIST_CAPTION,
  LIST_LABEL,
  LIST_PARTIAL,
  LOADING,
  NAME_CONTROL,
  NAME_DUPLICATE,
  NAME_DUPLICATE_REACTIVATE,
  NAME_EMPTY,
  NAME_HELP,
  NAME_IN_USE,
  NAME_LABEL,
  NAME_LONG,
  NEW_PRESET,
  OUTCOME_UNKNOWN,
  OUTCOME_UNKNOWN_UNREAD,
  PERCENT_DECIMALS,
  PERCENT_EMPTY,
  PERCENT_FORMAT,
  PERCENT_HELP,
  PERCENT_LABEL,
  PERCENT_NEGATIVE,
  PERCENT_OVER,
  PERCENT_SUFFIX,
  PRESETS,
  READ_FAILED,
  REACTIVATE,
  SAME_VALUES,
  SAVE,
  SAVING,
  SHARED_CONTEXT,
  STALE_UNREAD,
  STATUS_ACTIVE,
  STATUS_INACTIVE,
  TRY_AGAIN,
  USE_CURRENT,
  WAITING,
  currentKind,
  currentName,
  currentStatus,
  currentValue,
  deactivateName,
  deactivateTitle,
  deactivated,
  deactivating,
  editName,
  editTitle,
  facts,
  keepActiveName,
  outcomeAfterChoice,
  outcomeUnknownNewer,
  reactivateName,
  reactivated,
  reactivating,
  saved,
  staleNotice,
  stateFailed,
  stateSessionRefused,
  stateUnknown,
  stateUnknownUnread,
  unchanged,
  versionLine,
} from './copy.js';
import { holderOf, type Editor, type FieldError, type PageStatus, type PresetsModel, type PresetsState } from './model.js';
import { checkDraft, countsOf, currentValueText, inOrder, kindText, sameValue, valueText } from './value.js';

// BO-07, as DESIGN-022 draws it (docs/design/visual-directions/frost/back-office/presets.html): the
// presets in one table, active first, and beside it a non-modal panel for the one form. The panel
// is a named `role="dialog"` with `aria-modal="false"`, so the rail, Log out and the list stay live
// while it is open. The stay-or-discard decision (`forms/Decision.tsx`) and the deactivation
// confirmation are modal `<dialog>`s that follow the working-area dialog rule (C2 section 7). An
// off action is `aria-disabled`, never `disabled`, as in BO-03, BO-05 and BO-08.

const CLOSED_BY_NONE = { closedby: 'none' } as const;

const nameText: Record<FieldError, string> = {
  empty: NAME_EMPTY,
  long: NAME_LONG,
  control: NAME_CONTROL,
  duplicate: NAME_DUPLICATE,
  'duplicate-reactivate': NAME_DUPLICATE_REACTIVATE,
};
const percentText: Record<NonNullable<Editor['percentError']>, string> = {
  empty: PERCENT_EMPTY,
  negative: PERCENT_NEGATIVE,
  format: PERCENT_FORMAT,
  decimals: PERCENT_DECIMALS,
  over: PERCENT_OVER,
};
const amountText: Record<NonNullable<Editor['amountError']>, string> = {
  empty: AMOUNT_EMPTY,
  negative: AMOUNT_NEGATIVE,
  format: AMOUNT_FORMAT,
  bounds: AMOUNT_OVER,
};

function pageText(page: PageStatus): string {
  switch (page.kind) {
    case 'saved':
      return saved(page.name);
    case 'unchanged':
      return unchanged(page.name, page.version);
    case 'pending':
      return page.action === 'deactivate' ? deactivating(page.name) : reactivating(page.name);
    case 'deactivated':
      return deactivated(page.name);
    case 'reactivated':
      return reactivated(page.name);
    case 'failed':
      return stateFailed(page.name);
    case 'session':
      return stateSessionRefused(page.name);
    case 'unknown':
      return page.unread ? stateUnknownUnread(page.name) : stateUnknown(page.name);
    case 'waiting':
      return WAITING;
  }
}

const inertProps = (inert: boolean) => ({
  'aria-disabled': inert ? ('true' as const) : undefined,
  tabIndex: inert ? -1 : undefined,
});

/** The view of the working area's BO-07 model (made in `Screens`); it draws what the model holds. */
export function Presets({ model }: { model: PresetsModel }) {
  const session = useSession();
  const state = useSyncExternalStore(model.subscribe, model.getState);
  const phase = session.phase;
  const signedIn = phase === 'signed-in';
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    model.shown();
  }, [model]);
  useEffect(() => workGuard.register(model.guard), [model]);
  useEffect(() => model.subscribe(workGuard.changed), [model]);

  // Coming back from BO-01 as the same manager: the panel is shown again with the draft
  // control focused, unless a decision or the confirmation was restored, which takes focus first.
  // Coming back from M-6: the frame has put focus back where it was; if that element is gone, the
  // work takes it.
  const before = useRef(phase);
  useEffect(() => {
    const was = before.current;
    before.current = phase;
    if (phase !== 'signed-in') return;
    if (was === 'signed-out') {
      const now = model.getState();
      if (!now.decision && now.confirm === null) model.refocus();
    } else if (was === 'idle' && (document.activeElement === null || document.activeElement === document.body)) {
      model.refocus();
    }
  }, [phase, model]);

  // Where the model asked focus to go. A request made while the session is away waits for the
  // same manager's return.
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
    if (target === 'name') found = pick('#preset-name');
    else if (target === 'percent') found = pick('#preset-percent');
    else if (target === 'amount') found = pick('#preset-amount');
    else if (target === 'notice') found = pick('#form-notice');
    else if (target === 'status') found = pick('#page-status');
    else if (target === 'save') found = pick('#save-preset');
    else if (target === 'new-preset') found = pick('#new-preset');
    else if ('edit' in target) found = pick(`[data-edit="${target.edit}"]`) ?? pick('#new-preset');
    else found = pick(`[data-toggle="${target.toggle}"]`) ?? pick('#new-preset');
    found?.focus();
  }, [focus, signedIn]);

  // Escape leaves the form as Cancel does, unless a modal (M-6, the decision, the confirmation) is open.
  const live = useRef(signedIn);
  live.current = signedIn;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !live.current) return;
      const now = model.getState();
      if (now.editor === null || now.decision || now.confirm !== null || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      model.cancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [model]);

  const { editor, command, page, read, presets } = state;
  const busy = command !== null;
  // The rows can be drawn when a read succeeded, or when an answer was applied to the rows the
  // client knew while a read stands failed (the alert stays, the counts are withheld).
  const usable = read === 'ready' || state.partial;
  const holder = holderOf(state);
  const uncertain = model.guard.status() === 'uncertain';
  const rows = inOrder(presets);
  const { active, inactive } = countsOf(presets);
  const noVersion = state.version === null;

  return (
    <div ref={root}>
      <div className="office-heading">
        <h1>{PRESETS}</h1>
        <button
          type="button"
          id="new-preset"
          className="office-button primary office-push"
          {...inertProps(busy || !usable)}
          onClick={() => model.openCreate()}
        >
          {NEW_PRESET}
        </button>
      </div>
      <p className="office-muted">{CONTEXT}</p>
      {read === 'ready' && state.latest !== null && (
        <p id="list-facts" className="settings-help">
          {facts(active, inactive, state.latest)}
        </p>
      )}

      {page !== null && (
        <div
          id="page-status"
          tabIndex={-1}
          className="office-notice office-space-top"
          data-kind={page.kind === 'failed' ? 'failure' : 'status'}
          role={page.kind === 'failed' ? 'alert' : 'status'}
        >
          {pageText(page)}
        </div>
      )}

      <div className={editor === null ? 'tables-workspace office-space-top' : 'tables-workspace editing office-space-top'}>
        <section aria-label={LIST_LABEL} id="preset-collection">
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
          {read === 'ready' && presets.length === 0 && (
            <div className="office-empty" id="empty-state">
              <div className="office-empty-title">{EMPTY_TITLE}</div>
              <p>{EMPTY_BODY}</p>
            </div>
          )}
          {usable && presets.length > 0 && (
            <table className="office-table" id="presets-list">
              <caption>{LIST_CAPTION}</caption>
              <thead>
                <tr>
                  <th scope="col">{COLUMN_NAME}</th>
                  <th scope="col" className="num">
                    {COLUMN_DISCOUNT}
                  </th>
                  <th scope="col">{COLUMN_STATUS}</th>
                  <th scope="col">{COLUMN_ACTIONS}</th>
                </tr>
              </thead>
              <tbody id="preset-rows">
                {rows.map((preset) => (
                  <tr
                    key={preset.presetId}
                    data-preset={preset.presetId}
                    data-active={preset.isActive}
                    data-selected={editor?.presetId === preset.presetId}
                  >
                    <td>
                      {preset.name}
                      {holder === preset.presetId && <span className="table-holder">{NAME_IN_USE}</span>}
                    </td>
                    <td className="num">
                      <span className="preset-value">{valueText(preset.value)}</span>
                      <span className="preset-kind">{kindText(preset.value.kind)}</span>
                    </td>
                    <td>{preset.isActive ? STATUS_ACTIVE : STATUS_INACTIVE}</td>
                    <td>
                      <button
                        type="button"
                        className="office-button small"
                        data-edit={preset.presetId}
                        aria-label={editName(preset.name, preset.isActive)}
                        {...inertProps(busy || noVersion)}
                        onClick={() => model.openEdit(preset.presetId)}
                      >
                        {EDIT}
                      </button>
                      {preset.isActive ? (
                        <button
                          type="button"
                          className="office-button small danger"
                          data-toggle={preset.presetId}
                          aria-label={deactivateName(preset.name)}
                          {...inertProps(busy)}
                          onClick={() => model.openDeactivate(preset.presetId)}
                        >
                          {DEACTIVATE}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="office-button small"
                          data-toggle={preset.presetId}
                          aria-label={reactivateName(preset.name)}
                          {...inertProps(busy)}
                          onClick={() => model.reactivate(preset.presetId)}
                        >
                          {REACTIVATE}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        {editor !== null && <EditorPanel editor={editor} state={state} model={model} />}
      </div>

      <Decision
        open={state.decision}
        body={uncertain ? DEPARTURE_BODY_UNCERTAIN : DEPARTURE_BODY}
        onStay={() => model.stay()}
        onDiscard={() => model.discard()}
      />
      <DeactivateConfirm model={model} state={state} phase={phase} />
    </div>
  );
}

/** What the notice of an open form says, and how it is announced. */
function noticeOf(editor: Editor, pendingSave: boolean) {
  if (pendingSave) return { kind: 'pending', role: 'status', copy: SAVING } as const;
  switch (editor.notice) {
    case null:
      return null;
    case 'failure':
      return { kind: 'failure', role: 'alert', copy: FORM_FAILED } as const;
    case 'unknown':
      return { kind: 'unknown', role: 'status', copy: OUTCOME_UNKNOWN } as const;
    case 'unknown-unread':
      return { kind: 'unknown', role: 'status', copy: OUTCOME_UNKNOWN_UNREAD } as const;
    case 'unknown-newer':
      return { kind: 'unknown', role: 'status', copy: outcomeUnknownNewer(editor.offered?.version ?? editor.base ?? 0) } as const;
    case 'stale':
      return { kind: 'stale', role: 'alert', copy: staleNotice(editor.offered?.version ?? editor.base ?? 0) } as const;
    case 'stale-unread':
      return { kind: 'stale', role: 'alert', copy: STALE_UNREAD } as const;
    case 'after-choice':
      return { kind: 'unknown', role: 'status', copy: outcomeAfterChoice(editor.base ?? 0) } as const;
  }
}

function EditorPanel({ editor, state, model }: { editor: Editor; state: PresetsState; model: PresetsModel }) {
  const { command, read } = state;
  const pendingSave = command !== null && !command.discarded && command.editorKey === editor.key;
  const chooses = editor.offered !== null;
  // The screen has one command slot: any command in flight holds the draft's controls, not only
  // this form's own save. `pendingSave` stays for the Saving notice.
  const held = command !== null;
  const saveOff = held || chooses || editor.notice === 'stale-unread';
  const notice = noticeOf(editor, pendingSave);
  const { draft } = editor;
  const create = editor.presetId === null;
  const context = `${create ? CREATE_CONTEXT : editor.active ? '' : INACTIVE_CONTEXT} ${SHARED_CONTEXT}`.trim();
  const hint = pendingSave
    ? FOOT_HINT_PENDING
    : chooses
      ? FOOT_HINT_STALE
      : editor.notice === 'stale-unread'
        ? FOOT_HINT_STALE_UNREAD
        : FOOT_HINT;

  // What the reread showed beside the draft: only the fields that differ are marked.
  const { offered } = editor;
  const checked = offered === null ? null : checkDraft(draft);
  const nameDiffers = offered !== null && checked !== null && checked.name !== offered.name;
  const kindDiffers = offered !== null && draft.kind !== offered.value.kind;
  const valueDiffers = offered !== null && checked !== null && (checked.value === null || !sameValue(checked.value, offered.value));

  return (
    <section className="table-editor" id="preset-editor" role="dialog" aria-modal="false" aria-labelledby="editor-title">
      <header className="office-dialog__head">
        <h2 id="editor-title">{create ? NEW_PRESET : editTitle(editor.openedName)}</h2>
      </header>
      <form
        id="preset-form"
        method="post"
        noValidate
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          model.save();
        }}
      >
        <div className="office-dialog__body">
          <p id="form-context">{context}</p>
          {notice !== null && (
            <div id="form-notice" tabIndex={-1} className="office-notice" data-kind={notice.kind} role={notice.role}>
              <strong>{notice.copy.title}</strong>
              <p>{notice.copy.body}</p>
            </div>
          )}
          {read !== 'failed' && state.latest !== null && (
            <p id="form-version" className="settings-help">
              {versionLine(state.latest)}
            </p>
          )}

          <div className="settings-field office-space-top">
            <label htmlFor="preset-name">{NAME_LABEL}</label>
            <input
              id="preset-name"
              name="name"
              type="text"
              className="office-field"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={draft.name}
              disabled={held}
              aria-invalid={editor.nameError === null ? undefined : true}
              aria-describedby={editor.nameError === null ? 'preset-name-help' : 'preset-name-help preset-name-error'}
              onChange={(event) => model.setName(event.currentTarget.value)}
            />
            {editor.nameError !== null && (
              <span id="preset-name-error" className="office-error">
                {nameText[editor.nameError]}
              </span>
            )}
            <p className="settings-help" id="preset-name-help">
              {NAME_HELP}
            </p>
            {nameDiffers && offered !== null && (
              <p className="settings-current" id="current-name">
                {currentName(offered.name)}
              </p>
            )}
          </div>

          <fieldset className="office-radio" id="kind-choice">
            <legend>{KIND_LEGEND}</legend>
            <label>
              <input
                type="radio"
                name="kind"
                id="kind-percent"
                value="PERCENTAGE"
                checked={draft.kind === 'PERCENTAGE'}
                disabled={held}
                onChange={() => model.setKind('PERCENTAGE')}
              />
              {KIND_PERCENTAGE}
            </label>
            <label>
              <input
                type="radio"
                name="kind"
                id="kind-fixed"
                value="FIXED"
                checked={draft.kind === 'FIXED'}
                disabled={held}
                onChange={() => model.setKind('FIXED')}
              />
              {KIND_FIXED}
            </label>
          </fieldset>
          {kindDiffers && offered !== null && (
            <p className="settings-current" id="current-kind">
              {currentKind(kindText(offered.value.kind))}
            </p>
          )}

          {draft.kind === 'PERCENTAGE' ? (
            <div className="settings-field office-space-top" id="percent-field">
              <label htmlFor="preset-percent">{PERCENT_LABEL}</label>
              <div className="settings-rate">
                <input
                  id="preset-percent"
                  name="percent"
                  type="text"
                  inputMode="decimal"
                  className="office-field"
                  autoComplete="off"
                  spellCheck={false}
                  value={draft.percent}
                  disabled={held}
                  aria-invalid={editor.percentError === null ? undefined : true}
                  aria-describedby={editor.percentError === null ? 'preset-percent-help' : 'preset-percent-help preset-percent-error'}
                  onChange={(event) => model.setPercent(event.currentTarget.value)}
                />
                <span aria-hidden="true">{PERCENT_SUFFIX}</span>
              </div>
              {editor.percentError !== null && (
                <span id="preset-percent-error" className="office-error">
                  {percentText[editor.percentError]}
                </span>
              )}
              <p className="settings-help" id="preset-percent-help">
                {PERCENT_HELP}
              </p>
            </div>
          ) : (
            <div id="amount-field">
              <dl className="preset-money">
                <div>
                  <dt>{TERM_CURRENCY}</dt>
                  <dd>{currencyText(INSTALLATION_CURRENCY)}</dd>
                </div>
                <div>
                  <dt>{TERM_PRECISION}</dt>
                  <dd>{precisionText(INSTALLATION_MINOR_UNIT_PRECISION)}</dd>
                </div>
              </dl>
              <p className="settings-help">{FIXED_NOTE}</p>
              <div className="settings-field office-space-top">
                <label htmlFor="preset-amount">{AMOUNT_LABEL}</label>
                <input
                  id="preset-amount"
                  name="amount"
                  type="text"
                  inputMode="numeric"
                  className="office-field"
                  autoComplete="off"
                  spellCheck={false}
                  value={draft.amount}
                  disabled={held}
                  aria-invalid={editor.amountError === null ? undefined : true}
                  aria-describedby={editor.amountError === null ? 'preset-amount-help' : 'preset-amount-help preset-amount-error'}
                  onChange={(event) => model.setAmount(event.currentTarget.value)}
                />
                {editor.amountError !== null && (
                  <span id="preset-amount-error" className="office-error">
                    {amountText[editor.amountError]}
                  </span>
                )}
                <p className="settings-help" id="preset-amount-help">
                  {AMOUNT_HELP}
                </p>
              </div>
            </div>
          )}
          {valueDiffers && offered !== null && (
            <p className="settings-current" id="current-value">
              {currentValue(currentValueText(offered.value))}
            </p>
          )}

          {offered !== null && (
            <div id="stale-choices">
              {!nameDiffers && !kindDiffers && !valueDiffers && (
                <p className="settings-help" id="current-same">
                  {SAME_VALUES}
                </p>
              )}
              <p className="settings-help" id="current-status">
                {currentStatus(offered.active)}
              </p>
              <div className="office-actions office-space-top">
                <button type="button" className="office-button" id="keep-draft" onClick={() => model.keepMine()}>
                  {KEEP}
                </button>
                <button type="button" className="office-button" id="use-current" onClick={() => model.useCurrent()}>
                  {USE_CURRENT}
                </button>
              </div>
            </div>
          )}
        </div>
        <footer className="office-dialog__foot preset-footer">
          <p className="settings-foot-hint" id="save-hint">
            {hint}
          </p>
          <button type="button" id="cancel-preset" className="office-button" onClick={() => model.cancel()}>
            {CANCEL}
          </button>
          <button
            type="submit"
            id="save-preset"
            className="office-button primary"
            {...inertProps(saveOff)}
            aria-describedby="save-hint"
          >
            {SAVE}
          </button>
        </footer>
      </form>
    </section>
  );
}

/** The deactivation confirmation: a modal in the working area, held and reopened like the decision. */
function DeactivateConfirm({
  model,
  state,
  phase,
}: {
  model: PresetsModel;
  state: PresetsState;
  phase: ReturnType<typeof useSession>['phase'];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const { confirm } = state;
  // Wanted open only while the frame is shown. At BO-01 it is closed, and its state kept.
  const wanted = confirm !== null && (phase === 'signed-in' || phase === 'idle');
  const meant = useRef(wanted);
  meant.current = wanted;

  useLayoutEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (wanted && !element.open) {
      element.showModal();
      keep.current?.focus();
    } else if (!wanted && element.open) {
      element.close();
    }
  }, [wanted]);

  return (
    <dialog
      ref={dialog}
      className="office-dialog"
      id="deactivate-confirm"
      aria-labelledby="deactivate-title"
      aria-describedby="deactivate-copy"
      {...CLOSED_BY_NONE}
      onCancel={(event) => {
        // Escape means Keep active.
        event.preventDefault();
        if (meant.current) model.confirmKeep();
      }}
      onClose={() => {
        // Closed by anything but this component (a second Escape in some engines): reopen it.
        const element = dialog.current;
        if (meant.current && element !== null && !element.open) {
          element.showModal();
          keep.current?.focus();
        }
      }}
    >
      {confirm !== null && (
        <>
          <header className="office-dialog__head">
            <h2 id="deactivate-title">{deactivateTitle(confirm.name)}</h2>
          </header>
          <div className="office-dialog__body">
            <p id="deactivate-copy">{DEACTIVATE_BODY}</p>
          </div>
          <footer className="office-dialog__foot">
            <button
              ref={keep}
              type="button"
              id="keep-active"
              className="office-button"
              aria-label={keepActiveName(confirm.name)}
              onClick={() => model.confirmKeep()}
            >
              {KEEP_ACTIVE}
            </button>
            <button
              type="button"
              id="confirm-deactivate"
              className="office-button danger final"
              aria-label={deactivateName(confirm.name)}
              onClick={() => model.confirmDeactivate()}
            >
              {DEACTIVATE}
            </button>
          </footer>
        </>
      )}
    </dialog>
  );
}

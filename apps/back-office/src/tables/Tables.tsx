import { useEffect, useRef, useSyncExternalStore, type FormEvent } from 'react';
import {
  CREATE_CONTEXT,
  DEPARTURE_BODY,
  DEPARTURE_BODY_UNCERTAIN,
  EMPTY_BODY,
  EMPTY_TITLE,
  FORM_FAILED,
  LABEL_CONTROL,
  LABEL_DUPLICATE,
  LABEL_DUPLICATE_REACTIVATE,
  LABEL_EMPTY,
  LABEL_HELP,
  LABEL_IN_USE,
  LABEL_LONG,
  LABEL_NAME,
  LIST_CAPTION,
  LIST_PARTIAL,
  LOADING,
  NEW_TABLE,
  OUTCOME_UNKNOWN,
  OUTCOME_UNKNOWN_UNREAD,
  READ_FAILED,
  RENAME_ACTIVE_CONTEXT,
  RENAME_INACTIVE_CONTEXT,
  SAVING,
  TABLES,
  WAITING,
  counts,
  deactivated,
  deactivating,
  editTitle,
  reactivated,
  reactivating,
  saved,
  statusFailed,
  statusSessionRefused,
  statusUnknown,
  statusUnknownUnread,
} from '../copy.js';
import { Decision } from '../forms/Decision.js';
import { useSession } from '../session/useSession.js';
import { workGuard } from '../work/guard.js';
import { ordered, type FieldError, type PageStatus, type TablesModel } from './model.js';

// BO-05, as DESIGN-017 draws it (docs/design/visual-directions/frost/back-office/tables.html):
// the list, and beside it a non-modal panel for the one form. The panel is a named
// `role="dialog"` with `aria-modal="false"`, so the rail, Log out and the list stay live
// while it is open. Only the stay-or-discard decision is a modal `<dialog>`, and it is
// the one thing here that follows the working-area dialog rule (consult C2 section 7): open
// only while the frame is shown, closed with `close()` and its state kept when the session
// reaches BO-01, reopened with `showModal()` and focus on Stay when the same manager signs
// in again, left open behind M-6, and destroyed with the area's key for anyone else.

const fieldText: Record<FieldError, string> = {
  empty: LABEL_EMPTY,
  long: LABEL_LONG,
  control: LABEL_CONTROL,
  duplicate: LABEL_DUPLICATE,
  'duplicate-reactivate': LABEL_DUPLICATE_REACTIVATE,
};

function pageText(page: PageStatus): string {
  switch (page.kind) {
    case 'saved':
      return saved(page.label);
    case 'deactivated':
      return deactivated(page.label);
    case 'reactivated':
      return reactivated(page.label);
    case 'deactivating':
      return deactivating(page.label);
    case 'reactivating':
      return reactivating(page.label);
    case 'failed':
      return statusFailed(page.label);
    case 'session':
      return statusSessionRefused(page.label);
    case 'unknown':
      return page.unread ? statusUnknownUnread(page.label) : statusUnknown(page.label);
    case 'waiting':
      return WAITING;
  }
}

/** The view of the working area's BO-05 model (made in `Screens`); it draws what the model holds. */
export function Tables({ model }: { model: TablesModel }) {
  const session = useSession();
  const state = useSyncExternalStore(model.subscribe, model.getState);
  const phase = session.phase;
  const signedIn = phase === 'signed-in';
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => model.shown(), [model]);
  useEffect(() => workGuard.register(model.guard), [model]);
  useEffect(() => model.subscribe(workGuard.changed), [model]);

  // Coming back from BO-01 as the same manager: the panel is shown again with the
  // unsaved value focused, unless a decision was restored, which takes focus on Stay.
  // Coming back from M-6: the frame has put focus back where it was; if that element is
  // gone, the work takes it.
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

  // Where the model asked focus to go.
  // A request made while Tables was not on screen is not for this mount.
  const focus = state.focus;
  const live = useRef(signedIn);
  live.current = signedIn;
  const handled = useRef(focus?.n ?? 0);
  useEffect(() => {
    if (focus === null || focus.n <= handled.current) return;
    handled.current = focus.n;
    if (!live.current || root.current === null) return;
    const area = root.current;
    const opener = () => area.querySelector<HTMLElement>('[data-opener]');
    const target = focus.target;
    const found =
      target === 'label'
        ? area.querySelector<HTMLElement>('#table-label')
        : target === 'notice'
          ? area.querySelector<HTMLElement>('#form-notice')
          : target === 'status'
            ? area.querySelector<HTMLElement>('#table-status')
            : target === 'opener'
              ? opener()
              : (area.querySelector<HTMLElement>(`[data-edit="${target.edit}"]`) ?? opener());
    found?.focus();
  }, [focus]);

  // Escape leaves the form as Cancel does, unless a modal (M-6, the decision) is open.
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

  const { editor, command, page, read, rows } = state;
  const pendingSave = editor !== null && command !== null && !command.discarded && command.editorKey === editor.key;
  const busy = command !== null;
  const sorted = ordered(rows);
  const active = rows.filter((row) => row.isActive).length;
  const holder = (rowId: string, isActive: boolean, label: string): boolean =>
    editor !== null &&
    (editor.error === 'duplicate' || editor.error === 'duplicate-reactivate') &&
    isActive &&
    rowId !== editor.recordId &&
    label.toLowerCase() === editor.draft.trim().toLowerCase();
  // The header's New table, or the empty state's: one at a time, so one name is on the page.
  // The rows can be drawn when a read succeeded, or when an answer was applied to the rows the
  // client knew while a read stands failed (the alert stays, the counts are withheld).
  const usable = read === 'ready' || state.partial;
  const emptyStart = read === 'ready' && rows.length === 0 && editor === null && !busy;

  return (
    <div ref={root}>
      <div className="office-heading">
        <h1>{TABLES}</h1>
        {read === 'ready' && <p id="table-count">{counts(active, rows.length - active)}</p>}
        {!emptyStart && (
          <button
            type="button"
            className="office-button primary office-push"
            data-opener=""
            aria-disabled={!usable || busy ? 'true' : undefined}
            tabIndex={!usable || busy ? -1 : undefined}
            onClick={() => usable && model.openNew()}
          >
            {NEW_TABLE}
          </button>
        )}
      </div>

      {page !== null && (
        <div id="table-status" tabIndex={-1} className="office-notice" role="status">
          {pageText(page)}
        </div>
      )}

      <div className={editor === null ? 'tables-workspace' : 'tables-workspace editing'}>
        <section aria-label="Table list">
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
                  Try again
                </button>
              </div>
            </div>
          )}
          {read === 'ready' && rows.length === 0 && (
            <div className="office-empty">
              <div className="office-empty-title">{EMPTY_TITLE}</div>
              <p>{EMPTY_BODY}</p>
              {emptyStart && (
                <button type="button" className="office-button" data-opener="" onClick={() => model.openNew()}>
                  {NEW_TABLE}
                </button>
              )}
            </div>
          )}
          {usable && rows.length > 0 && (
            <table className="office-table" id="tables-list">
              <caption>{LIST_CAPTION}</caption>
              <thead>
                <tr>
                  <th scope="col">Label</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr
                    key={row.tableId}
                    data-active={row.isActive}
                    data-selected={row.tableId === editor?.recordId}
                  >
                    <td>
                      {row.label}
                      {holder(row.tableId, row.isActive, row.label) && <span className="table-holder">{LABEL_IN_USE}</span>}
                    </td>
                    <td className="table-status">{row.isActive ? 'Active' : 'Inactive'}</td>
                    <td>
                      <button
                        type="button"
                        className="office-button small"
                        data-edit={row.tableId}
                        aria-label={`Edit ${row.label} — ${row.isActive ? 'active' : 'inactive'}`}
                        aria-disabled={busy ? 'true' : undefined}
                        tabIndex={busy ? -1 : undefined}
                        onClick={() => model.openEdit(row.tableId)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="office-button small"
                        aria-label={`${row.isActive ? 'Deactivate' : 'Reactivate'} ${row.label}`}
                        aria-disabled={busy ? 'true' : undefined}
                        tabIndex={busy ? -1 : undefined}
                        onClick={() => model.changeStatus(row.tableId)}
                      >
                        {row.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {editor !== null && (
          <section className="table-editor" role="dialog" aria-modal="false" aria-labelledby="editor-title">
            <header className="office-dialog__head">
              <h2 id="editor-title">{editor.recordId === null ? NEW_TABLE : editTitle(editor.openedLabel)}</h2>
            </header>
            <form
              id="table-form"
              method="post"
              noValidate
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                model.save();
              }}
            >
              <div className="office-dialog__body">
                <p id="editor-context">
                  {editor.recordId === null ? CREATE_CONTEXT : editor.active ? RENAME_ACTIVE_CONTEXT : RENAME_INACTIVE_CONTEXT}
                </p>
                {(pendingSave || editor.notice !== null) && (
                  <div
                    id="form-notice"
                    tabIndex={-1}
                    className="office-notice"
                    data-kind={pendingSave ? 'pending' : editor.notice === 'failure' ? 'failure' : 'unknown'}
                    role={!pendingSave && editor.notice === 'failure' ? 'alert' : 'status'}
                  >
                    {(() => {
                      const copy = pendingSave
                        ? SAVING
                        : editor.notice === 'failure'
                          ? FORM_FAILED
                          : editor.notice === 'unknown-unread'
                            ? OUTCOME_UNKNOWN_UNREAD
                            : OUTCOME_UNKNOWN;
                      return (
                        <>
                          <strong>{copy.title}</strong>
                          <p>{copy.body}</p>
                        </>
                      );
                    })()}
                  </div>
                )}
                <label htmlFor="table-label">{LABEL_NAME}</label>
                <input
                  id="table-label"
                  name="label"
                  type="text"
                  className="office-field"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={editor.draft}
                  disabled={pendingSave}
                  aria-invalid={editor.error === null ? undefined : true}
                  aria-describedby={editor.error === null ? 'label-help' : 'label-error label-help'}
                  onChange={(event) => model.setDraft(event.currentTarget.value)}
                />
                {editor.error !== null && (
                  <span id="label-error" className="office-error">
                    {fieldText[editor.error]}
                  </span>
                )}
                <p id="label-help" className="office-muted">
                  {LABEL_HELP}
                </p>
              </div>
              <footer className="office-dialog__foot">
                <button type="button" id="cancel-table" className="office-button" onClick={() => model.cancel()}>
                  Cancel
                </button>
                <button
                  type="submit"
                  id="save-table"
                  className="office-button primary"
                  aria-disabled={pendingSave ? 'true' : undefined}
                >
                  Save
                </button>
              </footer>
            </form>
          </section>
        )}
      </div>

      <Decision
        open={state.decision}
        body={model.guard.status() === 'uncertain' ? DEPARTURE_BODY_UNCERTAIN : DEPARTURE_BODY}
        onStay={() => model.stay()}
        onDiscard={() => model.discard()}
      />
    </div>
  );
}

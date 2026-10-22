import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type FormEvent } from 'react';
import {
  DEPARTURE_BODY,
  DEPARTURE_BODY_UNCERTAIN,
  DEPARTURE_TITLE,
  FORM_FAILED,
  SAVING,
  WAITING,
} from '../copy.js';
import { useSession } from '../session/useSession.js';
import { workGuard } from '../work/guard.js';
import {
  CANCEL,
  CHANGE,
  CHOOSE_FIRST,
  CONFIRM_ALSO,
  CONFIRM_BACK,
  CONFIRM_RULE,
  CONFIRM_SAVE,
  CONFIRM_TITLE,
  EDIT_CONTEXT,
  EDIT_TITLE,
  ENTER_SETTINGS,
  FACTS_FIRST_RUN,
  FIRST_RUN_BODY,
  FIRST_RUN_CONTEXT,
  FIRST_RUN_TITLE,
  FIXED_NOTE,
  GROUP_MONEY,
  GROUP_RATES,
  GROUP_RECEIPT,
  KEEP,
  KEPT_BODY,
  LOADING_SETTINGS,
  NOT_SET,
  RATES_AND_RECEIPT,
  RATE_EMPTY,
  RATE_REFUSED,
  RECEIPT_NOTE,
  ROW,
  SAVE,
  SETTINGS,
  SETTINGS_READ_FAILED,
  STALE_TITLE,
  TERM_CURRENCY,
  TERM_PRECISION,
  TEXT_REFUSED,
  TRY_AGAIN,
  UNKNOWN_FIRST_RUN_BODY,
  UNKNOWN_TITLE,
  UNKNOWN_UNREAD_BODY,
  USED_BODY,
  USE_CURRENT,
  currencyText,
  factsLine,
  keptTitle,
  nowInForce,
  precisionText,
  rateChange,
  saved,
  staleBody,
  unchanged,
  unknownChangedBody,
  unknownSameBody,
  usedTitle,
} from './copy.js';
import { FIELD_ORDER, RATE_KEYS, isRate, type FieldError, type FieldKey, type RateKey, type TextKey } from './fields.js';
import { savedValue, type Form, type PageStatus, type SettingsModel, type SettingsState } from './model.js';
import { percentText } from './rate.js';
import { whenText } from './when.js';

// BO-08's settings part, as DESIGN-018 draws it
// (docs/design/visual-directions/frost/back-office/settings.html): a read view in two columns
// that becomes one inline form when a Change is pressed, in place. The form is a plain region
// of the page (the rail, Log out and the read stay live while it is open); only the rate
// confirmation and the stay-or-discard decision are modal `<dialog>`s, and both follow the
// working-area dialog rule (consult C2 section 7): open only while the frame is shown, closed
// with `close()` and their state kept when the session reaches BO-01, reopened with
// `showModal()` for the same manager, left open behind M-6, and destroyed with the area's key
// for anyone else. The payment-methods part (S3) mounts as a second `<section>` below this one.

const CLOSED_BY_NONE = { closedby: 'none' } as const;

const FIELD_ID: Record<FieldKey, string> = {
  tax: 'tax-rate',
  service: 'service-rate',
  outlet: 'outlet-name',
  address: 'address',
  phone: 'phone',
  npwpd: 'npwpd',
  footer: 'footer',
};

function errorText(key: FieldKey, error: FieldError): string {
  if (isRate(key)) return error === 'empty' ? RATE_EMPTY[key] : (RATE_REFUSED[error as keyof typeof RATE_REFUSED] ?? '');
  return TEXT_REFUSED[key as TextKey][error as keyof (typeof TEXT_REFUSED)[TextKey]] ?? '';
}

const rateName = (key: RateKey): 'Tax rate' | 'Service charge' => (key === 'tax' ? 'Tax rate' : 'Service charge');

function pageText(page: PageStatus): string {
  switch (page.kind) {
    case 'saved':
      return saved(page.version);
    case 'unchanged':
      return unchanged(page.version);
    case 'waiting':
      return WAITING;
  }
}

/** The view of the working area's BO-08 model (made in `Screens`); it draws what the model holds. */
export function Settings({ model }: { model: SettingsModel }) {
  const session = useSession();
  const state = useSyncExternalStore(model.subscribe, model.getState);
  const phase = session.phase;
  const signedIn = phase === 'signed-in';
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => model.shown(), [model]);
  useEffect(() => workGuard.register(model.guard), [model]);
  useEffect(() => model.subscribe(workGuard.changed), [model]);

  // Coming back from BO-01 as the same manager: the form is shown again with the unsaved
  // value focused, unless a decision or the confirmation was restored, which takes focus first.
  // Coming back from M-6: the frame has put focus back where it was; if that element is gone,
  // the work takes it.
  const before = useRef(phase);
  useEffect(() => {
    const was = before.current;
    before.current = phase;
    if (phase !== 'signed-in') return;
    const now = model.getState();
    if (was === 'signed-out') {
      if (!now.decision && now.confirm === null) model.refocus();
    } else if (was === 'idle' && (document.activeElement === null || document.activeElement === document.body)) {
      model.refocus();
    }
  }, [phase, model]);

  // Where the model asked focus to go. A request made while Settings was not on screen is not
  // for this mount.
  const focus = state.focus;
  const live = useRef(signedIn);
  live.current = signedIn;
  const handled = useRef(focus?.n ?? 0);
  useEffect(() => {
    if (focus === null || focus.n <= handled.current) return;
    handled.current = focus.n;
    if (!live.current || root.current === null) return;
    const area = root.current;
    const target = focus.target;
    let found: HTMLElement | null;
    if (target === 'notice') found = area.querySelector<HTMLElement>('#settings-notice');
    else if (target === 'save') found = area.querySelector<HTMLElement>('#save-settings');
    else if (target === 'confirm') found = area.querySelector<HTMLElement>('#confirm-back');
    else if ('field' in target) found = area.querySelector<HTMLElement>(`#${FIELD_ID[target.field]}`);
    else
      found =
        area.querySelector<HTMLElement>(`[data-change="${target.change}"]`) ??
        area.querySelector<HTMLElement>('[data-change]') ??
        area.querySelector<HTMLElement>('[data-opener]');
    found?.focus();
  }, [focus]);

  // Escape leaves the form as Cancel does, unless a modal (M-6, the decision, the
  // confirmation) is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !live.current) return;
      const now = model.getState();
      if (now.form === null || now.decision || now.confirm !== null || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      model.cancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [model]);

  const { form, command, page, read, current, installation } = state;
  const busy = command !== null;
  const pendingSave = form !== null && command !== null && !command.discarded && command.formKey === form.key;
  const showFacts = read === 'ready' && !state.withheld;
  const firstRunEmpty = read === 'ready' && current === null && form === null;

  return (
    <div ref={root}>
      <div className="office-heading">
        <h1>{SETTINGS}</h1>
      </div>

      <section className="settings-part" aria-labelledby="settings-title">
        <header className="settings-part__head">
          <div>
            <h2 id="settings-title">{RATES_AND_RECEIPT}</h2>
            {showFacts && (
              <p id="version-facts">
                {current === null ? FACTS_FIRST_RUN : factsLine(current.version, whenText(current.createdAt), current.createdByName)}
              </p>
            )}
          </div>
        </header>

        {page !== null && (
          <div id="settings-status" tabIndex={-1} className="office-notice settings-status" role="status">
            {pageText(page)}
          </div>
        )}

        {read === 'loading' && (
          <div id="settings-read">
            <div className="office-notice" role="status">
              {LOADING_SETTINGS}
            </div>
          </div>
        )}
        {read === 'failed' && (
          <div id="settings-read">
            <div className="office-notice" role="alert">
              <strong>{SETTINGS_READ_FAILED.title}</strong>
              <p>{SETTINGS_READ_FAILED.body}</p>
              <button type="button" className="office-button" onClick={() => void model.retryRead()}>
                {TRY_AGAIN}
              </button>
            </div>
          </div>
        )}
        {firstRunEmpty && (
          <div id="settings-read">
            <div className="office-empty">
              <div className="office-empty-title">{FIRST_RUN_TITLE}</div>
              <p>{FIRST_RUN_BODY}</p>
              <button
                type="button"
                className="office-button"
                data-opener=""
                aria-disabled={busy ? 'true' : undefined}
                tabIndex={busy ? -1 : undefined}
                onClick={() => model.openEnter()}
              >
                {ENTER_SETTINGS}
              </button>
            </div>
          </div>
        )}

        {read === 'ready' && current !== null && form === null && installation !== null && (
          <ReadView state={state} model={model} />
        )}

        {form !== null && installation !== null && (
          <SettingsForm form={form} state={state} model={model} pendingSave={pendingSave} />
        )}
      </section>

      <RateConfirm model={model} state={state} phase={phase} />
      <Decision model={model} state={state} phase={phase} />
    </div>
  );
}

function ReadView({ state, model }: { state: SettingsState; model: SettingsModel }) {
  const { current, installation, command } = state;
  if (current === null || installation === null) return null;
  const busy = command !== null;
  const change = (key: FieldKey) => (
    <dd className="settings-action">
      <button
        type="button"
        className="office-button small"
        data-change={key}
        aria-label={ROW[key].change}
        aria-disabled={busy ? 'true' : undefined}
        tabIndex={busy ? -1 : undefined}
        onClick={() => model.openChange(key)}
      >
        {CHANGE}
      </button>
    </dd>
  );
  const term = (key: FieldKey) => (
    <dt>
      {ROW[key].term}
      {ROW[key].note !== undefined && <span>{ROW[key].note}</span>}
    </dt>
  );
  const detail = (key: TextKey) => {
    const value = savedValue(current, key);
    return (
      <div className="settings-row" key={key}>
        {term(key)}
        <dd
          className={key === 'address' ? 'settings-value settings-value--lines' : 'settings-value'}
          data-empty={value === null ? 'true' : undefined}
        >
          {value ?? NOT_SET}
        </dd>
        {change(key)}
      </div>
    );
  };
  return (
    <div id="settings-view" className="settings-columns">
      <div className="settings-stack">
        <section className="settings-group" aria-labelledby="money-label">
          <h3 className="settings-group__label" id="money-label">
            {GROUP_MONEY}
          </h3>
          <dl className="settings-list">
            <div className="settings-row">
              <dt>{TERM_CURRENCY}</dt>
              <dd className="settings-value">{currencyText(installation.currency)}</dd>
            </div>
            <div className="settings-row">
              <dt>{TERM_PRECISION}</dt>
              <dd className="settings-value">{precisionText(installation.minorUnitPrecision)}</dd>
            </div>
          </dl>
          <p className="settings-note">{FIXED_NOTE}</p>
        </section>
        <section className="settings-group" aria-labelledby="rates-label">
          <h3 className="settings-group__label" id="rates-label">
            {GROUP_RATES}
          </h3>
          <dl className="settings-list">
            {RATE_KEYS.map((key) => (
              <div className="settings-row" key={key}>
                {term(key)}
                <dd className="settings-value">{percentText(savedValue(current, key)!)}%</dd>
                {change(key)}
              </div>
            ))}
          </dl>
        </section>
      </div>
      <section className="settings-group" aria-labelledby="receipt-label">
        <h3 className="settings-group__label" id="receipt-label">
          {GROUP_RECEIPT}
        </h3>
        <p className="settings-note settings-note--top">{RECEIPT_NOTE}</p>
        <dl className="settings-list">{(['outlet', 'address', 'phone', 'npwpd', 'footer'] as const).map(detail)}</dl>
      </section>
    </div>
  );
}

function SettingsForm({
  form,
  state,
  model,
  pendingSave,
}: {
  form: Form;
  state: SettingsState;
  model: SettingsModel;
  pendingSave: boolean;
}) {
  const { installation } = state;
  if (installation === null) return null;
  const chooses = form.offered !== null;
  const firstRun = form.base === null;

  const notice = (() => {
    if (pendingSave) return { kind: 'pending', role: 'status', title: SAVING.title, body: SAVING.body } as const;
    switch (form.notice) {
      case null:
        return null;
      case 'failure':
        return { kind: 'failure', role: 'alert', title: FORM_FAILED.title, body: FORM_FAILED.body } as const;
      case 'stale': {
        const o = form.offered!;
        const differs = Object.keys(form.nowInForce).length > 0;
        return { kind: 'stale', role: 'alert', title: STALE_TITLE, body: staleBody(o.version, o.createdByName, whenText(o.createdAt), differs) } as const;
      }
      case 'unknown-changed': {
        const o = form.offered!;
        const differs = Object.keys(form.nowInForce).length > 0;
        return { kind: 'unknown', role: 'status', title: UNKNOWN_TITLE, body: unknownChangedBody(o.version, o.createdByName, whenText(o.createdAt), differs) } as const;
      }
      case 'unknown':
        return {
          kind: 'unknown',
          role: 'status',
          title: UNKNOWN_TITLE,
          body: state.current === null ? UNKNOWN_FIRST_RUN_BODY : unknownSameBody(state.current.version),
        } as const;
      case 'unknown-unread':
        return { kind: 'unknown', role: 'status', title: UNKNOWN_TITLE, body: UNKNOWN_UNREAD_BODY } as const;
      case 'kept':
        return { kind: 'kept', role: 'status', title: keptTitle(form.base!.version), body: KEPT_BODY } as const;
      case 'used':
        return { kind: 'used', role: 'status', title: usedTitle(form.base!.version), body: USED_BODY } as const;
    }
  })();

  return (
    <form
      id="settings-form"
      className="settings-form"
      method="post"
      noValidate
      aria-labelledby="settings-form-title"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        model.save();
      }}
    >
      <header className="office-dialog__head">
        <h3 id="settings-form-title">{firstRun ? ENTER_SETTINGS : EDIT_TITLE}</h3>
        <p id="settings-context">{firstRun ? FIRST_RUN_CONTEXT : EDIT_CONTEXT}</p>
      </header>
      <div className="settings-form__body">
        {notice !== null && (
          <div id="settings-notice" tabIndex={-1} className="office-notice" data-kind={notice.kind} role={notice.role}>
            <strong>{notice.title}</strong>
            <p>{notice.body}</p>
            {chooses && (
              <div className="office-actions" id="stale-choices">
                <button type="button" className="office-button" id="keep-draft" onClick={() => model.keepMine()}>
                  {KEEP}
                </button>
                <button type="button" className="office-button" id="use-current" onClick={() => model.useCurrent()}>
                  {USE_CURRENT}
                </button>
              </div>
            )}
            {form.notice === 'unknown-unread' && (
              <button type="button" className="office-button" id="retry-settings-read" onClick={() => void model.retryRead()}>
                {TRY_AGAIN}
              </button>
            )}
          </div>
        )}
        <div className="settings-columns">
          <div className="settings-stack">
            <section className="settings-fieldset" aria-labelledby="money-edit-label">
              <h4 className="settings-group__label" id="money-edit-label">
                {GROUP_MONEY}
              </h4>
              <dl className="settings-list">
                <div className="settings-row">
                  <dt>{TERM_CURRENCY}</dt>
                  <dd className="settings-value">{currencyText(installation.currency)}</dd>
                </div>
                <div className="settings-row">
                  <dt>{TERM_PRECISION}</dt>
                  <dd className="settings-value">{precisionText(installation.minorUnitPrecision)}</dd>
                </div>
              </dl>
              <p className="settings-note">{FIXED_NOTE}</p>
            </section>
            <section className="settings-fieldset" aria-labelledby="rates-edit-label">
              <h4 className="settings-group__label" id="rates-edit-label">
                {GROUP_RATES}
              </h4>
              {RATE_KEYS.map((key) => (
                <Field key={key} fieldKey={key} form={form} model={model} locked={pendingSave} />
              ))}
            </section>
          </div>
          <section className="settings-fieldset" aria-labelledby="receipt-edit-label">
            <h4 className="settings-group__label" id="receipt-edit-label">
              {GROUP_RECEIPT}
            </h4>
            <p className="settings-note settings-note--top">{RECEIPT_NOTE}</p>
            {FIELD_ORDER.filter((key) => !isRate(key)).map((key) => (
              <Field key={key} fieldKey={key} form={form} model={model} locked={pendingSave} />
            ))}
          </section>
        </div>
      </div>
      <footer className="office-dialog__foot">
        {chooses && (
          <p className="settings-foot-hint" id="save-hint">
            {CHOOSE_FIRST}
          </p>
        )}
        <button type="button" id="cancel-settings" className="office-button" onClick={() => model.cancel()}>
          {CANCEL}
        </button>
        <button
          type="submit"
          id="save-settings"
          className="office-button primary"
          aria-disabled={pendingSave || chooses ? 'true' : undefined}
          aria-describedby={chooses ? 'save-hint' : undefined}
        >
          {SAVE}
        </button>
      </footer>
    </form>
  );
}

function Field({
  fieldKey,
  form,
  model,
  locked,
}: {
  fieldKey: FieldKey;
  form: Form;
  model: SettingsModel;
  locked: boolean;
}) {
  const id = FIELD_ID[fieldKey];
  const error = form.errors[fieldKey];
  const now = form.nowInForce[fieldKey];
  const described = [error !== undefined ? `${id}-error` : null, now !== undefined ? `${id}-current` : null, `${id}-help`]
    .filter((part): part is string => part !== null)
    .join(' ');
  const common = {
    id,
    name: id,
    className: 'office-field',
    autoComplete: 'off',
    spellCheck: false,
    value: form.draft[fieldKey],
    disabled: locked,
    'aria-invalid': error === undefined ? undefined : (true as const),
    'aria-describedby': described,
    onFocus: () => model.focused(fieldKey),
  };
  const label = ROW[fieldKey].label;
  return (
    <div className="settings-field" data-field={fieldKey}>
      <label htmlFor={id}>{label}</label>
      {isRate(fieldKey) ? (
        <div className="settings-rate">
          <input {...common} inputMode="decimal" onChange={(event) => model.setField(fieldKey, event.currentTarget.value)} />
          <span aria-hidden="true">%</span>
        </div>
      ) : fieldKey === 'address' ? (
        <textarea
          {...common}
          className="office-field settings-textarea"
          rows={3}
          onChange={(event) => model.setField(fieldKey, event.currentTarget.value)}
        />
      ) : (
        <input
          {...common}
          inputMode={fieldKey === 'phone' ? 'tel' : undefined}
          onChange={(event) => model.setField(fieldKey, event.currentTarget.value)}
        />
      )}
      {error !== undefined && (
        <span id={`${id}-error`} className="office-error">
          {errorText(fieldKey, error)}
        </span>
      )}
      {now !== undefined && (
        <p id={`${id}-current`} className="settings-current">
          {nowInForce(now)}
        </p>
      )}
      <p id={`${id}-help`} className="settings-help">
        {ROW[fieldKey].help}
      </p>
    </div>
  );
}

/** The rate confirmation: a modal in the working area, held and reopened like the decision. */
function RateConfirm({
  model,
  state,
  phase,
}: {
  model: SettingsModel;
  state: SettingsState;
  phase: ReturnType<typeof useSession>['phase'];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const back = useRef<HTMLButtonElement>(null);
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
      back.current?.focus();
    } else if (!wanted && element.open) {
      element.close();
    }
  }, [wanted]);

  return (
    <dialog
      ref={dialog}
      className="office-dialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-changes confirm-rule"
      {...CLOSED_BY_NONE}
      onCancel={(event) => {
        // Escape means Back to editing.
        event.preventDefault();
        if (meant.current) model.confirmBack();
      }}
      onClose={() => {
        // Closed by anything but this component (a second Escape in some engines): reopen it.
        const element = dialog.current;
        if (meant.current && element !== null && !element.open) {
          element.showModal();
          back.current?.focus();
        }
      }}
    >
      {confirm !== null && (
        <>
          <header className="office-dialog__head">
            <h2 id="confirm-title">{CONFIRM_TITLE}</h2>
          </header>
          <div className="office-dialog__body">
            <ul className="settings-changes" id="confirm-changes">
              {confirm.changes.map((change) => (
                <li key={change.key}>{rateChange(rateName(change.key), percentText(change.from), percentText(change.to))}</li>
              ))}
            </ul>
            <p id="confirm-rule">{CONFIRM_RULE}</p>
            {confirm.also && <p id="confirm-also">{CONFIRM_ALSO}</p>}
          </div>
          <footer className="office-dialog__foot">
            <button ref={back} type="button" id="confirm-back" className="office-button" onClick={() => model.confirmBack()}>
              {CONFIRM_BACK}
            </button>
            <button type="button" id="confirm-save" className="office-button primary" onClick={() => model.confirmSave()}>
              {CONFIRM_SAVE}
            </button>
          </footer>
        </>
      )}
    </dialog>
  );
}

function Decision({
  model,
  state,
  phase,
}: {
  model: SettingsModel;
  state: SettingsState;
  phase: ReturnType<typeof useSession>['phase'];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  // Wanted open only while the frame is shown. At BO-01 it is closed, and its state kept.
  const wanted = state.decision && (phase === 'signed-in' || phase === 'idle');
  const meant = useRef(wanted);
  meant.current = wanted;

  useLayoutEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (wanted && !element.open) {
      element.showModal();
      stay.current?.focus();
    } else if (!wanted && element.open) {
      element.close();
    }
  }, [wanted]);

  const uncertain = model.guard.status() === 'uncertain';
  return (
    <dialog
      ref={dialog}
      className="office-dialog"
      aria-labelledby="departure-title"
      aria-describedby="departure-copy"
      {...CLOSED_BY_NONE}
      onCancel={(event) => {
        // Escape means Stay.
        event.preventDefault();
        if (meant.current) model.stay();
      }}
      onClose={() => {
        // Closed by anything but this component (a second Escape in some engines): reopen it.
        // Closed by this component at BO-01, `wanted` is false and nothing is done.
        const element = dialog.current;
        if (meant.current && element !== null && !element.open) {
          element.showModal();
          stay.current?.focus();
        }
      }}
    >
      <header className="office-dialog__head">
        <h2 id="departure-title">{DEPARTURE_TITLE}</h2>
      </header>
      <div className="office-dialog__body">
        <p id="departure-copy">{uncertain ? DEPARTURE_BODY_UNCERTAIN : DEPARTURE_BODY}</p>
      </div>
      <footer className="office-dialog__foot">
        <button ref={stay} type="button" id="departure-stay" className="office-button" onClick={() => model.stay()}>
          Stay
        </button>
        <button type="button" className="office-button danger final" onClick={() => model.discard()}>
          Discard
        </button>
      </footer>
    </dialog>
  );
}

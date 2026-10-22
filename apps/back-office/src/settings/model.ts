import type { ApiResult } from '@pos/api-client';
import { ErrorCode, SaveSettingsRequest, type SettingsReadView, type SettingsVersionView } from '@pos/contracts';
import { fieldsInError } from '../forms/fieldsInError.js';
import type { ConfigApi } from '../session/api.js';
import type { WorkGuard, WorkStatus } from '../work/guard.js';
import { NOT_SET_IN_FORCE } from './copy.js';
import { FIELD_ORDER, RATE_KEYS, TEXT_KEYS, checkDrafts, checkText, draftOf, isRate, type Drafts, type FieldError, type FieldKey, type RateKey } from './fields.js';
import { checkRate, percentText } from './rate.js';

// BO-08's settings part, apart from how it is drawn (consult C2 section 6, DESIGN-018 and `D`'s
// configuration-form rules, copied from BO-05's model): the read, the one form, the one command,
// the rate confirmation, and what each answer does. It sends the save once and never again: a
// resend is the manager's own press of Save, which carries the version the draft builds on. It
// never infers success from a reread. The version a draft builds on (`form.base`) moves in
// three ways only: an authoritative success, an `unchanged` answer, and the manager's own
// choice in the stale state. A reread alone never moves it, because a silently rebased draft
// would overwrite whatever the reread contained (ADR-012 rule 3).
//
// **The screen's state is this model's.** The page registers one guard with `work/guard.ts`
// and the payment-methods part (S3) adds its own form and command to this state, so that
// DESIGN-018's one form and one command per screen stays one: `form`, `command`, `decision`
// and `page` are the screen's, not the settings part's.
//
// One model belongs to one working area. A different manager's sign-in changes the area's
// key, React drops the component, and its model goes with it.

export type FormNotice = 'failure' | 'unknown' | 'unknown-changed' | 'unknown-unread' | 'stale' | 'kept' | 'used';

/** What a save carries and what the form checked: rates as parts per million, texts trimmed, a blank NPWPD null. */
export type Values = Record<RateKey, string> & {
  outlet: string;
  address: string;
  phone: string;
  npwpd: string | null;
  footer: string;
};

export interface Form {
  /** Which form this is; a command remembers it, so a late answer knows whether its form is still here. */
  key: number;
  /** The control that opened it, which focus returns to; `enter` is the first-run button. */
  opener: FieldKey | 'enter';
  /** The version the draft builds on, or null at the first run. */
  base: SettingsVersionView | null;
  original: Drafts;
  draft: Drafts;
  errors: Partial<Record<FieldKey, FieldError>>;
  notice: FormNotice | null;
  /** A newer version waiting for the manager's choice (Keep my changes or Use current settings), or null. */
  offered: SettingsVersionView | null;
  /**
   * The newer version the draft is compared with, kept after the manager chooses Keep my changes.
   * "Now in force" beside a field, and the same-or-different sentence, are derived from the
   * current draft against it, so they follow every edit. Null when there is none.
   */
  compare: SettingsVersionView | null;
  /** An unknown outcome is open: leaving asks, whatever the draft holds. */
  uncertain: boolean;
  /** The field last edited or focused, where focus returns after a decision. */
  last: FieldKey | null;
}

export interface Confirm {
  formKey: number;
  body: SaveSettingsRequest;
  values: Values;
  /** The rates that change, with the rate they change from, in form order. */
  changes: ReadonlyArray<{ key: RateKey; from: string; to: string }>;
  /** Other details change in the same save. */
  also: boolean;
}

interface Command {
  formKey: number;
  /** The version the save carried. */
  expected: number | null;
  values: Values;
  /** The manager discarded the form this was sent from. Its answer still lands, silently. */
  discarded: boolean;
}

export type PageStatus = { kind: 'saved' | 'unchanged'; version: number } | { kind: 'waiting' };

export type FocusTarget = { field: FieldKey } | { change: FieldKey | 'enter' } | 'notice' | 'save' | 'confirm';

export interface SettingsState {
  read: 'loading' | 'ready' | 'failed';
  installation: SettingsReadView['installation'] | null;
  /** The version in force: the one most recently read or answered, never the one a draft builds on. */
  current: SettingsVersionView | null;
  /** An unknown outcome's reread failed: what the page knows of the version in force may be old. */
  withheld: boolean;
  form: Form | null;
  confirm: Confirm | null;
  /** The command in flight, or being settled; also a discarded save's, until it answers. */
  command: Command | null;
  page: PageStatus | null;
  /** The stay-or-discard decision is wanted. Whoever draws it keeps it open until it is answered. */
  decision: boolean;
  focus: { target: FocusTarget; n: number } | null;
}

type Answer = ApiResult<SettingsReadView>;
type Meaning = 'saved' | 'unchanged' | 'stale' | 'session' | 'general' | 'unknown';

const READ = '/api/back-office/config/settings' as const;
const SAVE = '/api/back-office/config/settings/save' as const;

/**
 * What an answer means for the form (consult C2 section 6). Never the text of an error.
 * *Unchanged* is read from the answered version equal to the one the save carried (S2a).
 */
function meaningOf(answer: Answer, expected: number | null): Meaning {
  switch (answer.kind) {
    case 'ok': {
      const version = answer.value.current?.version;
      if (version === undefined) return 'unknown';
      if (expected !== null && version === expected) return 'unchanged';
      return expected === null || version > expected ? 'saved' : 'unknown';
    }
    case 'failed':
    case 'unavailable':
      return 'unknown';
    case 'session-gone':
      return 'session';
    case 'invalid-request':
      return 'general';
    case 'refused':
      switch (answer.body.error.code) {
        case ErrorCode.SETTINGS_CHANGED:
          return 'stale';
        case ErrorCode.SESSION_IDLE:
        case ErrorCode.UNAUTHENTICATED:
        case ErrorCode.FORBIDDEN:
          return 'session';
        default:
          return 'general';
      }
  }
}

const SAVED_FIELD: Record<FieldKey, (version: SettingsVersionView) => string | null> = {
  tax: (v) => v.taxRatePpm,
  service: (v) => v.serviceChargeRatePpm,
  outlet: (v) => v.outletName,
  address: (v) => v.address,
  phone: (v) => v.phone,
  npwpd: (v) => v.npwpd,
  footer: (v) => v.footer,
};
export const savedValue = (version: SettingsVersionView, key: FieldKey): string | null => SAVED_FIELD[key](version);

/** The text each field of the form shows for a version, or all empty at the first run. */
export function draftsOf(version: SettingsVersionView | null): Drafts {
  const drafts = {} as Drafts;
  for (const key of FIELD_ORDER) drafts[key] = version === null ? '' : draftOf(key, savedValue(version, key));
  return drafts;
}

/**
 * "Now in force" beside each field where `version` differs from the current draft. The draft
 * is read through the form's own normalisation (a rate through `checkRate`, a text trimmed, a
 * blank NPWPD none); a rate that does not parse differs. Nothing is rebased or sent.
 */
export function differences(draft: Drafts, version: SettingsVersionView): Partial<Record<FieldKey, string>> {
  const out: Partial<Record<FieldKey, string>> = {};
  for (const key of FIELD_ORDER) {
    const theirs = savedValue(version, key);
    let mine: string | null | undefined;
    if (isRate(key)) {
      const checked = checkRate(draft[key]);
      mine = checked.ok ? checked.ppm : undefined;
    } else {
      mine = checkText(key, draft[key]).value;
    }
    if (mine === theirs) continue;
    out[key] = theirs === null ? NOT_SET_IN_FORCE : isRate(key) ? `${percentText(theirs)}%` : theirs;
  }
  return out;
}

export type SettingsModel = ReturnType<typeof createSettingsModel>;

export function createSettingsModel(config: ConfigApi) {
  let state: SettingsState = {
    read: 'loading',
    installation: null,
    current: null,
    withheld: false,
    form: null,
    confirm: null,
    command: null,
    page: null,
    decision: false,
    focus: null,
  };
  const listeners = new Set<() => void>();
  let gate = false;
  let stopped = true;
  let loaded = false;
  /** Counts the answers applied, so a read can tell whether one came after it began. */
  let appliedClock = 0;
  let readSequence = 0;
  let formSequence = 0;
  let focusSequence = 0;
  /** Where the manager was going when the decision was shown. */
  let proceed: (() => void) | null = null;
  /** An answer that arrived while the session was away or a decision was open. */
  let held: { command: Command; answer: Answer; read?: { view: SettingsReadView | null } } | null = null;

  const set = (patch: Partial<SettingsState>): void => {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener();
  };
  const aim = (target: FocusTarget): SettingsState['focus'] => ({ target, n: (focusSequence += 1) });
  const withForm = (patch: Partial<Form>): Form | null => (state.form === null ? null : { ...state.form, ...patch });

  const pending = (): boolean => {
    const { form, command } = state;
    return form !== null && command !== null && !command.discarded && command.formKey === form.key;
  };
  const dirty = (): boolean => {
    const { form, confirm } = state;
    return form !== null && (confirm !== null || FIELD_ORDER.some((key) => form.draft[key] !== form.original[key]));
  };
  const uncertain = (): boolean => state.form !== null && (pending() || state.form.uncertain);
  const status = (): WorkStatus => (uncertain() ? 'uncertain' : dirty() ? 'dirty' : 'clean');

  // What the page knows of the version in force. A version number only grows, so a read that
  // answers an older one than the page already holds (a read that began before a save was
  // answered) never replaces it.
  function adopt(view: SettingsReadView, authoritative: boolean): void {
    const { current } = state;
    const next = view.current;
    const take = next !== null && (current === null || next.version >= current.version);
    set({
      installation: view.installation,
      current: take ? next : current,
      withheld: false,
      ...(authoritative ? { read: 'ready' as const } : {}),
    });
  }

  async function fetchSettings(): Promise<SettingsReadView | null> {
    try {
      const answer = await config[READ]();
      return answer.kind === 'ok' ? answer.value : null;
    } catch {
      return null;
    }
  }

  // The page's read: the first visit shows "Loading", a later one rereads without hiding what is
  // held, and Try again hides it. The latest read decides the page's state.
  async function load(visible: boolean): Promise<boolean> {
    readSequence += 1;
    const mine = readSequence;
    const startedAt = appliedClock;
    if (visible) set({ read: 'loading' });
    const view = await fetchSettings();
    if (stopped) return view !== null;
    if (view !== null) adopt(view, false);
    if (mine === readSequence) {
      if (view !== null) {
        set({ read: 'ready' });
      } else {
        // A failed read does not take away what the manager is working in, nor an answer applied
        // after the read began: that answer is the freshest the page has.
        const keeps = state.current !== null && (appliedClock > startedAt || (!visible && state.form !== null));
        set({ read: keeps ? 'ready' : 'failed' });
      }
    }
    return view !== null;
  }

  // The reread that follows a refusal or an unknown outcome. It never hides the form and never
  // moves the version a draft builds on.
  async function reread(): Promise<SettingsReadView | null> {
    const view = await fetchSettings();
    if (view !== null && !stopped) adopt(view, false);
    return view;
  }

  function openForm(opener: FieldKey | 'enter'): void {
    if (state.read !== 'ready') return;
    const base = state.current;
    if ((opener === 'enter') !== (base === null)) return;
    formSequence += 1;
    const drafts = draftsOf(base);
    set({
      form: {
        key: formSequence,
        opener,
        base,
        original: drafts,
        draft: { ...drafts },
        errors: {},
        notice: null,
        offered: null,
        compare: null,
        uncertain: false,
        last: null,
      },
      confirm: null,
      page: null,
      focus: aim({ field: opener === 'enter' ? 'tax' : opener }),
    });
  }

  function closeForm(): void {
    const { form, command } = state;
    if (form === null) return;
    if (command !== null && command.formKey === form.key) command.discarded = true;
    set({ form: null, confirm: null, focus: aim({ change: form.opener }) });
  }

  // Leaving: the form closes, a held answer is presented (silently, if its form is gone), and
  // the destination runs. A save still outstanding says so, until it answers.
  function depart(next: () => void): void {
    closeForm();
    flush();
    next();
    if (state.command?.discarded === true) set({ page: { kind: 'waiting' } });
  }

  function flush(): void {
    if (held === null || !gate || state.decision) return;
    const { command, answer, read } = held;
    held = null;
    void present(command, answer, read);
  }

  function send(command: Command, call: () => Promise<Answer>, patch: Partial<SettingsState>): void {
    set({ ...patch, command });
    void call().then(
      (answer) => answered(command, answer),
      () => answered(command, { kind: 'invalid-request' })
    );
  }

  function answered(command: Command, answer: Answer): void {
    if (stopped) return;
    if (meaningOf(answer, command.expected) === 'session') {
      // Refused before the handler: nothing was applied, and nothing is held for the session
      // to hand back. M-6 or BO-01 is the session's own, and the draft stays where it is.
      set({
        command: state.command === command ? null : state.command,
        page: state.page?.kind === 'waiting' ? null : state.page,
      });
      return;
    }
    if (!gate || state.decision) {
      held = { command, answer };
      return;
    }
    void present(command, answer);
  }

  // After an unknown outcome the reread has been made. Same version: the plain uncertainty.
  // A newer version: the uncertainty with the stale comparison and its two choices. The reread
  // failed: the facts are withheld and Try again repeats the read only.
  function settleUnknown(form: Form, fresh: SettingsReadView | null): Partial<SettingsState> {
    if (fresh === null) {
      return {
        withheld: true,
        form: { ...form, notice: 'unknown-unread', offered: null, uncertain: true },
        focus: aim({ field: 'tax' }),
      };
    }
    const newer = fresh.current;
    if (newer !== null && newer.version !== (form.base?.version ?? null)) {
      return {
        form: { ...form, notice: 'unknown-changed', offered: newer, compare: newer, uncertain: true },
        focus: aim('notice'),
      };
    }
    return { form: { ...form, notice: 'unknown', offered: null, uncertain: true }, focus: aim({ field: 'tax' }) };
  }

  async function present(command: Command, answer: Answer, read?: { view: SettingsReadView | null }): Promise<void> {
    const meaning = meaningOf(answer, command.expected);
    const clearWaiting = (): PageStatus | null => (state.page?.kind === 'waiting' ? null : state.page);
    const done = state.command === command ? null : state.command;
    const here = (): Form | null => (!command.discarded && state.form?.key === command.formKey ? state.form : null);

    if (meaning === 'unknown') {
      // The reread comes first and never establishes success: it only makes the page current.
      const fresh = read !== undefined ? read.view : await reread();
      if (stopped) return;
      const form = here();
      if (form === null) {
        // The form is gone, but a reread that failed leaves the page not knowing the version in
        // force: the facts stay withheld until a later read or an authoritative answer.
        set({ command: done, page: clearWaiting(), ...(fresh === null ? { withheld: true } : {}) });
        return;
      }
      if (!gate || state.decision) {
        // The session or a decision took the screen during the reread: hold the finished result and
        // its read, and present them once when the same manager is back. Nothing is read or sent again.
        held = { command, answer, read: { view: fresh } };
        return;
      }
      set({ command: done, ...settleUnknown(form, fresh) });
      return;
    }

    if ((meaning === 'saved' || meaning === 'unchanged') && answer.kind === 'ok') {
      appliedClock += 1;
      adopt(answer.value, true);
      const form = here();
      if (form === null) {
        set({ command: done, page: clearWaiting() });
        return;
      }
      set({
        command: done,
        form: null,
        confirm: null,
        page: { kind: meaning, version: answer.value.current!.version },
        focus: aim({ change: form.opener }),
      });
      return;
    }

    if (meaning === 'stale') {
      // Nothing was written. One reread, so the manager sees what the server sees.
      const fresh = read !== undefined ? read.view : await reread();
      if (stopped) return;
      const form = here();
      if (form === null) {
        set({ command: done, page: clearWaiting(), ...(fresh === null ? { withheld: true } : {}) });
        return;
      }
      if (!gate || state.decision) {
        held = { command, answer, read: { view: fresh } };
        return;
      }
      const newer = fresh?.current ?? null;
      if (newer !== null && newer.version !== (form.base?.version ?? null)) {
        set({
          command: done,
          form: { ...form, notice: 'stale', offered: newer, compare: newer, uncertain: false },
          focus: aim('notice'),
        });
      } else {
        // The refusal stands and the reread gave nothing to compare (DESIGN-018 draws no state
        // for it): the definite general failure, draft kept. Save asks again, with its own reread.
        set({ command: done, form: { ...form, notice: 'failure', uncertain: false }, focus: aim({ field: 'tax' }) });
      }
      return;
    }

    // The definite general failure: draft kept, nothing was saved, nothing is resent.
    const form = here();
    if (form === null) {
      set({ command: done, page: clearWaiting() });
      return;
    }
    set({ command: done, form: { ...form, notice: 'failure', uncertain: false }, focus: aim({ field: 'tax' }) });
  }

  function save(): void {
    const { form } = state;
    if (form === null || state.command !== null || form.offered !== null || state.confirm !== null) return;
    const checked = checkDrafts(form.draft);
    if (!checked.ok) {
      const first = FIELD_ORDER.find((key) => checked.errors[key] !== undefined)!;
      set({
        form: { ...form, draft: { ...form.draft, ...checked.trimmed }, errors: checked.errors, notice: null },
        focus: aim({ field: first }),
      });
      return;
    }
    const v = checked.values;
    const draft: Drafts = { ...form.draft, outlet: v.outlet, address: v.address, phone: v.phone, npwpd: v.npwpd ?? '', footer: v.footer };
    const body: SaveSettingsRequest = {
      expectedVersion: form.base?.version ?? null,
      taxRatePpm: v.tax,
      serviceChargeRatePpm: v.service,
      outletName: v.outlet,
      address: v.address,
      phone: v.phone,
      npwpd: v.npwpd,
      footer: v.footer,
    };
    if (fieldsInError(SaveSettingsRequest, body).length > 0) {
      // The form's check and the contract disagree: a defect, shown as the general failure.
      set({ form: { ...form, draft, errors: {}, notice: 'failure' }, focus: aim({ field: 'tax' }) });
      return;
    }
    const { base } = form;
    const changes = base === null ? [] : RATE_KEYS.filter((key) => v[key] !== savedValue(base, key));
    if (base !== null && changes.length > 0) {
      const also = TEXT_KEYS.some((key) => v[key] !== savedValue(base, key));
      set({
        form: { ...form, draft, errors: {}, notice: null },
        confirm: {
          formKey: form.key,
          body,
          values: v,
          changes: changes.map((key) => ({ key, from: savedValue(base, key)!, to: v[key] })),
          also,
        },
        focus: aim('confirm'),
      });
      return;
    }
    transmit({ ...form, draft }, body, v);
  }

  function transmit(form: Form, body: SaveSettingsRequest, values: Values): void {
    const command: Command = { formKey: form.key, expected: body.expectedVersion, values, discarded: false };
    send(command, () => config[SAVE](body), {
      form: { ...form, errors: {}, notice: null, uncertain: false },
      confirm: null,
      page: null,
      focus: aim('notice'),
    });
  }

  // Leaving with unsaved work, or a save pending or of unknown outcome, needs the manager's
  // word. A clean form closes without asking.
  function leave(next: () => void): 'left' | 'held' {
    if (state.form === null || (!dirty() && !uncertain())) {
      depart(next);
      return 'left';
    }
    proceed = next;
    set({ decision: true });
    return 'held';
  }

  const returnTo = (): FocusTarget => {
    const { form, confirm } = state;
    if (form === null) return { change: 'enter' };
    if (confirm !== null) return 'confirm';
    return pending() ? 'notice' : { field: form.last ?? 'tax' };
  };

  const guard: WorkGuard = {
    status,
    leave,
    focus: () => {
      if (state.form !== null) set({ focus: aim(returnTo()) });
    },
  };

  return {
    getState: (): SettingsState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    guard,
    /**
     * The model lives as long as the working area (the keyed `div`), not as long as the screen:
     * a command outlives the manager leaving Settings. Returns the stop, which the area's
     * unmount calls.
     */
    start(): () => void {
      stopped = false;
      return () => {
        stopped = true;
      };
    },
    /**
     * Settings is on screen. Every visit reads: the first shows "Loading", a later one rereads
     * without hiding what is held. A visit sends its own read even while an earlier one is out:
     * the latest read decides, and a version never moves back (see `adopt`).
     */
    shown(): void {
      if (!loaded) {
        loaded = true;
        void load(true);
      } else {
        void load(false);
      }
      const { page } = state;
      if (page !== null && page.kind !== 'waiting') set({ page: null });
    },
    /** Whether answers may be presented: the session is signed in and nothing of the frame's is open. */
    setGate(open: boolean): void {
      gate = open;
      if (open) flush();
    },
    /** Try again: the read only. After an unknown outcome whose reread failed, it is that reread. */
    async retryRead(): Promise<void> {
      const { form } = state;
      if (form !== null && form.notice === 'unknown-unread') {
        const fresh = await reread();
        if (stopped || fresh === null) return;
        const now = state.form;
        if (now === null || now.key !== form.key || now.notice !== 'unknown-unread') return;
        set(settleUnknown(now, fresh));
        return;
      }
      const ok = await load(true);
      if (ok && !stopped) set({ focus: aim({ change: 'enter' }) });
    },
    /** After the session's own screen: put focus back in the work. */
    refocus(): void {
      set({ focus: aim(returnTo()) });
    },
    // One command at a time: while one is pending these are inert, whatever pressed them.
    openEnter(): void {
      if (state.command === null) leave(() => openForm('enter'));
    },
    openChange(key: FieldKey): void {
      if (state.command === null) leave(() => openForm(key));
    },
    setField(key: FieldKey, value: string): void {
      const { form } = state;
      if (form === null || state.command !== null) return;
      // Editing clears the field's obsolete refusal.
      const { [key]: _gone, ...errors } = form.errors;
      set({ form: { ...form, draft: { ...form.draft, [key]: value }, errors, last: key } });
    },
    /** Remembers where the manager is, for the focus a decision or M-6 gives back. */
    focused(key: FieldKey): void {
      const { form } = state;
      if (form !== null && form.last !== key) set({ form: { ...form, last: key } });
    },
    save,
    /** Save new rates: the one press that sends after the confirmation. */
    confirmSave(): void {
      const { confirm, form } = state;
      if (confirm === null || form === null || form.key !== confirm.formKey || state.command !== null) return;
      transmit(form, confirm.body, confirm.values);
    },
    /** Back to editing, and Escape on the confirmation: nothing is sent. */
    confirmBack(): void {
      const { confirm } = state;
      if (confirm === null) return;
      set({ confirm: null, focus: aim({ field: confirm.changes[0]?.key ?? 'tax' }) });
    },
    /** Keep my changes: the draft now builds on the version read; nothing is sent. */
    keepMine(): void {
      const { form } = state;
      if (form === null || form.offered === null) return;
      set({ form: { ...form, base: form.offered, offered: null, notice: 'kept' }, focus: aim('save') });
    },
    /** Use current settings: the fields take the current values; nothing is sent. */
    useCurrent(): void {
      const { form } = state;
      if (form === null || form.offered === null) return;
      const drafts = draftsOf(form.offered);
      set({
        form: { ...form, base: form.offered, offered: null, original: drafts, draft: { ...drafts }, errors: {}, compare: null, notice: 'used' },
        focus: aim({ field: 'tax' }),
      });
    },
    /** Cancel and Escape: leave the form where it stands. */
    cancel(): void {
      leave(() => {});
    },
    stay(): void {
      proceed = null;
      set({ decision: false, focus: aim(returnTo()) });
      flush();
    },
    discard(): void {
      const next = proceed ?? (() => {});
      proceed = null;
      set({ decision: false });
      depart(next);
    },
  };
}

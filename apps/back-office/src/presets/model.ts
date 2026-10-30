import { CreatePresetRequest, UpdatePresetRequest, type PresetValue, type PresetView } from '@pos/contracts';
import { call, meaningOf, type Answered } from '../forms/answer.js';
import { fieldsInError } from '../forms/fieldsInError.js';
import type { PriceError } from '../item/price.js';
import type { NameError } from '../menu/name.js';
import type { RateError } from '../settings/rate.js';
import type { ConfigApi } from '../session/api.js';
import type { WorkGuard, WorkStatus } from '../work/guard.js';
import { checkDraft, draftOf, sameDraft, sameName, type Draft, type Kind } from './value.js';

// BO-07's behaviour, apart from how it is drawn: the preset list, the one form (a percentage or a
// fixed amount), and the two state commands with their confirmation (consult C2 section 6,
// DESIGN-022 and `D`'s configuration-form rules, copied from BO-08's payment methods and BO-03's
// menu models). It sends a command once and never again: a resend is the manager's own press of
// Save or a row action. It never infers success from a reread. The record a command answers is
// applied to the list; nothing is reread after a success.
//
// **The screen's state is this model's.** One workGuard registration, one `command` slot, one
// `decision` and one held result belong to the screen. At most one form is open, and every opener
// (New preset, Edit, Deactivate, Reactivate) goes through `leave`, which closes a clean form and
// asks about a dirty or uncertain one. Every opener is inert while the slot is full, a discarded
// save still outstanding included.
//
// **The rows are held in the order the server answered** (creation order). A new record is
// appended, a changed one replaces its row in place, and the table groups them for display
// (`value.ts`), so a rename keeps its place and a deactivated record lands in its new group at the
// position its creation gives it. The client never sorts by name.
//
// **The versions.** Presets share the catalog version with the menu (ADR-012 rule 10). `version` is
// the one the list stands at (DESIGN-022 round 2 F1, `D`'s standing-version rule): a full read
// sets it; a command's answer advances it only when the answered version is exactly one step
// ahead, or equal, and only while the read stands; otherwise it keeps the standing version, so an
// edit opened from the list is refused `CATALOG_CHANGED` and rereads. An editor carries the
// standing version at the moment it opens (`base`) and only an answer, an unchanged answer, Keep
// my changes or Use current preset moves it (ADR-012 rule 3). `latest` is the version most
// recently read or answered, which the facts line and the form's version line name; it is never
// the base of anything.
//
// One model belongs to one working area. A different manager's sign-in changes the area's key,
// React drops the component, and its model goes with it: nothing of it is announced or focused in
// the next manager's area.

export type FieldError = NameError | 'duplicate' | 'duplicate-reactivate';
export type FormNotice =
  | 'failure'
  | 'unknown'
  | 'unknown-unread'
  | 'unknown-newer'
  | 'stale'
  | 'stale-unread'
  | 'after-choice';

/** The current preset as a reread showed it, beside a draft that is waiting for the manager's choice. */
export interface Offered {
  version: number;
  name: string;
  value: PresetValue;
  active: boolean;
}

export type FocusTarget =
  | 'name'
  | 'percent'
  | 'amount'
  | 'notice'
  | 'status'
  | 'save'
  | 'new-preset'
  | { edit: string }
  | { toggle: string };

export interface Editor {
  /** Which editor this is; a command remembers it, so a late answer knows whether its editor is still here. */
  key: number;
  /** The preset edited; null for a new one. */
  presetId: string | null;
  /** Whether that preset was active when the editor opened. */
  active: boolean;
  /** The preset's name when the editor opened, which names the panel; empty for a new one. */
  openedName: string;
  /** The version the draft builds on; null for a create, which carries none. */
  base: number | null;
  original: Draft;
  draft: Draft;
  /** The field errors of the last Save press or answer; editing a field clears its own. */
  nameError: FieldError | null;
  percentError: RateError | null;
  amountError: PriceError | null;
  /** A refused name was reread, so the holder can be told. */
  reread: boolean;
  notice: FormNotice | null;
  /** The current preset waiting for the manager's choice (Keep my changes or Use current preset), or null. */
  offered: Offered | null;
  /** An unknown outcome is open: leaving asks, whatever the draft holds. */
  uncertain: boolean;
  /** Where focus returns when the editor closes without a save. */
  opener: FocusTarget;
}

type CommandKind = 'create' | 'update' | 'deactivate' | 'reactivate';

interface Command {
  kind: CommandKind;
  /** The preset the command is about; null for a create. */
  presetId: string | null;
  /** The name the page speaks of: the submitted one for a save, the row's for a state command. */
  name: string;
  /** The editor this was sent from, or null for a state command. */
  editorKey: number | null;
  /** The version an edit carried; null for the commands that carry none. */
  expected: number | null;
  /** The manager discarded the editor this was sent from. Its answer still lands in the list, silently. */
  discarded: boolean;
}

export type PageStatus =
  | { kind: 'saved'; name: string }
  | { kind: 'unchanged'; name: string; version: number }
  | { kind: 'pending'; action: 'deactivate' | 'reactivate'; name: string }
  | { kind: 'deactivated' | 'reactivated'; name: string }
  | { kind: 'failed' | 'session'; name: string }
  | { kind: 'unknown'; name: string; unread: boolean }
  | { kind: 'waiting' };

/** The deactivation confirmation: a modal in the working area, naming the preset. */
export interface Confirm {
  presetId: string;
  name: string;
}

export interface PresetsState {
  read: 'loading' | 'ready' | 'failed';
  /** In the order the server answered. */
  presets: readonly PresetView[];
  /** The version the list stands at; null until a full read has succeeded. */
  version: number | null;
  /** The version most recently read or answered; what the facts line and the form name. */
  latest: number | null;
  /**
   * An authoritative answer was applied while the read stood failed: the rows are the ones the
   * client knows, shown with the partial alert, and no count claims they are current. A
   * successful read clears it.
   */
  partial: boolean;
  editor: Editor | null;
  /** The command in flight, or being settled; also a discarded save's, until it answers. The screen's one slot. */
  command: Command | null;
  page: PageStatus | null;
  /** The deactivation confirmation, while it is open. */
  confirm: Confirm | null;
  /** The stay-or-discard decision is wanted. Whoever draws it keeps it open until it is answered. */
  decision: boolean;
  focus: { target: FocusTarget; n: number } | null;
}

/** What an ok answer carries into the list. */
interface Applied {
  version: number;
  presets: readonly PresetView[];
}

type Answer = Answered<Applied>;

/** A reread's outcome, with what it showed beside the draft; held with a finished result. */
interface Reread {
  fresh: boolean;
  offered: Offered | null;
}

const READ = '/api/back-office/config/catalog/presets' as const;
const CREATE = '/api/back-office/config/catalog/presets/create' as const;
const UPDATE = '/api/back-office/config/catalog/presets/update' as const;
const DEACTIVATE = '/api/back-office/config/catalog/presets/deactivate' as const;
const REACTIVATE = '/api/back-office/config/catalog/presets/reactivate' as const;

function upsert(rows: readonly PresetView[], record: PresetView): PresetView[] {
  return rows.some((row) => row.presetId === record.presetId)
    ? rows.map((row) => (row.presetId === record.presetId ? record : row))
    : [...rows, record];
}

/**
 * Who holds the name a refused create, edit or reactivation asked for, once the reread has shown
 * it: the active preset with the same name without regard to case. Nobody matching means no marker.
 */
export function holderOf(state: PresetsState): string | null {
  const { editor } = state;
  if (editor === null || (editor.nameError !== 'duplicate' && editor.nameError !== 'duplicate-reactivate') || !editor.reread) {
    return null;
  }
  const asked = editor.draft.name.trim();
  const found = state.presets.find((p) => p.isActive && p.presetId !== editor.presetId && sameName(p.name, asked));
  return found === undefined ? null : found.presetId;
}

export type PresetsModel = ReturnType<typeof createPresetsModel>;

export function createPresetsModel(config: ConfigApi) {
  let state: PresetsState = {
    read: 'loading',
    presets: [],
    version: null,
    latest: null,
    partial: false,
    editor: null,
    command: null,
    page: null,
    confirm: null,
    decision: false,
    focus: null,
  };
  const listeners = new Set<() => void>();
  let gate = false;
  let stopped = true;
  let loaded = false;
  /** Counts the answers applied and the versions adopted, so a read can tell which came after it began. */
  let clock = 0;
  /** A record a command answered, with the catalog version of that answer and when it was applied. */
  const applied = new Map<string, { record: PresetView; at: number; version: number }>();
  /** The catalog version each row on screen was taken from: its snapshot's, or its answer's. */
  const rowVersion = new Map<string, number>();
  /** When the standing version, and the latest one, were last moved by an answer. */
  let standingAt = 0;
  let latestAt = 0;
  let readSequence = 0;
  /** The newest list read, settled with the outcome of the list on screen. */
  let newestRead: Promise<boolean> = Promise.resolve(true);
  let editorSequence = 0;
  let focusSequence = 0;
  /** Where the manager was going when the decision was shown. */
  let proceed: (() => void) | null = null;
  /** An answer that arrived while the session was away or a decision was open, with its reread if it made one. */
  let held: { command: Command; answer: Answer; read?: Reread } | null = null;
  /** The finished result of an explicit retry of a reread, held the same way. */
  let heldRetry: (() => void) | null = null;

  const set = (patch: Partial<PresetsState>): void => {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener();
  };
  const aim = (target: FocusTarget): PresetsState['focus'] => ({ target, n: (focusSequence += 1) });

  /** The screen's one command slot is taken: its own command, a discarded save still outstanding included. */
  const busy = (): boolean => state.command !== null;
  const pendingSave = (): boolean => {
    const { editor, command } = state;
    return editor !== null && command !== null && !command.discarded && command.editorKey === editor.key;
  };
  const dirty = (): boolean => {
    const { editor } = state;
    return editor !== null && !sameDraft(editor.draft, editor.original);
  };
  const uncertain = (): boolean => {
    const { editor } = state;
    return editor !== null && (pendingSave() || editor.uncertain);
  };
  const status = (): WorkStatus => (uncertain() ? 'uncertain' : dirty() ? 'dirty' : 'clean');
  /** Whether a finished result may be presented now: the same manager is here and nothing is open over the work. */
  const open = (): boolean => gate && !state.decision && state.confirm === null;

  // The list read, for the first load, for Try again, and for a reread after a refusal or an
  // unknown outcome (which does not hide the list while it runs). The latest read decides.
  //
  // A read is a snapshot taken before or after some command committed, and arrival order does not
  // say which. Every row therefore carries the catalog version it was taken from (`rowVersion`),
  // and the version decides: a record a command answered after the read began is kept (or
  // inserted) only when the answer's version is greater than the snapshot's; at the snapshot's
  // version or older the snapshot's row stands. A command answer likewise replaces a row only when
  // the row's version is lower. The standing and the latest version: an answer adopted after the
  // read began, ahead of what the read saw, stays.
  //
  // What a caller receives describes the list on screen: a read that is no longer the newest
  // waits for the newest read already in flight and returns that read's outcome. It starts no
  // read of its own.
  function load(visible: boolean): Promise<boolean> {
    const run = readList(visible);
    newestRead = run;
    return run;
  }

  async function readList(visible: boolean): Promise<boolean> {
    readSequence += 1;
    const mine = readSequence;
    const startedAt = clock;
    if (visible) set({ read: 'loading' });
    let snapshot: { version: number; presets: readonly PresetView[] } | null = null;
    try {
      const answer = await config[READ]();
      if (answer.kind === 'ok') snapshot = answer.value;
    } catch {
      snapshot = null;
    }
    if (stopped) return snapshot !== null;
    if (mine === readSequence) {
      if (snapshot !== null) {
        let presets = [...snapshot.presets];
        rowVersion.clear();
        for (const row of presets) rowVersion.set(row.presetId, snapshot.version);
        // The version decides, not the arrival: an answer applied after the read began is kept only
        // when it is newer than the snapshot. At the snapshot's version or older, the snapshot's row
        // stands (it may include a later edit by someone else).
        for (const { record, at, version } of applied.values()) {
          if (at > startedAt && version > snapshot.version) {
            presets = upsert(presets, record);
            rowVersion.set(record.presetId, version);
          }
        }
        const standingAhead = state.version !== null && standingAt > startedAt && state.version > snapshot.version;
        const latestAhead = state.latest !== null && latestAt > startedAt && state.latest > snapshot.version;
        set({
          read: 'ready',
          presets,
          partial: false,
          version: standingAhead ? state.version : snapshot.version,
          latest: latestAhead ? state.latest : snapshot.version,
        });
      } else {
        // The same reconciliation as a read that succeeded: an answer applied after this read
        // began is on screen, so the known rows stay drawn with the alert and no counts.
        set({ read: 'failed', partial: state.partial || clock > startedAt });
      }
      return snapshot !== null;
    }
    return newestRead;
  }

  /** What a reread showed of the preset an editor is about, beside its draft. */
  function offeredFor(presetId: string | null): Offered | null {
    if (state.version === null || presetId === null) return null;
    const preset = state.presets.find((p) => p.presetId === presetId);
    return preset === undefined
      ? null
      : { version: state.version, name: preset.name, value: preset.value, active: preset.isActive };
  }

  /**
   * A command's answer moves the list's version only when it is this write and nothing else, and
   * only while the read stands: a failed read leaves the version at the last full read (or unset),
   * so an edit opened then is refused and rereads.
   */
  function adopt(version: number): void {
    const { version: standing, read } = state;
    if (read === 'ready' && standing !== null && (version === standing + 1 || version === standing)) {
      clock += 1;
      standingAt = clock;
      set({ version });
    }
  }

  function apply(answer: Applied): void {
    clock += 1;
    let { presets } = state;
    for (const record of answer.presets) {
      const kept = applied.get(record.presetId);
      if (kept === undefined || kept.version <= answer.version) {
        applied.set(record.presetId, { record, at: clock, version: answer.version });
      }
      // A row a newer read (or answer) already established keeps its values.
      const have = rowVersion.get(record.presetId);
      if (have === undefined || have < answer.version) {
        presets = upsert(presets, record);
        rowVersion.set(record.presetId, answer.version);
      }
    }
    latestAt = clock;
    // The read stands failed: the rows are the client's own, and the alert stays. The latest
    // version never moves backwards.
    set({
      presets,
      latest: Math.max(state.latest ?? 0, answer.version),
      partial: state.read === 'failed' ? true : state.partial,
    });
    adopt(answer.version);
  }

  function openEditor(init: { presetId: string | null; active: boolean; openedName: string; base: number | null; draft: Draft; opener: FocusTarget }): void {
    editorSequence += 1;
    set({
      editor: {
        key: editorSequence,
        presetId: init.presetId,
        active: init.active,
        openedName: init.openedName,
        base: init.base,
        original: init.draft,
        draft: init.draft,
        nameError: null,
        percentError: null,
        amountError: null,
        reread: false,
        notice: null,
        offered: null,
        uncertain: false,
        opener: init.opener,
      },
      page: null,
      focus: aim('name'),
    });
  }

  function closeEditor(): void {
    const { editor, command } = state;
    if (editor === null) return;
    if (command !== null && command.editorKey === editor.key) command.discarded = true;
    set({ editor: null, focus: aim(editor.opener) });
  }

  // Leaving: the editor (and the confirmation, if one is open) closes, a held answer is presented
  // (silently, if its editor is gone), and the destination runs. A save still outstanding says so,
  // until it answers.
  function depart(next: () => void): void {
    closeEditor();
    if (state.confirm !== null) set({ confirm: null });
    flush();
    next();
    if (state.command?.discarded === true) set({ page: { kind: 'waiting' } });
  }

  function flush(): void {
    if (!open()) return;
    if (held !== null) {
      const result = held;
      held = null;
      void present(result.command, result.answer, result.read);
    }
    if (heldRetry !== null) {
      const result = heldRetry;
      heldRetry = null;
      result();
    }
  }

  function send(command: Command, request: () => Promise<Answer>, patch: Partial<PresetsState> = {}): void {
    set({ ...patch, command });
    void request().then(
      (answer) => answered(command, answer),
      () => answered(command, { kind: 'invalid-request' })
    );
  }

  /** The editor a command was sent from, if it is still open and was not discarded. */
  const editorOf = (command: Command): Editor | null =>
    command.editorKey !== null && !command.discarded && state.editor?.key === command.editorKey ? state.editor : null;

  /** Where focus goes to take the draft up again. */
  const draftTarget = (): FocusTarget => 'name';

  function answered(command: Command, answer: Answer): void {
    if (stopped) return;
    if (meaningOf(answer, command.expected) === 'session') {
      // Refused before the handler: nothing was applied, and nothing is held for the session
      // to hand back. M-6 or BO-01 is the session's own, and the draft stays where it is.
      const form = command.editorKey !== null;
      const editor = editorOf(command);
      const waiting = state.page?.kind === 'waiting' ? null : state.page;
      set({
        command: state.command === command ? null : state.command,
        editor: editor === null ? state.editor : { ...editor, uncertain: false },
        page: form ? waiting : { kind: 'session', name: command.name },
        // The Saving notice the press asked focus for is gone: the same manager returns to the draft.
        ...(editor === null ? {} : { focus: aim(draftTarget()) }),
      });
      return;
    }
    if (!open()) {
      held = { command, answer };
      return;
    }
    void present(command, answer);
  }

  // After an unknown outcome the reread has been made. Same version: the plain uncertainty. A
  // newer version, for an edit that carried one: the uncertainty with the comparison and its two
  // choices. The reread failed: the facts are withheld and Try again repeats the read only.
  function settleUnknown(editor: Editor, read: Reread): Partial<PresetsState> {
    if (!read.fresh) {
      return { editor: { ...editor, notice: 'unknown-unread', offered: null, uncertain: true }, focus: aim(draftTarget()) };
    }
    if (editor.base !== null && state.version !== null && state.version > editor.base && read.offered !== null) {
      return { editor: { ...editor, notice: 'unknown-newer', offered: read.offered, uncertain: true }, focus: aim('notice') };
    }
    return { editor: { ...editor, notice: 'unknown', offered: null, uncertain: true }, focus: aim(draftTarget()) };
  }

  async function reread(command: Command): Promise<Reread> {
    const fresh = await load(false);
    return { fresh, offered: fresh ? offeredFor(command.presetId) : null };
  }

  async function present(command: Command, answer: Answer, read?: Reread): Promise<void> {
    const meaning = meaningOf(answer, command.expected);
    const clearWaiting = (): PageStatus | null => (state.page?.kind === 'waiting' ? null : state.page);
    const done = state.command === command ? null : state.command;
    const form = command.editorKey !== null;

    // Every outcome that rereads does so first, once, and presents only if the session is still
    // here and nothing is open over the work. Otherwise the finished result is held with its read
    // and presented when the same manager returns: nothing is read or sent again.
    if (meaning === 'unknown' || meaning === 'stale' || meaning === 'duplicate' || meaning === 'gone') {
      const settled = read ?? (await reread(command));
      if (stopped) return;
      if (command.discarded) {
        set({ command: done, page: clearWaiting() });
        return;
      }
      if (!open()) {
        held = { command, answer, read: settled };
        return;
      }
      settle(command, meaning, settled, done);
      return;
    }

    if (meaning === 'saved' || meaning === 'unchanged') {
      if (answer.kind !== 'ok') return;
      const { applied: record } = answer;
      apply(record);
      const editor = editorOf(command);
      if (form && editor === null) {
        set({ command: done, page: clearWaiting() });
        return;
      }
      set({ command: done, ...(form ? { editor: null } : {}), ...resultOf(command, record, meaning) });
      return;
    }

    // A refusal that applied nothing and needs no reread: the definite general failure.
    failure(command, done);
  }

  /** A finished outcome that reread, presented. The command is not discarded and the session is here. */
  function settle(command: Command, meaning: 'unknown' | 'stale' | 'duplicate' | 'gone', read: Reread, done: Command | null): void {
    const clearWaiting = (): PageStatus | null => (state.page?.kind === 'waiting' ? null : state.page);
    const form = command.editorKey !== null;
    const editor = editorOf(command);

    if (meaning === 'unknown') {
      if (form) {
        if (editor === null) set({ command: done, page: clearWaiting() });
        else set({ command: done, ...settleUnknown(editor, read) });
      } else {
        set({ command: done, page: { kind: 'unknown', name: command.name, unread: !read.fresh }, focus: aim('status') });
      }
      return;
    }

    if (meaning === 'stale') {
      if (editor === null) {
        set({ command: done, page: clearWaiting() });
      } else if (!read.fresh) {
        set({ command: done, editor: { ...editor, notice: 'stale-unread', offered: null, uncertain: false }, focus: aim('notice') });
      } else if (read.offered !== null && editor.base !== null && read.offered.version > editor.base) {
        set({ command: done, editor: { ...editor, notice: 'stale', offered: read.offered, uncertain: false }, focus: aim('notice') });
      } else {
        // The refusal stands and the reread gave nothing to compare: the definite general
        // failure, draft kept. Save asks again, with its own reread.
        set({ command: done, editor: { ...editor, notice: 'failure', offered: null, uncertain: false }, focus: aim(draftTarget()) });
      }
      return;
    }

    if (meaning === 'duplicate') {
      if (form) {
        if (editor === null) {
          set({ command: done, page: clearWaiting() });
          return;
        }
        set({
          command: done,
          editor: { ...editor, nameError: 'duplicate', reread: read.fresh, notice: null, offered: null, uncertain: false },
          focus: aim('name'),
        });
        return;
      }
      // A reactivation into a held name opens that inactive preset's editor with its own sentence:
      // saving a new name leaves it inactive, and Reactivate is then pressed again.
      const preset = state.presets.find((p) => p.presetId === command.presetId);
      if (preset === undefined || state.version === null) {
        set({ command: done, page: { kind: 'failed', name: command.name }, focus: aim('status') });
        return;
      }
      set({ command: done });
      openEditor({
        presetId: preset.presetId,
        active: preset.isActive,
        openedName: preset.name,
        base: state.version,
        draft: draftOf(preset),
        opener: { edit: preset.presetId },
      });
      const opened = state.editor;
      if (opened !== null) set({ editor: { ...opened, nameError: 'duplicate-reactivate', reread: read.fresh } });
      return;
    }

    // `gone`: the preset was not found. The definite failure of the command, the list reread.
    failure(command, done);
  }

  /** The definite general failure: draft kept, nothing was saved. */
  function failure(command: Command, done: Command | null): void {
    const clearWaiting = (): PageStatus | null => (state.page?.kind === 'waiting' ? null : state.page);
    if (command.discarded) {
      set({ command: done, page: clearWaiting() });
      return;
    }
    if (command.editorKey !== null) {
      const editor = editorOf(command);
      if (editor === null) set({ command: done, page: clearWaiting() });
      else set({ command: done, editor: { ...editor, notice: 'failure', offered: null, uncertain: false }, focus: aim(draftTarget()) });
    } else {
      set({ command: done, page: { kind: 'failed', name: command.name }, focus: aim('status') });
    }
  }

  /** The page's sentence and focus for a command that was answered, and applied to the list. */
  function resultOf(command: Command, record: Applied, meaning: 'saved' | 'unchanged'): Partial<PresetsState> {
    const preset = record.presets[0];
    const name = preset?.name ?? command.name;
    const target: FocusTarget = preset === undefined ? 'new-preset' : { edit: preset.presetId };
    switch (command.kind) {
      case 'create':
      case 'update':
        return {
          page: meaning === 'unchanged' ? { kind: 'unchanged', name, version: record.version } : { kind: 'saved', name },
          focus: aim(target),
        };
      case 'deactivate':
        return { page: { kind: 'deactivated', name }, focus: aim(target) };
      case 'reactivate':
        return { page: { kind: 'reactivated', name }, focus: aim(target) };
    }
  }

  // ---- The form ------------------------------------------------------------------------------

  function save(): void {
    const { editor } = state;
    if (editor === null || busy()) return;
    // A choice comes first: neither Keep my changes nor Use current preset has been made, or the
    // comparison could not be read.
    if (editor.offered !== null || editor.notice === 'stale-unread') return;

    const checked = checkDraft(editor.draft);
    const draft = { ...editor.draft, name: checked.name };
    if (checked.nameError !== null || checked.value === null) {
      const first: FocusTarget =
        checked.nameError !== null ? 'name' : editor.draft.kind === 'PERCENTAGE' ? 'percent' : 'amount';
      set({
        editor: {
          ...editor,
          draft,
          nameError: checked.nameError,
          percentError: checked.percentError,
          amountError: checked.amountError,
          reread: false,
          notice: null,
        },
        focus: aim(first),
      });
      return;
    }

    const create = editor.presetId === null;
    const body = create
      ? { name: checked.name, value: checked.value }
      : { presetId: editor.presetId, expectedVersion: editor.base, name: checked.name, value: checked.value };
    // The form's check and the contract agree (a test holds them so): a disagreement is a defect,
    // shown as the general failure.
    if (fieldsInError(create ? CreatePresetRequest : UpdatePresetRequest, body).length > 0 || (!create && editor.base === null)) {
      set({ editor: { ...editor, draft, notice: 'failure' }, focus: aim('name') });
      return;
    }
    const value = checked.value;
    const command: Command = {
      kind: create ? 'create' : 'update',
      presetId: editor.presetId,
      name: checked.name,
      editorKey: editor.key,
      expected: create ? null : editor.base,
      discarded: false,
    };
    send(
      command,
      () =>
        create
          ? call(config[CREATE]({ name: checked.name, value }), (v) => ({ version: v.version, presets: [v.preset] }))
          : call(
              config[UPDATE]({ presetId: editor.presetId!, expectedVersion: editor.base!, name: checked.name, value }),
              (v) => ({ version: v.version, presets: [v.preset] })
            ),
      {
        editor: { ...editor, draft, nameError: null, percentError: null, amountError: null, reread: false, notice: null, uncertain: false },
        page: null,
        focus: aim('notice'),
      }
    );
  }

  // ---- The state commands --------------------------------------------------------------------

  function sendState(presetId: string, kind: 'deactivate' | 'reactivate', name: string): void {
    set({ page: { kind: 'pending', action: kind, name }, focus: aim('status') });
    const command: Command = { kind, presetId, name, editorKey: null, expected: null, discarded: false };
    send(command, () =>
      call(
        kind === 'deactivate' ? config[DEACTIVATE]({ presetId }) : config[REACTIVATE]({ presetId }),
        (v) => ({ version: v.version, presets: [v.preset] })
      )
    );
  }

  // Leaving with unsaved work, or a save pending or of unknown outcome, needs the manager's word.
  function leave(next: () => void): 'left' | 'held' {
    if (state.editor === null || (!dirty() && !uncertain())) {
      depart(next);
      return 'left';
    }
    proceed = next;
    set({ decision: true });
    return 'held';
  }

  const returnTo = (): FocusTarget => {
    const { editor } = state;
    if (editor === null) return 'new-preset';
    return pendingSave() ? 'notice' : draftTarget();
  };

  const guard: WorkGuard = {
    status,
    leave: (next) => leave(next),
    focus: () => {
      if (state.editor !== null) set({ focus: aim(returnTo()) });
    },
  };

  /** Whether a row can be acted on: the list can be drawn, and it holds the row. */
  const rowOf = (presetId: string): PresetView | undefined => state.presets.find((p) => p.presetId === presetId);
  const usable = (): boolean => state.read === 'ready' || state.partial;

  return {
    getState: (): PresetsState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    guard,
    /**
     * The model lives as long as the working area (the keyed `div`), not as long as the screen:
     * a command outlives the manager leaving BO-07. Returns the stop, which the area's unmount calls.
     */
    start(): () => void {
      stopped = false;
      return () => {
        stopped = true;
      };
    },
    /**
     * BO-07 is on screen. Every visit reads the list: the first shows "Loading", a later one
     * rereads without hiding the rows already held (the merge keeps any record a command answered
     * after the read began). A visit sends its own read even while an earlier one is out: the
     * latest read decides. A read is not interactive, so a development double effect that sends
     * one more is harmless.
     */
    shown(): void {
      if (!loaded) {
        loaded = true;
        void load(true);
      } else {
        void load(false);
      }
      const { page } = state;
      if (page !== null && page.kind !== 'waiting' && page.kind !== 'pending') set({ page: null });
    },
    /** Whether answers may be presented: the session is signed in and nothing of the frame's is open. */
    setGate(on: boolean): void {
      gate = on;
      if (on) flush();
    },
    /** Try again: the read only. After an unknown or stale outcome whose reread failed, it is that reread. */
    async retryRead(): Promise<void> {
      // What the retry is about, by identity: the editor whose notice asked for it, or the page
      // result, or neither (a plain failed read).
      const asked = state.editor;
      const askedPage = state.page;
      const fresh = await load(true);
      if (!fresh || stopped) return;
      // What the completed read shows beside the draft is kept now, with the read: presenting it
      // later never reads again.
      const offered = asked === null ? null : offeredFor(asked.presetId);
      const present = (): void => {
        const { editor, page } = state;
        if (asked !== null && (asked.notice === 'unknown-unread' || asked.notice === 'stale-unread')) {
          // Gone, discarded or changed meanwhile: the result is not for what is on screen.
          if (editor === null || editor.key !== asked.key || editor.notice !== asked.notice) return;
          if (asked.notice === 'unknown-unread') {
            set(settleUnknown(editor, { fresh: true, offered }));
          } else if (offered !== null && editor.base !== null && offered.version > editor.base) {
            set({ editor: { ...editor, notice: 'stale', offered }, focus: aim('notice') });
          } else {
            set({ editor: { ...editor, notice: 'failure', offered: null }, focus: aim(draftTarget()) });
          }
        } else if (askedPage?.kind === 'unknown' && askedPage.unread) {
          if (page === askedPage) set({ page: { ...askedPage, unread: false }, focus: aim('status') });
        } else {
          // A plain retry has no sentence of its own (DESIGN-022 draws none): focus returns to the work.
          set({ focus: aim(editor === null ? 'new-preset' : 'name') });
        }
      };
      // The session or a decision took the screen during the read: hold the finished result and
      // present it once, with its focus, when the same manager is back. Nothing is read again.
      if (!open()) heldRetry = present;
      else present();
    },
    /** After the session's own screen: put focus back in the work. */
    refocus(): void {
      set({ focus: aim(returnTo()) });
    },
    // One command at a time: while one is pending these are inert, whatever pressed them.
    openCreate(): void {
      // A new preset needs a list to be drawn beside (DESIGN-022 drew it inert otherwise).
      if (busy() || !usable()) return;
      leave(() =>
        openEditor({ presetId: null, active: true, openedName: '', base: null, draft: draftOf(null), opener: 'new-preset' })
      );
    },
    openEdit(presetId: string): void {
      if (busy() || !usable() || state.version === null) return;
      leave(() => {
        // The version is the list's standing one at the moment the editor opens.
        const row = rowOf(presetId);
        const base = state.version;
        if (row === undefined || base === null) return;
        openEditor({
          presetId,
          active: row.isActive,
          openedName: row.name,
          base,
          draft: draftOf(row),
          opener: { edit: presetId },
        });
      });
    },
    /** Deactivate: the confirmation opens first; nothing is sent until its final action. */
    openDeactivate(presetId: string): void {
      if (busy() || !usable()) return;
      leave(() => {
        const row = rowOf(presetId);
        if (row === undefined || !row.isActive) return;
        set({ confirm: { presetId, name: row.name }, page: null });
      });
    },
    /** Escape and Keep active: nothing is sent, and focus returns to that row's Deactivate. */
    confirmKeep(): void {
      const { confirm } = state;
      if (confirm === null) return;
      set({ confirm: null, focus: aim({ toggle: confirm.presetId }) });
      flush();
    },
    /** The confirmation's final action: the one press that sends a deactivation. */
    confirmDeactivate(): void {
      const { confirm } = state;
      if (confirm === null || busy()) return;
      set({ confirm: null });
      sendState(confirm.presetId, 'deactivate', confirm.name);
    },
    /** Reactivate: sent at once from the row, with no confirmation. */
    reactivate(presetId: string): void {
      if (busy() || !usable()) return;
      leave(() => {
        const row = rowOf(presetId);
        if (row === undefined || row.isActive) return;
        sendState(presetId, 'reactivate', row.name);
      });
    },
    setName(value: string): void {
      const { editor } = state;
      if (editor === null || busy()) return;
      // Editing clears the field's obsolete error and its holder marker.
      set({ editor: { ...editor, draft: { ...editor.draft, name: value }, nameError: null, reread: false } });
    },
    setPercent(value: string): void {
      const { editor } = state;
      if (editor === null || busy()) return;
      set({ editor: { ...editor, draft: { ...editor.draft, percent: value }, percentError: null } });
    },
    setAmount(value: string): void {
      const { editor } = state;
      if (editor === null || busy()) return;
      set({ editor: { ...editor, draft: { ...editor.draft, amount: value }, amountError: null } });
    },
    /**
     * The kind switch (`D`, "Switching between value kinds"): the selected kind changes, each kind
     * keeps its own typed text, nothing is converted, the value errors clear, and focus goes to the
     * newly visible input. Only the selected kind is ever checked or sent.
     */
    setKind(kind: Kind): void {
      const { editor } = state;
      if (editor === null || busy() || editor.draft.kind === kind) return;
      set({
        editor: { ...editor, draft: { ...editor.draft, kind }, percentError: null, amountError: null },
        focus: aim(kind === 'PERCENTAGE' ? 'percent' : 'amount'),
      });
    },
    save,
    /** Keep my changes: the draft now builds on the version read; nothing is sent. */
    keepMine(): void {
      const { editor } = state;
      if (editor === null || editor.offered === null) return;
      const { offered } = editor;
      set({
        editor: { ...editor, base: offered.version, offered: null, notice: editor.uncertain ? 'after-choice' : null },
        focus: aim('save'),
      });
    },
    /** Use current preset: the form takes the current values, clean, and the unused buffer is cleared; nothing is sent. */
    useCurrent(): void {
      const { editor } = state;
      if (editor === null || editor.offered === null) return;
      const { offered } = editor;
      const draft = draftOf({ presetId: editor.presetId!, name: offered.name, value: offered.value, isActive: offered.active });
      set({
        editor: {
          ...editor,
          base: offered.version,
          offered: null,
          active: offered.active,
          original: draft,
          draft,
          nameError: null,
          percentError: null,
          amountError: null,
          reread: false,
          notice: editor.uncertain ? 'after-choice' : null,
        },
        focus: aim('name'),
      });
    },
    /** Cancel and Escape: leave the editor where it stands. */
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

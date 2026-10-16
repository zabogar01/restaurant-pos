// TEST ONLY. jsdom 29 has no `showModal()` and no `close()` on `HTMLDialogElement`,
// and the source calls the real methods and feature-tests nothing. This models the
// parts of the platform that the DOM can show: `open` is the attribute, `showModal()`
// opens and moves focus to
// the dialog's first focusable control (as the platform's dialog focusing steps do),
// and `close()` closes and fires `close`. What only a browser shows (the top layer,
// the backdrop, native inertness, the scrim) is the owner's check by hand.

import { act } from 'react';

const FOCUSABLE ='a[href],button,input:not([type="hidden"]),select,textarea,[tabindex]';

export function installDialogShim(): void {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & Record<string, unknown>;
  if (typeof proto.showModal === 'function') return;
  // `open` is reflected by jsdom already; define it only if a jsdom ever stops doing so.
  if (!('open' in proto)) {
    Object.defineProperty(proto, 'open', {
      configurable: true,
      get(this: HTMLDialogElement) {
        return this.hasAttribute('open');
      },
      set(this: HTMLDialogElement, value: boolean) {
        this.toggleAttribute('open', Boolean(value));
      },
    });
  }
  proto.showModal = function showModal(this: HTMLDialogElement) {
    if (!this.isConnected) throw new DOMException('not connected', 'InvalidStateError');
    if (this.hasAttribute('open')) throw new DOMException('already open', 'InvalidStateError');
    this.setAttribute('open', '');
    this.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  };
  proto.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

/** Escape as a browser handles it: the key, then `cancel` if the key was not prevented, then close. */
export function pressEscape(target: Element = document.activeElement ?? document.body): {
  keydown: KeyboardEvent;
  cancel: Event | null;
} {
  const keydown = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(keydown);
  });
  if (keydown.defaultPrevented) return { keydown, cancel: null };
  const dialog = target.closest('dialog[open]') ?? document.querySelector('dialog[open]');
  if (!dialog) return { keydown, cancel: null };
  return { keydown, cancel: requestClose(dialog as HTMLDialogElement) };
}

/** A close request (the platform's `cancel`), which closes the dialog unless it is prevented. */
export function requestClose(dialog: HTMLDialogElement): Event {
  const cancel = new Event('cancel', { cancelable: true });
  act(() => {
    dialog.dispatchEvent(cancel);
    if (!cancel.defaultPrevented) dialog.close();
  });
  return cancel;
}

/** Tab as the page sees it: the key; the browser's own move is not modelled. */
export function pressTab(shift = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true });
  act(() => {
    (document.activeElement ?? document.body).dispatchEvent(event);
  });
  return event;
}

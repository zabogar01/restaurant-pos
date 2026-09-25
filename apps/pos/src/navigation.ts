import type { MouseEvent } from 'react';

/**
 * Client-side navigation for an anchor that leaves the screen (ruling of
 * 2026-09-17: it stays an `<a href>`). A plain click is intercepted with a
 * `pushState` and a location re-read — PosRoutes listens for `popstate` — so
 * the order store and payment session, which live above the route, survive.
 * A modified click or a non-primary button is left to the browser.
 */
export function navigateClient(destination: string) {
  window.history.pushState(null, '', destination);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** A plain primary click: the one the app follows itself. A modified click is the browser's (a new tab). */
export function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return !(event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}

export function followClientSide(event: MouseEvent<HTMLAnchorElement>, destination: string) {
  if (!isPlainClick(event)) return;
  event.preventDefault();
  navigateClient(destination);
}

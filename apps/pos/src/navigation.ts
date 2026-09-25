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

export function followClientSide(event: MouseEvent<HTMLAnchorElement>, destination: string) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateClient(destination);
}

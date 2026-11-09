import { useLayoutEffect, type RefObject } from 'react';

// While a form is open its heading, any warning and its commit controls stay in view, and only
// its field body scrolls (PHASE1-S8c1 ruling 15, DESIGN-023 "Delivery and implementation
// boundary"). The panel is as tall as the room from its own top to the bottom of the content
// pane, less that pane's bottom padding: measured, so no size is invented. The behaviour is the
// design's; the numbers are whatever the window gives.
//
// Anything that can move the panel's top (a read state, a status line or a notice above it, the
// session coming back) is a render of the screen, so the panel refits after every render while
// a form is open, as well as on scroll and on a change of the pane's size.

function fit(element: HTMLElement, pane: HTMLElement): void {
  const paneBox = pane.getBoundingClientRect();
  // A pane that is not shown (BO-01) has no room to measure; the next render or size change refits.
  if (paneBox.height === 0) return;
  const room = paneBox.bottom - element.getBoundingClientRect().top - parseFloat(getComputedStyle(pane).paddingBottom);
  element.style.maxHeight = `${Math.max(0, room)}px`;
}

export function useFitPanel(panel: RefObject<HTMLElement | null>, active: boolean): void {
  // After every render of the screen.
  useLayoutEffect(() => {
    const element = panel.current;
    const pane = element?.closest<HTMLElement>('.bocontent') ?? null;
    if (active && element != null && pane !== null) fit(element, pane);
  });

  useLayoutEffect(() => {
    const element = panel.current;
    if (!active || element === null) return;
    const pane = element.closest<HTMLElement>('.bocontent');
    if (pane === null) return;
    const refit = (): void => fit(element, pane);
    let frame = 0;
    const onScroll = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refit);
    };
    pane.addEventListener('scroll', onScroll);
    const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refit);
    watcher?.observe(pane);
    window.addEventListener('resize', refit);
    return () => {
      cancelAnimationFrame(frame);
      pane.removeEventListener('scroll', onScroll);
      watcher?.disconnect();
      window.removeEventListener('resize', refit);
      element.style.maxHeight = '';
    };
  }, [panel, active]);
}

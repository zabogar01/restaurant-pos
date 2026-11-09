import { useLayoutEffect, type RefObject } from 'react';

// While a form is open its heading, any warning and its commit controls stay in view, and only
// its field body scrolls (PHASE1-S8c1 ruling 15, DESIGN-023 "Delivery and implementation
// boundary"). The panel is as tall as the room from its own top to the bottom of the content
// pane, less that pane's bottom padding: measured, so no size is invented. The behaviour is the
// design's; the numbers are whatever the window gives.

export function useFitPanel(panel: RefObject<HTMLElement | null>, active: boolean): void {
  useLayoutEffect(() => {
    const element = panel.current;
    if (!active || element === null) return;
    const pane = element.closest<HTMLElement>('.bocontent');
    if (pane === null) return;
    const fit = (): void => {
      const paneBox = pane.getBoundingClientRect();
      // A pane that is not shown (BO-01) has no room to measure; the next change of size refits.
      if (paneBox.height === 0) return;
      const room = paneBox.bottom - element.getBoundingClientRect().top - parseFloat(getComputedStyle(pane).paddingBottom);
      element.style.maxHeight = `${Math.max(0, room)}px`;
    };
    fit();
    let frame = 0;
    const onScroll = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    pane.addEventListener('scroll', onScroll);
    const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    watcher?.observe(pane);
    window.addEventListener('resize', fit);
    return () => {
      cancelAnimationFrame(frame);
      pane.removeEventListener('scroll', onScroll);
      watcher?.disconnect();
      window.removeEventListener('resize', fit);
      element.style.maxHeight = '';
    };
  }, [panel, active]);
}

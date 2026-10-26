import type { MouseEvent } from 'react';
import { CONFIGURATION, TABLES } from './copy.js';
import { MENU } from './menu/copy.js';
import { router, useScreen } from './router.js';
import { PATHS, type Screen } from './routes.js';
import { SETTINGS } from './settings/copy.js';

// The rail lists only destinations that exist (DESIGN-016 Part B 4): Menu (S4c), Tables (S1b)
// and Settings (S2b), in that order (DESIGN-019 round 2, F5), under a group labelled
// Configuration. The landing is reached by browser Back, not by an entry.
const GROUPS: ReadonlyArray<{ label: string; entries: ReadonlyArray<{ screen: Screen; label: string }> }> = [
  {
    label: CONFIGURATION,
    entries: [
      { screen: 'menu', label: MENU },
      { screen: 'tables', label: TABLES },
      { screen: 'settings', label: SETTINGS },
    ],
  },
];

export function Rail() {
  const current = useScreen();
  const go = (screen: Screen) => (event: MouseEvent<HTMLAnchorElement>) => {
    // A new tab or window is the browser's own business.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    router.navigate(screen);
  };
  return (
    <>
      {GROUPS.map((group) => (
        <div key={group.label} role="group" aria-labelledby="rail-group-configuration">
          <div id="rail-group-configuration" className="bonav__sec">
            {group.label}
          </div>
          {group.entries.map((entry) => (
            <a
              key={entry.screen}
              href={PATHS[entry.screen]}
              aria-current={current === entry.screen ? 'page' : undefined}
              onClick={go(entry.screen)}
            >
              {entry.label}
            </a>
          ))}
        </div>
      ))}
    </>
  );
}

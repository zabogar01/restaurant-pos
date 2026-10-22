import { useEffect, useState, useSyncExternalStore } from 'react';
import { useScreen } from './router.js';
import { useConfig, useSession } from './session/useSession.js';
import { createSettingsModel } from './settings/model.js';
import { Settings } from './settings/Settings.js';
import { createTablesModel } from './tables/model.js';
import { Tables } from './tables/Tables.js';
import { workGuard } from './work/guard.js';

/**
 * The screen the address names, mounted as the `children` of `OfficeApp`'s keyed working
 * area, so a different manager's sign-in destroys it with the key (rule 22). The landing
 * is the Phase 0 frame's empty content pane: it draws nothing.
 *
 * What a screen has in flight belongs to the working area, not to the screen. BO-05's model
 * is made here, once per key, so that leaving Tables for the landing does not stop a command
 * already sent: Discard drops only the draft, and the answer still lands in the list,
 * silently, whether or not Tables is on screen.
 */
export function Screens() {
  const config = useConfig();
  const session = useSession();
  const screen = useScreen();
  const [tables] = useState(() => createTablesModel(config));
  const [settings] = useState(() => createSettingsModel(config));
  const frameHolds = useSyncExternalStore(workGuard.subscribe, workGuard.isHeld);
  const signedIn = session.phase === 'signed-in';

  useEffect(() => tables.start(), [tables]);
  useEffect(() => settings.start(), [settings]);
  // An answer is presented only while the same manager is signed in and nothing of the
  // frame's is open (a decision, the logout confirmation): nothing is chosen for them.
  useEffect(() => tables.setGate(signedIn && !frameHolds), [tables, signedIn, frameHolds]);
  useEffect(() => settings.setGate(signedIn && !frameHolds), [settings, signedIn, frameHolds]);

  switch (screen) {
    case 'tables':
      return <Tables model={tables} />;
    case 'settings':
      return <Settings model={settings} />;
    case 'landing':
      return null;
    default: {
      const unplaced: never = screen;
      return unplaced;
    }
  }
}

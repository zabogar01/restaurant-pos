import { useEffect, useState, useSyncExternalStore } from 'react';
import { useScreen } from './router.js';
import { createItemModel } from './item/model.js';
import { ItemEditor } from './item/ItemEditor.js';
import { createMenuModel } from './menu/model.js';
import { Menu } from './menu/Menu.js';
import { createPresetsModel } from './presets/model.js';
import { Presets } from './presets/Presets.js';
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
 * silently, whether or not Tables is on screen. BO-08's, BO-03's, BO-04's and BO-07's models are made here
 * for the same reason. BO-04's also holds which item it edits (never part of the address), so a
 * different manager's sign-in destroys the subject with the area's key.
 */
export function Screens() {
  const config = useConfig();
  const session = useSession();
  const screen = useScreen();
  const [tables] = useState(() => createTablesModel(config));
  const [settings] = useState(() => createSettingsModel(config));
  const [menu] = useState(() => createMenuModel(config));
  const [item] = useState(() => createItemModel(config, menu));
  const [presets] = useState(() => createPresetsModel(config));
  const frameHolds = useSyncExternalStore(workGuard.subscribe, workGuard.isHeld);
  const signedIn = session.phase === 'signed-in';

  useEffect(() => tables.start(), [tables]);
  useEffect(() => settings.start(), [settings]);
  useEffect(() => menu.start(), [menu]);
  useEffect(() => item.start(), [item]);
  useEffect(() => presets.start(), [presets]);
  // An answer is presented only while the same manager is signed in and nothing of the
  // frame's is open (a decision, the logout confirmation): nothing is chosen for them.
  useEffect(() => tables.setGate(signedIn && !frameHolds), [tables, signedIn, frameHolds]);
  useEffect(() => settings.setGate(signedIn && !frameHolds), [settings, signedIn, frameHolds]);
  useEffect(() => menu.setGate(signedIn && !frameHolds), [menu, signedIn, frameHolds]);
  useEffect(() => item.setGate(signedIn && !frameHolds), [item, signedIn, frameHolds]);
  useEffect(() => presets.setGate(signedIn && !frameHolds), [presets, signedIn, frameHolds]);

  switch (screen) {
    case 'menu':
      return <Menu model={menu} />;
    case 'item':
      return <ItemEditor model={item} />;
    case 'tables':
      return <Tables model={tables} />;
    case 'presets':
      return <Presets model={presets} />;
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

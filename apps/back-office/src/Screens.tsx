import { useScreen } from './router.js';
import { Tables } from './tables/Tables.js';

/**
 * The screen the address names, mounted as the `children` of `OfficeApp`'s keyed working
 * area, so a different manager's sign-in destroys it with the key (rule 22). The landing
 * is the Phase 0 frame's empty content pane: it draws nothing.
 */
export function Screens() {
  const screen = useScreen();
  switch (screen) {
    case 'tables':
      return <Tables />;
    case 'landing':
      return null;
    default: {
      const unplaced: never = screen;
      return unplaced;
    }
  }
}

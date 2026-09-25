import { Icon } from './icons.js';
import { followClientSide } from './navigation.js';

// FR-E3's emergency incident, as one component with two variants. FE-001 built
// it for POS-01's `incident` state; F2h reuses it on POS-03 rather than drawing
// a second banner, because FR-E3 makes the incident **application-wide and
// never actor-scoped**: one incident, one presentation, wherever the staff
// member happens to be standing.
//
// The two variants differ in exactly what FR-E3b says they differ in — detail.
// Before sign-in the banner names the printer and nothing else (ruling C-6);
// behind the PIN it may name the table and the round, because POS-03 is behind
// the PIN and the room is not reading it.
//
// role="alert": an incident that appears while the cashier is working is the
// result of something failing, and a failure a screen-reader user is never
// told about is a real defect (F2e's ruling, which is why both PIN pads carry
// role="alert").
export type BannerAction =
  /** Leaves the screen for POS-07: an anchor (ruling of 2026-09-17), followed client-side on a plain click. */
  | { label: string; href: string }
  /** Acts on the screen it is on: a button. */
  | { label: string; onPress: () => void };

export function EmergencyBanner({
  title,
  detail,
  action,
  inert = {},
}: {
  title: string;
  detail: string;
  action: BannerAction;
  /** React 18 has no inert prop; the caller passes the bare attribute, or nothing. */
  inert?: { inert?: string };
}) {
  return (
    <div className="emergency-banner" role="alert" {...inert}>
      <span className="emergency-banner__mark">
        <Icon name="alert" />
      </span>
      <div>
        <div className="emergency-banner__title">{title}</div>
        <div className="emergency-banner__detail">{detail}</div>
      </div>
      {'href' in action ? (
        <a className="emergency-banner__action" href={action.href} onClick={(event) => followClientSide(event, action.href)}>
          {action.label}
        </a>
      ) : (
        <button type="button" className="emergency-banner__action" onClick={action.onPress}>
          {action.label}
        </button>
      )}
    </div>
  );
}

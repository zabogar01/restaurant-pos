import { useSession, useSessionStore } from './session/useSession.js';

const ROLE_LABEL = { CASHIER: 'Cashier', MANAGER: 'Manager' } as const;

/**
 * The person signed in, the whole seconds of the idle limit left, and Release, on
 * every screen that draws the actor. Both read the session store: no screen prints
 * a name or a number of seconds from a literal (B-24).
 *
 * `idleClassName` is the host screen's own class for the chip; `release` draws
 * Release where the reviewed artifact draws it (floor.html:48, order.html:77,
 * closed.js:21). Release is a button, because it acts: the screen leaves for POS-01
 * whatever the server answers.
 */
export function ActorChip({
  idleClassName,
  release = false,
  releaseClassName,
}: {
  idleClassName: string;
  release?: boolean;
  releaseClassName?: string;
}) {
  const session = useSession();
  const store = useSessionStore();
  if (session.phase !== 'signed-in') return null;
  return (
    <>
      <span>{`${session.person.name} · ${ROLE_LABEL[session.person.role]}`}</span>
      {session.remainingSeconds !== null && <span className={idleClassName}>{`${session.remainingSeconds}s`}</span>}
      {release && (
        <button type="button" className={releaseClassName ?? 'floor-action'} onClick={() => store.release()}>
          Release
        </button>
      )}
    </>
  );
}

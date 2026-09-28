import { useState } from 'react';
import { Icon } from './icons.js';
import {
  INCIDENT_FIXTURES,
  INCIDENT_STATES,
  LIVE_REPRINT_TITLE,
  REPRINT_FOLLOW_UP,
  type Incident,
  type IncidentState,
} from './incidentFixtures.js';
import { followClientSide } from './navigation.js';

// POS-07 print incidents (FE-025). Nothing here is modal and nothing gates
// navigation (B-15): `← Floor` is live in every state, loading and error
// included.

const isEmergency = (incident: Incident) => incident.kind !== 'receipt';

/**
 * FR-E6 / AC-23: the emergency class is always above the receipt class, whatever
 * order the source lists them in. Sorted here, never by fixture position.
 * Within a class, the source order stands.
 */
export function groupIncidents(incidents: ReadonlyArray<Incident>) {
  return {
    emergency: incidents.filter(isEmergency),
    receipt: incidents.filter((incident) => !isEmergency(incident)),
  };
}

function IncidentCard({
  incident,
  result,
  checked,
  onReprint,
  onCheck,
  onClear,
}: {
  incident: Incident;
  result: string | null;
  checked: boolean;
  onReprint: () => void;
  onCheck: () => void;
  onClear: () => void;
}) {
  const emergency = isEmergency(incident);
  const titleId = `${incident.id}-title`;
  const metaId = `${incident.id}-meta`;
  return (
    <div
      className={`incident ${emergency ? 'incident--emergency' : 'incident--receipt'}`}
      data-incident={incident.id}
      data-kind={incident.kind}
    >
      <div className="incident__row">
        <div className="incident__text">
          <div className="incident__title" id={titleId}>
            {incident.title}
          </div>
          {incident.meta && (
            <div className="incident__meta" id={metaId}>
              {incident.meta}
            </div>
          )}
          {incident.note && (
            <div className="incident__note">
              This ticket tells the kitchen to <b>stop</b> work already sent. It may or may not have printed.{' '}
              <b>Check the printer before reprinting</b> — it is a cancellation, never a new order.
            </div>
          )}
        </div>
        {/* Per incident, never shared (FE-021's lesson): the button names what it reprints by describing it. */}
        {(() => {
          const reprint = (
            <button
              type="button"
              className={emergency ? 'incident__reprint' : 'incident__reprint incident__reprint--receipt'}
              aria-describedby={incident.meta ? `${titleId} ${metaId}` : titleId}
              onClick={onReprint}
            >
              {incident.button}
            </button>
          );
          // A receipt is the lower urgency class (FR-E6): Dismiss is always live and needs no check.
          return emergency ? (
            reprint
          ) : (
            <div className="receipt-actions">
              {reprint}
              <button type="button" className="incident-dismiss" aria-describedby={titleId} onClick={onClear}>
                Dismiss
              </button>
            </div>
          );
        })()}
      </div>
      {incident.unknownNote && <div className="incident__meta">{incident.unknownNote}</div>}
      {result && (
        <div className="notice notice--soft incident__result" role="status">
          <div className="notice__title">{result}</div>
          {emergency && <div>{REPRINT_FOLLOW_UP}</div>}
        </div>
      )}
      {emergency && (
        <div className="incident-recovery">
          <label id={`clear-reason-${incident.id}`}>
            <input type="checkbox" checked={checked} onChange={onCheck} />I checked: the kitchen has this{' '}
            {incident.kind === 'cancellation' ? 'cancellation' : 'ticket'}.
          </label>
          {/* Off is aria-disabled, never `disabled` (FE-024): it stays focusable and its press does nothing. */}
          <button
            type="button"
            className="incident-clear"
            aria-disabled={!checked}
            aria-describedby={`clear-reason-${incident.id}`}
            onClick={() => checked && onClear()}
          >
            Clear incident
          </button>
        </div>
      )}
    </div>
  );
}

export function IncidentsScreen({
  state,
  incidents = INCIDENT_FIXTURES[state].incidents,
}: {
  state: IncidentState;
  incidents?: ReadonlyArray<Incident>;
}) {
  // Screen-local, keyed by incident: a single shared flag is the defect this
  // project keeps paying for. No URL change, no history entry.
  const [reprinted, setReprinted] = useState<ReadonlySet<string>>(() => new Set());
  // Also screen-local and keyed by incident. Clearing is not audited (owner ruling, FE-028): no URL, no history.
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());
  const [cleared, setCleared] = useState<ReadonlySet<string>>(() => new Set());
  const [status, setStatus] = useState('');
  const visible = incidents.filter((incident) => !cleared.has(incident.id));
  const { emergency, receipt } = groupIncidents(visible);
  const allGone = state === 'empty' || (incidents.length > 0 && visible.length === 0);

  const resultFor = (incident: Incident) => incident.serverResult ?? (reprinted.has(incident.id) ? LIVE_REPRINT_TITLE : null);
  const draw = (incident: Incident) => (
    <IncidentCard
      key={incident.id}
      incident={incident}
      result={resultFor(incident)}
      checked={checked.has(incident.id)}
      onReprint={() => setReprinted((prev) => new Set(prev).add(incident.id))}
      onCheck={() =>
        setChecked((prev) => {
          const next = new Set(prev);
          if (!next.delete(incident.id)) next.add(incident.id);
          return next;
        })
      }
      onClear={() => {
        setCleared((prev) => new Set(prev).add(incident.id));
        const last = visible.length === 1;
        setStatus(
          last
            ? 'Nothing outstanding — no unresolved print incidents.'
            : isEmergency(incident)
              ? 'Kitchen incident cleared.'
              : 'Receipt warning dismissed.',
        );
      }}
    />
  );

  // Retry is a fixture: there is nothing to retry against. It replaces, not pushes.
  const retry = () => {
    window.history.replaceState(null, '', '/pos/incidents');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <>
      <div className="pos-device">
        <header className="settlement-bar">
          <a
            className="settlement-back incidents__back"
            href="/pos/floor"
            onClick={(event) => followClientSide(event, '/pos/floor')}
          >
            ← Floor
          </a>
          <h1>Printing</h1>
          <div className="settlement-actor">
            <span>Ana R. · Cashier</span>
            <span className="settlement-idle">90s</span>
          </div>
        </header>

        <main className="incidents">
          {state === 'loading' && (
            <div aria-busy="true">
              <div className="menu-loading__label">LOADING</div>
              <div className="skel-bar skel-bar--80" aria-hidden="true" />
              <div className="skel-bar skel-bar--40" aria-hidden="true" />
            </div>
          )}

          {state === 'error' && (
            <div className="notice">
              <div className="notice__title">Could not read printer state</div>
              <div>
                Check the printer directly.{' '}
                <button type="button" className="incidents__retry" onClick={retry}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {allGone && (
            <div className="incidents__empty">
              <div className="incidents__empty-title">Nothing outstanding</div>
              <div>No unresolved print incidents.</div>
            </div>
          )}

          {emergency.length > 0 && (
            <section className="incidents__group" data-class="emergency">
              <div className="incidents__heading">
                <span className="incidents__mark">
                  <Icon name="alert" />
                </span>
                <b className="incidents__heading-title">Needs attention now</b>
                <span className="incidents__heading-note">Check delivery with the kitchen</span>
              </div>
              {emergency.map(draw)}
            </section>
          )}

          {receipt.length > 0 && (
            <section className="incidents__group" data-class="receipt">
              <div className="incidents__heading incidents__heading--receipt">
                <span className="incidents__dot" />
                <b>Receipts</b>
                <span className="incidents__heading-note">Customer-service issue, not an emergency</span>
              </div>
              {receipt.map(draw)}
            </section>
          )}
          <div className="incident-status" role="status" aria-live="polite">
            {status}
          </div>
        </main>
      </div>
      <nav className="fixture-states" aria-label="Fixture states">
        {INCIDENT_STATES.map((s) => (
          <a key={s.id} href={`?state=${s.id}`} aria-current={s.id === state ? 'page' : undefined}>
            {s.label}
          </a>
        ))}
      </nav>
    </>
  );
}


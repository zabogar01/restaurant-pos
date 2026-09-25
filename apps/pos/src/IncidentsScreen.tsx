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

function IncidentCard({ incident, result, onReprint }: { incident: Incident; result: string | null; onReprint: () => void }) {
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
        <button
          type="button"
          className={emergency ? 'incident__reprint' : 'incident__reprint incident__reprint--receipt'}
          aria-describedby={incident.meta ? `${titleId} ${metaId}` : titleId}
          onClick={onReprint}
        >
          {incident.button}
        </button>
      </div>
      {result && (
        <div className="notice notice--soft incident__result" role="status">
          <div className="notice__title">{result}</div>
          {emergency && <div>{REPRINT_FOLLOW_UP}</div>}
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
  const { emergency, receipt } = groupIncidents(incidents);

  const resultFor = (incident: Incident) => incident.serverResult ?? (reprinted.has(incident.id) ? LIVE_REPRINT_TITLE : null);
  const draw = (incident: Incident) => (
    <IncidentCard
      key={incident.id}
      incident={incident}
      result={resultFor(incident)}
      onReprint={() => setReprinted((prev) => new Set(prev).add(incident.id))}
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

          {state === 'empty' && (
            <div className="incidents__empty">
              <div className="incidents__empty-title">Nothing outstanding</div>
              <div>Every ticket and receipt has printed.</div>
            </div>
          )}

          {emergency.length > 0 && (
            <section className="incidents__group" data-class="emergency">
              <div className="incidents__heading">
                <span className="incidents__mark">
                  <Icon name="alert" />
                </span>
                <b className="incidents__heading-title">Needs attention now</b>
                <span className="incidents__heading-note">The kitchen has not seen this work</span>
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


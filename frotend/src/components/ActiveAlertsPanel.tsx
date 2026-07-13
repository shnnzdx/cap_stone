import type { ActiveAlert } from "../simulation/alertTypes";

export function ActiveAlertsPanel({ alerts }: { alerts: ActiveAlert[] }) {
  return (
    <div className="active-alerts-panel">
      <div className="panel-title">
        <span>Active Alerts</span>
        <strong>{alerts.length}</strong>
      </div>
      <div className="alert-list">
        {alerts.length === 0 ? (
          <p>No surfaced alerts yet.</p>
        ) : (
          alerts.map((alert) => (
            <div className="alert-row" key={alert.id}>
              <span>{alert.workerId}</span>
              <strong>{Math.round(alert.utility * 100)}</strong>
              <em>{alert.reason}</em>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

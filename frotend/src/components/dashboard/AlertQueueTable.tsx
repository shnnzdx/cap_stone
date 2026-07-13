import type { DashboardAlertRecord } from "../../simulation/dashboardTypes";

function severityLabel(value: number) {
  if (value >= 0.8) return "Critical";
  if (value >= 0.6) return "High";
  if (value >= 0.4) return "Medium";
  return "Low";
}

function age(value: number) {
  if (value < 60) return `${Math.max(0, Math.round(value))}s`;
  return `${Math.round(value / 60)}m`;
}

export function AlertQueueTable({
  records,
  selectedId,
  onSelect,
}: {
  records: DashboardAlertRecord[];
  selectedId?: string;
  onSelect: (record: DashboardAlertRecord) => void;
}) {
  return (
    <div className="alert-table-wrap">
      <table className="alert-queue-table">
        <thead>
          <tr>
            <th>Alert ID</th>
            <th>Service / Job</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Score</th>
            <th>Decision</th>
            <th>Feedback</th>
            <th>Age</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr className={record.id === selectedId ? "selected" : ""} key={record.id} onClick={() => onSelect(record)}>
              <td>{record.id.replace("cand-", "")}</td>
              <td>
                <strong>{record.service}</strong>
                <span>{record.jobId}</span>
              </td>
              <td>{severityLabel(record.severity)}</td>
              <td>{record.status.replace(/_/g, " ")}</td>
              <td>{Math.round(record.score * 100)}</td>
              <td>
                <mark className={record.decision === "promote" ? "promoted" : "suppressed"}>{record.decision}</mark>
              </td>
              <td>{record.feedbackStatus === "none" ? "Unlabeled" : record.feedbackStatus.replace("_", " ")}</td>
              <td>{age(record.ageSeconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {records.length === 0 ? <p className="empty-table">No alerts match the current filters.</p> : null}
    </div>
  );
}

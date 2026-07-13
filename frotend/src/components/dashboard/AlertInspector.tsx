import type { DashboardAlertRecord } from "../../simulation/dashboardTypes";
import { ScoreBreakdown } from "./ScoreBreakdown";

export function AlertInspector({
  record,
  acknowledged,
  onAcknowledge,
}: {
  record?: DashboardAlertRecord;
  acknowledged: boolean;
  onAcknowledge: (id: string) => void;
}) {
  if (!record) {
    return (
      <aside className="dashboard-panel alert-inspector">
        <div className="panel-heading">
          <span>Alert Inspector</span>
        </div>
        <p className="empty-inspector">Select an alert to inspect decision context.</p>
      </aside>
    );
  }

  return (
    <aside className="dashboard-panel alert-inspector">
      <div className="panel-heading">
        <span>Alert Inspector</span>
        <strong>{record.decision}</strong>
      </div>
      <div className="inspector-title">
        <h2>{record.id.replace("cand-", "")}</h2>
        <p>
          {record.service} / {record.jobId}
        </p>
      </div>
      <dl className="inspector-meta">
        <div>
          <dt>Severity</dt>
          <dd>{Math.round(record.severity * 100)}</dd>
        </div>
        <div>
          <dt>Decision</dt>
          <dd>{record.decision}</dd>
        </div>
      </dl>
      <section>
        <h3>Why</h3>
        <p>{record.decisionReason}</p>
      </section>
      <section>
        <h3>Score Breakdown</h3>
        <ScoreBreakdown record={record} />
      </section>
      <section>
        <h3>Related Signals</h3>
        <ul className="related-signals">
          {record.relatedSignals.map((signal) => (
            <li key={signal.label}>
              <span>{signal.label}</span>
              <strong>{signal.value}</strong>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Recommended Action</h3>
        <p>
          {record.decision === "promote"
            ? "Open the full review workspace before classifying this alert."
            : "Open the full review workspace to inspect suppression evidence before accepting the decision."}
        </p>
      </section>
      <section>
        <h3>Feedback Status</h3>
        <p>{record.feedbackStatus === "none" ? "Unreviewed. Full human feedback belongs in Alert Review." : record.feedbackStatus.replace(/_/g, " ")}</p>
      </section>
      <div className="dashboard-review-actions">
        <a href={`#alerts/${encodeURIComponent(record.id)}`}>Open Full Review</a>
        <button type="button" onClick={() => onAcknowledge(record.id)}>
          {acknowledged ? "Acknowledged" : "Acknowledge"}
        </button>
      </div>
    </aside>
  );
}

import { displayConfidence, formatAge, formatDecision, formatOutcome, reviewPriority, severityLabel, shortId } from "../../simulation/alertReviewSelectors";
import type { DashboardAlertRecord } from "../../simulation/dashboardTypes";

export function AlertReviewQueue({
  records,
  selectedId,
  onSelect,
}: {
  records: DashboardAlertRecord[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="alerts-panel review-queue-panel">
      <div className="alerts-panel-heading">
        <span>Review Queue</span>
        <strong>{records.length}</strong>
      </div>
      <div className="review-queue-list">
        {records.map((record) => {
          const priority = reviewPriority(record);
          return (
            <button className={record.id === selectedId ? "selected" : ""} key={record.id} type="button" onClick={() => onSelect(record.id)}>
              <span className="selection-bar" />
              <span className="row-main">
                <strong>{shortId(record.id)}</strong>
                <em>
                  {record.service} / {record.jobId}
                </em>
              </span>
              <span className={`severity ${severityLabel(record.severity).toLowerCase()}`}>{severityLabel(record.severity)}</span>
              <span className={`decision ${record.decision}`}>{formatDecision(record.decision)}</span>
              <span className="priority">
                <strong>{priority.level}</strong>
                <em>{priority.reasons.join(" / ")}</em>
              </span>
              <span>{Math.round(displayConfidence(record) * 100)}%</span>
              <span>{record.feedbackStatus === "none" ? "Unreviewed" : formatOutcome(record.feedbackStatus)}</span>
              <span>{formatAge(record.ageSeconds)} ago</span>
            </button>
          );
        })}
        {records.length === 0 ? <p className="alerts-empty">No alerts match the current review filters.</p> : null}
      </div>
    </section>
  );
}

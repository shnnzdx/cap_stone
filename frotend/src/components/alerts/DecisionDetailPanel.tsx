import { useEffect, useState } from "react";
import type { StrategyMode } from "../../simulation/alertTypes";
import {
  displayConfidence,
  formatAge,
  formatDecision,
  formatOutcome,
  isHighRiskSuppression,
  severityLabel,
  shortId,
  suppressionReason,
} from "../../simulation/alertReviewSelectors";
import type { DashboardAlertRecord, OperatorAction, ReviewOutcome } from "../../simulation/dashboardTypes";

const outcomes: Array<[ReviewOutcome, string]> = [
  ["real_incident", "Real Incident"],
  ["false_positive", "False Positive"],
  ["duplicate", "Duplicate"],
  ["expected_behavior", "Expected Behavior"],
  ["non_actionable", "Non-Actionable"],
  ["needs_more_information", "Needs More Information"],
];

function strategyMessage(strategy: StrategyMode) {
  return strategy === "feedback" ? "Feedback saved. Audit record created. Ranking memory updated." : "Feedback saved for audit. Not applied to ranking in the current strategy.";
}

function recommendation(record: DashboardAlertRecord) {
  if (record.decision === "suppress" && isHighRiskSuppression(record)) {
    return "Review the suppressed pattern before accepting it. Escalate if the next retry fails or the same service remains near the decision boundary.";
  }
  if (record.isDuplicate) return "Confirm whether this is a duplicate cluster before closing the review.";
  if (record.retryCount > 2) return "Review repeated retries on the worker and escalate only if recovery does not follow.";
  return "Confirm the decision against the related backend-job evidence before closing the review.";
}

export function DecisionDetailPanel({
  record,
  strategy,
  onSubmit,
  onNext,
}: {
  record?: DashboardAlertRecord;
  strategy: StrategyMode;
  onSubmit: (id: string, outcome: ReviewOutcome, action: OperatorAction, note: string) => boolean;
  onNext: () => void;
}) {
  const [outcome, setOutcome] = useState<ReviewOutcome>();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setOutcome(record?.feedback?.outcome);
    setNote(record?.feedback?.note ?? "");
    setMessage("");
  }, [record?.id]);

  if (!record) {
    return (
      <section className="alerts-panel decision-detail-panel">
        <div className="alerts-panel-heading">
          <span>Decision Detail</span>
        </div>
        <p className="alerts-empty">Select an alert to review its decision evidence.</p>
      </section>
    );
  }

  const confidence = displayConfidence(record);
  const similarSuppressed = Math.max(0, Math.round(record.similarCandidateCount * 0.72));
  const similarPromoted = Math.max(0, Math.round(record.similarCandidateCount * 0.18));
  const similarReviewed = Math.max(0, record.feedbackStatus !== "none" ? 1 : Math.round(record.similarCandidateCount * 0.08));

  const submit = (action: OperatorAction) => {
    if (!outcome) {
      setMessage("Select one Review Outcome before confirming this review.");
      return;
    }
    if (onSubmit(record.id, outcome, action, note)) setMessage(strategyMessage(strategy));
  };

  return (
    <section className="alerts-panel decision-detail-panel">
      <div className="alerts-panel-heading">
        <span>Decision Detail</span>
        {record.decision === "suppress" && confidence < 0.68 ? <strong>Review Recommended</strong> : null}
      </div>

      <div className="detail-section alert-summary-grid">
        <div>
          <span>Alert</span>
          <strong>{shortId(record.id)}</strong>
          <em>
            {record.service} / {record.jobId}
          </em>
        </div>
        <div>
          <span>Worker</span>
          <strong>{record.workerId}</strong>
          <em>{record.status.replace(/_/g, " ")}</em>
        </div>
        <div>
          <span>Severity</span>
          <strong>{severityLabel(record.severity)}</strong>
          <em>{formatAge(record.ageSeconds)} ago</em>
        </div>
        <div>
          <span>System Decision</span>
          <strong>{formatDecision(record.decision)}</strong>
          <em>{Math.round(confidence * 100)}% confidence</em>
        </div>
        <div>
          <span>Ranking Score</span>
          <strong>{record.score.toFixed(2)}</strong>
          <em>Boundary {record.decisionBoundary.toFixed(2)}</em>
        </div>
      </div>

      <div className="detail-section">
        <h2>Why This Decision Was Made</h2>
        <p>{record.decisionReason}. This decision reflects {record.errorCount} errors, {record.retryCount} retries, {record.similarCandidateCount} similar candidates, and {record.missingTelemetry ? "incomplete telemetry" : "complete telemetry"}.</p>
      </div>

      <div className="detail-section score-contribution-list">
        <h2>Score Breakdown</h2>
        {record.reviewScoreBreakdown.map((item) => (
          <div key={item.feature}>
            <span>{item.feature}</span>
            <i className={item.contribution >= 0 ? "positive" : "negative"} style={{ width: `${Math.max(8, Math.abs(item.contribution) * 220)}px` }} />
            <strong>
              {item.contribution >= 0 ? "+" : ""}
              {item.contribution.toFixed(2)}
            </strong>
          </div>
        ))}
        <footer>
          <span>Final ranking score</span>
          <strong>{record.score.toFixed(2)}</strong>
          <span>Decision boundary</span>
          <strong>{record.decisionBoundary.toFixed(2)}</strong>
        </footer>
      </div>

      <div className="detail-section related-signal-grid">
        <h2>Related Backend-Job Signals</h2>
        {[
          ["Job status", record.status.replace(/_/g, " ")],
          ["Duration", `${(record.durationMs / 1000).toFixed(1)}s`],
          ["API latency", `${(record.apiLatencyMs / 1000).toFixed(1)}s`],
          ["Retry count", String(record.retryCount)],
          ["Error count", String(record.errorCount)],
          ["Retailer failure rate", `${Math.round(record.retailerFailureRate * 100)}%`],
          ["Address failure rate", `${Math.round(record.addressFailureRate * 100)}%`],
          ["Similar candidates", String(record.similarCandidateCount)],
          ["Missing telemetry", record.missingTelemetry ? "Yes" : "No"],
          ["Last successful run", record.lastSuccessfulRunAgeSeconds ? `${formatAge(record.lastSuccessfulRunAgeSeconds)} ago` : "Not observed"],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="detail-section similar-candidates">
        <h2>Similar and Duplicate Candidates</h2>
        <p>{record.similarCandidateCount} similar alerts in the past 30 minutes.</p>
        <div>
          <span>{similarSuppressed} suppressed</span>
          <span>{similarPromoted} promoted</span>
          <span>{similarReviewed} received human feedback</span>
        </div>
        <ul>
          {[0, 1, 2].map((offset) => (
            <li key={offset}>
              <span>{shortId(`cand-${Math.max(1, Number(record.id.replace("cand-", "")) - offset - 1)}`)}</span>
              <strong>{offset === 0 ? record.service : offset === 1 ? record.workerId : record.jobId}</strong>
              <em>{offset === 0 ? "same service pattern" : offset === 1 ? "same worker" : "same job family"}</em>
            </li>
          ))}
        </ul>
      </div>

      {record.decision === "suppress" ? (
        <div className="detail-section suppression-evidence">
          <h2>Suppression Evidence</h2>
          <p>{suppressionReason(record)}. Suppression is not treated as automatically correct.</p>
          {isHighRiskSuppression(record) ? <strong>Human review recommended</strong> : null}
        </div>
      ) : null}

      <div className="detail-section">
        <h2>Recommended Operator Action</h2>
        <p>{recommendation(record)}</p>
      </div>

      <div className="review-controls">
        <h2>Review Outcome</h2>
        <div className="outcome-grid">
          {outcomes.map(([value, label]) => (
            <button className={outcome === value ? "active" : ""} key={value} type="button" onClick={() => setOutcome(value)}>
              {label}
            </button>
          ))}
        </div>
        <textarea placeholder="Optional note" value={note} onChange={(event) => setNote(event.target.value)} />
        <div className="operator-actions">
          <button type="button" onClick={() => submit("confirm")}>
            Confirm Review
          </button>
          <button type="button" onClick={() => submit("escalate")}>
            Escalate
          </button>
          <button type="button" onClick={() => submit("close")}>
            Close Review
          </button>
          <button type="button" disabled={record.reviewStatus !== "reviewed"} onClick={onNext}>
            Review Next Alert
          </button>
        </div>
        {record.feedback ? (
          <p className="review-current-status">Current outcome: {formatOutcome(record.feedback.outcome)} / {record.feedback.appliedToRanking ? "ranking memory updated" : "audit only"}</p>
        ) : null}
        {message ? <p className="review-message">{message}</p> : null}
      </div>
    </section>
  );
}

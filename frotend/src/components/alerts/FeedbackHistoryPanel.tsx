import type { FeedbackHistoryRow } from "../../simulation/alertReviewSelectors";

export function FeedbackHistoryPanel({
  rows,
  acceptanceRate,
  rankingAdjustments,
  operatorOverrides,
}: {
  rows: FeedbackHistoryRow[];
  acceptanceRate: number;
  rankingAdjustments: number;
  operatorOverrides: number;
}) {
  return (
    <section className="alerts-panel feedback-history-panel">
      <div className="alerts-panel-heading">
        <span>Feedback History</span>
      </div>
      <div className="history-stats">
        <div>
          <span>Feedback Acceptance</span>
          <strong>{Math.round(acceptanceRate * 100)}%</strong>
        </div>
        <div>
          <span>Ranking Adjustments</span>
          <strong>{rankingAdjustments}</strong>
        </div>
        <div>
          <span>Operator Overrides</span>
          <strong>{operatorOverrides}</strong>
        </div>
      </div>
      <div className="feedback-history-table">
        <div className="history-head">
          <span>Time</span>
          <span>Alert</span>
          <span>Service / Job</span>
          <span>Reviewer</span>
          <span>Outcome</span>
          <span>System Decision</span>
          <span>Action</span>
          <span>Effect</span>
        </div>
        {rows.map((row) => (
          <div key={row.id}>
            <span>{row.time}</span>
            <strong>{row.alert}</strong>
            <span>{row.serviceJob}</span>
            <span>{row.reviewer}</span>
            <span>{row.outcome}</span>
            <span>{row.systemDecision}</span>
            <span>{row.operatorAction}</span>
            <span>{row.rankingEffect}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

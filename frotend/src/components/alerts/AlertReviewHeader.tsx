import type { StrategyMode } from "../../simulation/alertTypes";

const strategyLabels: Record<StrategyMode, string> = {
  feedback: "Feedback-Driven Ranking",
  threshold: "Fixed Threshold",
  rules: "Rule-Only Suppression",
};

export function AlertReviewHeader({
  needsReview,
  reviewedToday,
  highRiskSuppressions,
  strategy,
}: {
  needsReview: number;
  reviewedToday: number;
  highRiskSuppressions: number;
  strategy: StrategyMode;
}) {
  return (
    <header className="alerts-header">
      <div>
        <p className="eyebrow">Human-in-the-loop workspace</p>
        <h1>ALERT REVIEW.</h1>
        <p>Human review queue for adaptive alert decisions.</p>
      </div>
      <div className="alerts-header-summary" aria-label="Alert review summary">
        <div>
          <strong>{needsReview}</strong>
          <span>Need Review</span>
        </div>
        <div>
          <strong>{reviewedToday}</strong>
          <span>Reviewed Today</span>
        </div>
        <div>
          <strong>{highRiskSuppressions}</strong>
          <span>High-Risk Suppressions</span>
        </div>
        <div className="strategy">
          <span>Current Strategy</span>
          <strong>{strategyLabels[strategy]}</strong>
        </div>
      </div>
    </header>
  );
}

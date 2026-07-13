import { ensureFeedbackEffects, feedbackAcceptanceRate } from "../../simulation/dashboardSelectors";
import type { DashboardAlertRecord, FeedbackEffect } from "../../simulation/dashboardTypes";

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function timeLabel(value: number) {
  if (value < 60) return `${Math.round(value)}s`;
  return `${Math.round(value / 60)}m`;
}

export function FeedbackImpactPanel({
  records,
  effects,
  now,
}: {
  records: DashboardAlertRecord[];
  effects: FeedbackEffect[];
  now: number;
}) {
  const resolvedEffects = ensureFeedbackEffects(records, effects);
  const feedbackEvents = records.filter((record) => record.feedbackStatus !== "none").length;
  return (
    <section className="dashboard-panel analysis-panel">
      <div className="panel-heading">
        <span>Feedback Impact</span>
      </div>
      <div className="feedback-summary">
        <div>
          <span>Feedback Events</span>
          <strong>{feedbackEvents}</strong>
        </div>
        <div>
          <span>Acceptance Rate</span>
          <strong>{pct(feedbackAcceptanceRate(records))}</strong>
        </div>
        <div>
          <span>Ranking Adjustments</span>
          <strong>{effects.length}</strong>
        </div>
      </div>
      <div className="feedback-effects">
        {resolvedEffects.slice(0, 4).map((effect) => (
          <article key={effect.id}>
            <span>{timeLabel(Math.max(0, now - effect.timestamp))} ago</span>
            <strong>{effect.service}</strong>
            <p>{effect.description}</p>
            <em>{effect.feedbackType.replace("_", " ")}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

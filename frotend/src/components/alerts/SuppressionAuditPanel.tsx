import type { SuppressionAudit } from "../../simulation/alertReviewSelectors";

export function SuppressionAuditPanel({ audit }: { audit: SuppressionAudit }) {
  return (
    <section className="alerts-panel suppression-audit-panel">
      <div className="alerts-panel-heading">
        <span>Suppression Audit</span>
      </div>
      <div className="suppression-audit-stats">
        <div>
          <span>Suppressed Reviewed</span>
          <strong>{audit.suppressedReviewed}</strong>
        </div>
        <div>
          <span>Operator Overrides</span>
          <strong>{audit.operatorOverrides}</strong>
        </div>
        <div>
          <span>Confirmed Real Incidents After Suppression</span>
          <strong>{audit.suppressedRealIncidents}</strong>
        </div>
        <div>
          <span>Low-Confidence Awaiting Review</span>
          <strong>{audit.lowConfidenceAwaiting}</strong>
        </div>
        <div>
          <span>Rule-Triggered Suppressions</span>
          <strong>{audit.ruleTriggered}</strong>
        </div>
        <div>
          <span>Feedback-Driven Suppressions</span>
          <strong>{audit.feedbackDriven}</strong>
        </div>
      </div>
      <div className="suppression-case-list">
        {audit.cases.map((item) => (
          <article key={item.id}>
            <strong>{item.id}</strong>
            <span>{item.service}</span>
            <p>{item.reason}</p>
            <em>{item.status}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

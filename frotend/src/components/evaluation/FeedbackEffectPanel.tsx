import type { ExperimentResult, StrategyRunMetrics } from "../../experiments/experimentTypes";
import { compactNumber, pct, signedPctPoints } from "../../experiments/experimentFormatters";

function row(label: string, before: number | string, after: number | string, delta: string) {
  return { label, before, after, delta };
}

export function FeedbackEffectPanel({ result }: { result: ExperimentResult }) {
  const before = result.feedbackBefore;
  const after = result.feedbackAfter;
  const rows = [
    row("Low-Value Alerts Sent", compactNumber(before.lowValueAlertsSent), compactNumber(after.lowValueAlertsSent), compactNumber(after.lowValueAlertsSent - before.lowValueAlertsSent)),
    row("Precision", pct(before.precision), pct(after.precision), signedPctPoints(after.precision - before.precision)),
    row("Recall", pct(before.recall), pct(after.recall), signedPctPoints(after.recall - before.recall)),
    row("Duplicate Alerts Sent", compactNumber(before.duplicateAlertsSurfaced), compactNumber(after.duplicateAlertsSurfaced), compactNumber(after.duplicateAlertsSurfaced - before.duplicateAlertsSurfaced)),
    row("Operator Overrides", compactNumber(before.operatorOverrides), compactNumber(after.operatorOverrides), compactNumber(after.operatorOverrides - before.operatorOverrides)),
  ];

  return (
    <section className="evaluation-panel feedback-effect-panel">
      <div className="evaluation-panel-heading">
        <span>Human Feedback Effect</span>
      </div>
      <div className="before-after-table">
        <div className="before-after-head">
          <span>Metric</span>
          <span>Before</span>
          <span>After</span>
          <span>Delta</span>
        </div>
        {rows.map((item) => (
          <div key={item.label}>
            <strong>{item.label}</strong>
            <span>{item.before}</span>
            <span>{item.after}</span>
            <span>{item.delta}</span>
          </div>
        ))}
      </div>
      <div className="feedback-progression">
        {result.feedbackProgression.map((round) => {
          const max = Math.max(...result.feedbackProgression.map((item) => item.lowValueAlertsSent));
          return (
            <div key={round.round}>
              <span>Round {round.round}</span>
              <i style={{ width: `${Math.max(5, (round.lowValueAlertsSent / max) * 100)}%` }} />
              <strong>{compactNumber(round.lowValueAlertsSent)}</strong>
              <em>Recall {pct(round.recall)}</em>
            </div>
          );
        })}
      </div>
      <div className="weight-change-list">
        {result.feedbackWeightChanges.map((change) => (
          <article key={change.key}>
            <strong>{change.service ?? change.workerId}</strong>
            <span>{change.pattern}</span>
            <em>{change.delta >= 0 ? "+" : ""}{change.delta.toFixed(2)}</em>
            <p>{change.feedbackSource}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

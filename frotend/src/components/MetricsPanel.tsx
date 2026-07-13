import type { SimulationMetrics } from "../simulation/alertTypes";

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export function MetricsPanel({ metrics }: { metrics: SimulationMetrics }) {
  const primary = [
    ["Low-Value Suppressed", number(metrics.lowValueAlertsSuppressed)],
    ["Alert Reduction", percent(metrics.alertReduction)],
    ["Recall", percent(metrics.recall)],
  ];
  const secondary = [
    ["Jobs Processed", number(metrics.jobsProcessed)],
    ["Raw Candidates", number(metrics.rawAlertCandidates)],
    ["Alerts Sent", number(metrics.actionableAlertsSent)],
    ["Precision", percent(metrics.precision)],
    ["Feedback Events", number(metrics.feedbackEvents)],
    ["p95 Job Duration", `${number(metrics.p95JobDuration)}ms`],
    ["Active Workers", number(metrics.activeWorkers)],
  ];

  return (
    <div className="metrics-panel">
      <div className="primary-metrics">
        {primary.map(([label, value]) => (
          <div className="metric-primary" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="secondary-metrics">
        {secondary.map(([label, value]) => (
          <div className="metric-secondary" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

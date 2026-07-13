import type { StrategyMode } from "../simulation/alertTypes";

const names: Record<StrategyMode, string> = {
  feedback: "Feedback-Driven Ranking",
  threshold: "Fixed Threshold",
  rules: "Rule-Only Suppression",
};

export function MonitoringHeader({ strategy }: { strategy: StrategyMode }) {
  return (
    <div className="monitoring-header">
      <span>Synthetic controlled simulation</span>
      <strong>{names[strategy]}</strong>
    </div>
  );
}

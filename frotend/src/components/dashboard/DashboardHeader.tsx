import type { StrategyMode } from "../../simulation/alertTypes";

const strategyLabels: Record<StrategyMode, string> = {
  feedback: "Feedback Ranking",
  threshold: "Fixed Threshold",
  rules: "Rule Only",
};

export function DashboardHeader({
  strategy,
  paused,
  onStrategyChange,
  onTogglePaused,
  onRunComparison,
}: {
  strategy: StrategyMode;
  paused: boolean;
  onStrategyChange: (mode: StrategyMode) => void;
  onTogglePaused: () => void;
  onRunComparison: () => void;
}) {
  return (
    <header className="dashboard-header">
      <div>
        <p className="eyebrow">Controlled backend-job simulation</p>
        <h1>
          ALERT QUALITY
          <br />
          DASHBOARD.
        </h1>
        <p>Same seeded input stream across all strategies</p>
      </div>
      <div className="dashboard-controls" aria-label="Dashboard controls">
        <div className="dashboard-strategy-tabs">
          {(["feedback", "threshold", "rules"] as StrategyMode[]).map((mode) => (
            <button className={mode === strategy ? "active" : ""} key={mode} type="button" onClick={() => onStrategyChange(mode)}>
              {strategyLabels[mode]}
            </button>
          ))}
        </div>
        <div className="dashboard-status">
          <span>{paused ? "Paused" : "Simulation running"}</span>
          <button type="button" onClick={onTogglePaused}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button type="button" onClick={onRunComparison}>
            Run Comparison
          </button>
        </div>
      </div>
    </header>
  );
}

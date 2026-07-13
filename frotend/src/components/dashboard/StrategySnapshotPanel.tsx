import type { StrategyMode } from "../../simulation/alertTypes";
import type { StrategyComparisonRow } from "../../simulation/dashboardTypes";

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function StrategySnapshotPanel({
  rows,
  current,
}: {
  rows: StrategyComparisonRow[];
  current: StrategyMode;
}) {
  return (
    <section className="dashboard-panel analysis-panel">
      <div className="panel-heading">
        <span>Strategy Comparison Snapshot</span>
      </div>
      <div className="strategy-snapshot-table">
        <div className="snapshot-head">
          <span>Strategy</span>
          <span>Sent</span>
          <span>FP</span>
          <span>Precision</span>
          <span>Recall</span>
          <span>Reduction</span>
        </div>
        {rows.map((row) => (
          <div className={row.mode === current ? "active" : ""} key={row.mode}>
            <strong>
              {row.strategy}
              {row.mode === current ? <em>ACTIVE</em> : null}
            </strong>
            <span>{row.alertsSent}</span>
            <span>{row.falsePositives}</span>
            <span>{pct(row.precision)}</span>
            <span>{pct(row.recall)}</span>
            <span>{pct(row.alertReduction)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

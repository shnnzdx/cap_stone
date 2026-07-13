import { buildNoiseBreakdown } from "../../simulation/dashboardSelectors";
import type { DashboardAlertRecord } from "../../simulation/dashboardTypes";

export function NoiseBreakdownPanel({ records }: { records: DashboardAlertRecord[] }) {
  const rows = buildNoiseBreakdown(records);
  return (
    <section className="dashboard-panel analysis-panel">
      <div className="panel-heading">
        <span>Noise Reduction Breakdown</span>
      </div>
      <div className="noise-list">
        {rows.map((row) => (
          <div key={row.label}>
            <div>
              <span>{row.label}</span>
              <strong>{row.count}</strong>
            </div>
            <div className="bar-track">
              <i style={{ width: `${Math.round(row.percent * 100)}%` }} />
            </div>
            <em>{Math.round(row.percent * 100)}% of suppressed low-value alerts</em>
          </div>
        ))}
      </div>
    </section>
  );
}

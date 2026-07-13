import type { DashboardAlertRecord } from "../../simulation/dashboardTypes";

export function ScoreBreakdown({ record }: { record: DashboardAlertRecord }) {
  return (
    <div className="score-breakdown">
      {record.scoreBreakdown.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <div>
            <i style={{ width: `${Math.round(item.value * 100)}%` }} />
          </div>
          <strong>{Math.round(item.value * 100)}</strong>
        </div>
      ))}
    </div>
  );
}

import type { DashboardKpi } from "../../simulation/dashboardSelectors";

export function QualityKpiCard({ kpi }: { kpi: DashboardKpi }) {
  return (
    <article className="quality-kpi-card">
      <span>{kpi.label}</span>
      <strong>{kpi.value}</strong>
      <em>{kpi.delta}</em>
      <p>{kpi.interpretation}</p>
    </article>
  );
}

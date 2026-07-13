import type { DashboardKpi } from "../../simulation/dashboardSelectors";
import { QualityKpiCard } from "./QualityKpiCard";

export function QualityKpiStrip({ kpis }: { kpis: DashboardKpi[] }) {
  return (
    <section className="quality-kpi-strip" aria-label="Alert quality KPIs">
      {kpis.map((kpi) => (
        <QualityKpiCard kpi={kpi} key={kpi.label} />
      ))}
    </section>
  );
}

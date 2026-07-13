import type { AlertReviewFilter, AlertReviewFilters } from "../../simulation/alertReviewSelectors";

const primaryFilters: Array<[AlertReviewFilter, string]> = [
  ["needs_review", "Needs Review"],
  ["promoted", "Promoted"],
  ["suppressed", "Suppressed"],
  ["high_risk", "High-Risk Suppressions"],
  ["reviewed", "Reviewed"],
  ["all", "All"],
];

export function AlertQueueFilters({
  filters,
  services,
  onChange,
}: {
  filters: AlertReviewFilters;
  services: string[];
  onChange: (filters: AlertReviewFilters) => void;
}) {
  const update = (patch: Partial<AlertReviewFilters>) => onChange({ ...filters, ...patch });
  return (
    <section className="alerts-filter-bar" aria-label="Alert review filters">
      <div className="alerts-primary-filters">
        {primaryFilters.map(([value, label]) => (
          <button className={filters.primary === value ? "active" : ""} key={value} type="button" onClick={() => update({ primary: value })}>
            {label}
          </button>
        ))}
      </div>
      <div className="alerts-secondary-filters">
        <input
          aria-label="Search alerts"
          placeholder="Search alert, service, job, worker"
          value={filters.search}
          onChange={(event) => update({ search: event.target.value })}
        />
        <select aria-label="Service filter" value={filters.service} onChange={(event) => update({ service: event.target.value })}>
          <option value="all">All services</option>
          {services.map((service) => (
            <option key={service} value={service}>
              {service}
            </option>
          ))}
        </select>
        <select aria-label="Severity filter" value={filters.severity} onChange={(event) => update({ severity: event.target.value })}>
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select aria-label="Decision filter" value={filters.decision} onChange={(event) => update({ decision: event.target.value })}>
          <option value="all">All decisions</option>
          <option value="promote">Promoted</option>
          <option value="suppress">Suppressed</option>
        </select>
        <select aria-label="Feedback status filter" value={filters.feedback} onChange={(event) => update({ feedback: event.target.value })}>
          <option value="all">All feedback</option>
          <option value="unreviewed">Unreviewed</option>
          <option value="real_incident">Real Incident</option>
          <option value="false_positive">False Positive</option>
          <option value="duplicate">Duplicate</option>
          <option value="expected_behavior">Expected Behavior</option>
          <option value="non_actionable">Non-Actionable</option>
          <option value="needs_more_information">Needs More Information</option>
        </select>
      </div>
    </section>
  );
}

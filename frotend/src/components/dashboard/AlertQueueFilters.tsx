export type AlertQueueFilter = "needs_review" | "promoted" | "suppressed" | "all";

export function AlertQueueFilters({
  filter,
  search,
  onFilterChange,
  onSearchChange,
}: {
  filter: AlertQueueFilter;
  search: string;
  onFilterChange: (filter: AlertQueueFilter) => void;
  onSearchChange: (search: string) => void;
}) {
  const filters: Array<[AlertQueueFilter, string]> = [
    ["needs_review", "Needs Review"],
    ["promoted", "Promoted"],
    ["suppressed", "Suppressed"],
    ["all", "All Candidates"],
  ];
  return (
    <div className="alert-queue-filters">
      <div>
        {filters.map(([value, label]) => (
          <button className={filter === value ? "active" : ""} key={value} type="button" onClick={() => onFilterChange(value)}>
            {label}
          </button>
        ))}
      </div>
      <input
        aria-label="Search alerts"
        placeholder="Search alert, service, job, worker"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
    </div>
  );
}

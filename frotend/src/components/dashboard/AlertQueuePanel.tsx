import type { DashboardAlertRecord } from "../../simulation/dashboardTypes";
import { AlertQueueFilters, type AlertQueueFilter } from "./AlertQueueFilters";
import { AlertQueueTable } from "./AlertQueueTable";

export function AlertQueuePanel({
  records,
  selectedId,
  filter,
  search,
  onFilterChange,
  onSearchChange,
  onSelect,
}: {
  records: DashboardAlertRecord[];
  selectedId?: string;
  filter: AlertQueueFilter;
  search: string;
  onFilterChange: (filter: AlertQueueFilter) => void;
  onSearchChange: (search: string) => void;
  onSelect: (record: DashboardAlertRecord) => void;
}) {
  return (
    <section className="dashboard-panel alert-queue-panel">
      <div className="panel-heading">
        <span>Current Alert Queue</span>
        <strong>{records.length}</strong>
      </div>
      <AlertQueueFilters filter={filter} search={search} onFilterChange={onFilterChange} onSearchChange={onSearchChange} />
      <AlertQueueTable records={records} selectedId={selectedId} onSelect={onSelect} />
    </section>
  );
}

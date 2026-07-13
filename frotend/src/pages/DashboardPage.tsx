import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { AlertInspector } from "../components/dashboard/AlertInspector";
import { AlertQueuePanel } from "../components/dashboard/AlertQueuePanel";
import type { AlertQueueFilter } from "../components/dashboard/AlertQueueFilters";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { FeedbackImpactPanel } from "../components/dashboard/FeedbackImpactPanel";
import { NoiseBreakdownPanel } from "../components/dashboard/NoiseBreakdownPanel";
import { QualityKpiStrip } from "../components/dashboard/QualityKpiStrip";
import { StrategySnapshotPanel } from "../components/dashboard/StrategySnapshotPanel";
import { buildKpis, buildSecondaryStats } from "../simulation/dashboardSelectors";
import type { DashboardAlertRecord } from "../simulation/dashboardTypes";
import { SimulationEngine } from "../simulation/simulationEngine";
import { useAlertReviewStore } from "../simulation/alertReviewStore";

function filterRecords(records: DashboardAlertRecord[], filter: AlertQueueFilter, search: string) {
  const term = search.trim().toLowerCase();
  return records.filter((record) => {
    if (filter === "needs_review" && record.feedbackStatus !== "none") return false;
    if (filter === "promoted" && record.decision !== "promote") return false;
    if (filter === "suppressed" && record.decision !== "suppress") return false;
    if (!term) return true;
    return [record.id, record.service, record.jobId, record.workerId, record.status]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });
}

export function DashboardPage() {
  const { snapshot, strategy, paused, comparisonRows, setPaused, setStrategy, runComparison, acknowledgeAlert } = useAlertReviewStore();
  const [filter, setFilter] = useState<AlertQueueFilter>("needs_review");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [acknowledgedId, setAcknowledgedId] = useState<string>();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const filteredRecords = useMemo(() => filterRecords(snapshot.records, filter, search), [filter, search, snapshot.records]);
  const selectedRecord = useMemo(
    () => snapshot.records.find((record) => record.id === selectedId) ?? filteredRecords[0],
    [filteredRecords, selectedId, snapshot.records],
  );
  const baselineRows = useMemo(() => {
    const baseline = new SimulationEngine();
    baseline.setStrategy("threshold");
    for (let time = 0; time <= 90; time += 0.2) baseline.update(time, false);
    return baseline.getAlertHistory(90);
  }, []);
  const kpis = useMemo(() => buildKpis(snapshot.records, baselineRows), [baselineRows, snapshot.records]);
  const secondaryStats = useMemo(() => buildSecondaryStats(snapshot.metrics), [snapshot.metrics]);

  const handleStrategyChange = (mode: typeof strategy) => {
    setStrategy(mode);
    setSelectedId(undefined);
    setAcknowledgedId(undefined);
  };

  return (
    <main className="dashboard-page">
      <Navigation current="dashboard" />
      <DashboardHeader
        strategy={strategy}
        paused={paused}
        onStrategyChange={handleStrategyChange}
        onTogglePaused={() => setPaused((value) => !value)}
        onRunComparison={runComparison}
      />
      <QualityKpiStrip kpis={kpis} />
      <div className="dashboard-secondary-stats" aria-label="Secondary simulation statistics">
        {secondaryStats.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <section className="dashboard-main-row">
        <AlertQueuePanel
          records={filteredRecords}
          selectedId={selectedRecord?.id}
          filter={filter}
          search={search}
          onFilterChange={setFilter}
          onSearchChange={setSearch}
          onSelect={(record) => {
            setSelectedId(record.id);
            setAcknowledgedId(undefined);
          }}
        />
        <AlertInspector
          record={selectedRecord}
          acknowledged={acknowledgedId === selectedRecord?.id}
          onAcknowledge={(id) => {
            if (acknowledgeAlert(id)) setAcknowledgedId(id);
          }}
        />
      </section>
      <section className="dashboard-analysis-row">
        <NoiseBreakdownPanel records={snapshot.records} />
        <StrategySnapshotPanel rows={comparisonRows} current={strategy} />
        <FeedbackImpactPanel records={snapshot.records} effects={snapshot.effects} now={snapshot.now} />
      </section>
    </main>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { AlertQueueFilters } from "../components/alerts/AlertQueueFilters";
import { AlertReviewHeader } from "../components/alerts/AlertReviewHeader";
import { AlertReviewQueue } from "../components/alerts/AlertReviewQueue";
import { DecisionDetailPanel } from "../components/alerts/DecisionDetailPanel";
import { FeedbackHistoryPanel } from "../components/alerts/FeedbackHistoryPanel";
import { SuppressionAuditPanel } from "../components/alerts/SuppressionAuditPanel";
import {
  getFeedbackHistory,
  getReviewQueue,
  getReviewStats,
  getSuppressionAudit,
  isHighRiskSuppression,
  reviewPriority,
  type AlertReviewFilters,
} from "../simulation/alertReviewSelectors";
import { useAlertReviewStore } from "../simulation/alertReviewStore";

function selectedIdFromHash() {
  const hash = window.location.hash;
  if (!hash.startsWith("#alerts/")) return undefined;
  return decodeURIComponent(hash.replace("#alerts/", ""));
}

const defaultFilters: AlertReviewFilters = {
  primary: "needs_review",
  search: "",
  service: "all",
  severity: "all",
  decision: "all",
  feedback: "all",
};

export function AlertsPage() {
  const { snapshot, strategy, submitAlertReview, getNextReviewAlert } = useAlertReviewStore();
  const [filters, setFilters] = useState<AlertReviewFilters>(defaultFilters);
  const [selectedId, setSelectedId] = useState<string | undefined>(() => selectedIdFromHash());

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const updateSelectedFromHash = () => {
      const fromHash = selectedIdFromHash();
      if (fromHash) setSelectedId(fromHash);
    };

    updateSelectedFromHash();
    window.addEventListener("hashchange", updateSelectedFromHash);
    return () => window.removeEventListener("hashchange", updateSelectedFromHash);
  }, []);

  const services = useMemo(() => Array.from(new Set(snapshot.records.map((record) => record.service))).sort(), [snapshot.records]);
  const queue = useMemo(() => getReviewQueue(snapshot.records, filters), [filters, snapshot.records]);
  const selectedRecord = useMemo(() => {
    return snapshot.records.find((record) => record.id === selectedId) ?? queue[0] ?? snapshot.records[0];
  }, [queue, selectedId, snapshot.records]);
  const stats = useMemo(() => getReviewStats(snapshot.records, ""), [snapshot.records]);
  const historyRows = useMemo(() => getFeedbackHistory(snapshot.records), [snapshot.records]);
  const audit = useMemo(() => getSuppressionAudit(snapshot.records, snapshot.effects), [snapshot.effects, snapshot.records]);
  const rankedRecords = useMemo(() => [...snapshot.records].filter((record) => record.reviewStatus !== "reviewed").sort((a, b) => reviewPriority(b).score - reviewPriority(a).score), [snapshot.records]);
  const acceptanceRate = historyRows.length === 0 ? 0 : historyRows.filter((row) => row.outcome === "Real Incident" || row.outcome === "Needs More Information").length / historyRows.length;

  return (
    <main className="alerts-page">
      <Navigation current="alerts" />
      <AlertReviewHeader
        needsReview={stats.needsReview}
        reviewedToday={stats.reviewedToday}
        highRiskSuppressions={stats.highRiskSuppressions}
        strategy={strategy}
      />
      <AlertQueueFilters filters={filters} services={services} onChange={setFilters} />
      <section className="alerts-workspace">
        <AlertReviewQueue records={queue} selectedId={selectedRecord?.id} onSelect={setSelectedId} />
        <DecisionDetailPanel
          record={selectedRecord}
          strategy={strategy}
          onSubmit={submitAlertReview}
          onNext={() => {
            const next = getNextReviewAlert(selectedRecord?.id) ?? rankedRecords[0];
            if (next) setSelectedId(next.id);
          }}
        />
      </section>
      <section className="alerts-bottom-row">
        <FeedbackHistoryPanel
          rows={historyRows}
          acceptanceRate={acceptanceRate}
          rankingAdjustments={snapshot.effects.length}
          operatorOverrides={snapshot.records.filter((record) => record.escalated || (record.decision === "suppress" && record.feedback?.outcome === "real_incident")).length}
        />
        <SuppressionAuditPanel audit={{ ...audit, cases: audit.cases.length > 0 ? audit.cases : snapshot.records.filter(isHighRiskSuppression).slice(0, 4).map((record) => ({ id: record.id.replace("cand-", "ALT-"), service: record.service, reason: "High-risk suppression awaiting human review", status: "Pending human review" })) }} />
      </section>
    </main>
  );
}

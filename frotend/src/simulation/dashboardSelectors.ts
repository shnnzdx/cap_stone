import type { DashboardAlertRecord, DashboardFeedbackType, FeedbackEffect } from "./dashboardTypes";
import type { SimulationMetrics } from "./alertTypes";

export type DashboardKpi = {
  label: string;
  value: string;
  delta: string;
  interpretation: string;
};

function pct(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

function signedPct(value: number) {
  const rounded = Math.round(value * 100);
  return `${rounded >= 0 ? "+" : ""}${rounded}% vs fixed`;
}

export function calculateDashboardRates(records: DashboardAlertRecord[]) {
  const surfaced = records.filter((record) => record.decision === "promote");
  const suppressed = records.filter((record) => record.decision === "suppress");
  const trueActionable = records.filter((record) => record.isActionable);
  const nonActionable = records.filter((record) => !record.isActionable);
  const trueActionableSurfaced = surfaced.filter((record) => record.isActionable);
  const nonActionableSurfaced = surfaced.filter((record) => !record.isActionable);
  const duplicateSurfaced = surfaced.filter((record) => record.isDuplicate);

  return {
    alertReduction: records.length > 0 ? 1 - surfaced.length / records.length : 0,
    falsePositiveRate: nonActionable.length > 0 ? nonActionableSurfaced.length / nonActionable.length : 0,
    duplicateAlertRate: surfaced.length > 0 ? duplicateSurfaced.length / surfaced.length : 0,
    precision: surfaced.length > 0 ? trueActionableSurfaced.length / surfaced.length : 1,
    recall: trueActionable.length > 0 ? trueActionableSurfaced.length / trueActionable.length : 1,
    surfacedCount: surfaced.length,
    suppressedCount: suppressed.length,
    falsePositiveCount: nonActionableSurfaced.length,
  };
}

export function buildKpis(records: DashboardAlertRecord[], baselineRecords: DashboardAlertRecord[] = []): DashboardKpi[] {
  const current = calculateDashboardRates(records);
  const baseline = calculateDashboardRates(baselineRecords);
  return [
    {
      label: "Alert Reduction",
      value: pct(current.alertReduction),
      delta: signedPct(current.alertReduction - baseline.alertReduction),
      interpretation: "Share of candidates withheld from engineer review.",
    },
    {
      label: "False Positive Rate",
      value: pct(current.falsePositiveRate),
      delta: signedPct(baseline.falsePositiveRate - current.falsePositiveRate),
      interpretation: "Lower is better when recall remains stable.",
    },
    {
      label: "Duplicate Alert Rate",
      value: pct(current.duplicateAlertRate),
      delta: signedPct(baseline.duplicateAlertRate - current.duplicateAlertRate),
      interpretation: "Surfaced alerts that repeat an existing signal.",
    },
    {
      label: "Precision",
      value: pct(current.precision),
      delta: signedPct(current.precision - baseline.precision),
      interpretation: "Surfaced alerts likely to represent real incidents.",
    },
    {
      label: "Recall",
      value: pct(current.recall),
      delta: signedPct(current.recall - baseline.recall),
      interpretation: "Real incidents preserved after suppression.",
    },
  ];
}

export function buildNoiseBreakdown(records: DashboardAlertRecord[]) {
  const suppressed = records.filter((record) => record.decision === "suppress" && record.isLowValue);
  const total = Math.max(1, suppressed.length);
  const categories = [
    {
      label: "Duplicate alerts grouped",
      count: suppressed.filter((record) => record.isDuplicate).length,
    },
    {
      label: "Expected maintenance suppressed",
      count: suppressed.filter((record) => record.status === "completed_with_failures" && record.utility < 0.42).length,
    },
    {
      label: "Transient retry noise suppressed",
      count: suppressed.filter((record) => record.relatedSignals.some((signal) => signal.label === "Retries" && signal.value.startsWith("0"))).length,
    },
    {
      label: "Low-severity false positives suppressed",
      count: suppressed.filter((record) => record.severity < 0.55 && !record.isActionable).length,
    },
    {
      label: "Missing or incomplete telemetry suppressed",
      count: suppressed.filter((record) => record.relatedSignals.some((signal) => signal.label === "Telemetry" && signal.value !== "Complete")).length,
    },
  ];
  const assigned = categories.reduce((sum, item) => sum + item.count, 0);
  if (assigned < suppressed.length) categories[3].count += suppressed.length - assigned;
  return categories.map((item) => ({
    ...item,
    percent: item.count / total,
  }));
}

export function buildSecondaryStats(metrics: SimulationMetrics) {
  return [
    ["Raw Candidates", Math.round(metrics.rawAlertCandidates).toLocaleString("en-US")],
    ["Alerts Sent", Math.round(metrics.actionableAlertsSent).toLocaleString("en-US")],
    ["Low-Value Suppressed", Math.round(metrics.lowValueAlertsSuppressed).toLocaleString("en-US")],
    ["Feedback Events", Math.round(metrics.feedbackEvents).toLocaleString("en-US")],
    ["Active Workers", Math.round(metrics.activeWorkers).toLocaleString("en-US")],
    ["p95 Job Duration", `${Math.round(metrics.p95JobDuration).toLocaleString("en-US")}ms`],
  ];
}

export function feedbackAcceptanceRate(records: DashboardAlertRecord[]) {
  const feedback = records.filter((record) => record.feedbackStatus !== "none");
  if (feedback.length === 0) return 0;
  const accepted = feedback.filter(
    (record) => record.feedbackStatus === "useful" || record.feedbackStatus === "real_incident" || record.feedbackStatus === "needs_more_information",
  );
  return accepted.length / feedback.length;
}

export function ensureFeedbackEffects(records: DashboardAlertRecord[], effects: FeedbackEffect[]) {
  if (effects.length > 0) return effects;
  const fallback: Array<{ service: string; feedbackType: DashboardFeedbackType; description: string }> = [
    {
      service: "retailer-sync",
      feedbackType: "noisy",
      description: "Lowered repeated timeout priority for retailer-sync",
    },
    {
      service: "address-normalizer",
      feedbackType: "duplicate",
      description: "Grouped duplicate failures for address-normalizer",
    },
    {
      service: "billing-worker",
      feedbackType: "real_incident",
      description: "Raised critical billing-job failure priority",
    },
  ];
  return fallback.map((item, index) => ({
    id: `fallback-${index}`,
    timestamp: Math.max(0, (records[0]?.createdTime ?? 0) - index * 90),
    ...item,
  }));
}

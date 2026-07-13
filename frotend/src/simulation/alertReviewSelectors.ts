import type { DashboardAlertRecord, DashboardFeedbackType, FeedbackEffect, OperatorAction, ReviewOutcome } from "./dashboardTypes";

export type AlertReviewFilter = "needs_review" | "promoted" | "suppressed" | "high_risk" | "reviewed" | "all";

export type AlertReviewFilters = {
  primary: AlertReviewFilter;
  search: string;
  service: string;
  severity: string;
  decision: string;
  feedback: string;
};

export type FeedbackHistoryRow = {
  id: string;
  time: string;
  alert: string;
  serviceJob: string;
  reviewer: string;
  outcome: string;
  systemDecision: string;
  operatorAction: string;
  rankingEffect: string;
};

export type SuppressionAudit = {
  suppressedReviewed: number;
  operatorOverrides: number;
  suppressedRealIncidents: number;
  lowConfidenceAwaiting: number;
  ruleTriggered: number;
  feedbackDriven: number;
  cases: Array<{
    id: string;
    service: string;
    reason: string;
    status: string;
  }>;
};

export function severityLabel(value: number) {
  if (value >= 0.82) return "Critical";
  if (value >= 0.62) return "High";
  if (value >= 0.42) return "Medium";
  return "Low";
}

export function formatDecision(value: string) {
  return value === "promote" ? "Promoted" : value === "suppress" ? "Suppressed" : "Grouped";
}

export function formatOutcome(value: ReviewOutcome | DashboardFeedbackType | "none") {
  const labels: Record<ReviewOutcome | DashboardFeedbackType | "none", string> = {
    none: "Unreviewed",
    useful: "Useful",
    noisy: "Noisy",
    real_incident: "Real Incident",
    false_positive: "False Positive",
    duplicate: "Duplicate",
    expected: "Expected",
    expected_behavior: "Expected Behavior",
    non_actionable: "Non-Actionable",
    needs_more_information: "Needs More Information",
  };
  return labels[value];
}

export function formatOperatorAction(value: OperatorAction) {
  const labels: Record<OperatorAction, string> = {
    confirm: "Confirm Review",
    escalate: "Escalate",
    close: "Close Review",
  };
  return labels[value];
}

export function displayConfidence(record: DashboardAlertRecord) {
  return Math.max(0.42, Math.min(0.96, 0.54 + record.confidence));
}

export function isHighRiskSuppression(record: DashboardAlertRecord) {
  const nearBoundary = Math.abs(record.score - record.decisionBoundary) < 0.12 || displayConfidence(record) < 0.68;
  const riskySeverity = record.severity >= 0.62;
  const criticalService = record.service === "billing-worker" || record.service === "retailer-sync";
  return record.decision === "suppress" && (nearBoundary || riskySeverity || criticalService || record.errorCount >= 8);
}

export function reviewPriority(record: DashboardAlertRecord) {
  const confidence = displayConfidence(record);
  const uncertainty = 1 - confidence;
  const severityWeight = record.severity;
  const suppressedRisk = isHighRiskSuppression(record) ? 0.34 : 0;
  const ageWeight = Math.min(0.16, record.ageSeconds / 900);
  const criticality = record.service === "billing-worker" || record.service === "retailer-sync" ? 0.16 : 0.06;
  const duplicateWeight = Math.min(0.14, record.similarCandidateCount / 100);
  const disagreement = record.decision === "suppress" && record.feedback?.outcome === "real_incident" ? 0.28 : 0;
  const score = uncertainty * 0.26 + severityWeight * 0.24 + suppressedRisk + ageWeight + criticality + duplicateWeight + disagreement;
  const reasons: string[] = [];

  if (confidence < 0.68) reasons.push("Low confidence");
  if (record.severity >= 0.82) reasons.push("Critical severity");
  else if (record.severity >= 0.62) reasons.push("High severity");
  if (isHighRiskSuppression(record)) reasons.push("High-risk suppression");
  if (Math.abs(record.score - record.decisionBoundary) < 0.12) reasons.push("Near decision boundary");
  if (criticality >= 0.16) reasons.push("Critical service");
  if (record.similarCandidateCount >= 10) reasons.push("Duplicate cluster");
  if (reasons.length === 0) reasons.push(record.decision === "suppress" ? "Suppression review" : "Promoted alert review");

  return {
    score,
    level: score >= 0.78 ? "HIGH" : score >= 0.55 ? "MEDIUM" : "LOW",
    reasons: reasons.slice(0, 2),
  };
}

export function getReviewQueue(records: DashboardAlertRecord[], filters: AlertReviewFilters) {
  const term = filters.search.trim().toLowerCase();
  return records
    .filter((record) => {
      if (filters.primary === "needs_review" && record.reviewStatus === "reviewed") return false;
      if (filters.primary === "promoted" && record.decision !== "promote") return false;
      if (filters.primary === "suppressed" && record.decision !== "suppress") return false;
      if (filters.primary === "high_risk" && !isHighRiskSuppression(record)) return false;
      if (filters.primary === "reviewed" && record.reviewStatus !== "reviewed") return false;
      if (filters.service !== "all" && record.service !== filters.service) return false;
      if (filters.severity !== "all" && severityLabel(record.severity).toLowerCase() !== filters.severity) return false;
      if (filters.decision !== "all" && record.decision !== filters.decision) return false;
      if (filters.feedback !== "all") {
        if (filters.feedback === "unreviewed" && record.feedbackStatus !== "none") return false;
        if (filters.feedback !== "unreviewed" && record.feedbackStatus !== filters.feedback) return false;
      }
      if (!term) return true;
      return [record.id, record.service, record.jobId, record.workerId].join(" ").toLowerCase().includes(term);
    })
    .sort((a, b) => {
      if (a.reviewStatus !== b.reviewStatus) return a.reviewStatus === "reviewed" ? 1 : -1;
      return reviewPriority(b).score - reviewPriority(a).score;
    });
}

export function getReviewStats(records: DashboardAlertRecord[], strategyName: string) {
  return {
    needsReview: records.filter((record) => record.reviewStatus !== "reviewed").length,
    reviewedToday: records.filter((record) => record.reviewStatus === "reviewed").length,
    highRiskSuppressions: records.filter(isHighRiskSuppression).length,
    currentStrategy: strategyName,
  };
}

export function getFeedbackHistory(records: DashboardAlertRecord[]): FeedbackHistoryRow[] {
  return records
    .filter((record) => record.feedback)
    .sort((a, b) => (b.feedback?.submittedAt ?? 0) - (a.feedback?.submittedAt ?? 0))
    .slice(0, 8)
    .map((record) => ({
      id: `${record.id}-${record.feedback?.submittedAt}`,
      time: formatAge(record.feedback?.submittedAt ?? record.createdTime),
      alert: shortId(record.id),
      serviceJob: `${record.service} / ${record.jobId}`,
      reviewer: record.feedback?.reviewer ?? "You",
      outcome: formatOutcome(record.feedback?.outcome ?? "none"),
      systemDecision: formatDecision(record.decision),
      operatorAction: record.feedback ? formatOperatorAction(record.feedback.operatorAction) : "Confirm Review",
      rankingEffect: record.feedback?.rankingEffect ?? "Audit record created",
    }));
}

export function getSuppressionAudit(records: DashboardAlertRecord[], effects: FeedbackEffect[]): SuppressionAudit {
  const suppressed = records.filter((record) => record.decision === "suppress");
  const suppressedReviewed = suppressed.filter((record) => record.reviewStatus === "reviewed").length;
  const operatorOverrides = suppressed.filter((record) => record.feedback?.outcome === "real_incident" || record.escalated).length;
  const suppressedRealIncidents = suppressed.filter((record) => record.feedback?.outcome === "real_incident").length;
  const lowConfidenceAwaiting = suppressed.filter((record) => displayConfidence(record) < 0.68 && record.reviewStatus !== "reviewed").length;
  const ruleTriggered = suppressed.filter((record) => record.decisionReason.includes("rule")).length;
  const feedbackDriven = effects.filter((effect) => effect.description.toLowerCase().includes("weight") || effect.description.toLowerCase().includes("priority")).length;
  const cases = suppressed
    .filter((record) => isHighRiskSuppression(record) || record.reviewStatus === "reviewed" || record.escalated)
    .slice(0, 5)
    .map((record) => ({
      id: shortId(record.id),
      service: record.service,
      reason: record.feedback?.outcome === "real_incident" ? "Suppressed alert marked Real Incident" : suppressionReason(record),
      status: record.reviewStatus === "reviewed" ? formatOutcome(record.feedback?.outcome ?? "none") : "Pending human review",
    }));

  return { suppressedReviewed, operatorOverrides, suppressedRealIncidents, lowConfidenceAwaiting, ruleTriggered, feedbackDriven, cases };
}

export function shortId(id: string) {
  return id.replace("cand-", "ALT-");
}

export function formatAge(seconds: number) {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  return `${Math.round(seconds / 60)}m`;
}

export function suppressionReason(record: DashboardAlertRecord) {
  if (record.isDuplicate) return "Suppressed by duplicate cluster match";
  if (record.retryCount <= 1 && record.errorCount <= 1) return "Suppressed after transient retry pattern";
  if (record.status === "completed_with_failures" && record.utility < 0.42) return "Suppressed as expected failure pattern";
  if (record.missingTelemetry && record.utility < 0.5) return "Suppressed with incomplete telemetry evidence";
  return record.score < record.decisionBoundary ? "Suppressed below decision boundary" : "Suppression rule matched";
}

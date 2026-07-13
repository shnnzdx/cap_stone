import type { AlertCandidate, AlertDecisionStrategy, SimulatedJob, StrategyMode } from "../simulation/alertTypes";
import { createCandidate } from "../simulation/candidateGenerator";
import { generateJobs } from "../simulation/jobGenerator";
import { isLowValue } from "../simulation/metrics";
import { feedbackRankingStrategy } from "../simulation/strategies/feedbackRanking";
import { fixedThresholdStrategy } from "../simulation/strategies/fixedThreshold";
import { ruleSuppressionStrategy } from "../simulation/strategies/ruleSuppression";
import type {
  ExperimentDefinition,
  ExperimentResult,
  FeedbackRoundResult,
  FeedbackWeightChange,
  NoiseCategoryMetrics,
  StrategyExperimentResult,
  StrategyRunMetrics,
} from "./experimentTypes";
import { aggregateRuns } from "./experimentAggregation";
import { selectExperimentConclusion } from "./experimentConclusion";

const strategies: Record<StrategyMode, AlertDecisionStrategy> = {
  feedback: feedbackRankingStrategy,
  threshold: fixedThresholdStrategy,
  rules: ruleSuppressionStrategy,
};

type CalibrationResult = {
  memory: Map<string, number>;
  eventsApplied: number;
  weightChanges: FeedbackWeightChange[];
};

function serviceForJob(workerId: string, jobId: string) {
  const services = ["retailer-sync", "address-normalizer", "billing-worker", "catalog-pricing", "queue-drain"];
  const workerNumber = Number.parseInt(workerId.replace("worker-", ""), 10) || 1;
  const jobNumber = Number.parseInt(jobId.replace("job-", ""), 10) || 1;
  return services[(workerNumber + jobNumber) % services.length];
}

function createCandidates(seed: number, count: number) {
  return generateJobs(seed, count).map((job, index) => createCandidate(job, index));
}

function emptyNoiseCategories(): NoiseCategoryMetrics {
  return {
    duplicateCandidates: 0,
    duplicateSuppressed: 0,
    transientRetryCandidates: 0,
    transientRetrySuppressed: 0,
    expectedBehaviorCandidates: 0,
    expectedBehaviorSuppressed: 0,
    lowSeverityFalsePositiveCandidates: 0,
    lowSeverityFalsePositiveSuppressed: 0,
    incompleteTelemetryCandidates: 0,
    incompleteTelemetrySuppressed: 0,
  };
}

function markNoiseCategories(noise: NoiseCategoryMetrics, candidate: AlertCandidate, suppressed: boolean) {
  const job = candidate.job;
  if (candidate.isDuplicate) {
    noise.duplicateCandidates += 1;
    if (suppressed) noise.duplicateSuppressed += 1;
  }
  if (job.retryCount <= 1 && job.errorCount <= 1 && !candidate.isActionable) {
    noise.transientRetryCandidates += 1;
    if (suppressed) noise.transientRetrySuppressed += 1;
  }
  if (job.status === "completed_with_failures" && candidate.utility < 0.42) {
    noise.expectedBehaviorCandidates += 1;
    if (suppressed) noise.expectedBehaviorSuppressed += 1;
  }
  if (candidate.severity < 0.55 && !candidate.isActionable) {
    noise.lowSeverityFalsePositiveCandidates += 1;
    if (suppressed) noise.lowSeverityFalsePositiveSuppressed += 1;
  }
  if (job.missingTelemetry && !candidate.isActionable) {
    noise.incompleteTelemetryCandidates += 1;
    if (suppressed) noise.incompleteTelemetrySuppressed += 1;
  }
}

function highRiskSuppression(candidate: AlertCandidate, scoreBoundary: number) {
  return candidate.finalDecision === "suppress" && (candidate.severity >= 0.62 || Math.abs(candidate.score - scoreBoundary) < 0.12 || candidate.job.errorCount >= 6);
}

function evaluateCandidates(seed: number, candidates: AlertCandidate[], strategy: StrategyMode, memory = new Map<string, number>()): StrategyRunMetrics {
  const strategyImpl = strategies[strategy];
  const runMemory = new Map(memory);
  const boundary = strategy === "threshold" ? 0.58 : strategy === "feedback" ? 0.48 : 0.5;
  const noiseCategories = emptyNoiseCategories();
  let alertsSent = 0;
  let trueActionableSurfaced = 0;
  let nonActionableSurfaced = 0;
  let duplicateAlertsSurfaced = 0;
  let lowValueCandidates = 0;
  let lowValueAlertsSuppressed = 0;
  let lowValueAlertsSent = 0;
  let highRiskSuppressions = 0;
  let actionableAlertsSuppressed = 0;
  let operatorOverrides = 0;

  candidates.forEach((candidate, index) => {
    const evaluated = { ...candidate, job: candidate.job };
    const decision = strategyImpl.evaluate(evaluated, { feedbackMemory: runMemory, processedCount: index });
    evaluated.finalDecision = decision.decision;
    const suppressed = decision.decision === "suppress";
    const lowValue = isLowValue(evaluated.job);

    if (lowValue) lowValueCandidates += 1;
    if (decision.decision === "promote") {
      alertsSent += 1;
      if (evaluated.isActionable) trueActionableSurfaced += 1;
      else nonActionableSurfaced += 1;
      if (evaluated.isDuplicate) duplicateAlertsSurfaced += 1;
      if (lowValue) lowValueAlertsSent += 1;
    } else {
      if (lowValue) lowValueAlertsSuppressed += 1;
      if (evaluated.isActionable) actionableAlertsSuppressed += 1;
      if (highRiskSuppression(evaluated, boundary)) highRiskSuppressions += 1;
    }

    if (strategy === "feedback") {
      const delta = feedbackDelta(evaluated, suppressed);
      if (delta !== 0) runMemory.set(evaluated.job.workerId, (runMemory.get(evaluated.job.workerId) ?? 0) + delta);
      if (suppressed && evaluated.isActionable) operatorOverrides += 1;
    } else if (suppressed && evaluated.isActionable && evaluated.severity >= 0.62) {
      operatorOverrides += 1;
    }

    markNoiseCategories(noiseCategories, evaluated, suppressed);
  });

  const rawCandidates = candidates.length;
  const trueActionableTotal = candidates.filter((candidate) => candidate.isActionable).length;
  const nonActionableTotal = rawCandidates - trueActionableTotal;

  return {
    seed,
    rawCandidates,
    alertsSent,
    alertReduction: rawCandidates > 0 ? 1 - alertsSent / rawCandidates : 0,
    trueActionableTotal,
    trueActionableSurfaced,
    nonActionableTotal,
    nonActionableSurfaced,
    precision: alertsSent > 0 ? trueActionableSurfaced / alertsSent : 1,
    recall: trueActionableTotal > 0 ? trueActionableSurfaced / trueActionableTotal : 1,
    falsePositiveRate: nonActionableTotal > 0 ? nonActionableSurfaced / nonActionableTotal : 0,
    duplicateAlertsSurfaced,
    duplicateAlertRate: alertsSent > 0 ? duplicateAlertsSurfaced / alertsSent : 0,
    lowValueCandidates,
    lowValueAlertsSuppressed,
    lowValueAlertsSent,
    lowValueSuppressionRate: lowValueCandidates > 0 ? lowValueAlertsSuppressed / lowValueCandidates : 0,
    highRiskSuppressions,
    actionableAlertsSuppressed,
    operatorOverrides,
    noiseCategories,
  };
}

function feedbackDelta(candidate: AlertCandidate, suppressed: boolean) {
  if (suppressed && candidate.isActionable) return 0.07;
  if (!suppressed && !candidate.isActionable) return -0.06;
  if (!suppressed && candidate.isDuplicate) return -0.05;
  if (!suppressed && candidate.isActionable) return 0.03;
  return 0;
}

function calibrateFeedback(definition: ExperimentDefinition): CalibrationResult {
  const memory = new Map<string, number>();
  const before = new Map<string, number>();
  const sources = new Map<string, { service: string; pattern: string; source: string }>();
  let eventsApplied = 0;

  definition.calibrationSeeds.forEach((seed) => {
    createCandidates(seed, definition.jobsPerRun).forEach((candidate, index) => {
      const decision = feedbackRankingStrategy.evaluate(candidate, { feedbackMemory: memory, processedCount: index });
      const suppressed = decision.decision === "suppress";
      const delta = feedbackDelta(candidate, suppressed);
      if (delta === 0) return;
      const key = candidate.job.workerId;
      if (!before.has(key)) before.set(key, memory.get(key) ?? 0);
      memory.set(key, (memory.get(key) ?? 0) + delta);
      eventsApplied += 1;
      sources.set(key, {
        service: serviceForJob(candidate.job.workerId, candidate.job.id),
        pattern: candidate.isDuplicate ? "duplicate group" : candidate.job.status === "timeout" ? "timeout pattern" : "backend job outcome",
        source: suppressed && candidate.isActionable ? "operator override" : "operator feedback",
      });
    });
  });

  const weightChanges = Array.from(memory.entries())
    .map(([key, nextWeight]) => {
      const meta = sources.get(key);
      const previousWeight = before.get(key) ?? 0;
      return {
        key,
        workerId: key,
        service: meta?.service,
        pattern: meta?.pattern ?? "worker alert pattern",
        previousWeight,
        nextWeight,
        delta: nextWeight - previousWeight,
        feedbackSource: meta?.source ?? "operator feedback",
      };
    })
    .filter((change) => Math.abs(change.delta) > 0.001)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);

  return { memory, eventsApplied, weightChanges };
}

function combineRuns(seed: number, runs: StrategyRunMetrics[]): StrategyRunMetrics {
  const totals = runs.reduce(
    (acc, run) => ({
      rawCandidates: acc.rawCandidates + run.rawCandidates,
      alertsSent: acc.alertsSent + run.alertsSent,
      trueActionableTotal: acc.trueActionableTotal + run.trueActionableTotal,
      trueActionableSurfaced: acc.trueActionableSurfaced + run.trueActionableSurfaced,
      nonActionableTotal: acc.nonActionableTotal + run.nonActionableTotal,
      nonActionableSurfaced: acc.nonActionableSurfaced + run.nonActionableSurfaced,
      duplicateAlertsSurfaced: acc.duplicateAlertsSurfaced + run.duplicateAlertsSurfaced,
      lowValueCandidates: acc.lowValueCandidates + run.lowValueCandidates,
      lowValueAlertsSuppressed: acc.lowValueAlertsSuppressed + run.lowValueAlertsSuppressed,
      lowValueAlertsSent: acc.lowValueAlertsSent + run.lowValueAlertsSent,
      highRiskSuppressions: acc.highRiskSuppressions + run.highRiskSuppressions,
      actionableAlertsSuppressed: acc.actionableAlertsSuppressed + run.actionableAlertsSuppressed,
      operatorOverrides: acc.operatorOverrides + run.operatorOverrides,
    }),
    {
      rawCandidates: 0,
      alertsSent: 0,
      trueActionableTotal: 0,
      trueActionableSurfaced: 0,
      nonActionableTotal: 0,
      nonActionableSurfaced: 0,
      duplicateAlertsSurfaced: 0,
      lowValueCandidates: 0,
      lowValueAlertsSuppressed: 0,
      lowValueAlertsSent: 0,
      highRiskSuppressions: 0,
      actionableAlertsSuppressed: 0,
      operatorOverrides: 0,
    },
  );
  return {
    seed,
    ...totals,
    alertReduction: totals.rawCandidates > 0 ? 1 - totals.alertsSent / totals.rawCandidates : 0,
    precision: totals.alertsSent > 0 ? totals.trueActionableSurfaced / totals.alertsSent : 1,
    recall: totals.trueActionableTotal > 0 ? totals.trueActionableSurfaced / totals.trueActionableTotal : 1,
    falsePositiveRate: totals.nonActionableTotal > 0 ? totals.nonActionableSurfaced / totals.nonActionableTotal : 0,
    duplicateAlertRate: totals.alertsSent > 0 ? totals.duplicateAlertsSurfaced / totals.alertsSent : 0,
    lowValueSuppressionRate: totals.lowValueCandidates > 0 ? totals.lowValueAlertsSuppressed / totals.lowValueCandidates : 0,
    noiseCategories: emptyNoiseCategories(),
  };
}

function buildFeedbackProgression(definition: ExperimentDefinition, evaluationCandidates: AlertCandidate[][]): { progression: FeedbackRoundResult[]; calibration: CalibrationResult } {
  const memory = new Map<string, number>();
  const progression: FeedbackRoundResult[] = [];
  let feedbackEventsApplied = 0;
  let finalCalibration: CalibrationResult = { memory, eventsApplied: 0, weightChanges: [] };

  for (let round = 0; round <= definition.feedbackRounds; round += 1) {
    const runs = evaluationCandidates.map((candidates, index) => evaluateCandidates(definition.evaluationSeeds[index], candidates, "feedback", memory));
    const combined = combineRuns(round, runs);
    progression.push({
      round,
      feedbackEventsApplied,
      lowValueAlertsSent: combined.lowValueAlertsSent,
      precision: combined.precision,
      recall: combined.recall,
      duplicateAlertsSent: combined.duplicateAlertsSurfaced,
      operatorOverrides: combined.operatorOverrides,
    });
    if (round < definition.feedbackRounds) {
      finalCalibration = calibrateFeedback({
        ...definition,
        calibrationSeeds: [definition.calibrationSeeds[round % definition.calibrationSeeds.length]],
      });
      finalCalibration.memory.forEach((value, key) => memory.set(key, (memory.get(key) ?? 0) + value / definition.feedbackRounds));
      feedbackEventsApplied += finalCalibration.eventsApplied;
    }
  }

  const fullCalibration = calibrateFeedback(definition);
  return { progression, calibration: { ...fullCalibration, memory } };
}

export function runExperiment(definition: ExperimentDefinition): ExperimentResult {
  const evaluationCandidates = definition.evaluationSeeds.map((seed) => createCandidates(seed, definition.jobsPerRun));
  const { progression, calibration } = buildFeedbackProgression(definition, evaluationCandidates);

  const strategyResults: StrategyExperimentResult[] = (["feedback", "threshold", "rules"] as StrategyMode[]).map((strategy) => {
    const runs = evaluationCandidates.map((candidates, index) =>
      evaluateCandidates(definition.evaluationSeeds[index], candidates, strategy, strategy === "feedback" ? calibration.memory : new Map<string, number>()),
    );
    const aggregated = aggregateRuns(runs);
    return {
      strategy,
      runs,
      aggregate: aggregated.aggregate,
      noiseCategoryAggregate: aggregated.noiseCategoryAggregate,
      guardrailPassed: aggregated.aggregate.recall.mean >= definition.recallGuardrail,
    };
  });

  const beforeRuns = evaluationCandidates.map((candidates, index) => evaluateCandidates(definition.evaluationSeeds[index], candidates, "feedback", new Map<string, number>()));
  const afterRuns = evaluationCandidates.map((candidates, index) => evaluateCandidates(definition.evaluationSeeds[index], candidates, "feedback", calibration.memory));
  const feedbackBefore = combineRuns(0, beforeRuns);
  const feedbackAfter = combineRuns(1, afterRuns);

  return {
    definition,
    status: "completed",
    totalJobs: definition.evaluationSeeds.length * definition.jobsPerRun,
    totalCandidates: strategyResults[0]?.aggregate.rawCandidates.mean ? Math.round(strategyResults[0].aggregate.rawCandidates.mean * definition.evaluationSeeds.length) : 0,
    strategies: strategyResults,
    feedbackBefore,
    feedbackAfter,
    feedbackProgression: progression,
    feedbackWeightChanges: calibration.weightChanges,
    conclusion: selectExperimentConclusion(definition, strategyResults),
  };
}

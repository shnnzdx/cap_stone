import type { ExperimentConclusion, ExperimentDefinition, StrategyExperimentResult } from "./experimentTypes";

const strategyLabels = {
  feedback: "Feedback-Driven Ranking",
  threshold: "Fixed Threshold",
  rules: "Rule-Only Suppression",
};

export function selectExperimentConclusion(definition: ExperimentDefinition, strategies: StrategyExperimentResult[]): ExperimentConclusion {
  const eligible = strategies
    .filter((result) => result.guardrailPassed)
    .sort((a, b) => a.aggregate.lowValueAlertsSent.mean - b.aggregate.lowValueAlertsSent.mean);

  if (eligible.length === 0) {
    return {
      status: "guardrail_failed",
      summary: `No strategy satisfied the ${Math.round(definition.recallGuardrail * 100)}% recall guardrail.`,
    };
  }

  const best = eligible[0];
  const next = eligible[1];
  if (!next) {
    return {
      status: "winner",
      bestStrategy: best.strategy,
      summary: `${strategyLabels[best.strategy]} was the only strategy above the recall guardrail.`,
    };
  }

  const improvement = (next.aggregate.lowValueAlertsSent.mean - best.aggregate.lowValueAlertsSent.mean) / Math.max(1, next.aggregate.lowValueAlertsSent.mean);
  const strongestBaseline = next.strategy === "feedback" ? eligible.find((result) => result.strategy !== "feedback")?.strategy : next.strategy;

  if (improvement < definition.inconclusiveRelativeMargin) {
    return {
      status: "inconclusive",
      bestStrategy: best.strategy,
      strongestEligibleBaseline: strongestBaseline,
      primaryMetricImprovement: improvement,
      precisionDifferencePoints: best.aggregate.precision.mean - next.aggregate.precision.mean,
      recallDifferencePoints: best.aggregate.recall.mean - next.aggregate.recall.mean,
      summary: `Eligible strategies were within the ${Math.round(definition.inconclusiveRelativeMargin * 100)}% practical-difference margin.`,
    };
  }

  return {
    status: "winner",
    bestStrategy: best.strategy,
    strongestEligibleBaseline: strongestBaseline,
    primaryMetricImprovement: improvement,
    precisionDifferencePoints: best.aggregate.precision.mean - next.aggregate.precision.mean,
    recallDifferencePoints: best.aggregate.recall.mean - next.aggregate.recall.mean,
    summary: `${strategyLabels[best.strategy]} minimized low-value alerts sent among strategies above the recall guardrail.`,
  };
}

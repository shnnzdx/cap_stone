import type { ExperimentResult, NoiseCategoryMetrics } from "../../experiments/experimentTypes";
import { compactNumber, strategyLabels } from "../../experiments/experimentFormatters";

const categories: Array<[keyof NoiseCategoryMetrics, keyof NoiseCategoryMetrics, string]> = [
  ["duplicateCandidates", "duplicateSuppressed", "Duplicate alerts"],
  ["transientRetryCandidates", "transientRetrySuppressed", "Transient retry noise"],
  ["expectedBehaviorCandidates", "expectedBehaviorSuppressed", "Expected behavior"],
  ["lowSeverityFalsePositiveCandidates", "lowSeverityFalsePositiveSuppressed", "Low-severity false positives"],
  ["incompleteTelemetryCandidates", "incompleteTelemetrySuppressed", "Incomplete telemetry"],
];

export function SuppressionComparisonPanel({ result }: { result: ExperimentResult }) {
  return (
    <section className="evaluation-panel suppression-comparison-panel">
      <div className="evaluation-panel-heading">
        <span>Low-Value Suppression Comparison</span>
      </div>
      <div className="suppression-rows">
        {categories.map(([candidateKey, suppressedKey, label]) => {
          const max = Math.max(1, ...result.strategies.map((strategy) => strategy.noiseCategoryAggregate[suppressedKey]));
          return (
            <div className="suppression-row" key={label}>
              <span>{label}</span>
              {result.strategies.map((strategy) => {
                const suppressed = strategy.noiseCategoryAggregate[suppressedKey];
                const candidates = strategy.noiseCategoryAggregate[candidateKey];
                return (
                  <div className={`bar-line ${strategy.strategy}`} key={strategy.strategy}>
                    <em>{strategyLabels[strategy.strategy]}</em>
                    <i style={{ width: `${Math.max(4, (suppressed / max) * 100)}%` }} />
                    <strong>{compactNumber(suppressed)} / {compactNumber(candidates)}</strong>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="risk-summary">
        {result.strategies.map((strategy) => (
          <div key={strategy.strategy}>
            <span>{strategyLabels[strategy.strategy]}</span>
            <strong>{compactNumber(strategy.aggregate.highRiskSuppressions.mean)}</strong>
            <em>High-risk suppressions</em>
            <strong>{compactNumber(strategy.aggregate.actionableAlertsSuppressed.mean)}</strong>
            <em>Actionable alerts suppressed</em>
          </div>
        ))}
      </div>
    </section>
  );
}

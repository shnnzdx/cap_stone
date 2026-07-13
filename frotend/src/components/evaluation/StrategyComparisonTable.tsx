import type { ExperimentResult } from "../../experiments/experimentTypes";
import { compactNumber, pct, strategyLabels } from "../../experiments/experimentFormatters";
import { GuardrailBadge } from "./GuardrailBadge";

export function StrategyComparisonTable({ result }: { result: ExperimentResult }) {
  const bestStrategy = result.conclusion.status === "winner" ? result.conclusion.bestStrategy : undefined;
  return (
    <section className="evaluation-panel strategy-comparison-panel">
      <div className="evaluation-panel-heading">
        <span>Strategy Comparison Table</span>
      </div>
      <div className="strategy-comparison-table">
        <div className="comparison-head">
          <span>Strategy</span>
          <span>Alerts Sent</span>
          <span>Alert Reduction</span>
          <span>Low-Value Suppression</span>
          <span>Low-Value Alerts Sent</span>
          <span>False Positive Rate</span>
          <span>Duplicate Rate</span>
          <span>Precision</span>
          <span>Recall</span>
          <span>Guardrail</span>
        </div>
        {result.strategies.map((strategy) => (
          <div key={strategy.strategy}>
            <strong>{strategyLabels[strategy.strategy]}</strong>
            <span>{compactNumber(strategy.aggregate.alertsSent.mean)}</span>
            <span>{pct(strategy.aggregate.alertReduction.mean)}</span>
            <span>{pct(strategy.aggregate.lowValueSuppressionRate.mean)}</span>
            <span className={strategy.strategy === bestStrategy ? "best-cell" : ""}>{compactNumber(strategy.aggregate.lowValueAlertsSent.mean)}</span>
            <span>{pct(strategy.aggregate.falsePositiveRate.mean)}</span>
            <span>{pct(strategy.aggregate.duplicateAlertRate.mean)}</span>
            <span>{pct(strategy.aggregate.precision.mean)}</span>
            <span className={strategy.guardrailPassed ? "" : "recall-fail"}>{pct(strategy.aggregate.recall.mean)}</span>
            <GuardrailBadge passed={strategy.guardrailPassed} />
          </div>
        ))}
      </div>
      <p className="metric-footer">
        Alert Reduction = 1 - Alerts Sent / Raw Candidates. Low-Value Alerts Sent is the primary objective after applying the recall guardrail.
      </p>
    </section>
  );
}

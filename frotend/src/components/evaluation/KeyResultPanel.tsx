import type { ExperimentResult } from "../../experiments/experimentTypes";
import { pct, signedPctPoints, signedRelative, strategyLabels } from "../../experiments/experimentFormatters";

export function KeyResultPanel({ result }: { result: ExperimentResult }) {
  const conclusion = result.conclusion;
  const title =
    conclusion.status === "guardrail_failed"
      ? "NO STRATEGY MET THE RECALL GUARDRAIL"
      : conclusion.status === "inconclusive"
        ? "RESULT INCONCLUSIVE"
        : "BEST UNDER RECALL GUARDRAIL";
  return (
    <section className="evaluation-panel key-result-panel">
      <div className="evaluation-panel-heading">
        <span>Key Result</span>
      </div>
      <div className="key-result-body">
        <span>{title}</span>
        {conclusion.bestStrategy ? <h2>{strategyLabels[conclusion.bestStrategy]}</h2> : null}
        {conclusion.primaryMetricImprovement !== undefined ? (
          <dl>
            <div>
              <dt>Low-value alerts sent</dt>
              <dd>{signedRelative(-conclusion.primaryMetricImprovement)}</dd>
            </div>
            <div>
              <dt>Precision difference</dt>
              <dd>{signedPctPoints(conclusion.precisionDifferencePoints ?? 0)}</dd>
            </div>
            <div>
              <dt>Recall difference</dt>
              <dd>{signedPctPoints(conclusion.recallDifferencePoints ?? 0)}</dd>
            </div>
          </dl>
        ) : null}
        <p>{conclusion.summary}</p>
        {conclusion.strongestEligibleBaseline ? <em>Compared with {strategyLabels[conclusion.strongestEligibleBaseline]}, the strongest eligible baseline.</em> : null}
        <small>Recall guardrail: {pct(result.definition.recallGuardrail)}</small>
      </div>
    </section>
  );
}

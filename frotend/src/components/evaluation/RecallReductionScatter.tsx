import type { ExperimentResult } from "../../experiments/experimentTypes";
import { pct, strategyLabels } from "../../experiments/experimentFormatters";

const markerClass = { feedback: "feedback", threshold: "threshold", rules: "rules" };

export function RecallReductionScatter({ result }: { result: ExperimentResult }) {
  const width = 520;
  const height = 320;
  const left = 54;
  const top = 28;
  const plotW = 420;
  const plotH = 230;
  const xMin = 0;
  const xMax = Math.max(0.72, ...result.strategies.map((item) => item.aggregate.alertReduction.mean + 0.08));
  const yMin = Math.min(0.72, result.definition.recallGuardrail - 0.08);
  const yMax = 1;
  const x = (value: number) => left + ((value - xMin) / (xMax - xMin)) * plotW;
  const y = (value: number) => top + (1 - (value - yMin) / (yMax - yMin)) * plotH;
  const guardY = y(result.definition.recallGuardrail);

  return (
    <section className="evaluation-panel scatter-panel">
      <div className="evaluation-panel-heading">
        <span>Recall vs Alert Reduction</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Recall versus alert reduction scatter plot">
        <line x1={left} y1={top + plotH} x2={left + plotW} y2={top + plotH} />
        <line x1={left} y1={top} x2={left} y2={top + plotH} />
        <line className="guardrail-line" x1={left} y1={guardY} x2={left + plotW} y2={guardY} />
        <text x={left + plotW - 142} y={guardY - 8}>Recall Guardrail {pct(result.definition.recallGuardrail)}</text>
        {result.strategies.map((item) => {
          const cx = x(item.aggregate.alertReduction.mean);
          const cy = y(item.aggregate.recall.mean);
          return (
            <g className={`scatter-point ${markerClass[item.strategy]}`} key={item.strategy}>
              <circle cx={cx} cy={cy} r={9} />
              <text x={cx + 13} y={cy - 7}>{strategyLabels[item.strategy]}</text>
              <text x={cx + 13} y={cy + 10}>{pct(item.aggregate.alertReduction.mean)} / {pct(item.aggregate.recall.mean)}</text>
              <text x={cx + 13} y={cy + 27}>{item.guardrailPassed ? "PASS" : "FAIL"}</text>
            </g>
          );
        })}
        <text className="axis-label" x={left + plotW - 108} y={top + plotH + 36}>Alert Reduction</text>
        <text className="axis-label" x={8} y={top + 14}>Recall</text>
      </svg>
      <p>{result.conclusion.summary}</p>
    </section>
  );
}

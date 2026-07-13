import type { ExperimentResult } from "../../experiments/experimentTypes";
import { compactNumber, pct } from "../../experiments/experimentFormatters";

export function ExperimentSummaryPanel({ result }: { result: ExperimentResult }) {
  const definition = result.definition;
  const items = [
    ["Experiment", definition.id],
    ["Mode", "Controlled multi-seed evaluation"],
    ["Seeded Runs", String(definition.evaluationSeeds.length)],
    ["Jobs Per Run", compactNumber(definition.jobsPerRun)],
    ["Total Jobs", compactNumber(result.totalJobs)],
    ["Alert Candidates", compactNumber(result.totalCandidates)],
    ["Feedback Rounds", String(definition.feedbackRounds)],
    ["Recall Guardrail", `>= ${pct(definition.recallGuardrail)}`],
    ["Practical Margin", pct(definition.inconclusiveRelativeMargin)],
    ["Ground Truth", "Synthetic controlled labels"],
    ["Strategies", "Feedback / Threshold / Rule Only"],
  ];
  return (
    <section className="evaluation-panel experiment-summary-panel">
      <div className="evaluation-panel-heading">
        <span>Experiment Summary</span>
      </div>
      <div className="summary-grid">
        {items.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <p>All strategies process identical seeded backend-job streams.</p>
    </section>
  );
}

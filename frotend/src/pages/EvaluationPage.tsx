import { useMemo } from "react";
import { Navigation } from "../components/Navigation";
import { EvaluationHeader } from "../components/evaluation/EvaluationHeader";
import { ExperimentSummaryPanel } from "../components/evaluation/ExperimentSummaryPanel";
import { FeedbackEffectPanel } from "../components/evaluation/FeedbackEffectPanel";
import { KeyResultPanel } from "../components/evaluation/KeyResultPanel";
import { MethodologyPanel } from "../components/evaluation/MethodologyPanel";
import { RecallReductionScatter } from "../components/evaluation/RecallReductionScatter";
import { StrategyComparisonTable } from "../components/evaluation/StrategyComparisonTable";
import { SuppressionComparisonPanel } from "../components/evaluation/SuppressionComparisonPanel";
import { defaultExperimentDefinition } from "../experiments/experimentConfig";
import { runExperiment } from "../experiments/ExperimentRunner";

export function EvaluationPage() {
  const result = useMemo(() => runExperiment(defaultExperimentDefinition), []);

  return (
    <main className="evaluation-page">
      <Navigation current="evaluation" />
      <EvaluationHeader status={result.status} runCount={result.definition.evaluationSeeds.length} />
      <section className="evaluation-top-row">
        <ExperimentSummaryPanel result={result} />
        <KeyResultPanel result={result} />
      </section>
      <StrategyComparisonTable result={result} />
      <section className="evaluation-mid-row">
        <RecallReductionScatter result={result} />
        <SuppressionComparisonPanel result={result} />
      </section>
      <section className="evaluation-bottom-row">
        <FeedbackEffectPanel result={result} />
        <MethodologyPanel />
      </section>
    </main>
  );
}

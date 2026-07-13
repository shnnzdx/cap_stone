import type { StrategyMode } from "./alertTypes";
import type { StrategyComparisonRow } from "./dashboardTypes";
import { calculateDashboardRates } from "./dashboardSelectors";
import { SimulationEngine } from "./simulationEngine";

const names: Record<StrategyMode, string> = {
  feedback: "Feedback-Driven Ranking",
  threshold: "Fixed Threshold",
  rules: "Rule-Only Suppression",
};

export function buildStrategyComparisonSnapshot(duration = 90): StrategyComparisonRow[] {
  return (["feedback", "threshold", "rules"] as StrategyMode[]).map((mode) => {
    const engine = new SimulationEngine();
    engine.setStrategy(mode);
    for (let time = 0; time <= duration; time += 0.2) engine.update(time, false);
    const history = engine.getAlertHistory(duration);
    const rates = calculateDashboardRates(history);
    return {
      mode,
      strategy: names[mode],
      alertsSent: rates.surfacedCount,
      falsePositives: rates.falsePositiveCount,
      precision: rates.precision,
      recall: rates.recall,
      alertReduction: rates.alertReduction,
    };
  });
}

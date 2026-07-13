import { useCallback, useMemo, useRef, useState } from "react";
import type { ActiveAlert, SimulationMetrics, StrategyMode } from "../simulation/alertTypes";
import { createEmptyMetrics } from "../simulation/metrics";
import { SimulationEngine } from "../simulation/simulationEngine";

export type ComparisonResult = {
  mode: StrategyMode;
  strategy: string;
  metrics: SimulationMetrics;
};

export function useAlertSimulation() {
  const engineRef = useRef(new SimulationEngine());
  const [strategy, setStrategyState] = useState<StrategyMode>("feedback");
  const [metrics, setMetrics] = useState<SimulationMetrics>(() => createEmptyMetrics());
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const [comparison, setComparison] = useState<ComparisonResult[]>([]);

  const setStrategy = useCallback((mode: StrategyMode) => {
    engineRef.current.setStrategy(mode);
    setStrategyState(mode);
    setMetrics(engineRef.current.getMetrics());
    setActiveAlerts([]);
  }, []);

  const refreshUi = useCallback(() => {
    setMetrics(engineRef.current.getMetrics());
    setActiveAlerts(engineRef.current.getActiveAlerts());
  }, []);

  const runComparison = useCallback(() => {
    const result = engineRef.current.runComparison();
    setComparison(result);
    setMetrics(engineRef.current.getMetrics());
    setActiveAlerts(engineRef.current.getActiveAlerts());
  }, []);

  return useMemo(
    () => ({
      engineRef,
      strategy,
      metrics,
      activeAlerts,
      comparison,
      setStrategy,
      refreshUi,
      runComparison,
    }),
    [activeAlerts, comparison, metrics, refreshUi, runComparison, setStrategy, strategy],
  );
}

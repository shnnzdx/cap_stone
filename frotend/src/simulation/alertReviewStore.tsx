import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SimulationMetrics, StrategyMode } from "./alertTypes";
import { buildStrategyComparisonSnapshot } from "./comparisonSnapshot";
import type { DashboardAlertRecord, FeedbackEffect, OperatorAction, ReviewOutcome, StrategyComparisonRow } from "./dashboardTypes";
import { createEmptyMetrics } from "./metrics";
import { SimulationEngine } from "./simulationEngine";

type AlertSnapshot = {
  now: number;
  metrics: SimulationMetrics;
  records: DashboardAlertRecord[];
  effects: FeedbackEffect[];
};

type AlertReviewStore = {
  snapshot: AlertSnapshot;
  strategy: StrategyMode;
  strategyName: string;
  paused: boolean;
  comparisonRows: StrategyComparisonRow[];
  setPaused: (value: boolean | ((current: boolean) => boolean)) => void;
  setStrategy: (mode: StrategyMode) => void;
  runComparison: () => void;
  submitAlertReview: (alertId: string, outcome: ReviewOutcome, action: OperatorAction, note?: string) => boolean;
  acknowledgeAlert: (alertId: string) => boolean;
  getNextReviewAlert: (currentAlertId?: string) => DashboardAlertRecord | undefined;
};

const AlertReviewContext = createContext<AlertReviewStore | null>(null);

function createPrimedEngine() {
  const engine = new SimulationEngine();
  for (let time = 0; time <= 75; time += 0.2) engine.update(time, false);
  return engine;
}

export function AlertReviewProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<SimulationEngine>();
  if (!engineRef.current) engineRef.current = createPrimedEngine();
  const startedAt = useRef(performance.now() - 75_000);
  const [strategy, setStrategyState] = useState<StrategyMode>("feedback");
  const [paused, setPaused] = useState(false);
  const [comparisonRows, setComparisonRows] = useState<StrategyComparisonRow[]>(() => buildStrategyComparisonSnapshot());
  const [snapshot, setSnapshot] = useState<AlertSnapshot>({
    now: 75,
    metrics: createEmptyMetrics(),
    records: engineRef.current.getAlertHistory(75),
    effects: engineRef.current.getFeedbackEffects(),
  });

  const refreshSnapshot = useCallback((now: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    setSnapshot({
      now,
      metrics: engine.getMetrics(),
      records: engine.getAlertHistory(now),
      effects: engine.getFeedbackEffects(),
    });
  }, []);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const engine = engineRef.current;
      if (!engine) return;
      const now = (performance.now() - startedAt.current) / 1000;
      engine.update(now, paused);
      refreshSnapshot(now);
      frame = window.setTimeout(tick, 650);
    };
    tick();
    return () => window.clearTimeout(frame);
  }, [paused, refreshSnapshot]);

  const setStrategy = useCallback(
    (mode: StrategyMode) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.setStrategy(mode);
      for (let time = 0; time <= 75; time += 0.2) engine.update(time, false);
      startedAt.current = performance.now() - 75_000;
      setStrategyState(mode);
      refreshSnapshot(75);
    },
    [refreshSnapshot],
  );

  const submitAlertReview = useCallback(
    (alertId: string, outcome: ReviewOutcome, action: OperatorAction, note = "") => {
      const engine = engineRef.current;
      if (!engine) return false;
      const now = (performance.now() - startedAt.current) / 1000;
      const ok = engine.submitAlertReview(alertId, outcome, action, note, now);
      if (ok) refreshSnapshot(now);
      return ok;
    },
    [refreshSnapshot],
  );

  const acknowledgeAlert = useCallback(
    (alertId: string) => {
      const engine = engineRef.current;
      if (!engine) return false;
      const now = (performance.now() - startedAt.current) / 1000;
      const ok = engine.submitAlertReview(alertId, "needs_more_information", "confirm", "Acknowledged from Dashboard preview.", now);
      if (ok) refreshSnapshot(now);
      return ok;
    },
    [refreshSnapshot],
  );

  const getNextReviewAlert = useCallback(
    (currentAlertId?: string) => {
      const queue = snapshot.records.filter((record) => record.reviewStatus !== "reviewed");
      if (queue.length === 0) return undefined;
      const index = queue.findIndex((record) => record.id === currentAlertId);
      return queue[index + 1] ?? queue[0];
    },
    [snapshot.records],
  );

  const value = useMemo<AlertReviewStore>(
    () => ({
      snapshot,
      strategy,
      strategyName: engineRef.current?.strategyName ?? "Feedback-Driven Ranking",
      paused,
      comparisonRows,
      setPaused,
      setStrategy,
      runComparison: () => setComparisonRows(buildStrategyComparisonSnapshot()),
      submitAlertReview,
      acknowledgeAlert,
      getNextReviewAlert,
    }),
    [acknowledgeAlert, comparisonRows, getNextReviewAlert, paused, setStrategy, snapshot, strategy, submitAlertReview],
  );

  return <AlertReviewContext.Provider value={value}>{children}</AlertReviewContext.Provider>;
}

export function useAlertReviewStore() {
  const value = useContext(AlertReviewContext);
  if (!value) throw new Error("useAlertReviewStore must be used inside AlertReviewProvider");
  return value;
}

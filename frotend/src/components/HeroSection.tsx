import { useRef } from "react";
import { HeroCopy } from "./HeroCopy";
import { Navigation } from "./Navigation";
import { SceneCanvas } from "./SceneCanvas";
import { ScrollAnimationController } from "./ScrollAnimationController";
import { MonitoringHeader } from "./MonitoringHeader";
import { StrategySelector } from "./StrategySelector";
import { MetricsPanel } from "./MetricsPanel";
import { ActiveAlertsPanel } from "./ActiveAlertsPanel";
import { ComparisonSummary } from "./ComparisonSummary";
import { useAlertSimulation } from "../hooks/useAlertSimulation";
import { usePageVisibility } from "../hooks/usePageVisibility";
import { useReducedMotion } from "../hooks/useReducedMotion";

export function HeroSection() {
  const heroRef = useRef<HTMLElement>(null);
  const scrollProgress = useRef(0);
  const reducedMotion = useReducedMotion();
  const visible = usePageVisibility();
  const simulation = useAlertSimulation();

  return (
    <section className="hero-stage" id="top" ref={heroRef}>
      <Navigation />
      <SceneCanvas
        progressRef={scrollProgress}
        engineRef={simulation.engineRef}
        reducedMotion={reducedMotion}
        paused={!visible}
        onUiTick={simulation.refreshUi}
        strategy={simulation.strategy}
      />
      <div className="hero-grid">
        <HeroCopy />
      </div>
      <MonitoringHeader strategy={simulation.strategy} />
      <StrategySelector
        value={simulation.strategy}
        onChange={simulation.setStrategy}
        onCompare={simulation.runComparison}
      />
      <MetricsPanel metrics={simulation.metrics} />
      <ActiveAlertsPanel alerts={simulation.activeAlerts} />
      <ComparisonSummary comparison={simulation.comparison} />
      <div className="scene-legend" aria-hidden="true">
        <span className={simulation.strategy === "threshold" ? "active" : ""}>Actionable Output</span>
        <span className={simulation.strategy === "rules" ? "active" : ""}>Suppression</span>
        <span className={simulation.strategy === "feedback" ? "active" : ""}>Feedback Loop</span>
      </div>
      <div className="flow-labels" aria-hidden="true">
        <span className="label-intake">Job Intake</span>
        <span className="label-signal">Signals</span>
        <span className="label-buffer">Candidate Buffer</span>
        <span className="label-core">Ranking Core</span>
        <span className="label-output">Actionable Output</span>
        <span className="label-suppress">Suppressed Reservoir</span>
      </div>
      <ScrollAnimationController
        heroRef={heroRef}
        progressRef={scrollProgress}
        reducedMotion={reducedMotion}
      />
    </section>
  );
}

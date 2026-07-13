# Frontend Design Summary

## Project Scope

This frontend is a Vite + React + TypeScript desktop prototype for the `Alert Triage Engine` capstone.

The project is not a generic marketing website. It is a product-style prototype for a human-in-the-loop adaptive alerting system for backend reliability monitoring. The current frontend focuses on:

- an editorial desktop-only Overview / Home screen
- a full-bleed React Three Fiber monitoring scene
- a synthetic alert-triage simulation
- strategy switching between feedback ranking, fixed threshold, and rule-only suppression
- compact monitoring metrics and active alert overlays
- a planned Dashboard for alert quality, review, feedback, and evaluation summary

Mobile design is intentionally out of scope for the current prototype.

## Visual Direction

- Background: light gray editorial canvas
- Typography: condensed black headline with compact operational UI text
- Accent: saturated yellow for active controls and high-priority action
- Monitoring cards: restrained off-white panels with low visual noise
- 3D language: industrial, modular, chamber-like, tactile
- Motion: choreographed monitoring-data flow, not random floating cubes
- Page style: product prototype / operating console, not SaaS marketing

## Current Navigation Model

The Overview / Home navigation has been revised to match the capstone workflow:

- `Overview`
- `Dashboard`
- `Alerts`
- `Evaluation`
- `Admin`

The hero CTA buttons are:

- `Open Dashboard`
- `Review Alerts`

The top-right CTA is:

- `Review Alerts`

The old generic links such as `Platform`, `Model`, and `System` were removed because they did not map cleanly to the project proposal.

## Current Hero Composition

The first screen is structured as a desktop-only `hero-stage`:

- `Navigation` sits at the top layer
- `HeroCopy` occupies the left editorial safe zone
- `SceneCanvas` spans the full hero as a full-bleed background layer
- the 3D `AlertTriageEngine` sits center-right
- `MonitoringHeader` and `StrategySelector` sit in the top-right safe zone
- `MetricsPanel` sits on the right side
- `ActiveAlertsPanel` sits in the lower-left action area, near the hero buttons
- `ComparisonSummary` appears only after running comparison
- `scene-legend` highlights the current strategy focus
- flow labels mark major visual subsystems

The left hero copy order is:

1. `AI infrastructure for reliability teams`
2. short project explanation
3. `ALERT TRIAGE ENGINE.`
4. `Open Dashboard` and `Review Alerts`
5. `Active Alerts` panel nearby

## Overview Continuation Section

The second section is `Prototype Navigation`, not a marketing content block. It introduces the planned product areas:

- `Dashboard`: alert quality and backend job health
- `Alerts`: alert review, explanation, and feedback labeling
- `Evaluation`: strategy comparison against baselines
- `Admin`: rule, threshold, role, recommendation, and audit management

## 3D System Meaning

The 3D scene represents a continuous alert-triage process:

1. monitoring data enters through intake lanes
2. candidates accumulate in an external buffer
3. candidates dock into the adaptive ranking chamber
4. the chamber fills with visible internal voxel cells
5. the chamber compresses and ranks accumulated candidates
6. high-value alerts leave through the actionable output port
7. low-value alerts leave through the suppression port
8. feedback units return to the ranking chamber

The black outer core should remain present throughout the cycle. Accumulation and dissolution happen through internal data cells, not by making the whole core disappear.

## Current 3D Architecture

The old static `RankingCore` concept has been replaced by an adaptive chamber concept.

Important parts:

- `SceneCanvas.tsx`: R3F Canvas, camera, lighting, scene mounting
- `AlertTriageEngine.tsx`: main 3D system wrapper, materials, instanced moving units, strategy view switching
- `AdaptiveRankingCore.tsx`: black chamber frame, internal docking slots, visible voxel matrix, intake gate, output ports, feedback-memory element
- `simulationEngine.ts`: animation state machine, candidate lifecycle, strategy decisions, metrics updates
- `animationConfig.ts`: centralized animation timing values

The current chamber model contains:

- stable black industrial outer frame
- visible internal docking-slot matrix
- intake gate on the left
- actionable output port on the upper-right
- suppression port on the lower-right
- green feedback-memory rail

## Strategy-Based View Switching

The three strategy controls now switch both strategy logic and 3D viewing angle:

- `Feedback Ranking`: emphasizes feedback loop / memory return
- `Fixed Threshold`: used as the main/default visual angle and emphasizes actionable output
- `Rule Only`: emphasizes suppression-oriented output

The bottom scene legend also changes active focus based on the selected strategy.

## Simulation and Strategy Layer

The frontend includes a seeded synthetic simulation so all strategies run against the same input stream:

- `Feedback-Driven Ranking`
- `Fixed Threshold`
- `Rule-Only Suppression`

The simulation computes:

- jobs processed
- raw candidates
- alerts sent
- low-value alerts suppressed
- alert reduction
- recall
- precision
- feedback events
- p95 job duration
- active workers

The visual animation now uses one main moving candidate unit per simulated candidate instead of duplicating each candidate as separate job, signal, and candidate meshes.

## Dashboard Design Direction

The next major page should be the `Dashboard`. It should act as the operational overview for the capstone prototype.

Recommended first Dashboard modules:

1. `Alert Quality Overview`
   - Alert Reduction
   - False Positive Rate
   - Duplicate Alert Rate
   - Precision
   - Recall

2. `Current Alert Queue`
   - Alert ID
   - Service / Job
   - Severity
   - Score
   - Strategy Decision
   - Feedback Status
   - Created Time

3. `Alert Explanation Preview`
   - why an alert was raised, ranked, grouped, or suppressed
   - score breakdown
   - related job signals
   - recommended action

4. `Noise Reduction Breakdown`
   - duplicate alerts grouped
   - expected maintenance suppressed
   - transient retry noise suppressed
   - low-severity false positives suppressed

5. `Strategy Comparison Snapshot`
   - Feedback-Driven Ranking
   - Fixed Threshold
   - Rule-Only Suppression
   - alerts sent, precision, recall, false positives, duplicate rate, alert reduction

6. `Feedback Impact`
   - feedback events
   - alerts marked useful
   - alerts marked noisy
   - false positives confirmed
   - ranking changes caused by feedback

Later Dashboard additions can include:

- Service / Job Health
- Recommendation Review Summary
- Admin approval status
- audit activity

## Important Source Areas

Core entry and layout:

- `src/App.tsx`
- `src/main.tsx`
- `src/styles/global.css`
- `src/styles/hero.css`

Hero and monitoring UI:

- `src/components/HeroSection.tsx`
- `src/components/HeroCopy.tsx`
- `src/components/Navigation.tsx`
- `src/components/MonitoringHeader.tsx`
- `src/components/StrategySelector.tsx`
- `src/components/MetricsPanel.tsx`
- `src/components/ActiveAlertsPanel.tsx`
- `src/components/ComparisonSummary.tsx`

3D scene:

- `src/components/SceneCanvas.tsx`
- `src/components/AlertTriageEngine.tsx`
- `src/components/AdaptiveRankingCore.tsx`
- `src/components/Lighting.tsx`
- `src/components/JobIntakeQueue.tsx`
- `src/components/SignalExtractionLayer.tsx`
- `src/components/CandidateBuffer.tsx`
- `src/components/AlertOutput.tsx`
- `src/components/SuppressionReservoir.tsx`
- `src/components/FeedbackLoop.tsx`

Simulation and hooks:

- `src/simulation/simulationEngine.ts`
- `src/simulation/alertTypes.ts`
- `src/simulation/objectPool.ts`
- `src/scene/animationConfig.ts`
- `src/hooks/useAlertSimulation.ts`
- `src/hooks/usePageVisibility.ts`
- `src/hooks/useReducedMotion.ts`
- `src/hooks/useResponsiveScene.ts`

## Packaging Note

Per request, the current frontend files are copied into:

- `C:\\Users\\ROG\\Desktop\\capstone\\frotend`

The folder name is kept as `frotend` exactly as requested.

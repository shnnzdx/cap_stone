import { animationConfig } from "../scene/animationConfig";
import type {
  ActiveAlert,
  AlertCandidate,
  AlertDecisionStrategy,
  CorePhase,
  CoreVisualState,
  FeedbackType,
  SimulationMetrics,
  StrategyMode,
  VisualUnit,
} from "./alertTypes";
import { createCandidate } from "./candidateGenerator";
import { generateJobs } from "./jobGenerator";
import { computeDerivedMetrics, createEmptyMetrics, isLowValue } from "./metrics";
import { createVisualPool, resetVisualUnit } from "./objectPool";
import { createSeededRandom, pick, range } from "./seededRandom";
import { feedbackRankingStrategy } from "./strategies/feedbackRanking";
import { fixedThresholdStrategy } from "./strategies/fixedThreshold";
import { ruleSuppressionStrategy } from "./strategies/ruleSuppression";
import type { DashboardAlertRecord, DashboardFeedbackType, FeedbackEffect, OperatorAction, ReviewOutcome } from "./dashboardTypes";

const strategies: Record<StrategyMode, AlertDecisionStrategy> = {
  feedback: feedbackRankingStrategy,
  threshold: fixedThresholdStrategy,
  rules: ruleSuppressionStrategy,
};

type Vec3 = [number, number, number];

type FlowRecord = {
  candidate: AlertCandidate;
  unit: VisualUnit;
  decisionReason: string;
  laneIndex: number;
  bufferSlot: number;
  coreSlot: number | null;
  state: "intake" | "buffered" | "docking" | "docked" | "ranking" | "releasing" | "recycling";
  stateStartedAt: number;
  recycleUntil: number;
};

const coreSlotCount = 32;
const processingThreshold = 22;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function ease(value: number) {
  const x = Math.min(1, Math.max(0, value));
  return x * x * (3 - 2 * x);
}

function setPosition(unit: VisualUnit, from: Vec3, to: Vec3, t: number) {
  const amount = ease(t);
  unit.currentPosition = [
    lerp(from[0], to[0], amount),
    lerp(from[1], to[1], amount),
    lerp(from[2], to[2], amount),
  ];
}

function setBezierPosition(unit: VisualUnit, p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number) {
  const x = Math.min(1, Math.max(0, t));
  const a = (1 - x) ** 3;
  const b = 3 * (1 - x) ** 2 * x;
  const c = 3 * (1 - x) * x ** 2;
  const d = x ** 3;
  unit.currentPosition = [
    p0[0] * a + p1[0] * b + p2[0] * c + p3[0] * d,
    p0[1] * a + p1[1] * b + p2[1] * c + p3[1] * d,
    p0[2] * a + p1[2] * b + p2[2] * c + p3[2] * d,
  ];
}

function laneSource(lane: number, phase = 0): Vec3 {
  const lanes: Vec3[] = [
    [-3.42, -1.26, 0.18],
    [-3.34, -0.38, 0.42],
    [-2.92, 0.82, 0.66],
  ];
  const base = lanes[lane % lanes.length];
  return [base[0], base[1] + Math.sin(phase) * 0.04, base[2] + Math.cos(phase) * 0.035];
}

function bufferSlot(slot: number): Vec3 {
  const positions: Vec3[] = [
    [-1.18, -0.82, 0.36],
    [-0.96, -0.62, 0.44],
    [-0.74, -0.42, 0.52],
    [-1.08, -0.12, 0.4],
    [-0.86, 0.08, 0.5],
    [-0.64, 0.28, 0.6],
    [-0.92, 0.54, 0.44],
    [-0.68, 0.72, 0.56],
    [-0.44, 0.9, 0.68],
    [-1.32, 0.26, 0.34],
    [-1.2, 0.7, 0.42],
    [-0.46, -0.72, 0.58],
  ];
  return positions[slot % positions.length];
}

function laneControlA(lane: number): Vec3 {
  return [
    [-2.72, -1.12, 0.3],
    [-2.56, -0.1, 0.62],
    [-2.08, 0.72, 0.82],
  ][lane % 3] as Vec3;
}

function laneControlB(slot: number): Vec3 {
  const target = bufferSlot(slot);
  return [target[0] - 0.58, target[1] + 0.12, target[2] + 0.2];
}

function coreEntry(slot: number): Vec3 {
  const row = Math.floor((slot % 16) / 4);
  return [-0.42, -0.46 + row * 0.3, 0.6 + (slot >= 16 ? 0.24 : 0)];
}

function outputStart(decision: "promote" | "suppress", slot: number): Vec3 {
  if (decision === "promote") return [1.14, 0.48 + (slot % 2) * 0.16, 0.62];
  return [1.0, -0.72 - (slot % 2) * 0.14, 0.32];
}

function outputEnd(decision: "promote" | "suppress", slot: number): Vec3 {
  if (decision === "promote") return [2.72, 0.9 + (slot % 2) * 0.16, 0.5];
  return [2.2, -1.66 - (slot % 2) * 0.2, 0.04];
}

export class SimulationEngine {
  readonly jobs = createVisualPool("job", 0);
  readonly signals = createVisualPool("signal", 0);
  readonly candidates = createVisualPool("candidate", 36);
  readonly feedback = createVisualPool("feedback", 6);

  private readonly inputJobs = generateJobs();
  private readonly random = createSeededRandom(7331);
  private readonly feedbackMemory = new Map<string, number>();
  private readonly durations: number[] = [];
  private readonly workers = new Set<string>();
  private metrics = createEmptyMetrics();
  private activeAlerts: ActiveAlert[] = [];
  private alertHistory: DashboardAlertRecord[] = [];
  private feedbackEffects: FeedbackEffect[] = [];
  private mode: StrategyMode = "feedback";
  private jobCursor = 0;
  private candidateCursor = 0;
  private feedbackCursor = 0;
  private nextSpawnAt = 0;
  private phase: CorePhase = "filling";
  private phaseStartedAt = 0;
  private coreSlots: Array<FlowRecord | null> = Array.from({ length: coreSlotCount }, () => null);
  private activeBatch: FlowRecord[] = [];
  private nextBatch: FlowRecord[] = [];
  private records: FlowRecord[] = [];

  get strategyMode() {
    return this.mode;
  }

  get strategyName() {
    return strategies[this.mode].name;
  }

  getMetrics(): SimulationMetrics {
    return computeDerivedMetrics(this.metrics, this.durations, this.workers);
  }

  getActiveAlerts() {
    return this.activeAlerts.slice(0, 5);
  }

  getAlertHistory(elapsed = 0): DashboardAlertRecord[] {
    return this.alertHistory.slice(0, 100).map((record) => ({
      ...record,
      ageSeconds: Math.max(0, elapsed - record.createdTime),
    }));
  }

  getSuppressedHistory(elapsed = 0) {
    return this.getAlertHistory(elapsed).filter((record) => record.decision === "suppress");
  }

  getFeedbackEffects() {
    return this.feedbackEffects.slice(0, 12);
  }

  submitAlertFeedback(alertId: string, feedbackType: DashboardFeedbackType, elapsed = 0) {
    const record = this.alertHistory.find((item) => item.id === alertId);
    if (!record) return false;
    record.feedbackStatus = feedbackType;
    if (this.mode === "feedback") {
      const delta = feedbackType === "useful" || feedbackType === "real_incident" ? 0.05 : -0.05;
      this.feedbackMemory.set(record.workerId, (this.feedbackMemory.get(record.workerId) ?? 0) + delta);
    }
    this.feedbackEffects = [
      {
        id: `${alertId}-${feedbackType}-${Math.round(elapsed * 10)}`,
        timestamp: elapsed,
        service: record.service,
        feedbackType,
        description: createFeedbackEffectDescription(record.service, feedbackType),
      },
      ...this.feedbackEffects,
    ].slice(0, 12);
    return true;
  }

  submitAlertReview(alertId: string, outcome: ReviewOutcome, operatorAction: OperatorAction, note = "", elapsed = 0) {
    const record = this.alertHistory.find((item) => item.id === alertId);
    if (!record) return false;
    const appliedToRanking = this.mode === "feedback";
    record.feedbackStatus = outcome;
    record.reviewStatus = "reviewed";
    record.escalated = operatorAction === "escalate" || record.escalated;
    record.feedback = {
      outcome,
      reviewer: "You",
      note: note.trim() || undefined,
      submittedAt: elapsed,
      operatorAction,
      appliedToRanking,
      rankingEffect: appliedToRanking ? createReviewRankingEffect(record.service, outcome) : "Saved for audit only",
    };

    if (appliedToRanking) {
      const positive = outcome === "real_incident";
      const negative = outcome === "false_positive" || outcome === "duplicate" || outcome === "expected_behavior" || outcome === "non_actionable";
      const delta = positive ? 0.07 : negative ? -0.06 : 0.01;
      this.feedbackMemory.set(record.workerId, (this.feedbackMemory.get(record.workerId) ?? 0) + delta);
    }

    this.feedbackEffects = [
      {
        id: `${alertId}-${outcome}-${operatorAction}-${Math.round(elapsed * 10)}`,
        timestamp: elapsed,
        service: record.service,
        feedbackType: outcome,
        description: appliedToRanking ? createReviewRankingEffect(record.service, outcome) : `Audit-only ${formatReviewOutcome(outcome)} review recorded`,
      },
      ...this.feedbackEffects,
    ].slice(0, 12);
    return true;
  }

  getCoreVisualState(elapsed: number): CoreVisualState {
    const phaseAge = elapsed - this.phaseStartedAt;
    const compressionProgress = this.phase === "compressing" ? ease(phaseAge / 1.1) : this.phase === "ranking" || this.phase === "releasing" ? 1 : 0;
    const rankingProgress = this.phase === "ranking" ? ease(phaseAge / 1.8) : this.phase === "releasing" ? 1 : 0;
    const releaseProgress = this.phase === "releasing" ? ease(phaseAge / 3.4) : 0;
    const feedbackPulse = this.feedback.some((unit) => unit.active) ? 1 : 0;
    const occupiedSlots = this.coreSlots.flatMap((record, slotId) => {
      if (!record) return [];
      const state: "docking" | "docked" | "ranking" | "releasing" =
        record.state === "docking"
          ? "docking"
          : record.state === "ranking"
            ? "ranking"
            : record.state === "releasing"
              ? "releasing"
              : "docked";
      return [
        {
          slotId,
          candidateId: record.candidate.id,
          score: record.candidate.score,
          utility: record.candidate.utility,
          decision: record.candidate.finalDecision,
          state,
        },
      ];
    });

    return {
      phase: this.phase,
      fillLevel: occupiedSlots.length / coreSlotCount,
      compressionProgress,
      rankingProgress,
      releaseProgress,
      feedbackPulse,
      occupiedSlots,
    };
  }

  setStrategy(mode: StrategyMode) {
    this.mode = mode;
    this.reset();
  }

  reset() {
    this.jobs.forEach(resetVisualUnit);
    this.signals.forEach(resetVisualUnit);
    this.candidates.forEach(resetVisualUnit);
    this.feedback.forEach(resetVisualUnit);
    this.feedbackMemory.clear();
    this.durations.length = 0;
    this.workers.clear();
    this.metrics = createEmptyMetrics();
    this.activeAlerts = [];
    this.alertHistory = [];
    this.feedbackEffects = [];
    this.jobCursor = 0;
    this.candidateCursor = 0;
    this.feedbackCursor = 0;
    this.nextSpawnAt = 0;
    this.phase = "filling";
    this.phaseStartedAt = 0;
    this.coreSlots = Array.from({ length: coreSlotCount }, () => null);
    this.activeBatch = [];
    this.nextBatch = [];
    this.records = [];
  }

  update(elapsed: number, paused: boolean) {
    if (paused) return;
    if (elapsed >= this.nextSpawnAt) {
      this.spawnCandidate(elapsed);
      this.nextSpawnAt = elapsed + range(this.random, animationConfig.spawnInterval.min, animationConfig.spawnInterval.max);
    }

    this.updateCorePhase(elapsed);
    this.updateCandidates(elapsed);
    this.updateFeedback(elapsed);
  }

  runComparison() {
    const originalMode = this.mode;
    const result = (["threshold", "rules", "feedback"] as StrategyMode[]).map((mode) => {
      this.mode = mode;
      this.reset();
      for (let time = 0; time < 90; time += 0.2) this.update(time, false);
      return {
        mode,
        strategy: strategies[mode].name,
        metrics: this.getMetrics(),
      };
    });
    this.mode = originalMode;
    this.reset();
    return result;
  }

  private spawnCandidate(elapsed: number) {
    const unit = this.candidates[this.candidateCursor];
    const existing = this.records.find((record) => record.unit === unit);
    if (existing && existing.state !== "recycling") return;

    const job = this.inputJobs[this.jobCursor % this.inputJobs.length];
    const candidate = createCandidate(job, this.jobCursor);
    const decision = strategies[this.mode].evaluate(candidate, {
      feedbackMemory: this.feedbackMemory,
      processedCount: this.metrics.jobsProcessed,
    });
    candidate.finalDecision = decision.decision;

    const laneIndex = this.jobCursor % 3;
    const bufferSlotId = this.jobCursor % 12;
    resetVisualUnit(unit);
    unit.active = true;
    unit.lifecycleState = "job_ingestion";
    unit.startTime = elapsed;
    unit.duration = range(this.random, animationConfig.intakeDuration.min, animationConfig.intakeDuration.max);
    unit.laneIndex = laneIndex;
    unit.bufferSlot = bufferSlotId;
    unit.score = candidate.score;
    unit.severity = candidate.severity;
    unit.utility = candidate.utility;
    unit.isActionable = candidate.isActionable;
    unit.isDuplicate = candidate.isDuplicate;
    unit.finalDecision = candidate.finalDecision;
    unit.currentPosition = laneSource(laneIndex, unit.phaseOffset);
    unit.targetPosition = bufferSlot(bufferSlotId);
    unit.visualScale = 0.82;

    const record: FlowRecord = {
      candidate,
      unit,
      decisionReason: decision.reason,
      laneIndex,
      bufferSlot: bufferSlotId,
      coreSlot: null,
      state: "intake",
      stateStartedAt: elapsed,
      recycleUntil: 0,
    };

    this.records = this.records.filter((item) => item.unit !== unit);
    this.records.push(record);
    this.nextBatch.push(record);

    this.metrics.jobsProcessed += 1;
    this.metrics.rawAlertCandidates += 1;
    this.metrics.trueActionableTotal += candidate.isActionable ? 1 : 0;
    this.metrics.lowValueCandidates += isLowValue(job) ? 1 : 0;
    this.durations.push(job.durationMs);
    if (this.durations.length > 120) this.durations.shift();
    this.workers.add(job.workerId);
    if (this.workers.size > 8) this.workers.clear();

    this.jobCursor += 1;
    this.candidateCursor = (this.candidateCursor + 1) % this.candidates.length;

    this.recordDashboardAlert(candidate, decision.reason, decision.confidence, elapsed);
  }

  private updateCorePhase(elapsed: number) {
    const occupied = this.coreSlots.filter(Boolean).length;
    if (this.phase === "filling" && occupied >= processingThreshold) {
      this.phase = "compressing";
      this.phaseStartedAt = elapsed;
      this.activeBatch = this.coreSlots.filter(Boolean) as FlowRecord[];
    } else if (this.phase === "compressing" && elapsed - this.phaseStartedAt > 1.1) {
      this.phase = "ranking";
      this.phaseStartedAt = elapsed;
      this.activeBatch.forEach((record) => {
        record.state = "ranking";
        record.stateStartedAt = elapsed;
      });
    } else if (this.phase === "ranking" && elapsed - this.phaseStartedAt > 1.8) {
      this.phase = "releasing";
      this.phaseStartedAt = elapsed;
      const ordered = [...this.activeBatch].sort((a, b) => b.candidate.utility - a.candidate.utility);
      ordered.forEach((record, index) => {
        record.state = "releasing";
        record.stateStartedAt = elapsed + index * 0.1;
      });
    } else if (this.phase === "releasing" && this.activeBatch.every((record) => record.state === "recycling")) {
      this.phase = "recovering";
      this.phaseStartedAt = elapsed;
    } else if (this.phase === "recovering" && elapsed - this.phaseStartedAt > 0.9) {
      this.phase = "filling";
      this.phaseStartedAt = elapsed;
      this.activeBatch = [];
    }
  }

  private findFreeCoreSlot() {
    return this.coreSlots.findIndex((slot) => slot === null);
  }

  private updateCandidates(elapsed: number) {
    this.records = this.records.filter((record) => {
      const unit = record.unit;
      if (record.state === "intake") {
        const t = (elapsed - record.stateStartedAt) / unit.duration;
        unit.lifecycleState = t < 0.42 ? "job_ingestion" : t < 0.72 ? "signal_extraction" : "candidate_buffer";
        setBezierPosition(
          unit,
          laneSource(record.laneIndex, unit.phaseOffset),
          laneControlA(record.laneIndex),
          laneControlB(record.bufferSlot),
          bufferSlot(record.bufferSlot),
          t,
        );
        unit.visualScale = lerp(0.72, 1, ease(t));
        if (t >= 1) {
          record.state = "buffered";
          record.stateStartedAt = elapsed;
          unit.lifecycleState = "candidate_buffer";
        }
        return true;
      }

      if (record.state === "buffered") {
        const slotPosition = bufferSlot(record.bufferSlot);
        const idle = Math.sin(elapsed * 1.3 + unit.phaseOffset) * 0.012;
        unit.currentPosition = [slotPosition[0], slotPosition[1] + idle, slotPosition[2]];
        unit.visualScale = 1;
        if (this.phase === "filling") {
          const freeSlot = this.findFreeCoreSlot();
          if (freeSlot >= 0) {
            record.coreSlot = freeSlot;
            record.state = "docking";
            record.stateStartedAt = elapsed + (record.bufferSlot % 3) * 0.08;
            this.coreSlots[freeSlot] = record;
            this.nextBatch = this.nextBatch.filter((item) => item !== record);
          }
        }
        return true;
      }

      if (record.state === "docking") {
        if (record.coreSlot === null) return true;
        const t = (elapsed - record.stateStartedAt) / 0.95;
        unit.lifecycleState = "absorbing";
        const from = bufferSlot(record.bufferSlot);
        const entry = coreEntry(record.coreSlot);
        setBezierPosition(unit, from, [from[0] + 0.32, from[1] + 0.08, from[2] + 0.16], entry, entry, t);
        unit.visualScale = lerp(1, 0.78, ease(t));
        if (t >= 1) {
          record.state = "docked";
          record.stateStartedAt = elapsed;
          unit.active = false;
        }
        return true;
      }

      if (record.state === "docked" || record.state === "ranking") {
        unit.active = false;
        return true;
      }

      if (record.state === "releasing") {
        if (record.coreSlot === null || elapsed < record.stateStartedAt) return true;
        const t = (elapsed - record.stateStartedAt) / (record.candidate.finalDecision === "promote" ? 1.45 : 1.9);
        unit.active = true;
        unit.lifecycleState = record.candidate.finalDecision === "promote" ? "promoted" : "suppressed";
        const start = outputStart(record.candidate.finalDecision, record.coreSlot);
        const end = outputEnd(record.candidate.finalDecision, record.coreSlot);
        setBezierPosition(
          unit,
          start,
          [start[0] + 0.42, start[1] + (record.candidate.finalDecision === "promote" ? 0.3 : -0.22), start[2] + 0.08],
          [end[0] - 0.26, end[1], end[2] + 0.06],
          end,
          t,
        );
        unit.visualScale = record.candidate.finalDecision === "promote" ? lerp(0.72, 1.08, ease(Math.min(t, 0.5) / 0.5)) : lerp(0.68, 0.24, ease(t));
        if (t >= 1) {
          this.finishCandidate(record, elapsed);
          if (record.coreSlot !== null) this.coreSlots[record.coreSlot] = null;
          record.state = "recycling";
          record.stateStartedAt = elapsed;
          record.recycleUntil = elapsed + range(this.random, animationConfig.recycleDelay.min, animationConfig.recycleDelay.max);
          unit.active = false;
        }
        return true;
      }

      if (record.state === "recycling") {
        if (elapsed >= record.recycleUntil) {
          resetVisualUnit(unit);
          return false;
        }
        return true;
      }

      return true;
    });
  }

  private finishCandidate(record: FlowRecord, elapsed: number) {
    const { candidate, unit, decisionReason } = record;
    if (candidate.finalDecision === "promote") {
      this.metrics.actionableAlertsSent += 1;
      this.metrics.trueActionableSurfaced += candidate.isActionable ? 1 : 0;
      this.metrics.lowValueAlertsSent += isLowValue(candidate.job) ? 1 : 0;
      this.activeAlerts = [
        {
          id: candidate.id,
          workerId: candidate.job.workerId,
          status: candidate.job.status,
          score: candidate.score,
          utility: candidate.utility,
          reason: decisionReason,
        },
        ...this.activeAlerts,
      ].slice(0, 5);
      this.spawnFeedback(candidate, elapsed);
    } else if (isLowValue(candidate.job)) {
      this.metrics.lowValueAlertsSuppressed += 1;
    }

    if (unit.finalDecision === "promote") {
      const feedbackType: FeedbackType = candidate.isActionable
        ? pick(this.random, ["acknowledged", "useful", "escalated", "resolved"])
        : pick(this.random, ["ignored", "false_positive"]);
      candidate.feedbackType = feedbackType;
      const delta = candidate.isActionable ? 0.04 : -0.05;
      this.feedbackMemory.set(candidate.job.workerId, (this.feedbackMemory.get(candidate.job.workerId) ?? 0) + delta);
    }
  }

  private recordDashboardAlert(candidate: AlertCandidate, decisionReason: string, confidence: number, elapsed: number) {
    const job = candidate.job;
    const service = serviceForJob(job.workerId, job.id);
    const decisionBoundary = this.mode === "threshold" ? 0.58 : this.mode === "feedback" ? 0.48 : 0.5;
    const similarCandidateCount = Math.max(1, Math.round((candidate.isDuplicate ? 9 : 2) + job.retryCount * 1.8 + job.errorCount * 0.18));
    const successfulRecovery = job.status === "completed" || (job.status === "completed_with_failures" && job.retryCount > 0);
    const scoreBreakdown = [
      { label: "Error count", value: Math.min(1, job.errorCount * 0.11) },
      { label: "Retry pressure", value: Math.min(1, job.retryCount * 0.07) },
      { label: "Latency", value: Math.min(1, job.apiLatencyMs / 9000) },
      { label: "Status weight", value: job.status === "timeout" ? 0.28 : job.status === "failed" ? 0.2 : job.status === "completed_with_failures" ? 0.12 : 0 },
      { label: "Telemetry gap", value: job.missingTelemetry ? 0.1 : 0 },
    ];
    const reviewScoreBreakdown = [
      { feature: "Failure severity", contribution: Math.min(0.32, candidate.severity * 0.26) },
      { feature: "Repeated retries", contribution: Math.min(0.18, job.retryCount * 0.035) },
      { feature: "Service criticality", contribution: service === "billing-worker" || service === "retailer-sync" ? 0.12 : 0.05 },
      { feature: "Duplicate pattern", contribution: candidate.isDuplicate ? -0.24 : -0.04 },
      { feature: "Successful recovery", contribution: successfulRecovery ? -0.18 : 0 },
      { feature: "Telemetry gap", contribution: job.missingTelemetry ? 0.07 : 0 },
    ];
    const relatedSignals = [
      { label: "Latency", value: `${job.apiLatencyMs}ms API / ${job.durationMs}ms job` },
      { label: "Retries", value: `${job.retryCount} retries` },
      { label: "Errors", value: `${job.errorCount} errors` },
      { label: "Telemetry", value: job.missingTelemetry ? "Missing fields" : "Complete" },
    ];

    const dashboardRecord: DashboardAlertRecord = {
        id: candidate.id,
        service,
        jobId: job.id,
        workerId: job.workerId,
        severity: candidate.severity,
        status: job.status,
        score: candidate.score,
        utility: candidate.utility,
        decision: candidate.finalDecision,
        decisionReason,
        confidence,
        decisionBoundary,
        feedbackStatus: "none",
        reviewStatus: "unreviewed",
        escalated: false,
        createdTime: elapsed,
        ageSeconds: 0,
        relatedSignals,
        scoreBreakdown,
        reviewScoreBreakdown,
        durationMs: job.durationMs,
        apiLatencyMs: job.apiLatencyMs,
        retryCount: job.retryCount,
        errorCount: job.errorCount,
        retailerFailureRate: job.retailerFailureRate,
        addressFailureRate: job.addressFailureRate,
        similarCandidateCount,
        missingTelemetry: job.missingTelemetry,
        lastSuccessfulRunAgeSeconds: successfulRecovery ? Math.round(120 + (this.jobCursor % 7) * 55) : undefined,
        isActionable: candidate.isActionable,
        isDuplicate: candidate.isDuplicate,
        isLowValue: isLowValue(job),
      };
    this.alertHistory = [dashboardRecord, ...this.alertHistory].slice(0, 100);
  }

  private spawnFeedback(candidate: AlertCandidate, elapsed: number) {
    if (this.mode !== "feedback") return;
    const unit = this.feedback[this.feedbackCursor];
    resetVisualUnit(unit);
    unit.active = true;
    unit.lifecycleState = "feedback";
    unit.startTime = elapsed + range(this.random, animationConfig.feedbackDelay.min, animationConfig.feedbackDelay.max);
    unit.duration = animationConfig.feedbackDuration;
    unit.score = candidate.score;
    unit.utility = candidate.utility;
    unit.isActionable = candidate.isActionable;
    unit.finalDecision = "promote";
    unit.currentPosition = [2.46, 0.96, 0.54];
    unit.targetPosition = [0.24, 0.18, 0.82];
    unit.visualScale = 0.56;
    this.feedbackCursor = (this.feedbackCursor + 1) % this.feedback.length;
    this.metrics.feedbackEvents += 1;
  }

  private updateFeedback(elapsed: number) {
    this.feedback.forEach((unit) => {
      if (!unit.active) return;
      const t = (elapsed - unit.startTime) / unit.duration;
      if (t < 0) return;
      setBezierPosition(unit, [2.46, 0.96, 0.54], [2.1, 1.42, 0.9], [1.1, 1.36, 1.0], [0.24, 0.18, 0.82], t);
      unit.visualScale = 0.52 + Math.sin(elapsed * 6 + unit.phaseOffset) * 0.04;
      if (t >= 1) resetVisualUnit(unit);
    });
  }
}

function serviceForJob(workerId: string, jobId: string) {
  const services = ["retailer-sync", "address-normalizer", "billing-worker", "catalog-pricing", "queue-drain"];
  const workerNumber = Number.parseInt(workerId.replace("worker-", ""), 10) || 1;
  const jobNumber = Number.parseInt(jobId.replace("job-", ""), 10) || 1;
  return services[(workerNumber + jobNumber) % services.length];
}

function createFeedbackEffectDescription(service: string, feedbackType: DashboardFeedbackType) {
  const effects: Record<DashboardFeedbackType, string> = {
    useful: `Raised priority confidence for recurring ${service} alerts`,
    noisy: `Lowered repeated low-utility priority for ${service}`,
    duplicate: `Grouped duplicate failures for ${service}`,
    expected: `Marked expected behavior pattern for ${service}`,
    false_positive: `Reduced false-positive weight for ${service}`,
    real_incident: `Raised incident sensitivity for ${service}`,
  };
  return effects[feedbackType];
}

function formatReviewOutcome(outcome: ReviewOutcome) {
  const labels: Record<ReviewOutcome, string> = {
    real_incident: "Real Incident",
    false_positive: "False Positive",
    duplicate: "Duplicate",
    expected_behavior: "Expected Behavior",
    non_actionable: "Non-Actionable",
    needs_more_information: "Needs More Information",
  };
  return labels[outcome];
}

function createReviewRankingEffect(service: string, outcome: ReviewOutcome) {
  const effects: Record<ReviewOutcome, string> = {
    real_incident: `Raised high-risk sensitivity for ${service}`,
    false_positive: `Lowered false-positive weight for ${service}`,
    duplicate: `Increased duplicate grouping weight for ${service}`,
    expected_behavior: `Marked expected behavior pattern for ${service}`,
    non_actionable: `Reduced non-actionable priority for ${service}`,
    needs_more_information: `Queued ${service} pattern for additional review evidence`,
  };
  return effects[outcome];
}

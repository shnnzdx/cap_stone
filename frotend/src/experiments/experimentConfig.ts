import type { ExperimentDefinition } from "./experimentTypes";

export const evaluationSeedSet = [7331, 10427, 18539, 24671, 31991, 42043, 51871, 63149, 74201, 86413];

export const defaultExperimentDefinition: ExperimentDefinition = {
  id: "EXP-2026-07-12-01",
  name: "Controlled multi-seed strategy evaluation",
  calibrationSeeds: evaluationSeedSet.slice(0, 4),
  evaluationSeeds: evaluationSeedSet,
  jobsPerRun: 1200,
  recallGuardrail: 0.9,
  feedbackRounds: 4,
  inconclusiveRelativeMargin: 0.03,
  groundTruthSource: "synthetic_controlled_labels",
  createdAt: Date.UTC(2026, 6, 12),
};

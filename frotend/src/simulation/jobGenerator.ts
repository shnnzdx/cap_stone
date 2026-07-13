import type { SimulatedJob } from "./alertTypes";
import { createSeededRandom, pick, range } from "./seededRandom";

export function generateJobs(seed = 20260112, count = 420): SimulatedJob[] {
  const random = createSeededRandom(seed);

  return Array.from({ length: count }, (_, index) => {
    const workerId = `worker-${1 + (index % 8)}`;
    const statusRoll = random();
    const status =
      statusRoll > 0.92
        ? "timeout"
        : statusRoll > 0.78
          ? "failed"
          : statusRoll > 0.62
            ? "completed_with_failures"
            : "completed";
    const retryCount = Math.floor(range(random, 0, status === "completed" ? 2.2 : 5.8));
    const errorCount =
      status === "completed"
        ? Math.floor(range(random, 0, 1.8))
        : Math.floor(range(random, 1, status === "timeout" ? 8 : 6));
    const apiLatencyMs = Math.round(range(random, 110, status === "timeout" ? 5200 : 2400));
    const durationMs = Math.round(apiLatencyMs + range(random, 300, 6400) + retryCount * range(random, 120, 760));
    const retailerFailureRate = status === "completed" ? range(random, 0, 0.08) : range(random, 0.05, 0.54);
    const addressFailureRate = status === "completed" ? range(random, 0, 0.04) : range(random, 0.03, 0.42);
    const missingTelemetry = random() > 0.88;
    const utility =
      errorCount * 0.12 +
      retryCount * 0.08 +
      (status === "timeout" ? 0.34 : 0) +
      (status === "failed" ? 0.26 : 0) +
      retailerFailureRate * 0.42 +
      addressFailureRate * 0.26 +
      (missingTelemetry ? 0.12 : 0) +
      range(random, -0.12, 0.16);
    const trueActionable = utility > 0.58 || (status !== "completed" && errorCount >= 4);

    return {
      id: `job-${index + 1}`,
      workerId,
      durationMs,
      apiLatencyMs,
      retryCount,
      errorCount,
      status: pick(random, [status, status, status]),
      retailerFailureRate,
      addressFailureRate,
      missingTelemetry,
      trueActionable,
      alertUtility: Math.max(0, Math.min(1, utility)),
    };
  });
}

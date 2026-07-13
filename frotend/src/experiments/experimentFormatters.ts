import type { StrategyMode } from "../simulation/alertTypes";

export const strategyLabels: Record<StrategyMode, string> = {
  feedback: "Feedback-Driven Ranking",
  threshold: "Fixed Threshold",
  rules: "Rule-Only Suppression",
};

export function pct(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

export function signedPctPoints(value: number) {
  const points = Math.round(value * 1000) / 10;
  return `${points >= 0 ? "+" : ""}${points} percentage points`;
}

export function signedRelative(value: number) {
  const percent = Math.round(value * 1000) / 10;
  return `${percent >= 0 ? "+" : ""}${percent}%`;
}

export function compactNumber(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

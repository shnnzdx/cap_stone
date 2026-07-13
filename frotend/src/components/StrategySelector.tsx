import type { StrategyMode } from "../simulation/alertTypes";

const options: Array<{ mode: StrategyMode; label: string }> = [
  { mode: "feedback", label: "Feedback Ranking" },
  { mode: "threshold", label: "Fixed Threshold" },
  { mode: "rules", label: "Rule Only" },
];

type StrategySelectorProps = {
  value: StrategyMode;
  onChange: (mode: StrategyMode) => void;
  onCompare: () => void;
};

export function StrategySelector({ value, onChange, onCompare }: StrategySelectorProps) {
  return (
    <div className="strategy-selector" aria-label="Alert decision strategy">
      {options.map((option) => (
        <button
          className={option.mode === value ? "active" : ""}
          key={option.mode}
          type="button"
          onClick={() => onChange(option.mode)}
        >
          {option.label}
        </button>
      ))}
      <button className="compare-button" type="button" onClick={onCompare}>
        Run Comparison
      </button>
    </div>
  );
}

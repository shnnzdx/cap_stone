import type { DashboardFeedbackType } from "../../simulation/dashboardTypes";

const options: Array<[DashboardFeedbackType, string]> = [
  ["useful", "Useful"],
  ["noisy", "Noisy"],
  ["duplicate", "Duplicate"],
  ["expected", "Expected"],
  ["false_positive", "False Positive"],
  ["real_incident", "Real Incident"],
];

export function FeedbackControls({
  value,
  submitted,
  onSubmit,
}: {
  value: DashboardFeedbackType | "none";
  submitted: boolean;
  onSubmit: (type: DashboardFeedbackType) => void;
}) {
  return (
    <div className="feedback-controls">
      <span>Feedback</span>
      <div>
        {options.map(([type, label]) => (
          <button className={value === type ? "active" : ""} key={type} type="button" onClick={() => onSubmit(type)}>
            {label}
          </button>
        ))}
      </div>
      {submitted ? <p>Feedback applied to ranking memory.</p> : null}
    </div>
  );
}

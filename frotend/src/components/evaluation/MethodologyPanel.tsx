export function MethodologyPanel() {
  const notes = [
    ["Input Control", "All strategies process identical seeded backend-job streams."],
    ["Ground Truth", "Synthetic actionable labels are used only for controlled evaluation metrics."],
    ["Review Blinding", "Ground-truth labels are not exposed in the Alert Review interface."],
    ["Feedback Isolation", "Feedback changes only the Feedback-Driven Ranking strategy."],
    ["Baseline Stability", "Fixed Threshold and Rule-Only Suppression remain unchanged across feedback rounds."],
    ["Metric Timing", "Metrics are calculated after every strategy processes the same number of candidates."],
    ["Live System Isolation", "Evaluation runs do not reset or mutate the Dashboard simulation, Overview animation, alert review queue, or live feedback state."],
    ["Multi-Run Aggregation", "Displayed strategy metrics are means across identical seeded runs."],
    ["Limitation", "Synthetic controlled results do not by themselves establish production performance."],
  ];
  return (
    <section className="evaluation-panel methodology-panel">
      <div className="evaluation-panel-heading">
        <span>Methodology Notes</span>
      </div>
      <div className="methodology-list">
        {notes.map(([label, body]) => (
          <div key={label}>
            <strong>{label}</strong>
            <p>{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

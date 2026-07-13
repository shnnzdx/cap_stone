export function EvaluationHeader({ status, runCount }: { status: string; runCount: number }) {
  return (
    <header className="evaluation-header">
      <div>
        <p className="eyebrow">Controlled experiment evidence</p>
        <h1>EVALUATION.</h1>
        <p>Compare adaptive alerting strategies on identical controlled job streams.</p>
      </div>
      <div className="evaluation-status">
        <span>Experiment Status</span>
        <strong>{status}</strong>
        <em>{runCount} seeded runs</em>
      </div>
    </header>
  );
}

import type { ComparisonResult } from "../hooks/useAlertSimulation";

export function ComparisonSummary({ comparison }: { comparison: ComparisonResult[] }) {
  if (comparison.length === 0) return null;

  return (
    <div className="comparison-summary">
      <span>Experiment comparison</span>
      <div className="comparison-grid">
        {comparison.map((item) => (
          <div className="comparison-row" key={item.mode}>
            <strong>{item.strategy}</strong>
            <span>Sent {Math.round(item.metrics.actionableAlertsSent)}</span>
            <span>Low-value sent {Math.round(item.metrics.lowValueAlertsSent)}</span>
            <span>Recall {Math.round(item.metrics.recall * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GuardrailBadge({ passed }: { passed: boolean }) {
  return <span className={passed ? "guardrail-badge pass" : "guardrail-badge fail"}>{passed ? "PASS" : "FAIL"}</span>;
}

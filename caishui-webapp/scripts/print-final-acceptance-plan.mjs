const {
  formatFinalAcceptanceExecutionPlan,
  getFinalAcceptanceRunbook,
  planFinalAcceptanceExecution,
} = await import("../lib/smoke/final-acceptance-runbook.ts");

const runbook = getFinalAcceptanceRunbook(process.env);
const plan = planFinalAcceptanceExecution(runbook);

console.log(formatFinalAcceptanceExecutionPlan(plan));

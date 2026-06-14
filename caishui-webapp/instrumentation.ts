// instrumentation.ts — 在 Next.js 服务端启动时运行一次（需 next.config experimental.instrumentationHook）。
// 核心服务依赖长连 SSE + 常驻进程，禁止 Serverless 部署（见 ADR-0008）。
// 把"误部署到 Serverless"从静默运行转为启动即失败。

export async function register() {
  // 仅在 Node 服务端运行；edge runtime 不在此校验。
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const escapeHatch = process.env.ALLOW_SERVERLESS === "true";
  if (escapeHatch) return;

  const serverlessSignals: Array<[string, string | undefined]> = [
    ["AWS_LAMBDA_RUNTIME_API", process.env.AWS_LAMBDA_RUNTIME_API],
    ["AWS_LAMBDA_FUNCTION_NAME", process.env.AWS_LAMBDA_FUNCTION_NAME],
    ["VERCEL", process.env.VERCEL],
    ["FC_FUNCTION_NAME", process.env.FC_FUNCTION_NAME], // 阿里云 FC
    ["SCF_FUNCTIONNAME", process.env.SCF_FUNCTIONNAME], // 腾讯云 SCF
  ];

  const detected = serverlessSignals.filter(([, v]) => v).map(([k]) => k);
  if (detected.length > 0) {
    throw new Error(
      `Refusing to start: serverless runtime detected (${detected.join(", ")}). ` +
        `This service needs long-lived SSE + resident background tasks; deploy on a long-running ` +
        `container (see ADR-0008). Set ALLOW_SERVERLESS=true only if you have verified the platform ` +
        `supports the required connection duration, AbortSignal and concurrency.`,
    );
  }
}

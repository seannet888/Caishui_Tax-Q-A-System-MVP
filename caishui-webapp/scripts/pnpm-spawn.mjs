import { spawn } from "node:child_process";

export function getPnpmExecutable(platform = process.platform) {
  return platform === "win32" ? "cmd.exe" : "pnpm";
}

export function getPnpmArgs(args, platform = process.platform) {
  return platform === "win32" ? ["/d", "/s", "/c", "pnpm", ...args] : args;
}

export function createPnpmSpawnSpec(args, options = {}, platform = process.platform) {
  return {
    command: getPnpmExecutable(platform),
    args: getPnpmArgs(args, platform),
    options: {
      ...options,
      shell: false,
    },
  };
}

export function spawnPnpm(args, options = {}) {
  const spec = createPnpmSpawnSpec(args, options);
  return spawn(spec.command, spec.args, spec.options);
}

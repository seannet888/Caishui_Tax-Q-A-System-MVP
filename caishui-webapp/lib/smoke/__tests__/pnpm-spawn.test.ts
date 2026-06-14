import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

describe("pnpm CLI spawn helper", () => {
  it("uses pnpm.cmd on Windows without shell execution", () => {
    const script = [
      "import { createPnpmSpawnSpec, getPnpmExecutable } from './scripts/pnpm-spawn.mjs';",
      "const spec = createPnpmSpawnSpec(['vitest', 'run', 'x.test.ts'], { stdio: 'inherit' }, 'win32');",
      "console.log(JSON.stringify({",
      "  windowsCommand: getPnpmExecutable('win32'),",
      "  linuxCommand: getPnpmExecutable('linux'),",
      "  specCommand: spec.command,",
      "  specShell: spec.options.shell,",
      "  specArgs: spec.args,",
      "}));",
    ].join("\n");

    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("DEP0190");
    const output = JSON.parse(result.stdout.trim()) as {
      windowsCommand: string;
      linuxCommand: string;
      specCommand: string;
      specShell: boolean;
      specArgs: string[];
    };
    expect(output.windowsCommand).toBe("cmd.exe");
    expect(output.linuxCommand).toBe("pnpm");
    expect(output.specCommand).toBe("cmd.exe");
    expect(output.specShell).toBe(false);
    expect(output.specArgs).toEqual(["/d", "/s", "/c", "pnpm", "vitest", "run", "x.test.ts"]);
  });
});

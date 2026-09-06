import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = import.meta.dir.endsWith("/tests") ? join(import.meta.dir, "..") : import.meta.dir;

describe("runPrintMode", () => {
  test("sets a non-zero exit code and reports to stderr when an adapter throws mid-query", () => {
    // The fixture adapter only supports coding-agent, planning-studio, and
    // incident-console. Calling runPrintMode directly (bypassing main()'s
    // pre-flight assertAdapterSupportsApp check) with an unsupported app
    // reaches query()'s catch block, which yields an "Error:"-prefixed
    // status event mid-loop -- exactly the case a future throwing adapter
    // would hit.
    //
    // This is run in a subprocess (rather than calling runPrintMode in-process
    // and asserting on process.exitCode directly) because Bun's test runner
    // treats any process.exitCode mutation made during a test as sticky for
    // the whole `bun test` invocation, even after it's reset in a `finally`
    // block -- which would make `bun test` itself exit non-zero despite every
    // test passing.
    const script = `
      import { runPrintMode } from "./src/main";
      import { getAdapter } from "./src/adapters/registry";
      const adapter = getAdapter("fixture");
      await runPrintMode("sales-copilot", "anything", adapter);
    `;

    const result = spawnSync("bun", ["-e", script], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
    expect(result.stdout).not.toContain("Error:");
  });
});

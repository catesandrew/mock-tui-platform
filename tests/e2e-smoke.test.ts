import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = import.meta.dir.endsWith("/tests")
  ? join(import.meta.dir, "..")
  : import.meta.dir;

function run(args: string[]): string {
  const result = spawnSync("bun", args, {
    cwd: root,
    encoding: "utf8",
  });

  expect(result.status).toBe(0);
  return `${result.stdout}${result.stderr}`;
}

describe("e2e smoke", () => {
  test("lists all app variants from the built CLI", () => {
    const output = run(["run", "dist/cli.js", "--list-apps"]);
    expect(output).toContain("coding-agent");
    expect(output).toContain("knowledge-terminal");
  });

  test("runs a headless print flow through the query engine", () => {
    const output = run([
      "run",
      "dist/cli.js",
      "--app",
      "planning-studio",
      "--print",
      "draft a launch plan for the next initiative",
    ]);

    expect(output).toContain("[tool:roadmap-weave]");
    expect(output).toContain("Planning Studio received the prompt");
    expect(output).toContain("streaming transcript updates");
  });
});

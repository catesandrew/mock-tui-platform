import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = import.meta.dir.endsWith("/tests")
  ? join(import.meta.dir, "..")
  : import.meta.dir;

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("project documentation", () => {
  test("ships onboarding documentation for new contributors", () => {
    const path = "docs/ONBOARDING.md";
    expect(existsSync(join(root, path))).toBe(true);

    const content = read(path);
    expect(content).toContain("# Onboarding");
    expect(content).toContain("Architecture spine");
    expect(content).toContain("Development workflow");
    expect(content).toContain("Verification commands");
  });

  test("ships ADR documents for key architecture decisions", () => {
    const adrPaths = [
      "docs/adr/0001-standalone-mock-platform.md",
      "docs/adr/0002-variant-driven-shell.md",
      "docs/adr/0003-query-engine-and-smoke-tests.md",
    ];

    for (const path of adrPaths) {
      expect(existsSync(join(root, path))).toBe(true);
      const content = read(path);
      expect(content).toContain("# ADR");
      expect(content).toContain("Status");
      expect(content).toContain("Decision");
      expect(content).toContain("Consequences");
    }
  });

  test("README points readers to onboarding and ADR docs", () => {
    const content = read("README.md");
    expect(content).toContain("## Onboarding");
    expect(content).toContain("docs/ONBOARDING.md");
    expect(content).toContain("docs/adr/");
    expect(content).toContain("## Testing");
  });
});

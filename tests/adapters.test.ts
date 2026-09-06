import { describe, expect, test } from "bun:test";
import { getAppDefinition } from "../src/apps/catalog";
import { getTools } from "../src/tools";
import { mockAdapter } from "../src/adapters/mockAdapter";

describe("mock adapter", () => {
  test("selects a tool whose keywords match the prompt", () => {
    const app = getAppDefinition("coding-agent");
    const tools = getTools(app);
    const tool = mockAdapter.selectTool(app, "show me the codebase modules", tools);
    expect(tool?.name).toBe("workspace-map");
  });

  test("returns undefined when no tool keywords match", () => {
    const app = getAppDefinition("coding-agent");
    const tools = getTools(app);
    const tool = mockAdapter.selectTool(app, "hello there", tools);
    expect(tool).toBeUndefined();
  });

  test("generates response text referencing the app and selected tool", () => {
    const app = getAppDefinition("coding-agent");
    const text = mockAdapter.generateResponseText(app, "map the codebase", "workspace-map");
    expect(text).toContain("Coding Agent received the prompt");
    expect(text).toContain("workspace-map");
  });

  test("generates response text without a tool clause when no tool is selected", () => {
    const app = getAppDefinition("coding-agent");
    const text = mockAdapter.generateResponseText(app, "hello there");
    expect(text).toContain("No specialized tool was required");
  });
});

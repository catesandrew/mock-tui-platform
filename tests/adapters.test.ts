import { describe, expect, test } from "bun:test";
import { getAppDefinition } from "../src/apps/catalog";
import { getTools } from "../src/tools";
import { mockAdapter } from "../src/adapters/mockAdapter";
import { getAdapter, assertAdapterSupportsApp } from "../src/adapters/registry";
import { query } from "../src/query";
import { createMockNotification } from "../src/mocks/runtime";

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

describe("fixture adapter", () => {
  test("selects the fixture tool for a matching prompt", () => {
    const app = getAppDefinition("planning-studio");
    const tools = getTools(app);
    const adapter = getAdapter("fixture");
    const tool = adapter.selectTool(app, "sequence the next roadmap initiative", tools);
    expect(tool?.name).toBe("roadmap-weave");
  });

  test("returns the default fixture response for a non-matching prompt", () => {
    const app = getAppDefinition("planning-studio");
    const adapter = getAdapter("fixture");
    const text = adapter.generateResponseText(app, "what's the weather like");
    expect(text).toContain("replayed the default fixture");
  });

  test("returns the matched fixture response for all 3 supported apps", () => {
    const adapter = getAdapter("fixture");
    expect(adapter.generateResponseText(getAppDefinition("coding-agent"), "show me the codebase modules")).toContain(
      "workspace-map fixture",
    );
    expect(adapter.generateResponseText(getAppDefinition("incident-console"), "what's the blast radius")).toContain(
      "blast-radius fixture",
    );
  });
});

describe("adapter registry", () => {
  test("returns mockAdapter for id 'mock'", () => {
    expect(getAdapter("mock").id).toBe("mock");
  });

  test("returns a fixture adapter for id 'fixture'", () => {
    expect(getAdapter("fixture").id).toBe("fixture");
  });

  test("throws for an unknown adapter id", () => {
    expect(() => getAdapter("bogus")).toThrow('Unknown adapter "bogus". Valid adapters: mock, fixture.');
  });

  test("assertAdapterSupportsApp throws for fixture + unsupported app", () => {
    expect(() => assertAdapterSupportsApp("fixture", "sales-copilot")).toThrow(
      'Adapter "fixture" has no fixtures for app "sales-copilot"',
    );
  });

  test("assertAdapterSupportsApp does not throw for fixture + supported app", () => {
    expect(() => assertAdapterSupportsApp("fixture", "coding-agent")).not.toThrow();
  });

  test("assertAdapterSupportsApp does not throw for mock + any app", () => {
    expect(() => assertAdapterSupportsApp("mock", "sales-copilot")).not.toThrow();
  });
});

describe("query with fixture adapter", () => {
  test("surfaces an unsupported-app adapter error as a status event, not a throw", async () => {
    const app = getAppDefinition("sales-copilot");
    const tools = getTools(app);
    const adapter = getAdapter("fixture");
    const events = [];

    for await (const event of query({
      app,
      prompt: "anything",
      tools,
      notificationFactory: () => createMockNotification(app),
      adapter,
    })) {
      events.push(event);
    }

    const statusEvents = events.filter(event => event.type === "status");
    expect(statusEvents.some(event => event.status.startsWith("Error:"))).toBe(true);
    expect(events.at(-1)?.type).toBe("done");
  });
});

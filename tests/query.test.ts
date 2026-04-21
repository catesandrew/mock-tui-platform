import { describe, expect, test } from "bun:test";
import { getAppDefinition } from "../src/apps/catalog";
import { QueryEngine } from "../src/QueryEngine";
import { getTools } from "../src/tools";
import { createMockNotification } from "../src/mocks/runtime";

describe("query engine", () => {
  test("streams an assistant response", async () => {
    const app = getAppDefinition("coding-agent");
    const engine = new QueryEngine(app, getTools(app), () => createMockNotification(app));
    const events = [];

    for await (const event of engine.submitPrompt("map the codebase modules", [])) {
      events.push(event.type);
    }

    expect(events).toContain("assistant-start");
    expect(events).toContain("assistant-chunk");
    expect(events.at(-1)).toBe("done");
  });
});

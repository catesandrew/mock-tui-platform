import type { AppDefinition, ToolDefinition, ToolResult } from "./types";
import { sleep } from "./utils/time";

function buildTool(name: string, description: string, keywords: string[]): ToolDefinition {
  return {
    name,
    description,
    keywords,
    async run(prompt: string, app: AppDefinition): Promise<ToolResult> {
      await sleep(160);
      return {
        summary: `${name} scanned the ${app.title} workspace`,
        result: `${name} analyzed the prompt "${prompt}" and produced a mock ${app.subtitle.toLowerCase()} artifact.`,
      };
    },
  };
}

export function getBaseTools(): ToolDefinition[] {
  return [
    buildTool("mock-inspector", "Inspect the active application shell", ["inspect", "overview", "status"]),
    buildTool("mock-task-router", "Route tasks through the mock runtime", ["task", "route", "queue"]),
  ];
}

export function getTools(app: AppDefinition): ToolDefinition[] {
  return [
    ...getBaseTools(),
    ...app.tools.map(tool => buildTool(tool.name, tool.description, tool.keywords)),
  ];
}

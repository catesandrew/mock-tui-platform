import type { AppDefinition, ToolDefinition } from "../types";
import type { ResponseAdapter } from "./types";

function chooseTool(_app: AppDefinition, prompt: string, tools: ToolDefinition[]): ToolDefinition | undefined {
  const lowered = prompt.toLowerCase();
  return tools.find(tool => tool.keywords.some(keyword => lowered.includes(keyword)));
}

function buildMockResponse(app: AppDefinition, prompt: string, toolName?: string): string {
  const toolClause = toolName
    ? `I routed this through ${toolName} to keep the shell aligned with the ${app.title} operating model.`
    : `No specialized tool was required, so the runtime answered directly from the mock shell.`;

  return [
    `${app.title} received the prompt: "${prompt}".`,
    toolClause,
    `The response is mocked, but it still follows the production-shaped path: prompt submission, query engine, streaming transcript updates, and footer/status changes.`,
    `This makes the shell reusable across the ${app.title} domain without changing the architecture skeleton.`,
  ].join(" ");
}

export const mockAdapter: ResponseAdapter = {
  id: "mock",
  selectTool: chooseTool,
  generateResponseText: buildMockResponse,
};

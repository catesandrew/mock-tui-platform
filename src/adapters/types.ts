import type { AppDefinition, ToolDefinition } from "../types";

export type ResponseAdapter = {
  id: string;
  selectTool(app: AppDefinition, prompt: string, tools: ToolDefinition[]): ToolDefinition | undefined;
  generateResponseText(app: AppDefinition, prompt: string, toolName?: string): string;
};

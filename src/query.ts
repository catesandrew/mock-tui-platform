import type { AppDefinition, MockNotification, QueryEvent, ToolDefinition } from "./types";
import { createId } from "./utils/id";
import { sleep } from "./utils/time";

function chooseTool(prompt: string, tools: ToolDefinition[]): ToolDefinition | undefined {
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

function chunk(text: string): string[] {
  const words = text.split(" ");
  const chunks: string[] = [];
  for (let index = 0; index < words.length; index += 6) {
    chunks.push(words.slice(index, index + 6).join(" ") + " ");
  }
  return chunks;
}

export async function* query(params: {
  app: AppDefinition;
  prompt: string;
  tools: ToolDefinition[];
  notificationFactory: () => MockNotification | undefined;
}): AsyncGenerator<QueryEvent> {
  const { app, prompt, tools, notificationFactory } = params;

  yield { type: "status", status: `Planning response inside ${app.title}...` };
  await sleep(120);

  const selectedTool = chooseTool(prompt, tools);
  if (selectedTool) {
    yield {
      type: "tool-call",
      toolName: selectedTool.name,
      detail: `Mock tool call triggered by prompt keywords in ${app.id}.`,
    };
    const result = await selectedTool.run(prompt, app);
    yield {
      type: "tool-result",
      toolName: selectedTool.name,
      result: result.result,
    };
  }

  const messageId = createId("assistant");
  yield {
    type: "assistant-start",
    messageId,
    title: `${app.title} response`,
  };

  for (const part of chunk(buildMockResponse(app, prompt, selectedTool?.name))) {
    await sleep(45);
    yield {
      type: "assistant-chunk",
      messageId,
      chunk: part,
    };
  }

  const notification = notificationFactory();
  if (notification) {
    yield { type: "notification", notification };
  }

  yield { type: "status", status: `${app.title} is idle. Mock runtime ready.` };
  yield { type: "done" };
}

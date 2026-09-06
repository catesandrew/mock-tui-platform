import type { AppDefinition, MockNotification, QueryEvent, ToolDefinition } from "./types";
import type { ResponseAdapter } from "./adapters/types";
import { createId } from "./utils/id";
import { sleep } from "./utils/time";

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
  adapter: ResponseAdapter;
}): AsyncGenerator<QueryEvent> {
  const { app, prompt, tools, notificationFactory, adapter } = params;

  yield { type: "status", status: `Planning response inside ${app.title}...` };
  await sleep(120);

  let selectedTool: ToolDefinition | undefined;
  let responseText: string;
  try {
    selectedTool = adapter.selectTool(app, prompt, tools);
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
    responseText = adapter.generateResponseText(app, prompt, selectedTool?.name);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    yield { type: "status", status: `Error: ${message}` };
    yield { type: "done" };
    return;
  }

  const messageId = createId("assistant");
  yield {
    type: "assistant-start",
    messageId,
    title: `${app.title} response`,
  };

  for (const part of chunk(responseText)) {
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

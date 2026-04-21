import type { AppDefinition, MockNotification, QueryEvent, ToolDefinition, TranscriptMessage } from "./types";
import { query } from "./query";

export class QueryEngine {
  constructor(
    private readonly app: AppDefinition,
    private readonly tools: ToolDefinition[],
    private readonly notificationFactory: () => MockNotification | undefined,
  ) {}

  async *submitPrompt(prompt: string, _messages: TranscriptMessage[]): AsyncGenerator<QueryEvent> {
    yield* query({
      app: this.app,
      prompt,
      tools: this.tools,
      notificationFactory: this.notificationFactory,
    });
  }
}

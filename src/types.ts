export type AccentColor =
  | "cyan"
  | "green"
  | "magenta"
  | "yellow"
  | "blue"
  | "red"
  | "white";

export type MessageRole = "system" | "user" | "assistant" | "tool";
export type MessageKind = "text" | "status" | "tool-call" | "tool-result";

export type TranscriptMessage = {
  id: string;
  role: MessageRole;
  kind: MessageKind;
  title?: string;
  content: string;
  timestamp: string;
};

export type MockTask = {
  id: string;
  subject: string;
  description: string;
  status: "pending" | "active" | "completed";
};

export type MockNotification = {
  id: string;
  title: string;
  body: string;
  tone: "info" | "success" | "warning";
};

export type MockMailboxItem = {
  id: string;
  content: string;
};

export type ToolResult = {
  summary: string;
  result: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  keywords: string[];
  run: (prompt: string, app: AppDefinition) => Promise<ToolResult>;
};

export type CommandContext = {
  app: AppDefinition;
  args: string[];
};

export type CommandExecution =
  | {
      kind: "message";
      messages: TranscriptMessage[];
    }
  | {
      kind: "panel";
      panel: AppPanel;
    }
  | {
      kind: "search";
      term: string;
    }
  | {
      kind: "clear-search";
    }
  | {
      kind: "switch-app";
      appId: string;
    }
  | {
      kind: "noop";
    };

export type CommandDefinition = {
  name: string;
  description: string;
  aliases?: string[];
  execute: (context: CommandContext) => Promise<CommandExecution> | CommandExecution;
};

export type AppDefinition = {
  id: string;
  title: string;
  subtitle: string;
  accent: AccentColor;
  welcome: string;
  quickCommands: string[];
  starterMessages: Array<Pick<TranscriptMessage, "role" | "kind" | "title" | "content">>;
  tasks: Array<Pick<MockTask, "subject" | "description">>;
  mailboxPrompts: string[];
  notifications: Array<Pick<MockNotification, "title" | "body" | "tone">>;
  tools: Array<Pick<ToolDefinition, "name" | "description" | "keywords">>;
};

export type FocusMode = "input" | "transcript";
export type AppPanel = "none" | "help" | "tasks" | "apps";

export type AppState = {
  selectedAppId: string;
  messages: TranscriptMessage[];
  tasks: MockTask[];
  notifications: MockNotification[];
  mailboxQueue: MockMailboxItem[];
  statusLine: string;
  focusMode: FocusMode;
  panel: AppPanel;
  searchTerm: string;
  transcriptOffset: number;
  isLoading: boolean;
};

export type QueryEvent =
  | { type: "status"; status: string }
  | { type: "tool-call"; toolName: string; detail: string }
  | { type: "tool-result"; toolName: string; result: string }
  | { type: "assistant-start"; messageId: string; title: string }
  | { type: "assistant-chunk"; messageId: string; chunk: string }
  | { type: "notification"; notification: MockNotification }
  | { type: "done" };

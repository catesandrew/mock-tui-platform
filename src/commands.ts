import { APP_DEFINITIONS, getAppDefinition } from "./apps/catalog";
import type { AppDefinition, CommandContext, CommandDefinition, CommandExecution } from "./types";
import { makeMessage } from "./utils/messages";

const HELP_MESSAGE = [
  "/help",
  "/apps",
  "/variant <id>",
  "/tasks",
  "/search <term>",
  "/clear-search",
  "/clear",
  "/mailbox",
  "/notify",
  "/status",
].join("\n");

function parseVariant(args: string[]): string | undefined {
  return args[0];
}

function buildBaseCommands(app: AppDefinition): CommandDefinition[] {
  return [
    {
      name: "help",
      description: "Show core shell commands",
      execute: () => ({
        kind: "message",
        messages: [makeMessage("system", "text", HELP_MESSAGE, "Command reference")],
      }),
    },
    {
      name: "apps",
      description: "Open the app-switcher panel",
      execute: () => ({ kind: "panel", panel: "apps" }),
    },
    {
      name: "variant",
      description: "Switch to another mock application variant",
      execute: ({ args }: CommandContext) => {
        const appId = parseVariant(args);
        if (!appId) {
          return {
            kind: "message",
            messages: [
              makeMessage("system", "text", "Usage: /variant <app-id>", "Variant switch"),
            ],
          };
        }
        return { kind: "switch-app", appId };
      },
    },
    {
      name: "tasks",
      description: "Toggle the task panel",
      execute: () => ({ kind: "panel", panel: "tasks" }),
    },
    {
      name: "search",
      description: "Highlight transcript matches",
      execute: ({ args }: CommandContext) => ({
        kind: "search",
        term: args.join(" "),
      }),
    },
    {
      name: "clear-search",
      description: "Clear transcript search state",
      execute: () => ({ kind: "clear-search" }),
    },
    {
      name: "clear",
      description: "Clear the transcript and reload the variant welcome messages",
      execute: () => ({
        kind: "message",
        messages: [makeMessage("system", "status", `Clearing transcript for ${app.title}.`, "Transcript reset")],
      }),
    },
    {
      name: "mailbox",
      description: "Queue a mock mailbox prompt into the runtime loop",
      execute: () => ({
        kind: "message",
        messages: [
          makeMessage(
            "system",
            "status",
            `Queued mailbox prompt for ${app.title}. It will be injected when the runtime is idle.`,
            "Mailbox",
          ),
        ],
      }),
    },
    {
      name: "notify",
      description: "Emit a mock notification",
      execute: () => ({
        kind: "message",
        messages: [
          makeMessage(
            "system",
            "status",
            `Queued a mock notification for ${app.title}.`,
            "Notification",
          ),
        ],
      }),
    },
    {
      name: "status",
      description: "Explain the current shell state",
      execute: () => ({
        kind: "message",
        messages: [
          makeMessage(
            "system",
            "text",
            `${app.title} is running on the shared mock architecture shell. Commands and tools are mock-backed, but the REPL, store, registries, and transcript flow are real.`,
            "Shell status",
          ),
        ],
      }),
    },
  ];
}

export function getCommands(app: AppDefinition): CommandDefinition[] {
  return buildBaseCommands(app);
}

export function findCommand(input: string, commands: CommandDefinition[]): {
  command: CommandDefinition | undefined;
  args: string[];
} {
  const parts = input.trim().replace(/^\//, "").split(/\s+/).filter(Boolean);
  const [name = "", ...args] = parts;
  const command = commands.find(
    item => item.name === name || item.aliases?.includes(name),
  );
  return { command, args };
}

export function listAppIds(): string[] {
  return APP_DEFINITIONS.map(app => app.id);
}

export function isKnownAppId(appId: string): boolean {
  return APP_DEFINITIONS.some(app => app.id === appId);
}

export function switchVariantMessage(appId: string): CommandExecution {
  const app = getAppDefinition(appId);
  return {
    kind: "message",
    messages: [makeMessage("system", "status", `Switched shell to ${app.title}.`, "Variant switched")],
  };
}

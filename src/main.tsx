import { Command } from "commander";
import { APP_DEFINITIONS, getAppDefinition } from "./apps/catalog";
import { createRoot } from "./ink";
import { getDefaultAppState } from "./state/AppStateStore";
import { getRenderContext, renderAndRun, showSetupScreens, exitWithMessage } from "./interactiveHelpers";
import { launchRepl } from "./replLauncher";
import { getTools } from "./tools";
import { QueryEngine } from "./QueryEngine";
import { createMockNotification } from "./mocks/runtime";
import { makeMessage } from "./utils/messages";
import { handlePromptSubmit } from "./utils/handlePromptSubmit";

export function startDeferredPrefetches(): void {
  setTimeout(() => {
    void APP_DEFINITIONS.length;
  }, 0);
}

function initializeEntrypoint(isNonInteractive: boolean): void {
  process.env.MOCK_TUI_ENTRYPOINT = isNonInteractive ? "headless" : "interactive";
}

async function runPrintMode(appId: string, prompt: string): Promise<void> {
  const app = getAppDefinition(appId);
  const tools = getTools(app);
  const queryEngine = new QueryEngine(app, tools, () => createMockNotification(app));
  const transcript = [
    ...getDefaultAppState(app.id).messages,
    makeMessage("user", "text", prompt, "Prompt"),
  ];

  for await (const event of queryEngine.submitPrompt(prompt, transcript)) {
    if (event.type === "assistant-chunk") {
      process.stdout.write(event.chunk);
    }
    if (event.type === "tool-call") {
      process.stdout.write(`\n[tool:${event.toolName}] ${event.detail}\n`);
    }
    if (event.type === "tool-result") {
      process.stdout.write(`[tool-result:${event.toolName}] ${event.result}\n`);
    }
  }

  process.stdout.write("\n");
}

export async function main(): Promise<void> {
  const program = new Command();
  program
    .name("mock-tui-platform")
    .argument("[prompt]", "Optional prompt for headless mode")
    .option("--app <id>", "Select an app variant")
    .option("-p, --print", "Run a headless prompt against the mock query engine")
    .option("--list-apps", "Print available application ids");

  await program.parseAsync(process.argv);
  const options = program.opts<{ app?: string; print?: boolean; listApps?: boolean }>();
  const prompt = program.args[0];

  if (options.listApps) {
    for (const app of APP_DEFINITIONS) {
      process.stdout.write(`${app.id}\n`);
    }
    return;
  }

  const requestedAppId = options.app ?? APP_DEFINITIONS[0]!.id;
  const app = getAppDefinition(requestedAppId);

  if (options.print) {
    initializeEntrypoint(true);
    const submission = handlePromptSubmit(prompt ?? `Give me a quick status brief for ${app.title}.`);
    if (!submission || submission.kind !== "query") {
      throw await exitWithMessage("Headless mode requires a non-command prompt.");
    }
    await runPrintMode(app.id, submission.input);
    return;
  }

  initializeEntrypoint(false);
  const root = await createRoot(getRenderContext().renderOptions);
  const selectedAppId = await showSetupScreens(root, APP_DEFINITIONS, options.app);
  startDeferredPrefetches();
  await launchRepl(root, { initialState: getDefaultAppState(selectedAppId) }, renderAndRun);
}

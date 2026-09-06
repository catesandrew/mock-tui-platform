# Response Adapter Seam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use beads-superpowers:subagent-driven-development (recommended) or beads-superpowers:executing-plans to implement this plan task-by-task. Each Task becomes a bead (`bd create -t task --parent <epic-id>`). Steps within tasks use checkbox (`- [ ]`) syntax for human readability.

**Goal:** Introduce a pluggable `ResponseAdapter` interface behind `query.ts` (mock default +
fixture-replay second adapter), selectable via a `--adapter` CLI flag, with zero behavior change
to the existing mock path.

**Architecture:** `query()` keeps 100% of its event choreography (status/tool-call/tool-result/
assistant-start/assistant-chunk/notification/done, including timing) and delegates only content
decisions — which tool fires, what the final assistant text says — to a `ResponseAdapter`. Two
adapters ship: `mockAdapter` (today's inline logic, moved verbatim) and a fixture-replay adapter
covering 3 apps, both selected via `getAdapter(id)`.

**Tech Stack:** Bun, TypeScript (no new dependencies; fixture data loads via static JSON `import`).

## Global Constraints

- No new npm/bun dependencies — only existing deps (`commander`, `ink`, `react`). Fixture data is
  loaded via static `import` of the JSON files, not `node:fs`/`node:url` — required so bundling
  into `dist/cli.js` doesn't break fixture path resolution (see Task 2).
- `QueryEvent`'s type union (`src/types.ts`) does not change shape — errors surface via the
  existing `{ type: "status", status: string }` variant, never a new event type.
- `tests/query.test.ts` must pass with **zero edits** — this is the explicit acceptance bar for
  mock-adapter behavior preservation (spec: `.internal/specs/2026-09-05-response-adapter-seam-design.md`).
- Fixture coverage is exactly 3 apps: `coding-agent`, `planning-studio`, `incident-console`. Do not
  add fixtures for other apps in this plan — that's an explicit, documented non-goal.
- `bun run typecheck`, `bun test`, `bun run test:e2e`, and `bun run build` must all pass after
  every task.

---

### Task 1: ResponseAdapter interface, mockAdapter, and query.ts refactor

**Files:**
- Create: `src/adapters/types.ts`
- Create: `src/adapters/mockAdapter.ts`
- Create: `tests/adapters.test.ts`
- Modify: `src/query.ts` (entire file — remove `chooseTool`/`buildMockResponse`, accept adapter,
  add error handling)
- Modify: `src/QueryEngine.ts:1-19` (add 4th constructor param defaulting to `mockAdapter`)

**Interfaces:**
- Produces: `ResponseAdapter` type (`{ id: string; selectTool(app, prompt, tools):
  ToolDefinition | undefined; generateResponseText(app, prompt, toolName?): string }`) from
  `src/adapters/types.ts`.
- Produces: `mockAdapter: ResponseAdapter` (`id: "mock"`) from `src/adapters/mockAdapter.ts`.
- Produces: `query(params: { app, prompt, tools, notificationFactory, adapter })` — `adapter` is a
  new required field on the params object.
- Produces: `new QueryEngine(app, tools, notificationFactory, adapter = mockAdapter)` — 4th
  constructor param, optional, defaults to `mockAdapter`.

**Acceptance Criteria:**
- `tests/query.test.ts` passes with zero edits to that file.
- `tests/adapters.test.ts` (new) passes, covering `mockAdapter.selectTool` and
  `mockAdapter.generateResponseText` directly.
- `bun run typecheck`, `bun test`, `bun run build` all pass.

- [ ] **Step 1: Write the failing test for mockAdapter**

Create `tests/adapters.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { getAppDefinition } from "../src/apps/catalog";
import { getTools } from "../src/tools";
import { mockAdapter } from "../src/adapters/mockAdapter";

describe("mock adapter", () => {
  test("selects a tool whose keywords match the prompt", () => {
    const app = getAppDefinition("coding-agent");
    const tools = getTools(app);
    const tool = mockAdapter.selectTool(app, "show me the codebase modules", tools);
    expect(tool?.name).toBe("workspace-map");
  });

  test("returns undefined when no tool keywords match", () => {
    const app = getAppDefinition("coding-agent");
    const tools = getTools(app);
    const tool = mockAdapter.selectTool(app, "hello there", tools);
    expect(tool).toBeUndefined();
  });

  test("generates response text referencing the app and selected tool", () => {
    const app = getAppDefinition("coding-agent");
    const text = mockAdapter.generateResponseText(app, "map the codebase", "workspace-map");
    expect(text).toContain("Coding Agent received the prompt");
    expect(text).toContain("workspace-map");
  });

  test("generates response text without a tool clause when no tool is selected", () => {
    const app = getAppDefinition("coding-agent");
    const text = mockAdapter.generateResponseText(app, "hello there");
    expect(text).toContain("No specialized tool was required");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/adapters.test.ts`
Expected: FAIL — `Cannot find module '../src/adapters/mockAdapter'` (module doesn't exist yet).

- [ ] **Step 3: Create the ResponseAdapter interface**

Create `src/adapters/types.ts`:

```ts
import type { AppDefinition, ToolDefinition } from "../types";

export type ResponseAdapter = {
  id: string;
  selectTool(app: AppDefinition, prompt: string, tools: ToolDefinition[]): ToolDefinition | undefined;
  generateResponseText(app: AppDefinition, prompt: string, toolName?: string): string;
};
```

- [ ] **Step 4: Create mockAdapter by moving today's query.ts logic verbatim**

Create `src/adapters/mockAdapter.ts`:

```ts
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
```

- [ ] **Step 5: Run test to verify mockAdapter tests pass**

Run: `bun test tests/adapters.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Refactor query.ts to consume the adapter and catch adapter errors**

Replace the full contents of `src/query.ts`:

```ts
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
```

- [ ] **Step 7: Update QueryEngine to pass the adapter through, defaulting to mockAdapter**

Replace the full contents of `src/QueryEngine.ts`:

```ts
import type { AppDefinition, MockNotification, QueryEvent, ToolDefinition, TranscriptMessage } from "./types";
import type { ResponseAdapter } from "./adapters/types";
import { mockAdapter } from "./adapters/mockAdapter";
import { query } from "./query";

export class QueryEngine {
  constructor(
    private readonly app: AppDefinition,
    private readonly tools: ToolDefinition[],
    private readonly notificationFactory: () => MockNotification | undefined,
    private readonly adapter: ResponseAdapter = mockAdapter,
  ) {}

  async *submitPrompt(prompt: string, _messages: TranscriptMessage[]): AsyncGenerator<QueryEvent> {
    yield* query({
      app: this.app,
      prompt,
      tools: this.tools,
      notificationFactory: this.notificationFactory,
      adapter: this.adapter,
    });
  }
}
```

- [ ] **Step 8: Run the full check suite to verify behavior preservation**

Run: `bun run typecheck && bun test && bun run build`
Expected: all pass, including `tests/query.test.ts` (unmodified) and the new `tests/adapters.test.ts`.

- [ ] **Step 9: Commit**

```bash
git add src/adapters/types.ts src/adapters/mockAdapter.ts src/query.ts src/QueryEngine.ts tests/adapters.test.ts
git commit -m "refactor: extract ResponseAdapter seam, move mock logic to mockAdapter"
```

---

### Task 2: Fixture files, fixtureAdapter, and registry

**Files:**
- Create: `src/mocks/fixtures/coding-agent.json`
- Create: `src/mocks/fixtures/planning-studio.json`
- Create: `src/mocks/fixtures/incident-console.json`
- Create: `src/adapters/fixtureAdapter.ts`
- Create: `src/adapters/registry.ts`
- Modify: `tests/adapters.test.ts` (append fixture + registry tests)

**Interfaces:**
- Consumes: `ResponseAdapter` type from `src/adapters/types.ts` (Task 1). `query()`'s adapter-error
  try/catch from `src/query.ts` (Task 1) — exercised by this task's runtime-error test.
- Produces: `createFixtureAdapter(): ResponseAdapter` from `src/adapters/fixtureAdapter.ts`.
- Produces: `getAdapter(id: string): ResponseAdapter` and
  `assertAdapterSupportsApp(adapterId: string, appId: string): void` from
  `src/adapters/registry.ts`, used by Task 3's CLI wiring.

**Acceptance Criteria:**
- `getAdapter("mock")` returns `mockAdapter`; `getAdapter("fixture")` returns a working adapter
  backed by the 3 fixture files; `getAdapter("bogus")` throws
  `Unknown adapter "bogus". Valid adapters: mock, fixture.`.
- `assertAdapterSupportsApp("fixture", "sales-copilot")` throws naming the 3 supported apps;
  `assertAdapterSupportsApp("fixture", "coding-agent")` and `assertAdapterSupportsApp("mock", "sales-copilot")`
  do not throw.
- `query()` driven with the fixture adapter against an unsupported app yields
  `{ type: "status", status: "Error: ..." }` followed by `{ type: "done" }`, never throws out of
  the generator.
- All existing tests (`tests/query.test.ts`, Task 1's `tests/adapters.test.ts` cases) still pass
  unmodified.

- [ ] **Step 1: Write the fixture data files**

Create `src/mocks/fixtures/coding-agent.json`:

```json
[
  {
    "match": ["codebase", "files", "modules"],
    "toolName": "workspace-map",
    "response": "Coding Agent replayed a fixture: the workspace-map fixture describes three active modules and flags one module needing a refactor pass."
  },
  {
    "match": ["default"],
    "response": "Coding Agent replayed the default fixture: no specific tool fixture matched, so this is the canned fallback response for the software delivery workspace."
  }
]
```

Create `src/mocks/fixtures/planning-studio.json`:

```json
[
  {
    "match": ["roadmap", "initiative", "sequence"],
    "toolName": "roadmap-weave",
    "response": "Planning Studio replayed a fixture: the roadmap-weave fixture sequences three initiatives across the next two quarters."
  },
  {
    "match": ["default"],
    "response": "Planning Studio replayed the default fixture: no specific tool fixture matched, so this is the canned fallback response for the product planning workspace."
  }
]
```

Create `src/mocks/fixtures/incident-console.json`:

```json
[
  {
    "match": ["impact", "services", "blast"],
    "toolName": "blast-radius",
    "response": "Incident Console replayed a fixture: the blast-radius fixture estimates two downstream services are affected."
  },
  {
    "match": ["default"],
    "response": "Incident Console replayed the default fixture: no specific tool fixture matched, so this is the canned fallback response for the incident response workspace."
  }
]
```

- [ ] **Step 2: Write failing tests for fixtureAdapter and registry**

Append to `tests/adapters.test.ts`:

```ts
import { getAdapter, assertAdapterSupportsApp } from "../src/adapters/registry";
import { query } from "../src/query";
import { createMockNotification } from "../src/mocks/runtime";

describe("fixture adapter", () => {
  test("selects the fixture tool for a matching prompt", () => {
    const app = getAppDefinition("planning-studio");
    const tools = getTools(app);
    const adapter = getAdapter("fixture");
    const tool = adapter.selectTool(app, "sequence the next roadmap initiative", tools);
    expect(tool?.name).toBe("roadmap-weave");
  });

  test("returns the default fixture response for a non-matching prompt", () => {
    const app = getAppDefinition("planning-studio");
    const adapter = getAdapter("fixture");
    const text = adapter.generateResponseText(app, "what's the weather like");
    expect(text).toContain("replayed the default fixture");
  });

  test("returns the matched fixture response for all 3 supported apps", () => {
    const adapter = getAdapter("fixture");
    expect(adapter.generateResponseText(getAppDefinition("coding-agent"), "show me the codebase modules")).toContain(
      "workspace-map fixture",
    );
    expect(adapter.generateResponseText(getAppDefinition("incident-console"), "what's the blast radius")).toContain(
      "blast-radius fixture",
    );
  });
});

describe("adapter registry", () => {
  test("returns mockAdapter for id 'mock'", () => {
    expect(getAdapter("mock").id).toBe("mock");
  });

  test("returns a fixture adapter for id 'fixture'", () => {
    expect(getAdapter("fixture").id).toBe("fixture");
  });

  test("throws for an unknown adapter id", () => {
    expect(() => getAdapter("bogus")).toThrow('Unknown adapter "bogus". Valid adapters: mock, fixture.');
  });

  test("assertAdapterSupportsApp throws for fixture + unsupported app", () => {
    expect(() => assertAdapterSupportsApp("fixture", "sales-copilot")).toThrow(
      'Adapter "fixture" has no fixtures for app "sales-copilot"',
    );
  });

  test("assertAdapterSupportsApp does not throw for fixture + supported app", () => {
    expect(() => assertAdapterSupportsApp("fixture", "coding-agent")).not.toThrow();
  });

  test("assertAdapterSupportsApp does not throw for mock + any app", () => {
    expect(() => assertAdapterSupportsApp("mock", "sales-copilot")).not.toThrow();
  });
});

describe("query with fixture adapter", () => {
  test("surfaces an unsupported-app adapter error as a status event, not a throw", async () => {
    const app = getAppDefinition("sales-copilot");
    const tools = getTools(app);
    const adapter = getAdapter("fixture");
    const events = [];

    for await (const event of query({
      app,
      prompt: "anything",
      tools,
      notificationFactory: () => createMockNotification(app),
      adapter,
    })) {
      events.push(event);
    }

    const statusEvents = events.filter(event => event.type === "status");
    expect(statusEvents.some(event => event.status.startsWith("Error:"))).toBe(true);
    expect(events.at(-1)?.type).toBe("done");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test tests/adapters.test.ts`
Expected: FAIL — `Cannot find module '../src/adapters/fixtureAdapter'` / `'../src/adapters/registry'`.

- [ ] **Step 4: Implement fixtureAdapter using static JSON imports**

Static imports (not `fs.readFileSync`) are required here: `bun build` bundles `src/cli.ts` into a
single `dist/cli.js`, and a path built relative to `import.meta.url` at runtime would resolve
against the bundle's own location, not the original source file's — breaking fixture lookup once
built. Static imports are resolved and inlined by Bun's bundler at build time instead, so this
works identically from `src/cli.ts` (dev) and the built `dist/cli.js`.

Create `src/adapters/fixtureAdapter.ts`:

```ts
import type { ResponseAdapter } from "./types";
import codingAgentFixtures from "../mocks/fixtures/coding-agent.json";
import planningStudioFixtures from "../mocks/fixtures/planning-studio.json";
import incidentConsoleFixtures from "../mocks/fixtures/incident-console.json";

export const SUPPORTED_FIXTURE_APP_IDS = ["coding-agent", "planning-studio", "incident-console"] as const;
export type SupportedFixtureAppId = (typeof SUPPORTED_FIXTURE_APP_IDS)[number];

export function isSupportedFixtureAppId(appId: string): appId is SupportedFixtureAppId {
  return (SUPPORTED_FIXTURE_APP_IDS as readonly string[]).includes(appId);
}

export function assertSupportedFixtureAppId(appId: string): asserts appId is SupportedFixtureAppId {
  if (!isSupportedFixtureAppId(appId)) {
    throw new Error(
      `Adapter "fixture" has no fixtures for app "${appId}". Supported apps: ${SUPPORTED_FIXTURE_APP_IDS.join(", ")}. Use --adapter mock instead.`,
    );
  }
}

type FixtureEntry = {
  match: string[];
  toolName?: string;
  response: string;
};

const FIXTURES_BY_APP: Record<SupportedFixtureAppId, FixtureEntry[]> = {
  "coding-agent": codingAgentFixtures,
  "planning-studio": planningStudioFixtures,
  "incident-console": incidentConsoleFixtures,
};

for (const [appId, entries] of Object.entries(FIXTURES_BY_APP)) {
  const hasDefault = entries.some(entry => entry.match.includes("default"));
  if (!hasDefault) {
    throw new Error(`Fixture file for "${appId}" is missing a required "default" entry.`);
  }
}

function matchEntry(entries: FixtureEntry[], prompt: string): FixtureEntry {
  const lowered = prompt.toLowerCase();
  const hit = entries.find(
    entry => !entry.match.includes("default") && entry.match.some(keyword => lowered.includes(keyword)),
  );
  return hit ?? entries.find(entry => entry.match.includes("default"))!;
}

export function createFixtureAdapter(): ResponseAdapter {
  return {
    id: "fixture",
    selectTool(app, prompt, tools) {
      assertSupportedFixtureAppId(app.id);
      const entry = matchEntry(FIXTURES_BY_APP[app.id], prompt);
      if (!entry.toolName) {
        return undefined;
      }
      return tools.find(tool => tool.name === entry.toolName);
    },
    generateResponseText(app, prompt) {
      assertSupportedFixtureAppId(app.id);
      return matchEntry(FIXTURES_BY_APP[app.id], prompt).response;
    },
  };
}
```

- [ ] **Step 5: Implement the registry**

Create `src/adapters/registry.ts`:

```ts
import type { ResponseAdapter } from "./types";
import { mockAdapter } from "./mockAdapter";
import { createFixtureAdapter, assertSupportedFixtureAppId } from "./fixtureAdapter";

const KNOWN_ADAPTER_IDS = ["mock", "fixture"] as const;

export function getAdapter(id: string): ResponseAdapter {
  if (id === "mock") {
    return mockAdapter;
  }
  if (id === "fixture") {
    return createFixtureAdapter();
  }
  throw new Error(`Unknown adapter "${id}". Valid adapters: ${KNOWN_ADAPTER_IDS.join(", ")}.`);
}

export function assertAdapterSupportsApp(adapterId: string, appId: string): void {
  if (adapterId !== "fixture") {
    return;
  }
  assertSupportedFixtureAppId(appId);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun run typecheck && bun test`
Expected: all pass, including every new case in `tests/adapters.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/mocks/fixtures src/adapters/fixtureAdapter.ts src/adapters/registry.ts tests/adapters.test.ts
git commit -m "feat: add fixture-replay adapter and adapter registry"
```

---

### Task 3: CLI and REPL wiring

**Files:**
- Modify: `src/main.tsx` (entire file)
- Modify: `src/screens/REPL.tsx:1-46` (imports + `queryEngine` useMemo)
- Modify: `tests/e2e-smoke.test.ts` (append a new test)

**Interfaces:**
- Consumes: `getAdapter`, `assertAdapterSupportsApp` from `src/adapters/registry.ts` (Task 2).
  `ResponseAdapter` type from `src/adapters/types.ts` (Task 1). `QueryEngine`'s 4th constructor
  param (Task 1).
- Produces: `--adapter <id>` CLI option (default `"mock"`) and `MOCK_TUI_ADAPTER` env var, both
  consumed only within this task.

**Acceptance Criteria:**
- `bun run dist/cli.js --app coding-agent --print "..."` behaves identically to before (default
  `mock` adapter).
- `bun run dist/cli.js --adapter fixture --app coding-agent --print "show me the codebase modules"`
  prints the fixture response text.
- `bun run dist/cli.js --adapter bogus --app coding-agent --print "hi"` exits non-zero with
  `Unknown adapter "bogus". Valid adapters: mock, fixture.` on stderr.
- `bun run dist/cli.js --adapter fixture --app sales-copilot --print "hi"` exits non-zero with the
  unsupported-app message, before any query engine runs.
- Interactive mode: an adapter error (e.g. `/variant`-switching to an unsupported app under
  `--adapter fixture`) appears as a durable transcript message, not just a footer flash overwritten
  by the next status update (Step 4b).

- [ ] **Step 1: Write the failing e2e test**

Append to `tests/e2e-smoke.test.ts`:

```ts
test("runs a headless print flow through the fixture adapter", () => {
  const output = run([
    "run",
    "dist/cli.js",
    "--adapter",
    "fixture",
    "--app",
    "coding-agent",
    "--print",
    "show me the codebase modules",
  ]);

  expect(output).toContain("workspace-map fixture");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run build && bun test tests/e2e-smoke.test.ts`
Expected: FAIL — `error: unknown option '--adapter'` (commander rejects the unrecognized flag).

- [ ] **Step 3: Wire the CLI flag, early validation, and threading in main.tsx**

Replace the full contents of `src/main.tsx`:

```tsx
import { Command } from "commander";
import { APP_DEFINITIONS, getAppDefinition } from "./apps/catalog";
import { createRoot } from "./ink";
import { getDefaultAppState } from "./state/AppStateStore";
import { getRenderContext, renderAndRun, showSetupScreens, exitWithMessage } from "./interactiveHelpers";
import { launchRepl } from "./replLauncher";
import { getTools } from "./tools";
import { QueryEngine } from "./QueryEngine";
import { getAdapter, assertAdapterSupportsApp } from "./adapters/registry";
import type { ResponseAdapter } from "./adapters/types";
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

async function runPrintMode(appId: string, prompt: string, adapter: ResponseAdapter): Promise<void> {
  const app = getAppDefinition(appId);
  const tools = getTools(app);
  const queryEngine = new QueryEngine(app, tools, () => createMockNotification(app), adapter);
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
    if (event.type === "status" && event.status.startsWith("Error:")) {
      process.stdout.write(`\n${event.status}\n`);
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
    .option("--list-apps", "Print available application ids")
    .option("--adapter <id>", "Response adapter to use (mock or fixture)", "mock");

  await program.parseAsync(process.argv);
  const options = program.opts<{ app?: string; print?: boolean; listApps?: boolean; adapter: string }>();
  const prompt = program.args[0];

  if (options.listApps) {
    for (const app of APP_DEFINITIONS) {
      process.stdout.write(`${app.id}\n`);
    }
    return;
  }

  const requestedAppId = options.app ?? APP_DEFINITIONS[0]!.id;
  const app = getAppDefinition(requestedAppId);

  let adapter: ResponseAdapter;
  try {
    adapter = getAdapter(options.adapter);
    assertAdapterSupportsApp(options.adapter, app.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw await exitWithMessage(message);
  }

  if (options.print) {
    initializeEntrypoint(true);
    const submission = handlePromptSubmit(prompt ?? `Give me a quick status brief for ${app.title}.`);
    if (!submission || submission.kind !== "query") {
      throw await exitWithMessage("Headless mode requires a non-command prompt.");
    }
    await runPrintMode(app.id, submission.input, adapter);
    return;
  }

  initializeEntrypoint(false);
  process.env.MOCK_TUI_ADAPTER = options.adapter;
  const root = await createRoot(getRenderContext().renderOptions);
  const selectedAppId = await showSetupScreens(root, APP_DEFINITIONS, options.app);
  startDeferredPrefetches();
  await launchRepl(root, { initialState: getDefaultAppState(selectedAppId) }, renderAndRun);
}
```

- [ ] **Step 4: Wire REPL.tsx to read the adapter from the env var**

In `src/screens/REPL.tsx`, add to the imports (after the existing `getTools` import on line 10):

```ts
import { getAdapter } from "../adapters/registry";
```

Replace the `queryEngine` useMemo (lines 43-46):

```ts
  const queryEngine = useMemo(
    () => new QueryEngine(app, tools, () => createMockNotification(app), getAdapter(process.env.MOCK_TUI_ADAPTER ?? "mock")),
    [app, tools],
  );
```

- [ ] **Step 4b: Make error status events survive the post-loop status reset**

**Discovered during Task 1's review, not in the original plan text:** `applyQueryEvent`'s
`status` branch only updates `statusLine` (the footer). The `for await` loop's caller
unconditionally resets `statusLine` to `` `${app.title} is idle. Ready for the next prompt.` ``
immediately after the loop ends (`src/screens/REPL.tsx` around line 108) — which runs right after
`query()`'s error path yields its `status` event and then `done`. Today, an adapter error is
invisible in interactive mode: the footer briefly holds the error text for zero renders, then gets
overwritten, and nothing is added to the transcript. Fix: error status events also append a
transcript message, which the trailing idle-status reset cannot clobber.

In `src/screens/REPL.tsx`, replace the `status` branch inside `applyQueryEvent` (currently):

```ts
    if (event.type === "status") {
      setAppState(prev => ({ ...prev, statusLine: event.status }));
      return;
    }
```

with:

```ts
    if (event.type === "status") {
      const isError = event.status.startsWith("Error:");
      setAppState(prev => ({
        ...prev,
        statusLine: event.status,
        messages: isError
          ? [...prev.messages, makeMessage("system", "status", event.status, "Adapter error")]
          : prev.messages,
      }));
      return;
    }
```

There is no existing test coverage for `REPL.tsx`'s internal event handling (no unit tests exist
for this component today), so verify this manually in Step 6 rather than adding a new test
pattern the rest of the file doesn't use: run interactively with `--adapter fixture`, switch to an
unsupported app via `/variant sales-copilot`, submit a prompt, and confirm the error appears as a
transcript message (not just a footer flash).

- [ ] **Step 5: Run the full check suite**

Run: `bun run build && bun run typecheck && bun test`
Expected: all pass, including the new fixture e2e test.

- [ ] **Step 6: Manually verify the error paths**

Run: `bun run dist/cli.js --adapter bogus --app coding-agent --print "hi"; echo "exit=$?"`
Expected: stderr shows `Unknown adapter "bogus". Valid adapters: mock, fixture.`, `exit=1`.

Run: `bun run dist/cli.js --adapter fixture --app sales-copilot --print "hi"; echo "exit=$?"`
Expected: stderr shows the unsupported-app message naming the 3 supported apps, `exit=1`.

Manually verify Step 4b's fix: run `bun run src/cli.ts --adapter fixture --app coding-agent` (use
the `--adapter` flag, not the `MOCK_TUI_ADAPTER` env var alone — `main.tsx`'s interactive branch
unconditionally sets `process.env.MOCK_TUI_ADAPTER = options.adapter`, so an externally-set env
var without the matching flag is clobbered before `REPL.tsx` ever reads it), switch variants with
`/variant sales-copilot`, submit any prompt, and confirm the unsupported-app error appears as a
message in the transcript (not just a footer line that then disappears).

- [ ] **Step 7: Commit**

```bash
git add src/main.tsx src/screens/REPL.tsx tests/e2e-smoke.test.ts
git commit -m "feat: wire --adapter CLI flag through headless and interactive modes"
```

---

### Task 4: Onboarding docs update

**Files:**
- Modify: `docs/ONBOARDING.md` (Verification commands / Useful manual smoke commands sections)

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing consumed by other tasks.

**Acceptance Criteria:**
- `docs/ONBOARDING.md` documents the `--adapter` flag and the fixture-replay adapter's 3 supported
  apps. Do **not** document `MOCK_TUI_ADAPTER` as a user-facing setting — Task 3's review found
  it's write-only internal state (`main.tsx`'s interactive branch always overwrites it from
  `options.adapter`), not something a user can usefully set themselves.
- `tests/docs.test.ts` still passes unmodified (it only checks for pre-existing section headers,
  which remain unchanged).

- [ ] **Step 1: Add adapter documentation**

In `docs/ONBOARDING.md`, after the "Useful manual smoke commands" code block (after the line
`bun run dist/cli.js --app planning-studio --print "draft a launch plan for the next initiative"`),
add:

```markdown

Response content comes from a pluggable adapter (`--adapter mock` by default). Try the
fixture-replay adapter, which covers `coding-agent`, `planning-studio`, and `incident-console`:

```bash
bun run src/cli.ts --adapter fixture --app coding-agent --print "show me the codebase modules"
```

Selecting `--adapter fixture` with any other app exits with an error naming the supported apps.
```

- [ ] **Step 2: Verify docs test still passes**

Run: `bun test tests/docs.test.ts`
Expected: PASS (no changes needed to the test — it checks for existing headers only).

- [ ] **Step 3: Run the full check suite one final time**

Run: `bun run typecheck && bun test && bun run test:e2e && bun run build`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add docs/ONBOARDING.md
git commit -m "docs: document the --adapter flag and fixture-replay adapter"
```

---

## Stress Test Results: response-adapter-seam plan

### Resolved Decisions

- **Bundled `dist/cli.js` fixture path resolution (critical)**: the original plan used runtime
  `fs.readFileSync` + `fileURLToPath(new URL(..., import.meta.url))`, which resolves against the
  *bundle's* location after `bun build`, not the original source file's — the plan's own e2e test
  running `dist/cli.js --adapter fixture ...` would have failed with `ENOENT`. Verified the fix
  (static JSON `import`) with an isolated `bun build` test before locking it in: bundled output
  correctly inlines the JSON data and runs standalone.
- **Duplicated error-message logic**: `fixtureAdapter`'s per-call check and `registry.ts`'s
  CLI-startup check each independently constructed the same error string. Collapsed into one
  exported `assertSupportedFixtureAppId` in `fixtureAdapter.ts`, called by both.
- **Task dependency ordering**: linear 1→2→3→4 with Consumes/Produces sections already
  documenting the handoff; no explicit dependency table needed.
- **Test coverage**: cross-checked against the spec's Testing section — mock parity, fixture
  matching/default fallback, registry errors, runtime unsupported-app-via-query error path, CLI
  e2e for the fixture adapter, docs test — all present, no gap.
- **Security, scale**: static imports remove even the reduced filesystem-path surface from the
  design-level review; still N/A for both.
- **Alternative fixture format**: considered collapsing the 3 JSON files into one `fixtures.ts`
  module; kept the 3 separate JSON files (no complexity difference, matches the spec's
  plain-data framing).

### Changes Made

- `fixtureAdapter.ts` rewritten to use static `import` of the 3 fixture JSON files instead of
  `fs.readFileSync`/`fileURLToPath`. Default-entry validation moved to a module-level loop that
  runs once at import time (process startup) rather than inside a lazy loader function.
- `registry.ts` simplified: no more manual singleton caching (static imports mean
  `createFixtureAdapter()` is already cheap — no I/O to memoize), and `assertAdapterSupportsApp`
  now delegates to `fixtureAdapter.ts`'s single `assertSupportedFixtureAppId` instead of
  duplicating the throw.
- Global Constraints updated to drop the `node:fs`/`node:url` mention.

### Deferred / Parking Lot

- Same as the design's: real network-backed adapter, fixture coverage beyond the 3 named apps —
  both explicitly out of scope.

### Confidence Assessment

- Overall: High.
- Areas of concern: none outstanding. The one critical bug found (bundled-build fixture path
  resolution) was verified fixed with an isolated build test, not just reasoned about.

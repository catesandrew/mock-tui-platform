# Response Adapter Seam — Design

## Status

Approved (2026-09-05)

## Context

`mock-tui-platform` preserves a recovered Claude Code-style TUI architecture with mocked
integrations (ADR 0001). ADR 0002 keeps domain variation in `src/apps/catalog.ts` behind one
shared shell. ADR 0003 requires the prompt -> query engine -> transcript path to stay real and
smoke-tested even though content is mocked, so "future real integrations can replace mocks
behind the same query engine boundary."

Today `src/query.ts` hardcodes both tool selection (`chooseTool`) and response text generation
(`buildMockResponse`) inline in the `query()` generator. There is no seam: replacing mock content
means editing `query.ts` directly, which is exactly what ADR 0003 says future work should avoid.

This spec defines that seam: a `ResponseAdapter` interface, the existing mock behavior
re-expressed as the default adapter, and a second concrete adapter (fixture-replay) that proves
the seam is real and swappable — without introducing network calls, API keys, or nondeterminism
into the default path.

## Goals

- Introduce a `ResponseAdapter` interface that owns *content* (which tool fires, what text comes
  back) while `query()` keeps owning *event choreography* (status/tool-call/tool-result/
  assistant-start/assistant-chunk/notification/done, including timing/chunking).
- Re-implement current behavior as `mockAdapter` with zero behavior change (existing tests must
  pass unmodified).
- Add `fixtureAdapter`, which replays canned per-app JSON fixtures instead of generating text
  inline, for 3 representative variants: `coding-agent`, `planning-studio`, `incident-console`.
- Let the CLI select the adapter explicitly (`--adapter mock|fixture`, default `mock`) for both
  headless (`--print`) and interactive REPL modes.
- Fail loudly and specifically on invalid adapter ids or unsupported app+adapter combinations —
  never silently fall back to mock text.

## Non-goals

- No real LLM/network-backed adapter in this spec (explicitly deferred; this is the seam, not the
  live integration).
- No fixture authoring for all 12 variants — only the 3 named above. Other 9 variants remain
  mock-only; selecting `--adapter fixture` with one of them is a documented error, not a gap to
  paper over.
- No change to `QueryEvent` shape, timing, or the transcript/state layers.

## Design

### Interface

`src/adapters/types.ts`:

```ts
export type ResponseAdapter = {
  id: string;
  selectTool(prompt: string, tools: ToolDefinition[]): ToolDefinition | undefined;
  generateResponseText(app: AppDefinition, prompt: string, toolName?: string): string;
};
```

### Adapters

- `src/adapters/mockAdapter.ts`: moves today's `chooseTool` and `buildMockResponse` out of
  `query.ts` verbatim. `id: "mock"`. This is the default and must produce byte-identical output
  to the current implementation for the same inputs.
- `src/adapters/fixtureAdapter.ts`: `id: "fixture"`. Loads
  `src/mocks/fixtures/<appId>.json`, shape:

  ```json
  [
    { "match": ["status", "overview"], "toolName": "mock-inspector", "toolResult": "...", "response": "..." },
    { "match": ["default"], "response": "..." }
  ]
  ```

  Every fixture file must include exactly one entry whose `match` array contains the literal
  string `"default"` — used when no other entry's keywords match the prompt (case-insensitive
  substring match, same semantics as today's `chooseTool`). Missing default entry is a load-time
  error (fail fast at startup, not at first unmatched prompt).
- `src/adapters/registry.ts`: `getAdapter(id: string): ResponseAdapter`.
  - Unknown `id` -> throws `Unknown adapter "<id>". Valid adapters: mock, fixture.`
  - `id === "fixture"` and `app.id` not in `["coding-agent", "planning-studio", "incident-console"]`
    -> throws `Adapter "fixture" has no fixtures for app "<appId>". Supported apps: coding-agent, planning-studio, incident-console. Use --adapter mock instead.`

### query.ts changes

`query()` gains an `adapter: ResponseAdapter` field on its params object (required, no default —
callers must pass one; `QueryEngine` is what supplies the default). Internal `chooseTool` and
`buildMockResponse` functions are deleted from `query.ts`; call sites become
`adapter.selectTool(prompt, tools)` and `adapter.generateResponseText(app, prompt, selectedTool?.name)`.
`chunk()` (the text-to-event chunking helper) stays in `query.ts` — it's choreography, not content.

### QueryEngine changes

```ts
constructor(
  private readonly app: AppDefinition,
  private readonly tools: ToolDefinition[],
  private readonly notificationFactory: () => MockNotification | undefined,
  private readonly adapter: ResponseAdapter = mockAdapter,
) {}
```

Existing 3-arg call sites (`tests/query.test.ts`) keep compiling and keep testing the mock
adapter's behavior by default.

### CLI wiring

`src/cli.ts`/`main.tsx`:

```ts
.option("--adapter <id>", "Response adapter to use", "mock")
```

using commander's `.choices(["mock", "fixture"])` if the installed commander version supports it
on `.option()`'s returned `Option`; otherwise validate manually against `getAdapter`'s known ids
before constructing `QueryEngine`, calling `exitWithMessage` on failure (same pattern already
used for `"Headless mode requires a non-command prompt."`).

- Headless (`--print`): `runPrintMode` takes `adapterId` as a new parameter, resolves it via
  `getAdapter`, passes it into `new QueryEngine(...)`.
- Interactive: `main()` sets `process.env.MOCK_TUI_ADAPTER = options.adapter` alongside the
  existing `initializeEntrypoint` call. `REPL.tsx`'s `useMemo` for `queryEngine` reads
  `process.env.MOCK_TUI_ADAPTER` (defaulting to `"mock"` if unset, e.g. under `bun test`) via
  `getAdapter()` and passes the result as the 4th `QueryEngine` constructor argument.

### Testing

- `tests/adapters.test.ts` (new):
  - `mockAdapter` output matches the pre-refactor inline behavior (tool selection + response
    text) for representative prompts across at least 2 apps.
  - `fixtureAdapter` returns the matching fixture entry for a keyword hit, and the `default`
    entry for a non-matching prompt, for all 3 supported apps.
  - `getAdapter("bogus")` throws with the unknown-adapter message.
  - `getAdapter("fixture")` for an unsupported app (e.g. `sales-copilot`) throws with the
    unsupported-app message naming the 3 supported apps.
- `tests/query.test.ts`: unmodified, must still pass (proves the refactor is behavior-preserving
  for the default adapter).
- `tests/e2e-smoke.test.ts`: add one case running the built CLI with
  `--adapter fixture --app coding-agent --print "<prompt>"` and asserting the fixture response
  text appears in stdout.

## Error handling

Two failure modes, both synchronous and both surfaced through the existing CLI error path
(`exitWithMessage` / non-zero exit), never a silent fallback:

1. Unknown `--adapter` value.
2. `--adapter fixture` combined with an `--app` outside the 3 supported ids.

A fixture file missing its `default` entry is a load-time throw (not a request-time throw),
since it's a data-authoring bug, not a runtime condition.

## Consequences

- `query.ts` shrinks to pure choreography; content generation is fully swappable without touching
  it again.
- Adding a real (network-backed) adapter later is additive: a new file implementing
  `ResponseAdapter`, registered in `registry.ts`, with its own opt-in error/latency handling — no
  changes to `query.ts`, `QueryEngine`, or the event/transcript layers.
- Fixture coverage is intentionally partial (3/12 apps). This is a documented boundary, not a
  silent gap — attempting to use it outside that boundary fails with a message naming the
  supported apps and the fallback flag.
- Two new CLI-observable behaviors (`--adapter` flag, `MOCK_TUI_ADAPTER` env var) need a line in
  `docs/ONBOARDING.md`'s verification/manual-smoke sections.

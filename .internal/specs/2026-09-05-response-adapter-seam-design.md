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
  selectTool(app: AppDefinition, prompt: string, tools: ToolDefinition[]): ToolDefinition | undefined;
  generateResponseText(app: AppDefinition, prompt: string, toolName?: string): string;
};
```

Both methods take `app` (found while writing `fixtureAdapter`: fixture data is per-app, so
`selectTool` needs `app` to know which fixture set to consult — `mockAdapter`'s implementation
simply ignores the parameter, since its tool matching is app-independent).

**Contract:** both methods must be pure, deterministic functions of their inputs. `query()` calls
them independently (not as one combined call) and expects `selectTool`'s pick and
`generateResponseText`'s output to stay consistent with each other for the same `(app, prompt)` —
an adapter must not introduce hidden state or randomness that could desync the two.

### Adapters

- `src/adapters/mockAdapter.ts`: moves today's `chooseTool` and `buildMockResponse` out of
  `query.ts` verbatim. `id: "mock"`. This is the default and must produce byte-identical output
  to the current implementation for the same inputs.
- `src/adapters/fixtureAdapter.ts`: `id: "fixture"`. Loads
  `src/mocks/fixtures/<appId>.json`, shape:

  ```json
  [
    { "match": ["status", "overview"], "toolName": "mock-inspector", "response": "..." },
    { "match": ["default"], "response": "..." }
  ]
  ```

  `toolName`, when present, must name a tool that exists in the `tools` array `selectTool` is
  called with (`ToolDefinition.name`) — `selectTool` looks up and returns that `ToolDefinition`
  object; `generateResponseText` returns the entry's `response` string. There is no `toolResult`
  field: the `tool-result` event's content still comes from `selectedTool.run(prompt, app)` (the
  generic mock execution in `tools.ts`, unchanged) for both adapters — the content-only interface
  (`selectTool` + `generateResponseText`) has no seam for overriding tool-result content, only
  which tool fires and what the final assistant text says.

  Every fixture file must include exactly one entry whose `match` array contains the literal
  string `"default"` — used when no other entry's keywords match the prompt (case-insensitive
  substring match, same semantics as today's `chooseTool`).

  Because `generateResponseText`/`selectTool` only receive `app` at call time (not at adapter
  construction time), fixtures cannot be lazily discovered per-app and still claim to "fail fast
  at startup." Instead, `getAdapter("fixture")` eagerly reads and parses all 3 known fixture
  files (`coding-agent.json`, `planning-studio.json`, `incident-console.json` — the supported-app
  list is static, defined once in `registry.ts`) at construction time, validating each has a
  `default` entry and is well-formed JSON. Any failure (missing file, invalid JSON, missing
  `default` entry) throws immediately from `getAdapter("fixture")` itself.
- `src/adapters/registry.ts`:
  - `getAdapter(id: string): ResponseAdapter` — unknown `id` throws
    `Unknown adapter "<id>". Valid adapters: mock, fixture.`. Returns a memoized singleton for
    `"fixture"` so the eager fixture-file load in `fixtureAdapter.ts` happens once per process, on
    first request for that adapter (not on every `getAdapter` call, and not for `"mock"` at all).
  - `assertAdapterSupportsApp(adapterId: string, appId: string): void` — no-op unless
    `adapterId === "fixture"`; throws
    `Adapter "fixture" has no fixtures for app "<appId>". Supported apps: coding-agent,
    planning-studio, incident-console. Use --adapter mock instead.` if `appId` isn't one of the 3
    supported ids. Exported so both the CLI's startup check (for the initially-selected `--app`)
    and `fixtureAdapter`'s per-call check (for a later interactive `/variant` switch) share one
    implementation and one message — no duplicated logic to drift out of sync.

### query.ts changes

`query()` gains an `adapter: ResponseAdapter` field on its params object (required, no default —
callers must pass one; `QueryEngine` is what supplies the default). Internal `chooseTool` and
`buildMockResponse` functions are deleted from `query.ts`; call sites become
`adapter.selectTool(app, prompt, tools)` and `adapter.generateResponseText(app, prompt, selectedTool?.name)`.
`chunk()` (the text-to-event chunking helper) stays in `query.ts` — it's choreography, not content.

**Adapter error handling:** both adapter calls are wrapped in try/catch inside `query()`. On
failure (e.g. the fixture adapter's app-not-supported error, reachable at runtime via the
interactive `/variant <id>` command switching to an app outside the fixture adapter's 3 supported
ids), `query()` yields `{ type: "status", status: "Error: <message>" }` followed by `{ type:
"done" }` and returns — it does not let the error propagate out of the generator. This keeps
`QueryEvent`'s shape unchanged (per Non-goals) while preventing an uncaught throw from crashing a
live Ink render. The headless `--print` path is a single-shot process, not a long-lived render, so
`runPrintMode` does not need this try/catch — an adapter error there is validated away before this
point (see CLI wiring) or, if it still occurs, is acceptable to propagate and exit non-zero.

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

Validated manually against `getAdapter`'s known ids right after `const app =
getAppDefinition(requestedAppId)` in `main()` (so the check has the resolved `app.id` available),
and before the `if (options.print)` branch — not deferred into `runPrintMode` or `REPL.tsx`'s
`useMemo`, where an invalid value would otherwise only surface after the Ink UI has already
mounted. Calls `exitWithMessage` on failure (same pattern already used for
`"Headless mode requires a non-command prompt."`) — not via commander's `.choices()`, so the
valid-id list stays defined once, in `registry.ts`, instead of duplicated into the CLI option
declaration. (`--list-apps` still short-circuits before this, unaffected since it never touches an
adapter.)

Note: `getAppDefinition(appId)` does **not** throw on an unknown app id — it silently falls back to
`APP_DEFINITIONS[0]` (`found ?? APP_DEFINITIONS[0]!`). This is pre-existing behavior, out of scope
for this spec, and not something the adapter validation should try to mirror. It does mean the
`--adapter fixture` + unsupported-app check in `registry.ts` must compare against the *resolved*
`app.id` (always one of the 12 real catalog ids after `getAppDefinition` runs), not the raw
`--app` string — an invalid `--app` value never reaches the adapter check as an invalid app id in
the first place.

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
  - `query()` with the fixture adapter driven against an app outside the 3 supported ids (e.g.
    simulating a `/variant` switch to `sales-copilot`) yields `{ type: "status", status: "Error:
    ..." }` followed by `{ type: "done" }` — never throws out of the generator.
- `tests/query.test.ts`: **unmodified, must pass with zero edits** — this is the explicit
  acceptance bar for mock-adapter parity (not just "moved verbatim" as an unverified claim). Any
  assertion or snapshot change here means the refactor altered mock behavior.
- `tests/e2e-smoke.test.ts`: add one case running the built CLI with
  `--adapter fixture --app coding-agent --print "<prompt>"` and asserting the fixture response
  text appears in stdout.

## Error handling

Three failure modes, none a silent fallback:

1. Unknown `--adapter` value, or `--adapter fixture` combined with an `--app` outside the 3
   supported ids **at CLI startup** — both are validated synchronously right after arg parsing and
   surfaced through the existing CLI error path (`exitWithMessage` / non-zero exit), before any
   rendering or query engine construction happens.
2. A fixture file that's missing, malformed JSON, or missing its `default` entry — thrown
   synchronously from `getAdapter("fixture")` itself (eager-loaded at construction; a
   data-authoring bug, not a runtime condition).
3. An app switching to an unsupported id **after** startup, via the interactive `/variant <id>`
   command, while the fixture adapter is active — this can't be caught at CLI-parse time since the
   app wasn't known yet. `query()` catches it per-prompt and surfaces it as an in-transcript
   `status` event (see query.ts changes) instead of crashing the REPL.

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

## Stress Test Results: response-adapter-seam design

### Resolved Decisions

- **Mock-adapter parity**: `tests/query.test.ts` passing with zero edits is the explicit
  acceptance bar, not an implicit "moved verbatim" claim.
- **Fixture load timing**: the original "fail fast at startup" claim was structurally impossible
  given the interface (`app` only arrives at call time). Fixed to eager-load-and-validate all 3
  known fixture files at `getAdapter("fixture")` construction time (static supported-app list),
  genuinely restoring startup-time failure.
- **Runtime `/variant` switch to an unsupported app**: identified as an uncaught-throw-crashes-the-
  REPL bug in the original design. Fixed: `query()` catches adapter errors and surfaces them as an
  in-transcript `status` event, preserving the `QueryEvent` non-goal (no new event type).
- **Determinism contract**: `ResponseAdapter`'s two independently-called methods now have an
  explicit purity/determinism requirement documented on the interface.
- **CLI validation ordering**: `--adapter` validation moved to immediately after arg parsing in
  `main()`, before either branch, mirroring existing app-id validation — not deferred into
  `runPrintMode` or `REPL.tsx`.
- **Security, scale, rollback**: no security surface (appId always pre-validated against the fixed
  catalog before touching the filesystem), no scale dimension (single-user CLI/TUI), rollback is a
  plain git revert of a docs-only spec plus a later single-PR implementation — all resolved N/A.
- **Alternative interface shapes revisited**: considered collapsing `selectTool` +
  `generateResponseText` into one combined call to remove the determinism-contract note by
  construction; rejected as more invasive to `query.ts` for a benefit not worth the churn.

### Changes Made

- Added an explicit determinism/purity contract note to the `ResponseAdapter` interface.
- Changed fixture loading from an unspecified "load time" to eager loading of all 3 known files at
  `getAdapter("fixture")` construction.
- Added adapter-error try/catch in `query()`, surfacing failures as a `status` event instead of
  throwing out of the generator.
- Added explicit CLI validation ordering (right after `parseAsync`, before branching).
- Added a new test case (fixture adapter + unsupported app → error status event, not a throw).
- Made the mock-parity acceptance bar explicit in the Testing section.

### Deferred / Parking Lot

- Real network-backed adapter (explicitly out of scope, per Non-goals).
- Fixture coverage for the other 9 variants (explicitly out of scope, documented boundary).

### Confidence Assessment

- Overall: High.
- Areas of concern: none outstanding. The two structural gaps found (fixture-load timing
  contradiction, uncaught-throw-crashes-REPL on runtime app switch) are both resolved in the design
  above; nothing is being carried forward as a known risk into implementation.

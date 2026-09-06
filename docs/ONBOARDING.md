# Onboarding

This project is a standalone mock shell that preserves the recovered Claude Code-style TUI architecture while replacing production integrations with deterministic mock adapters.

## What This Project Is For

- Preserve the runtime boundaries recovered from the original architecture.
- Provide a buildable sandbox for designing many future TUIs from one shell.
- Make it easy to replace mocked services with real adapters later without rewriting the shell.

## Architecture spine

The primary execution path is intentionally stable:

1. `src/cli.ts`
2. `src/main.tsx`
3. `src/ink.tsx` and `src/interactiveHelpers.tsx`
4. `src/replLauncher.tsx`
5. `src/components/App.tsx`
6. `src/state/AppState.tsx` and `src/state/AppStateStore.ts`
7. `src/screens/REPL.tsx`
8. `src/QueryEngine.ts`
9. `src/query.ts`
10. `src/commands.ts` and `src/tools.ts`

The rule is simple: keep the architecture line intact even when the behavior behind it is mocked.

## Project layout

- `src/apps/`: variant catalog and domain-specific configuration
- `src/components/`: TUI shell pieces such as prompt, transcript, footer, and panels
- `src/hooks/`: mailbox and task watchers plus terminal helpers
- `src/mocks/`: deterministic event and notification factories
- `src/screens/`: top-level screen orchestration
- `src/state/`: external store and state access hooks
- `src/utils/`: small runtime helpers
- `tests/`: unit and smoke coverage
- `docs/adr/`: architecture decision records

## Development workflow

1. Start from the architecture spine before editing leaf components.
2. Prefer adding new domains as variants in `src/apps/catalog.ts`.
3. Keep commands in `src/commands.ts` and tools in `src/tools.ts`.
4. Add tests before modifying shell behavior.
5. Replace mock adapters behind the existing boundaries instead of bypassing the query engine or store.
6. Update the ADRs if you make a decision that changes the shell shape.

## Core behaviors to preserve

- Provider shell -> external store -> REPL hub
- Prompt submission -> query engine -> streamed transcript updates
- Commands and tools loaded from registries
- Transcript virtualization/windowing concepts
- Mailbox and task feeds routed through the same prompt/query contract
- Headless CLI path that can be used for smoke verification

## Verification commands

Run these before handing off changes:

```bash
bun run typecheck
bun test
bun run test:e2e
bun run build
```

Useful manual smoke commands:

```bash
bun run src/cli.ts --list-apps
bun run src/cli.ts --app coding-agent --print "map the codebase modules"
bun run dist/cli.js --app planning-studio --print "draft a launch plan for the next initiative"
```

Response content comes from a pluggable adapter (`--adapter mock` by default). Try the
fixture-replay adapter, which covers `coding-agent`, `planning-studio`, and `incident-console`:

```bash
bun run src/cli.ts --adapter fixture --app coding-agent --print "show me the codebase modules"
```

Selecting `--adapter fixture` with any other app exits with an error naming the supported apps.

## Recommended first reads

- `src/main.tsx`
- `src/screens/REPL.tsx`
- `src/query.ts`
- `src/QueryEngine.ts`
- `src/state/AppState.tsx`
- `src/state/AppStateStore.ts`
- `src/components/VirtualMessageList.tsx`
- `docs/adr/0001-standalone-mock-platform.md`

## Adding a new variant

1. Add the definition in `src/apps/catalog.ts`.
2. Provide title, subtitle, accent, starter transcript, tasks, notifications, and tool descriptors.
3. Verify it appears in `--list-apps`.
4. Extend smoke coverage if the variant introduces a new shell expectation.

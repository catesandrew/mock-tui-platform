# Mock TUI Platform

A standalone, runnable mock shell that mirrors the recovered Claude Code-style TUI architecture while replacing real integrations with mock data.

## Goals

- Preserve the architecture spine:
  - `cli -> main -> createRoot -> showSetupScreens -> launchRepl -> renderAndRun`
  - `App provider shell -> external store -> REPL orchestration hub`
  - `Prompt submission -> query engine -> streaming transcript updates`
  - `command registry + tool registry + background feeds`
- Keep the project reusable for many TUI applications by swapping app definitions instead of rewriting the shell.
- Ship with 12 mock application variants.

## Run

```bash
bun install
bun run src/cli.ts
```

Headless smoke mode:

```bash
bun run src/cli.ts --app coding-agent --print "Summarize the current system status"
```

## Onboarding

- Start with [docs/ONBOARDING.md](docs/ONBOARDING.md) for setup, architecture orientation, and contributor workflow.
- Read the decision records in [docs/adr/](docs/adr/) before changing the shell boundaries.

## Commands

- `/help`
- `/apps`
- `/variant <id>`
- `/tasks`
- `/search <term>`
- `/clear-search`
- `/clear`
- `/mailbox`
- `/notify`
- `/status`

## Variants

- coding-agent
- incident-console
- support-desk
- data-pipeline
- research-assistant
- crm-workspace
- sales-copilot
- planning-studio
- logistics-dispatch
- security-triage
- healthcare-intake
- knowledge-terminal

## Testing

```bash
bun run typecheck
bun test
bun run test:e2e
bun run build
```

The e2e smoke tests execute the built CLI and validate the headless print path and variant discovery flow.

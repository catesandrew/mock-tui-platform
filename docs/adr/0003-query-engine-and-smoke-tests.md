# ADR 0003: Query Engine And Smoke Tests

## Status

Accepted

## Context

The architectural value of the shell depends on preserving the prompt-to-query-to-transcript path, not just the visible layout. Static documentation alone is not enough to prove that path still works.

## Decision

Keep a dedicated `QueryEngine` and `query` layer in mock mode, and verify the shell with both unit tests and end-to-end smoke tests that execute the built CLI.

## Consequences

- The shell remains honest about its layered runtime model.
- Regressions in CLI wiring and headless prompt flow are more likely to be caught automatically.
- Verification takes slightly longer because smoke tests spawn Bun processes.
- Future real integrations can replace mocks behind the same query engine boundary with confidence that the shell path is still exercised.

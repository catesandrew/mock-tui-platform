# ADR 0002: Variant Driven Shell

## Status

Accepted

## Context

The shell is intended to support many TUI applications. Forking the runtime per domain would immediately destroy reuse and make architectural consistency impossible to maintain.

## Decision

Represent domains as variant definitions in `src/apps/catalog.ts`, while reusing one CLI, one provider shell, one REPL hub, one query engine, and one set of registries.

## Consequences

- New use cases can usually be added by configuration rather than rewriting the runtime.
- Review remains focused on the shared shell as the center of gravity.
- Domain-specific behavior is easier to isolate.
- Some future use cases may need richer extension points, but they should still preserve the shared shell contract.

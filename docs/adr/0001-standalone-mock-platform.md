# ADR 0001: Standalone Mock Platform

## Status

Accepted

## Context

The recovered architecture source is valuable as a design reference, but it is not a normal buildable repository root. The mock shell needs its own executable project boundary.

## Decision

Create a standalone package in `mock-tui-platform/` with its own manifest, TypeScript configuration, runtime entrypoints, and tests.

## Consequences

- The shell can be built and tested independently.
- Architectural fidelity can be preserved without depending on the recovered snapshot as an executable workspace.
- Future real adapters can be introduced incrementally behind stable shell boundaries.
- The team must actively keep this project aligned with the recovered architecture instead of letting it drift into a generic demo.

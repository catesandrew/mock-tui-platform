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

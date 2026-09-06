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

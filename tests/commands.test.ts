import { describe, expect, test } from "bun:test";
import { getAppDefinition } from "../src/apps/catalog";
import { findCommand, getCommands } from "../src/commands";

describe("command registry", () => {
  test("exposes the shell commands expected by onboarding docs", () => {
    const commands = getCommands(getAppDefinition("coding-agent"));
    const names = commands.map(command => command.name);

    expect(names).toEqual([
      "help",
      "apps",
      "variant",
      "tasks",
      "search",
      "clear-search",
      "clear",
      "mailbox",
      "notify",
      "status",
    ]);
  });

  test("parses variant switches from slash input", () => {
    const commands = getCommands(getAppDefinition("coding-agent"));
    const { command, args } = findCommand("/variant incident-console", commands);

    expect(command?.name).toBe("variant");
    expect(args).toEqual(["incident-console"]);
  });
});

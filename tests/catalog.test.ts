import { describe, expect, test } from "bun:test";
import { APP_DEFINITIONS } from "../src/apps/catalog";

describe("app catalog", () => {
  test("ships at least twelve variants", () => {
    expect(APP_DEFINITIONS.length).toBeGreaterThanOrEqual(12);
  });

  test("app ids are unique", () => {
    const ids = APP_DEFINITIONS.map(app => app.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

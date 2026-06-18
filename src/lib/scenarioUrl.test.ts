import { describe, expect, it } from "vitest";
import { decodeScenario, encodeScenario } from "./scenarioUrl";
import type { ScenarioOverrides } from "./scenarioUrl";

describe("encodeScenario / decodeScenario", () => {
  it("round-trips H/D/A choices", () => {
    const overrides: ScenarioOverrides = { m1: "H", m2: "D", m3: "A" };
    expect(decodeScenario(encodeScenario(overrides))).toEqual(overrides);
  });

  it("encodes an empty object to an empty string", () => {
    expect(encodeScenario({})).toBe("");
  });

  it("decodes an empty string to an empty object", () => {
    expect(decodeScenario("")).toEqual({});
  });

  it("URL-encodes special characters in match IDs", () => {
    const overrides: ScenarioOverrides = { "match/42": "H" };
    const encoded = encodeScenario(overrides);
    expect(encoded).toContain("%2F");
    expect(decodeScenario(encoded)).toEqual(overrides);
  });

  it("ignores malformed parts without a colon separator", () => {
    expect(decodeScenario("badpart,m1:H")).toEqual({ m1: "H" });
  });

  it("ignores unknown choice values", () => {
    expect(decodeScenario("m1:X")).toEqual({});
  });

  it("handles a single entry", () => {
    const overrides: ScenarioOverrides = { match1: "A" };
    expect(decodeScenario(encodeScenario(overrides))).toEqual(overrides);
  });
});

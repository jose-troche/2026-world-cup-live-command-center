import { describe, expect, it } from "vitest";
import { getTournamentAvailabilityMessage } from "./useTournamentData";

describe("tournament availability message", () => {
  it("uses calm fallback copy without exposing an HTTP status", () => {
    const message = getTournamentAvailabilityMessage(false);
    expect(message).toContain("saved tournament snapshot");
    expect(message).not.toMatch(/\b(4|5)\d{2}\b/);
    expect(message).not.toContain("API");
  });

  it("explains when the most recent live update is retained", () => {
    const message = getTournamentAvailabilityMessage(true);
    expect(message).toContain("most recent update");
    expect(message).not.toMatch(/\b(4|5)\d{2}\b/);
  });
});

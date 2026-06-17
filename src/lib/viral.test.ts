import { describe, expect, it } from "vitest";
import { fallbackData } from "../data/fallback";
import type { Match, TournamentData } from "../types";
import {
  buildMatchPrediction,
  buildPowerRankings,
  buildUpsetMeter,
  buildViralContent,
  buildWhatChanged,
  getContentPath,
  getGroupPath,
  getMatchPath,
  getTeamPath,
} from "./viral";

describe("viral content engine", () => {
  it("builds shareable match predictions with normalized percentages and social links", () => {
    const prediction = buildMatchPrediction(fallbackData.matches[3], "https://example.com");
    const total = prediction.homePercent + prediction.drawPercent + prediction.awayPercent;

    expect(prediction.title).toBe("Spain vs Cape Verde");
    expect(total).toBeGreaterThanOrEqual(99);
    expect(total).toBeLessThanOrEqual(101);
    expect(prediction.cardUrl).toBe("https://example.com/api/cards/match/14.svg");
    expect(prediction.shareLinks.map((link) => link.label)).toEqual([
      "X",
      "Bluesky",
      "Reddit",
      "LinkedIn",
      "Copy",
    ]);
  });

  it("ranks teams from model strength and current group performance", () => {
    const rankings = buildPowerRankings(fallbackData, 5);

    expect(rankings).toHaveLength(5);
    expect(rankings[0].rank).toBe(1);
    expect(rankings[0].score).toBeGreaterThanOrEqual(rankings[1].score);
    expect(rankings.some((team) => team.note.includes("GD"))).toBe(true);
  });

  it("detects lower-rated winners as upset-meter entries", () => {
    const upsetMatch: Match = {
      ...fallbackData.matches[0],
      id: "upset",
      homeName: "Haiti",
      awayName: "Brazil",
      homeScore: 2,
      awayScore: 1,
      status: "finished",
    };

    const upsets = buildUpsetMeter({ matches: [upsetMatch] });

    expect(upsets[0]).toMatchObject({
      winnerName: "Haiti",
      loserName: "Brazil",
      score: "2-1",
    });
    expect(upsets[0].upsetScore).toBeGreaterThan(0);
  });

  it("generates What Changed rows from finished match deltas", () => {
    const changed = buildWhatChanged(fallbackData, "https://example.com");

    expect(changed.length).toBeGreaterThan(0);
    expect(changed.some((item) => item.change !== 0)).toBe(true);
  });

  it("assembles a complete viral content feed", () => {
    const content = buildViralContent(fallbackData as TournamentData, "https://example.com");

    expect(content.prediction?.title).toBeTruthy();
    expect(content.powerRankings.length).toBe(10);
    expect(content.contentStories.length).toBeGreaterThan(0);
    expect(content.socialPosts.length).toBeGreaterThan(0);
    expect(content.seoPages.some((page) => page.path.startsWith("/teams/"))).toBe(true);
    expect(content.seoPages.some((page) => page.path.startsWith("/content/"))).toBe(true);
  });

  it("builds stable deep-link paths for SEO inventory pages", () => {
    expect(getMatchPath(fallbackData.matches[3])).toBe("/matches/spain-cape-verde");
    expect(getTeamPath(fallbackData.teams.find((team) => team.name === "United States")!)).toBe("/teams/united-states");
    expect(getGroupPath("H")).toBe("/groups/group-h");
    expect(getContentPath("Spain Cape Verde Prediction")).toBe("/content/spain-cape-verde-prediction");
  });
});

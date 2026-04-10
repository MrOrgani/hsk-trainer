import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db/dexie";
import { getWeeklyStats, getOverallStats } from "@/lib/stats";
import type { DailyState, SrsCard } from "@/db/schema";

beforeEach(async () => {
  await db.dailyState.clear();
  await db.srsCards.clear();
});

function makeDailyState(
  date: string,
  newCards: number,
  reviews: number
): DailyState {
  return { date, newCardsIntroduced: newCards, reviewsCompleted: reviews };
}

function makeCard(id: string, state: SrsCard["state"]): SrsCard {
  return {
    id,
    wordId: id.split("::")[0],
    promptType: "recognition",
    state,
    learningStep: 0,
    interval: state === "review" ? 5 : 0,
    easeFactor: 2.5,
    repetitions: state === "review" ? 3 : 0,
    dueDate: Date.now(),
    lastReview: Date.now(),
    createdAt: Date.now(),
  };
}

describe("getWeeklyStats", () => {
  it("returns 7 days filling gaps with zeros", async () => {
    await db.dailyState.bulkPut([
      makeDailyState("2026-04-10", 5, 20),
      makeDailyState("2026-04-08", 3, 10),
    ]);
    const result = await getWeeklyStats(
      new Date("2026-04-10T12:00:00").getTime()
    );
    expect(result).toHaveLength(7);
    expect(result[6].reviewsCompleted).toBe(20);
    expect(result[4].reviewsCompleted).toBe(10);
    expect(result[5].reviewsCompleted).toBe(0);
  });
});

describe("getOverallStats", () => {
  it("counts cards by state", async () => {
    await db.srsCards.bulkPut([
      makeCard("a::recognition", "learning"),
      makeCard("b::recognition", "review"),
      makeCard("c::recognition", "review"),
      makeCard("d::recognition", "new"),
    ]);
    const r = await getOverallStats();
    expect(r.learning).toBe(1);
    expect(r.review).toBe(2);
    expect(r.total).toBe(4);
  });

  it("returns zeros when empty", async () => {
    const r = await getOverallStats();
    expect(r.total).toBe(0);
  });
});

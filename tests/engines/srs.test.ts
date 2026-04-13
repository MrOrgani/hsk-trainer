import { beforeEach, describe, expect, it } from "vitest";
import {
  introduceNewCard,
  incrementDailyNew,
  getTodayState,
} from "@/engines/srs";
import { db } from "@/db/dexie";
import type { PromptType } from "@/db/schema";
import { DEFAULT_SETTINGS } from "@/db/schema";

const NOW = 1_800_000_000_000;

describe("introduceNewCard", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("creates one srsCard per enabled prompt type in learning state", async () => {
    const settings = { ...DEFAULT_SETTINGS, enabledPromptTypes: ["recognition", "audio-to-word"] as PromptType[] };
    const created = await introduceNewCard("你好", settings, NOW);

    expect(created).toHaveLength(2);
    expect(created.every((c) => c.state === "learning")).toBe(true);
    expect(created.every((c) => c.learningStep === 0)).toBe(true);
    expect(created.every((c) => c.dueDate === NOW + settings.learningSteps[0] * 60 * 1000)).toBe(true);

    const inDb = await db.srsCards.where("wordId").equals("你好").toArray();
    expect(inDb).toHaveLength(2);
  });

  it("is idempotent — does not create duplicate cards", async () => {
    await introduceNewCard("水", DEFAULT_SETTINGS, NOW);
    await introduceNewCard("水", DEFAULT_SETTINGS, NOW);

    const inDb = await db.srsCards.where("wordId").equals("水").toArray();
    expect(inDb.length).toBe(DEFAULT_SETTINGS.enabledPromptTypes.length);
  });
});

describe("dailyState counters", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("creates today's row on first increment", async () => {
    await incrementDailyNew(NOW);
    const today = await getTodayState(NOW);
    expect(today.newCardsIntroduced).toBe(1);
  });

  it("increments existing row", async () => {
    await incrementDailyNew(NOW);
    await incrementDailyNew(NOW);
    await incrementDailyNew(NOW);
    const today = await getTodayState(NOW);
    expect(today.newCardsIntroduced).toBe(3);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import {
  schedule,
  getDueCards,
  introduceNewCard,
  incrementDailyNew,
  getTodayState,
} from "@/engines/srs";
import { db } from "@/db/dexie";
import type { SrsCard } from "@/db/schema";
import { DEFAULT_SETTINGS } from "@/db/schema";

const MINUTE = 60 * 1000;
const NOW = 1_800_000_000_000;

function makeLearningCard(overrides: Partial<SrsCard> = {}): SrsCard {
  return {
    id: "w::recognition",
    wordId: "w",
    promptType: "recognition",
    state: "learning",
    learningStep: 1,
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    dueDate: NOW,
    lastReview: null,
    createdAt: NOW,
    ...overrides,
  };
}

function makeReviewCard(overrides: Partial<SrsCard> = {}): SrsCard {
  return {
    id: "w::recognition",
    wordId: "w",
    promptType: "recognition",
    state: "review",
    learningStep: 0,
    interval: 2,
    easeFactor: 2.5,
    repetitions: 3,
    dueDate: NOW,
    lastReview: null,
    createdAt: NOW,
    ...overrides,
  };
}

describe("schedule — learning state — Again", () => {
  it("resets learningStep to 0 and reschedules to now + learningSteps[0]", () => {
    const card = makeLearningCard({ learningStep: 1 });
    const next = schedule(card, "again", NOW, DEFAULT_SETTINGS);

    expect(next.state).toBe("learning");
    expect(next.learningStep).toBe(0);
    expect(next.dueDate).toBe(NOW + DEFAULT_SETTINGS.learningSteps[0] * MINUTE);
    expect(next.lastReview).toBe(NOW);
  });
});

describe("schedule — learning state — Hard", () => {
  it("stays at current learningStep and reschedules using that step", () => {
    const settings = { ...DEFAULT_SETTINGS, learningSteps: [1, 10] };
    const card = makeLearningCard({ learningStep: 1 });
    const next = schedule(card, "hard", NOW, settings);

    expect(next.state).toBe("learning");
    expect(next.learningStep).toBe(1);
    expect(next.dueDate).toBe(NOW + 10 * MINUTE);
  });
});

describe("schedule — learning state — Good", () => {
  it("advances learningStep by 1 when more steps remain", () => {
    const settings = { ...DEFAULT_SETTINGS, learningSteps: [1, 10] };
    const card = makeLearningCard({ learningStep: 0 });
    const next = schedule(card, "good", NOW, settings);

    expect(next.state).toBe("learning");
    expect(next.learningStep).toBe(1);
    expect(next.dueDate).toBe(NOW + 10 * MINUTE);
  });

  it("graduates to review with interval=1 day, ease=2.5 when no steps remain", () => {
    const settings = { ...DEFAULT_SETTINGS, learningSteps: [1, 10] };
    const card = makeLearningCard({ learningStep: 1 });
    const next = schedule(card, "good", NOW, settings);

    expect(next.state).toBe("review");
    expect(next.interval).toBe(1);
    expect(next.easeFactor).toBe(2.5);
    expect(next.repetitions).toBe(1);
    expect(next.dueDate).toBe(NOW + 1 * 24 * 60 * MINUTE);
  });
});

describe("schedule — learning state — Easy", () => {
  it("graduates immediately to review with interval=4 days, ease=2.5", () => {
    const settings = { ...DEFAULT_SETTINGS, learningSteps: [1, 10] };
    const card = makeLearningCard({ learningStep: 0 });
    const next = schedule(card, "easy", NOW, settings);

    expect(next.state).toBe("review");
    expect(next.interval).toBe(4);
    expect(next.easeFactor).toBe(2.5);
    expect(next.repetitions).toBe(1);
    expect(next.dueDate).toBe(NOW + 4 * 24 * 60 * MINUTE);
  });
});

describe("schedule — review state — Good", () => {
  it("multiplies interval by easeFactor, increments repetitions", () => {
    const card = makeReviewCard({ interval: 2, easeFactor: 2.5 });
    const next = schedule(card, "good", NOW, DEFAULT_SETTINGS);

    expect(next.state).toBe("review");
    expect(next.interval).toBe(5);
    expect(next.easeFactor).toBe(2.5);
    expect(next.repetitions).toBe(4);
    expect(next.dueDate).toBe(NOW + 5 * 24 * 60 * MINUTE);
  });
});

describe("schedule — review state — Hard", () => {
  it("interval * 1.2, easeFactor -= 0.15, floor at 1.3", () => {
    const card = makeReviewCard({ interval: 10, easeFactor: 2.0 });
    const next = schedule(card, "hard", NOW, DEFAULT_SETTINGS);

    expect(next.interval).toBe(12);
    expect(next.easeFactor).toBeCloseTo(1.85, 5);
  });

  it("does not push easeFactor below 1.3", () => {
    const card = makeReviewCard({ interval: 5, easeFactor: 1.35 });
    const next = schedule(card, "hard", NOW, DEFAULT_SETTINGS);
    expect(next.easeFactor).toBe(1.3);
  });
});

describe("schedule — review state — Easy", () => {
  it("interval * ease * 1.3, easeFactor += 0.15", () => {
    const card = makeReviewCard({ interval: 4, easeFactor: 2.5 });
    const next = schedule(card, "easy", NOW, DEFAULT_SETTINGS);

    expect(next.interval).toBe(Math.round(4 * 2.5 * 1.3));
    expect(next.easeFactor).toBeCloseTo(2.65, 5);
  });
});

describe("schedule — review state — Again", () => {
  it("demotes the card back to learning at step 0 and resets interval", () => {
    const settings = { ...DEFAULT_SETTINGS, learningSteps: [1, 10] };
    const card = makeReviewCard({ interval: 30, easeFactor: 2.3, repetitions: 6 });
    const next = schedule(card, "again", NOW, settings);

    expect(next.state).toBe("learning");
    expect(next.learningStep).toBe(0);
    expect(next.interval).toBe(0);
    expect(next.repetitions).toBe(0);
    expect(next.dueDate).toBe(NOW + 1 * MINUTE);
    expect(next.easeFactor).toBeCloseTo(2.1, 5);
  });
});

describe("getDueCards", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("returns only cards whose dueDate <= now, sorted ascending", async () => {
    await db.srsCards.bulkPut([
      { id: "a::recognition", wordId: "a", promptType: "recognition", state: "review", learningStep: 0, interval: 1, easeFactor: 2.5, repetitions: 1, dueDate: NOW - 100, lastReview: null, createdAt: NOW },
      { id: "b::recognition", wordId: "b", promptType: "recognition", state: "review", learningStep: 0, interval: 1, easeFactor: 2.5, repetitions: 1, dueDate: NOW - 50, lastReview: null, createdAt: NOW },
      { id: "c::recognition", wordId: "c", promptType: "recognition", state: "review", learningStep: 0, interval: 1, easeFactor: 2.5, repetitions: 1, dueDate: NOW + 10000, lastReview: null, createdAt: NOW },
    ]);

    const due = await getDueCards(NOW);
    expect(due.map((c) => c.wordId)).toEqual(["a", "b"]);
  });
});

describe("introduceNewCard", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("creates one srsCard per enabled prompt type in learning state", async () => {
    const settings = { ...DEFAULT_SETTINGS, enabledPromptTypes: ["recognition", "audio-to-word"] as const };
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

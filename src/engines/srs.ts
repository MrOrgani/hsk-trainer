import type { DailyState, Grade, PromptType, Settings, SrsCard, Word } from "@/db/schema";
import { db } from "@/db/dexie";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export async function introduceNewCard(
  wordId: string,
  settings: Settings,
  now: number
): Promise<SrsCard[]> {
  const firstStepMs = settings.learningSteps[0] * MINUTE;
  const cards: SrsCard[] = settings.enabledPromptTypes.map((promptType: PromptType) => ({
    id: `${wordId}::${promptType}`,
    wordId,
    promptType,
    state: "learning",
    learningStep: 0,
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    dueDate: now + firstStepMs,
    lastReview: null,
    createdAt: now,
  }));
  // bulkPut with matching keys is idempotent — replaces rather than duplicates.
  await db.srsCards.bulkPut(cards);
  return cards;
}

export async function introduceNewCardWithGrade(
  wordId: string,
  settings: Settings,
  now: number,
  grade: Grade
): Promise<SrsCard[]> {
  const firstStepMs = settings.learningSteps[0] * MINUTE;

  const cards: SrsCard[] = settings.enabledPromptTypes.map((promptType: PromptType) => {
    const base = {
      id: `${wordId}::${promptType}`,
      wordId,
      promptType,
      easeFactor: 2.5,
      repetitions: 0,
      lastReview: null,
      createdAt: now,
    };

    if (grade === "easy") {
      return {
        ...base,
        state: "review" as const,
        learningStep: 0,
        interval: 4,
        repetitions: 1,
        dueDate: now + 4 * DAY,
      };
    }
    if (grade === "good") {
      return {
        ...base,
        state: "review" as const,
        learningStep: 0,
        interval: 1,
        repetitions: 1,
        dueDate: now + DAY,
      };
    }
    // "hard" and "again" — stay in learning, step 0
    return {
      ...base,
      state: "learning" as const,
      learningStep: 0,
      interval: 0,
      dueDate: now + firstStepMs,
    };
  });

  await db.srsCards.bulkPut(cards);
  return cards;
}

function localDateString(now: number): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getTodayState(now: number): Promise<DailyState> {
  const date = localDateString(now);
  const existing = await db.dailyState.get(date);
  return existing ?? { date, newCardsIntroduced: 0, reviewsCompleted: 0 };
}

export async function incrementDailyNew(now: number): Promise<void> {
  const date = localDateString(now);
  await db.transaction("rw", db.dailyState, async () => {
    const existing = await db.dailyState.get(date);
    const row: DailyState = existing
      ? { ...existing, newCardsIntroduced: existing.newCardsIntroduced + 1 }
      : { date, newCardsIntroduced: 1, reviewsCompleted: 0 };
    await db.dailyState.put(row);
  });
}

export async function incrementDailyReviews(now: number): Promise<void> {
  const date = localDateString(now);
  await db.transaction("rw", db.dailyState, async () => {
    const existing = await db.dailyState.get(date);
    const row: DailyState = existing
      ? { ...existing, reviewsCompleted: existing.reviewsCompleted + 1 }
      : { date, newCardsIntroduced: 0, reviewsCompleted: 1 };
    await db.dailyState.put(row);
  });
}

/**
 * Returns distinct Words that have at least one SrsCard due at or before `now`.
 */
export async function getDueWords(now: number): Promise<Word[]> {
  const dueCards = await db.srsCards.where("dueDate").belowOrEqual(now).toArray();
  const wordIds = Array.from(new Set(dueCards.map((c) => c.wordId)));
  if (wordIds.length === 0) return [];
  const rows = await db.words.bulkGet(wordIds);
  return rows.filter((w): w is Word => w !== undefined);
}

/**
 * Apply SM-2 grading to all SrsCards for a given word.
 */
export async function reviewCard(
  wordId: string,
  grade: Grade,
  settings: Settings,
  now: number,
): Promise<void> {
  const firstStepMs = settings.learningSteps[0] * MINUTE;
  const cards = await db.srsCards.where("wordId").equals(wordId).toArray();
  if (cards.length === 0) return;

  const updated: SrsCard[] = cards.map((c) => {
    if (grade === "again") {
      return {
        ...c,
        state: "learning",
        learningStep: 0,
        interval: 0,
        easeFactor: Math.max(1.3, c.easeFactor - 0.2),
        repetitions: 0,
        dueDate: now + firstStepMs,
        lastReview: now,
      };
    }
    if (grade === "hard") {
      const ease = Math.max(1.3, c.easeFactor - 0.15);
      const interval = Math.max(1, Math.round(c.interval * 1.2));
      return {
        ...c,
        state: "review",
        easeFactor: ease,
        interval,
        repetitions: c.repetitions + 1,
        dueDate: now + interval * DAY,
        lastReview: now,
      };
    }
    if (grade === "good") {
      const interval = c.repetitions === 0 ? 1 : Math.round(c.interval * c.easeFactor);
      return {
        ...c,
        state: "review",
        interval,
        repetitions: c.repetitions + 1,
        dueDate: now + interval * DAY,
        lastReview: now,
      };
    }
    // easy
    const ease = c.easeFactor + 0.15;
    const interval =
      c.repetitions === 0 ? 4 : Math.round(c.interval * c.easeFactor * 1.3);
    return {
      ...c,
      state: "review",
      easeFactor: ease,
      interval,
      repetitions: c.repetitions + 1,
      dueDate: now + interval * DAY,
      lastReview: now,
    };
  });

  await db.srsCards.bulkPut(updated);
}


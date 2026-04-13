import type { DailyState, Grade, PromptType, Settings, SrsCard } from "@/db/schema";
import { db } from "@/db/dexie";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export function schedule(
  card: SrsCard,
  grade: Grade,
  now: number,
  settings: Settings
): SrsCard {
  const base: SrsCard = { ...card, lastReview: now };

  if (base.state === "learning") {
    const steps = settings.learningSteps;
    if (grade === "again") {
      return { ...base, learningStep: 0, dueDate: now + steps[0] * MINUTE };
    }
    if (grade === "hard") {
      const step = Math.max(0, Math.min(base.learningStep, steps.length - 1));
      return { ...base, learningStep: step, dueDate: now + steps[step] * MINUTE };
    }
    if (grade === "good") {
      const nextStep = base.learningStep + 1;
      if (nextStep < steps.length) {
        return { ...base, learningStep: nextStep, dueDate: now + steps[nextStep] * MINUTE };
      }
      return {
        ...base,
        state: "review",
        learningStep: 0,
        interval: 1,
        easeFactor: 2.5,
        repetitions: 1,
        dueDate: now + DAY,
      };
    }
    if (grade === "easy") {
      return {
        ...base,
        state: "review",
        learningStep: 0,
        interval: 4,
        easeFactor: 2.5,
        repetitions: 1,
        dueDate: now + 4 * DAY,
      };
    }
  }

  if (base.state === "review") {
    if (grade === "again") {
      const newEase = Math.max(1.3, base.easeFactor - 0.2);
      return {
        ...base,
        state: "learning",
        learningStep: 0,
        interval: 0,
        easeFactor: newEase,
        repetitions: 0,
        dueDate: now + settings.learningSteps[0] * MINUTE,
      };
    }
    if (grade === "good") {
      const newInterval = Math.max(1, Math.round(base.interval * base.easeFactor));
      return {
        ...base,
        interval: newInterval,
        repetitions: base.repetitions + 1,
        dueDate: now + newInterval * DAY,
      };
    }
    if (grade === "hard") {
      const newInterval = Math.max(1, Math.round(base.interval * 1.2));
      const newEase = Math.max(1.3, base.easeFactor - 0.15);
      return {
        ...base,
        interval: newInterval,
        easeFactor: newEase,
        repetitions: base.repetitions + 1,
        dueDate: now + newInterval * DAY,
      };
    }
    if (grade === "easy") {
      const newInterval = Math.max(1, Math.round(base.interval * base.easeFactor * 1.3));
      const newEase = base.easeFactor + 0.15;
      return {
        ...base,
        interval: newInterval,
        easeFactor: newEase,
        repetitions: base.repetitions + 1,
        dueDate: now + newInterval * DAY,
      };
    }
  }

  return base;
}

export async function getDueCards(now: number): Promise<SrsCard[]> {
  return db.srsCards.where("dueDate").belowOrEqual(now).sortBy("dueDate");
}

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

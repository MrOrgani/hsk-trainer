import { db } from "@/db/dexie";
import type { DailyState, HskLevel } from "@/db/schema";
import { loadWordsWithState, getMaturity } from "@/lib/word-state";

function localDateString(now: number): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return localDateString(d.getTime());
}

export async function getWeeklyStats(now: number): Promise<DailyState[]> {
  const today = localDateString(now);
  const startDate = addDays(today, -6);

  const stored = await db.dailyState
    .where("date")
    .between(startDate, today, true, true)
    .toArray();

  const byDate = new Map(stored.map((s) => [s.date, s]));
  const result: DailyState[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(startDate, i);
    result.push(
      byDate.get(date) ?? { date, newCardsIntroduced: 0, reviewsCompleted: 0 }
    );
  }
  return result;
}

export interface OverallStats {
  total: number;
  learning: number;
  review: number;
  suspended: number;
  newCount: number;
}

export type MaturityLevel = "new" | "learning" | "young" | "mature";

export interface LevelProgress {
  hskLevel: HskLevel;
  total: number;
  new: number;
  learning: number;
  young: number;
  mature: number;
}

export async function getCharacterProgress(): Promise<LevelProgress[]> {
  const wordsWithState = await loadWordsWithState();

  const byLevel = new Map<HskLevel, { total: number; new: number; learning: number; young: number; mature: number }>();
  for (const { word, bestCard } of wordsWithState) {
    const level = word.hskLevel as HskLevel;
    if (!byLevel.has(level)) {
      byLevel.set(level, { total: 0, new: 0, learning: 0, young: 0, mature: 0 });
    }
    const bucket = byLevel.get(level)!;
    bucket.total++;

    const maturity = getMaturity(bestCard);
    bucket[maturity]++;
  }

  const levels: HskLevel[] = [1, 2, 3, 4, 5, 6, 7];
  return levels
    .filter((l) => byLevel.has(l))
    .map((l) => ({
      hskLevel: l,
      ...byLevel.get(l)!,
    }));
}

export async function getOverallStats(): Promise<OverallStats> {
  const cards = await db.srsCards.toArray();
  let learning = 0;
  let review = 0;
  let suspended = 0;
  let newCount = 0;
  for (const c of cards) {
    if (c.state === "learning") learning++;
    else if (c.state === "review") review++;
    else if (c.state === "suspended") suspended++;
    else newCount++;
  }
  return { total: cards.length, learning, review, suspended, newCount };
}

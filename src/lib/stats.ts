import { db } from "@/db/dexie";
import type { DailyState } from "@/db/schema";

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

import { db } from "@/db/dexie";
import type { Word } from "@/db/schema";

export async function seedHskLevel(level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9): Promise<void> {
  const existing = await db.words.where("hskLevel").equals(level).count();
  if (existing > 0) return;

  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/hsk-${level}.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${base}data/hsk-${level}.json (${res.status})`);
  }
  const words = (await res.json()) as Word[];
  await db.words.bulkPut(words);
}

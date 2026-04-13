import { db } from "@/db/dexie";
import type { Word, CardState } from "@/db/schema";

export type Maturity = "new" | "learning" | "young" | "mature";

export interface BestCard {
  interval: number;
  repetitions: number;
  dueDate: number;
  state: string;
}

export interface WordWithState {
  word: Word;
  state: CardState | "unseen";
  bestCard: BestCard | null;
}

export const STATE_COLORS: Record<string, string> = {
  unseen: "bg-ink-100 text-ink-400",
  new: "bg-ink-200 text-ink-500",
  learning: "bg-gold-100 text-gold-700",
  review: "bg-jade-100 text-jade-700",
  suspended: "bg-vermillion-100 text-vermillion-700",
};

export const MATURITY_TILE_COLORS: Record<Maturity, string> = {
  new: "bg-ink-200",
  learning: "bg-vermillion-400",
  young: "bg-gold-400",
  mature: "bg-jade-400",
};

function statePriority(state: CardState): number {
  switch (state) {
    case "review":
      return 3;
    case "learning":
      return 2;
    case "new":
      return 1;
    case "suspended":
      return 0;
  }
}

export function getMaturity(bestCard: BestCard | null): Maturity {
  if (!bestCard) return "new";
  if (
    bestCard.state === "learning" ||
    bestCard.interval < 1 ||
    bestCard.repetitions < 3
  )
    return "learning";
  if (bestCard.interval <= 21) return "young";
  return "mature";
}

export async function loadWordsWithState(): Promise<WordWithState[]> {
  const words = await db.words.orderBy("frequency").toArray();
  const cards = await db.srsCards.toArray();

  // Best card by highest interval per word
  const bestCardByWord = new Map<string, BestCard>();
  // Best state by priority per word
  const stateByWord = new Map<string, CardState>();

  for (const card of cards) {
    // Track best card (highest interval)
    const prevBest = bestCardByWord.get(card.wordId);
    if (!prevBest || card.interval > prevBest.interval) {
      bestCardByWord.set(card.wordId, {
        interval: card.interval,
        repetitions: card.repetitions,
        dueDate: card.dueDate,
        state: card.state,
      });
    }

    // Track best state (highest priority)
    const prevState = stateByWord.get(card.wordId);
    if (!prevState || statePriority(card.state) > statePriority(prevState)) {
      stateByWord.set(card.wordId, card.state);
    }
  }

  return words.map((word) => ({
    word,
    state: stateByWord.get(word.id) ?? "unseen",
    bestCard: bestCardByWord.get(word.id) ?? null,
  }));
}

export function filterWords(
  items: WordWithState[],
  query: string,
): WordWithState[] {
  const q = query.trim();
  if (!q) return items;
  const lower = q.toLowerCase();
  return items.filter(
    ({ word }) =>
      word.id.includes(q) ||
      word.pinyin.toLowerCase().includes(lower) ||
      word.meaningEn.toLowerCase().includes(lower) ||
      word.meaningFr.toLowerCase().includes(lower),
  );
}

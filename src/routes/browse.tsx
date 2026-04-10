import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/db/dexie";
import type { Word, CardState } from "@/db/schema";

export const Route = createFileRoute("/browse")({
  component: BrowsePage,
});

interface WordWithState {
  word: Word;
  state: CardState | "unseen";
}

const STATE_COLORS: Record<string, string> = {
  unseen: "bg-ink-100 text-ink-400",
  new: "bg-ink-200 text-ink-500",
  learning: "bg-gold-100 text-gold-700",
  review: "bg-jade-100 text-jade-700",
  suspended: "bg-vermillion-100 text-vermillion-700",
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

export function BrowsePage() {
  const [items, setItems] = useState<WordWithState[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const words = await db.words.orderBy("frequency").toArray();
      const cards = await db.srsCards.toArray();
      const stateByWord = new Map<string, CardState>();
      for (const card of cards) {
        const prev = stateByWord.get(card.wordId);
        if (!prev || statePriority(card.state) > statePriority(prev)) {
          stateByWord.set(card.wordId, card.state);
        }
      }
      setItems(
        words.map((word) => ({
          word,
          state: stateByWord.get(word.id) ?? "unseen",
        })),
      );
    })();
  }, []);

  const filtered = search.trim()
    ? items.filter(
        ({ word }) =>
          word.id.includes(search) ||
          word.pinyin.toLowerCase().includes(search.toLowerCase()) ||
          word.meaningEn.toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  return (
    <div className="max-w-2xl mx-auto px-5 pt-10 pb-16">
      <h1 className="font-display text-3xl sm:text-4xl text-ink-800 mb-6">
        Vocabulary
      </h1>
      <input
        type="text"
        placeholder="Search by character, pinyin, or meaning..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl border border-ink-200 bg-paper px-4 py-3 text-ink-800 font-medium placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-vermillion-300 mb-6"
      />
      <div className="space-y-2">
        {filtered.map(({ word, state }) => (
          <div
            key={word.id}
            className="rounded-xl card px-4 py-3 sm:px-5 sm:py-4 flex items-center gap-4"
          >
            <span className="font-hanzi text-2xl sm:text-3xl font-black text-ink-800 min-w-[3rem]">
              {word.id}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm sm:text-base font-semibold text-ink-700 truncate">
                {word.pinyin}
              </p>
              <p className="text-xs sm:text-sm text-ink-400 truncate">
                {word.meaningEn}
              </p>
            </div>
            <span
              className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md ${STATE_COLORS[state]}`}
            >
              {state === "unseen" ? "new" : state}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center py-8 text-ink-300 font-medium">
            No words found.
          </p>
        )}
      </div>
    </div>
  );
}

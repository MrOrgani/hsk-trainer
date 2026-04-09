import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/db/dexie";
import {
  introduceNewCard,
  incrementDailyNew,
  getTodayState,
} from "@/engines/srs";
import { useSettings } from "@/state/settings-store";
import { useStudyStore } from "@/state/study-store";
import { StrokeAnimation } from "@/components/StrokeAnimation";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { AudioButton } from "@/components/AudioButton";
import { chunky } from "@/components/Button";
import type { Word } from "@/db/schema";

export const Route = createFileRoute("/study")({
  component: Study,
});

function Study() {
  const settings = useSettings();
  const { queue, index, phase, start, nextPhase, commitCurrent, clear } =
    useStudyStore();

  useEffect(() => {
    if (!settings) return;
    (async () => {
      const today = await getTodayState(Date.now());
      const remaining = Math.max(
        0,
        settings.newPerDay - today.newCardsIntroduced
      );
      if (remaining === 0) {
        start([]);
        return;
      }
      const words = await db.words
        .where("hskLevel")
        .equals(1)
        .sortBy("frequency");
      const existing = new Set(
        (await db.srsCards.toArray()).map((c) => c.wordId)
      );
      const fresh = words
        .filter((w) => !existing.has(w.id))
        .slice(0, remaining);
      start(fresh);
    })();
    return () => clear();
  }, [settings, start, clear]);

  if (!settings) {
    return (
      <p className="text-center py-20 text-gray-400 font-bold uppercase tracking-wider text-sm">
        Loading…
      </p>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center animate-pop-in">
        <p className="text-6xl mb-4">🌿</p>
        <p className="text-2xl font-extrabold text-gray-800">
          Nothing new to learn right now.
        </p>
        <p className="mt-2 text-gray-500 font-semibold">
          Either your daily cap is reached or HSK 1 is exhausted.
        </p>
        <Link to="/" className={chunky("primary", "mt-8")}>
          ← Back to home
        </Link>
      </div>
    );
  }

  if (index >= queue.length) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center animate-pop-in">
        <p className="text-7xl mb-4">🎉</p>
        <p className="text-3xl sm:text-4xl font-extrabold text-green-600">
          All done!
        </p>
        <p className="mt-2 text-gray-500 font-semibold">
          {queue.length} new {queue.length === 1 ? "word" : "words"} added to
          your deck.
        </p>
        <Link to="/" className={chunky("primary", "mt-8 w-full")}>
          Back to home
        </Link>
      </div>
    );
  }

  const word = queue[index];

  async function handleCommitCurrent() {
    await introduceNewCard(word.id, settings!, Date.now());
    await incrementDailyNew(Date.now());
    commitCurrent();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-16">
      <header className="flex items-center gap-3 mb-10">
        <Link
          to="/"
          aria-label="Exit study"
          className="grid place-items-center h-10 w-10 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-2xl font-black"
        >
          ✕
        </Link>
        <div className="flex-1 h-4 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full bg-sky-500 border-b-[3px] border-sky-700 rounded-full transition-all duration-300"
            style={{ width: `${(index / queue.length) * 100}%` }}
          />
        </div>
        <span className="text-sm font-extrabold tabular-nums text-gray-500 min-w-[3ch] text-right">
          {index + 1}/{queue.length}
        </span>
      </header>

      {phase === "present" && (
        <div className="text-center animate-pop-in">
          <p className="text-xs font-extrabold uppercase tracking-widest text-sky-500">
            New word
          </p>
          <p className="mt-6 font-hanzi text-7xl sm:text-8xl font-black text-gray-800">
            {word.id}
          </p>
          <p className="mt-4 text-2xl font-extrabold text-gray-700">
            {word.pinyin}
          </p>
          <p className="mt-2 text-lg font-bold text-gray-500">{word.meaningEn}</p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <AudioButton
              audioFile={word.audioFile}
              fallbackText={word.id}
              label="Listen"
              variant="neutral"
            />
            <button onClick={nextPhase} className={chunky("primary")}>
              Show strokes →
            </button>
          </div>
        </div>
      )}

      {phase === "animate" && (
        <div className="text-center animate-pop-in">
          <p className="text-xs font-extrabold uppercase tracking-widest text-sky-500">
            Watch the stroke order
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            {word.characters.map((c, i) => (
              <StrokeAnimation key={`${word.id}:${i}`} character={c} />
            ))}
          </div>
          <button onClick={nextPhase} className={chunky("primary", "mt-8")}>
            Try it yourself →
          </button>
        </div>
      )}

      {phase === "attempt" && (
        <AttemptPhase key={word.id} word={word} onDone={handleCommitCurrent} />
      )}
    </div>
  );
}

function AttemptPhase({
  word,
  onDone,
}: {
  word: Word;
  onDone: () => void;
}) {
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (charIndex >= word.characters.length) {
      onDone();
    }
  }, [charIndex, word.characters.length, onDone]);

  if (charIndex >= word.characters.length) return null;

  return (
    <div className="text-center animate-pop-in">
      <p className="text-xs font-extrabold uppercase tracking-widest text-sky-500">
        Your turn · {charIndex + 1} / {word.characters.length}
      </p>
      <div className="mt-6">
        <DrawingCanvas
          key={`${word.id}:${charIndex}`}
          character={word.characters[charIndex]}
          onComplete={() => setCharIndex((i) => i + 1)}
        />
      </div>
    </div>
  );
}
